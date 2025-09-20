/**
 * Claude Code API Routes
 * Handles Claude Code session management and command execution
 */

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

// In-memory session storage (in production, use Redis or database)
const claudeSessions = new Map();

/**
 * Start Claude Code session for a project
 */
router.post('/projects/:projectId/start-claude', async (req, res) => {
    const { projectId } = req.params;

    try {
        // Check if session already exists
        if (claudeSessions.has(projectId)) {
            return res.json({
                success: true,
                message: 'Claude session already running',
                sessionId: claudeSessions.get(projectId).sessionId
            });
        }

        // Get project data from internal API
        const http = require('http');
        const port = process.env.PORT || 5004;
        const projectData = await new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: port,
                path: `/api/projects/${projectId}`,
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            };

            const httpReq = http.request(options, (httpRes) => {
                let data = '';
                httpRes.on('data', chunk => data += chunk);
                httpRes.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            httpReq.on('error', reject);
            httpReq.end();
        }).catch(() => null);

        if (!projectData || !projectData.success) {
            return res.status(404).json({
                success: false,
                error: 'Project not found or not accessible'
            });
        }

        const project = projectData.data;
        const projectPath = project.targetFolder;

        // Verify project exists
        try {
            await fs.access(projectPath);
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: 'Project folder not found: ' + projectPath
            });
        }

        // Generate session ID
        const sessionId = `claude-${projectId}-${Date.now()}`;

        // Prepare Claude Code command with BMAD integration
        const claudeArgs = ['@anthropic-ai/claude-code', '--directory', projectPath];

        // Add BMAD context if enabled
        if (project.bmadConfig && project.bmadConfig.enabled) {
            const bmadContext = `BMAD Project Context:
- Workflow: ${project.bmadConfig.workflow || 'standard'}
- Agents: ${project.bmadConfig.agents ? project.bmadConfig.agents.join(', ') : 'dev, qa, pm'}
- Status: ${project.bmadConfig.status || 'active'}
- Current Phase: ${project.bmadConfig.currentPhase || 'development'}

This is a BMAD-managed project. Consider multi-agent collaboration and workflow requirements.`;

            // Set context as environment variable for Claude
            process.env.CLAUDE_CONTEXT = bmadContext;
        }

        // Start Claude Code process
        const claudeProcess = spawn('npx', claudeArgs, {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: projectPath,
            env: {
                ...process.env,
                PATH: process.env.PATH,
                ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
            }
        });

        // Store session info
        const sessionInfo = {
            sessionId,
            projectId,
            projectPath,
            project: project,
            bmadEnabled: project.bmadConfig && project.bmadConfig.enabled,
            bmadConfig: project.bmadConfig,
            process: claudeProcess,
            status: 'starting',
            startTime: new Date(),
            messages: []
        };

        claudeSessions.set(projectId, sessionInfo);

        // Handle process events
        claudeProcess.on('spawn', () => {
            sessionInfo.status = 'running';
            req.logger?.info(`Claude session started for project ${projectId}`);
        });

        claudeProcess.on('error', (error) => {
            sessionInfo.status = 'error';
            sessionInfo.error = error.message;
            req.logger?.error(`Claude session error for project ${projectId}:`, error);
        });

        claudeProcess.on('exit', (code) => {
            sessionInfo.status = 'stopped';
            sessionInfo.exitCode = code;
            claudeSessions.delete(projectId);
            req.logger?.info(`Claude session ended for project ${projectId} with code ${code}`);
        });

        // Set up output handling
        let outputBuffer = '';
        claudeProcess.stdout.on('data', (data) => {
            outputBuffer += data.toString();
            sessionInfo.messages.push({
                type: 'output',
                content: data.toString(),
                timestamp: new Date()
            });
        });

        claudeProcess.stderr.on('data', (data) => {
            sessionInfo.messages.push({
                type: 'error',
                content: data.toString(),
                timestamp: new Date()
            });
        });

        res.json({
            success: true,
            message: 'Claude session starting',
            sessionId,
            projectPath
        });

    } catch (error) {
        req.logger?.error('Error starting Claude session:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to start Claude session'
        });
    }
});

/**
 * Stop Claude Code session
 */
router.post('/projects/:projectId/claude/stop', async (req, res) => {
    const { projectId } = req.params;

    try {
        const session = claudeSessions.get(projectId);

        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'No Claude session found for this project'
            });
        }

        // Kill the process
        if (session.process && !session.process.killed) {
            session.process.kill('SIGTERM');

            // Force kill after 5 seconds if needed
            setTimeout(() => {
                if (!session.process.killed) {
                    session.process.kill('SIGKILL');
                }
            }, 5000);
        }

        // Clean up session
        claudeSessions.delete(projectId);

        res.json({
            success: true,
            message: 'Claude session stopped'
        });

    } catch (error) {
        req.logger?.error('Error stopping Claude session:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to stop Claude session'
        });
    }
});

/**
 * Send command to Claude Code session
 */
router.post('/projects/:projectId/claude/command', async (req, res) => {
    const { projectId } = req.params;
    const { message, sessionId } = req.body;

    try {
        const session = claudeSessions.get(projectId);

        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'No Claude session found for this project'
            });
        }

        if (session.status !== 'running') {
            return res.status(400).json({
                success: false,
                error: `Claude session is ${session.status}`
            });
        }

        // Enhance message with BMAD context if enabled
        let enhancedMessage = message;
        if (session.bmadEnabled && session.bmadConfig) {
            enhancedMessage = `[BMAD Context: ${session.bmadConfig.workflow} workflow with agents: ${session.bmadConfig.agents?.join(', ') || 'dev, qa, pm'}]\n\n${message}`;
        }

        // Send message to Claude process
        session.process.stdin.write(enhancedMessage + '\n');

        // Log the command
        session.messages.push({
            type: 'input',
            content: message,
            enhancedContent: enhancedMessage,
            timestamp: new Date(),
            bmadContext: session.bmadEnabled
        });

        // Wait for response with improved handling
        let responseTimeout;
        let response = '';
        let responseStarted = false;

        const responsePromise = new Promise((resolve, reject) => {
            responseTimeout = setTimeout(() => {
                reject(new Error('Command timeout'));
            }, 30000); // 30 second timeout

            const onData = (data) => {
                const chunk = data.toString();
                response += chunk;

                if (!responseStarted && chunk.trim()) {
                    responseStarted = true;
                }

                // Better completion detection
                if (responseStarted && (
                    chunk.includes('How can I help you?') ||
                    chunk.includes('claude>') ||
                    chunk.includes('$ ') ||
                    chunk.includes('> ') ||
                    (response.length > 50 && chunk.includes('\n\n'))
                )) {
                    clearTimeout(responseTimeout);
                    session.process.stdout.removeListener('data', onData);
                    resolve(response);
                }
            };

            session.process.stdout.on('data', onData);

            // Also listen for stderr to catch errors
            session.process.stderr.on('data', (data) => {
                const errorText = data.toString();
                if (errorText.includes('Error') || errorText.includes('error')) {
                    clearTimeout(responseTimeout);
                    session.process.stdout.removeListener('data', onData);
                    resolve(response + '\n[Error]: ' + errorText);
                }
            });
        });

        try {
            const claudeResponse = await responsePromise;

            res.json({
                success: true,
                response: claudeResponse.trim(),
                sessionId: session.sessionId
            });

        } catch (error) {
            clearTimeout(responseTimeout);

            if (error.message === 'Command timeout') {
                res.json({
                    success: true,
                    response: 'Command sent successfully. Claude may be processing or encountered an issue.',
                    sessionId: session.sessionId,
                    timeout: true
                });
            } else {
                throw error;
            }
        }

    } catch (error) {
        req.logger?.error('Error sending command to Claude:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send command to Claude'
        });
    }
});

/**
 * Get Claude Code session status
 */
router.get('/projects/claude/status', (req, res) => {
    try {
        const activeSessions = [];

        for (const [projectId, session] of claudeSessions.entries()) {
            activeSessions.push({
                projectId,
                sessionId: session.sessionId,
                status: session.status,
                startTime: session.startTime,
                messageCount: session.messages.length
            });
        }

        res.json({
            success: true,
            data: {
                activeSessions,
                totalSessions: activeSessions.length
            }
        });

    } catch (error) {
        req.logger?.error('Error getting Claude status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get Claude status'
        });
    }
});

/**
 * Get session messages/logs
 */
router.get('/projects/:projectId/claude/messages', (req, res) => {
    const { projectId } = req.params;
    const { limit = 50 } = req.query;

    try {
        const session = claudeSessions.get(projectId);

        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'No Claude session found for this project'
            });
        }

        const messages = session.messages.slice(-parseInt(limit));

        res.json({
            success: true,
            messages,
            sessionId: session.sessionId,
            status: session.status
        });

    } catch (error) {
        req.logger?.error('Error getting Claude messages:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get Claude messages'
        });
    }
});

module.exports = router;