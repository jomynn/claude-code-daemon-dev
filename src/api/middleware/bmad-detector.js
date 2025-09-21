/**
 * BMAD Document Detection Middleware
 * Detects when BMAD content is pasted and triggers immediate execution mode
 */

const fs = require('fs').promises;
const path = require('path');

class BMADDetector {
    constructor() {
        this.bmadPatterns = [
            // BMAD document headers
            /^#\s*BMAD[\s-]*(Document|Specification|Project)/i,
            /^#{1,3}\s*Business[\s-]*Method[\s-]*and[\s-]*Design/i,

            // BMAD structure patterns
            /^##?\s*(Project[\s-]*Overview|Business[\s-]*Context)/i,
            /^##?\s*(Technical[\s-]*Requirements|Architecture[\s-]*Specification)/i,
            /^##?\s*(Development[\s-]*Tasks|Implementation[\s-]*Plan)/i,
            /^##?\s*(Database[\s-]*Schema|API[\s-]*Endpoints)/i,
            /^##?\s*(File[\s-]*Structure|Directory[\s-]*Layout)/i,

            // BMAD content indicators
            /(?:create|build|implement|setup).*(?:project|application|system)/i,
            /(?:database|schema|tables?).*(?:create|design|setup)/i,
            /(?:api|endpoints?).*(?:create|implement|build)/i,
            /(?:frontend|ui|interface).*(?:create|build|implement)/i,
            /(?:backend|server).*(?:create|setup|implement)/i,

            // Technology stack indicators
            /tech[\s-]*stack|technology[\s-]*stack/i,
            /(?:react|vue|angular|node|express|django|flask|spring)/i,
            /(?:mysql|postgresql|mongodb|sqlite|redis)/i,

            // File/folder creation patterns
            /create.*(?:folder|directory|file)s?.*:/i,
            /file[\s-]*structure:|directory[\s-]*structure:/i,
            /```(?:bash|shell|terminal)/m,

            // Dependencies and setup
            /install.*dependencies/i,
            /npm[\s-]*install|yarn[\s-]*install|pip[\s-]*install/i,
            /package\.json|requirements\.txt|composer\.json/i
        ];

        this.executionTriggers = [
            'create the project',
            'build the application',
            'implement the system',
            'setup the database',
            'create all files',
            'build this project',
            'implement this',
            'create this application'
        ];

        this.pmPatternBlacklist = [
            /sprint|iteration|scrum|agile/i,
            /timeline|schedule|milestone/i,
            /planning|roadmap|backlog/i,
            /story[\s-]*points?|velocity/i,
            /project[\s-]*manager?|pm[\s-]*role/i,
            /budget|cost|estimate/i,
            /stakeholder|client|customer/i
        ];
    }

    /**
     * Detect if content contains BMAD document patterns
     */
    detectBMAD(content) {
        if (!content || typeof content !== 'string') {
            return { isBMAD: false, confidence: 0 };
        }

        const lines = content.split('\n');
        let score = 0;
        let matches = [];
        let executionIndicators = 0;
        let pmIndicators = 0;

        // Check for BMAD patterns
        for (const line of lines) {
            for (const pattern of this.bmadPatterns) {
                if (pattern.test(line)) {
                    score += this._getPatternWeight(pattern);
                    matches.push({
                        pattern: pattern.toString(),
                        line: line.trim(),
                        weight: this._getPatternWeight(pattern)
                    });
                }
            }

            // Check for execution triggers
            for (const trigger of this.executionTriggers) {
                if (line.toLowerCase().includes(trigger.toLowerCase())) {
                    executionIndicators++;
                    score += 15;
                }
            }

            // Check for PM pattern blacklist
            for (const pmPattern of this.pmPatternBlacklist) {
                if (pmPattern.test(line)) {
                    pmIndicators++;
                    score -= 5; // Reduce score for PM-style content
                }
            }
        }

        // Additional scoring based on content structure
        if (this._hasCodeBlocks(content)) score += 10;
        if (this._hasTechnicalSpecs(content)) score += 15;
        if (this._hasFileStructure(content)) score += 20;
        if (this._hasSetupInstructions(content)) score += 15;

        const confidence = Math.min(Math.max(score / 50, 0), 1); // Normalize to 0-1
        const isBMAD = confidence > 0.6; // Threshold for BMAD detection

        return {
            isBMAD,
            confidence,
            score,
            matches,
            executionIndicators,
            pmIndicators,
            metadata: {
                hasCodeBlocks: this._hasCodeBlocks(content),
                hasTechnicalSpecs: this._hasTechnicalSpecs(content),
                hasFileStructure: this._hasFileStructure(content),
                hasSetupInstructions: this._hasSetupInstructions(content),
                contentLength: content.length,
                lineCount: lines.length
            }
        };
    }

    /**
     * Extract project metadata from BMAD content
     */
    extractProjectMetadata(content) {
        const metadata = {
            name: null,
            description: null,
            techStack: [],
            databases: [],
            features: [],
            fileStructure: [],
            dependencies: [],
            setupSteps: []
        };

        const lines = content.split('\n');

        for (const line of lines) {
            // Extract project name
            const nameMatch = line.match(/^#\s*(.+?)(?:\s*-\s*BMAD|$)/i);
            if (nameMatch && !metadata.name) {
                metadata.name = nameMatch[1].trim();
            }

            // Extract tech stack
            if (/tech[\s-]*stack|technologies?/i.test(line)) {
                const techMatches = line.match(/(react|vue|angular|node|express|django|flask|spring|mysql|postgresql|mongodb|sqlite|redis|docker|kubernetes)/gi);
                if (techMatches) {
                    metadata.techStack.push(...techMatches);
                }
            }

            // Extract databases
            const dbMatch = line.match(/(mysql|postgresql|mongodb|sqlite|redis|dynamodb|firebase)/gi);
            if (dbMatch) {
                metadata.databases.push(...dbMatch);
            }

            // Extract features from bullet points
            if (/^[\s]*[-*+]\s*(.+)/i.test(line)) {
                const featureMatch = line.match(/^[\s]*[-*+]\s*(.+)/i);
                if (featureMatch) {
                    metadata.features.push(featureMatch[1].trim());
                }
            }
        }

        // Extract file structure
        const fileStructureMatch = content.match(/```(?:bash|shell|terminal|text)?\n([\s\S]*?)```/gm);
        if (fileStructureMatch) {
            metadata.fileStructure = fileStructureMatch;
        }

        // Remove duplicates
        metadata.techStack = [...new Set(metadata.techStack)];
        metadata.databases = [...new Set(metadata.databases)];

        return metadata;
    }

    /**
     * Get pattern weight for scoring
     */
    _getPatternWeight(pattern) {
        const patternStr = pattern.toString();
        if (patternStr.includes('BMAD')) return 25;
        if (patternStr.includes('Business.*Method.*Design')) return 20;
        if (patternStr.includes('Technical.*Requirements')) return 15;
        if (patternStr.includes('create|build|implement')) return 10;
        return 5;
    }

    /**
     * Check if content has code blocks
     */
    _hasCodeBlocks(content) {
        return /```[\s\S]*?```/.test(content);
    }

    /**
     * Check if content has technical specifications
     */
    _hasTechnicalSpecs(content) {
        return /(?:api|database|schema|endpoint|route|component|service|model|controller)/i.test(content);
    }

    /**
     * Check if content has file structure
     */
    _hasFileStructure(content) {
        return /(?:folder|directory|file).*structure|src\/|public\/|\.js|\.py|\.html|package\.json/i.test(content);
    }

    /**
     * Check if content has setup instructions
     */
    _hasSetupInstructions(content) {
        return /(?:npm|yarn|pip|composer).*install|clone.*repo|setup|installation|getting.*started/i.test(content);
    }
}

/**
 * Express middleware for BMAD detection
 */
function bmadDetectionMiddleware(req, res, next) {
    const detector = new BMADDetector();

    // Add detector to request object
    req.bmadDetector = detector;

    // Intercept request body to check for BMAD content
    if (req.body && typeof req.body === 'object') {
        let contentToCheck = '';

        // Check common content fields
        if (req.body.message) contentToCheck = req.body.message;
        else if (req.body.content) contentToCheck = req.body.content;
        else if (req.body.text) contentToCheck = req.body.text;
        else if (req.body.description) contentToCheck = req.body.description;

        if (contentToCheck) {
            const detection = detector.detectBMAD(contentToCheck);

            // Add detection results to request
            req.bmadDetection = detection;

            // If BMAD detected, set execution mode flag
            if (detection.isBMAD) {
                req.executionMode = true;
                req.bmadMetadata = detector.extractProjectMetadata(contentToCheck);

                // Log detection
                console.log('[BMAD DETECTOR] BMAD content detected:', {
                    confidence: detection.confidence,
                    score: detection.score,
                    executionMode: true,
                    projectName: req.bmadMetadata.name
                });
            }
        }
    }

    next();
}

module.exports = {
    BMADDetector,
    bmadDetectionMiddleware
};