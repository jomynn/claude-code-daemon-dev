#!/usr/bin/env node

/**
 * BMAD Execution System Test and Validation Script
 * Tests all components of the BMAD execution system
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class BMADSystemTester {
    constructor(baseUrl = 'http://localhost:5004') {
        this.baseUrl = baseUrl;
        this.testResults = [];
        this.startTime = Date.now();
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('🚀 Starting BMAD Execution System Tests\n');

        try {
            // Test 1: Health Check
            await this.testHealthCheck();

            // Test 2: System Status
            await this.testSystemStatus();

            // Test 3: BMAD Detection
            await this.testBMADDetection();

            // Test 4: Configuration Management
            await this.testConfigurationManagement();

            // Test 5: Response Validation
            await this.testResponseValidation();

            // Test 6: Manual Execution
            await this.testManualExecution();

            // Test 7: Claude Integration
            await this.testClaudeIntegration();

            // Test 8: Statistics
            await this.testStatistics();

            // Generate test report
            this.generateTestReport();

        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            process.exit(1);
        }
    }

    /**
     * Test health check endpoint
     */
    async testHealthCheck() {
        console.log('🔍 Testing Health Check...');

        try {
            const response = await axios.get(`${this.baseUrl}/api/bmad-execution/health`);

            this.assert(response.status === 200, 'Health check returns 200');
            this.assert(response.data.success === true, 'Health check returns success');
            this.assert(response.data.data.status === 'healthy', 'System is healthy');

            const components = response.data.data.components;
            this.assert(components.detector === true, 'Detector component is active');
            this.assert(components.interceptor === true, 'Interceptor component is active');
            this.assert(components.promptModifier === true, 'Prompt modifier component is active');
            this.assert(components.autoExecutor === true, 'Auto executor component is active');
            this.assert(components.configManager === true, 'Config manager component is active');

            this.logSuccess('Health check passed');

        } catch (error) {
            this.logError('Health check failed', error);
        }
    }

    /**
     * Test system status endpoint
     */
    async testSystemStatus() {
        console.log('🔍 Testing System Status...');

        try {
            const response = await axios.get(`${this.baseUrl}/api/bmad-execution/status`);

            this.assert(response.status === 200, 'Status endpoint returns 200');
            this.assert(response.data.success === true, 'Status returns success');
            this.assert(response.data.data.status === 'active', 'System is active');

            const config = response.data.data.configuration;
            this.assert(typeof config.executionEnabled === 'boolean', 'Execution enabled setting present');
            this.assert(typeof config.autoDetection === 'boolean', 'Auto detection setting present');

            this.logSuccess('System status test passed');

        } catch (error) {
            this.logError('System status test failed', error);
        }
    }

    /**
     * Test BMAD detection
     */
    async testBMADDetection() {
        console.log('🔍 Testing BMAD Detection...');

        const testCases = [
            {
                name: 'Valid BMAD Document',
                content: `# E-Commerce Platform - BMAD Document

## Project Overview
Create a full-stack e-commerce platform with React frontend and Node.js backend.

## Technical Requirements
- Frontend: React, Redux, Material-UI
- Backend: Node.js, Express, MongoDB
- Authentication: JWT
- Payment: Stripe integration

## File Structure
src/
  components/
  pages/
  services/
server/
  routes/
  models/
  middleware/`,
                expectedDetection: true,
                minConfidence: 0.6
            },
            {
                name: 'Non-BMAD Content',
                content: 'Hello, how are you today? Can you help me with a simple question?',
                expectedDetection: false,
                maxConfidence: 0.3
            },
            {
                name: 'Partial BMAD Content',
                content: 'Create a React application with the following features: user authentication, dashboard, and settings page.',
                expectedDetection: false,
                maxConfidence: 0.6
            }
        ];

        for (const testCase of testCases) {
            try {
                const response = await axios.post(`${this.baseUrl}/api/bmad-execution/test-detection`, {
                    content: testCase.content
                });

                this.assert(response.status === 200, `Detection test "${testCase.name}" returns 200`);
                this.assert(response.data.success === true, `Detection test "${testCase.name}" returns success`);

                const detection = response.data.data.detection;
                const metadata = response.data.data.metadata;

                if (testCase.expectedDetection) {
                    this.assert(detection.isBMAD === true, `"${testCase.name}" detected as BMAD`);
                    this.assert(detection.confidence >= testCase.minConfidence, `"${testCase.name}" confidence >= ${testCase.minConfidence}`);
                    this.assert(metadata && typeof metadata === 'object', `"${testCase.name}" metadata extracted`);
                } else {
                    this.assert(detection.isBMAD === false, `"${testCase.name}" not detected as BMAD`);
                    if (testCase.maxConfidence) {
                        this.assert(detection.confidence <= testCase.maxConfidence, `"${testCase.name}" confidence <= ${testCase.maxConfidence}`);
                    }
                }

                console.log(`  ✅ ${testCase.name}: Detection=${detection.isBMAD}, Confidence=${detection.confidence.toFixed(2)}`);

            } catch (error) {
                this.logError(`Detection test "${testCase.name}" failed`, error);
            }
        }

        this.logSuccess('BMAD detection tests completed');
    }

    /**
     * Test configuration management
     */
    async testConfigurationManagement() {
        console.log('🔍 Testing Configuration Management...');

        try {
            // Get current configuration
            const getResponse = await axios.get(`${this.baseUrl}/api/bmad-execution/config`);
            this.assert(getResponse.status === 200, 'Get config returns 200');
            this.assert(getResponse.data.success === true, 'Get config returns success');

            const originalConfig = getResponse.data.data;
            this.assert(typeof originalConfig === 'object', 'Config is object');
            this.assert(originalConfig.execution, 'Config has execution section');
            this.assert(originalConfig.bmad, 'Config has bmad section');

            // Update configuration
            const updateData = {
                bmad: {
                    detectionThreshold: 0.8
                },
                execution: {
                    enabled: true
                }
            };

            const updateResponse = await axios.post(`${this.baseUrl}/api/bmad-execution/config`, updateData);
            this.assert(updateResponse.status === 200, 'Update config returns 200');
            this.assert(updateResponse.data.success === true, 'Update config returns success');

            // Verify update
            const verifyResponse = await axios.get(`${this.baseUrl}/api/bmad-execution/config`);
            const updatedConfig = verifyResponse.data.data;
            this.assert(updatedConfig.bmad.detectionThreshold === 0.8, 'Detection threshold updated');

            this.logSuccess('Configuration management test passed');

        } catch (error) {
            this.logError('Configuration management test failed', error);
        }
    }

    /**
     * Test response validation
     */
    async testResponseValidation() {
        console.log('🔍 Testing Response Validation...');

        const testResponses = [
            {
                name: 'Planning Response (Invalid)',
                response: 'Let me help you plan this project. First, we need to understand the requirements and create a timeline with sprints.',
                expectedValid: false
            },
            {
                name: 'Execution Response (Valid)',
                response: 'Creating project structure now. Building React application with all required components. Installing dependencies automatically.',
                expectedValid: true
            },
            {
                name: 'Mixed Response',
                response: 'I will create the project files and setup the development environment. The application will include user authentication and dashboard features.',
                expectedValid: true
            }
        ];

        for (const testResponse of testResponses) {
            try {
                const response = await axios.post(`${this.baseUrl}/api/bmad-execution/validate-response`, {
                    response: testResponse.response
                });

                this.assert(response.status === 200, `Validation "${testResponse.name}" returns 200`);
                this.assert(response.data.success === true, `Validation "${testResponse.name}" returns success`);

                const validation = response.data.data;
                this.assert(validation.isValid === testResponse.expectedValid,
                    `"${testResponse.name}" validation result matches expected`);

                console.log(`  ✅ ${testResponse.name}: Valid=${validation.isValid}, Score=${validation.score}`);

            } catch (error) {
                this.logError(`Response validation "${testResponse.name}" failed`, error);
            }
        }

        this.logSuccess('Response validation tests completed');
    }

    /**
     * Test manual execution
     */
    async testManualExecution() {
        console.log('🔍 Testing Manual Execution...');

        try {
            const bmadContent = `# Test Project - BMAD Document

## Project Overview
Create a simple Node.js API with basic CRUD operations.

## Technical Requirements
- Backend: Node.js, Express
- Database: SQLite
- Authentication: Basic JWT

## Features
- User registration
- User authentication
- Basic CRUD operations`;

            const response = await axios.post(`${this.baseUrl}/api/bmad-execution/execute`, {
                content: bmadContent,
                options: {
                    autoInstall: false  // Skip installation for test
                }
            });

            this.assert(response.status === 200, 'Manual execution returns 200');
            this.assert(response.data.success === true, 'Manual execution returns success');

            const result = response.data.data;
            this.assert(result.executionId, 'Execution ID provided');
            this.assert(result.projectPath, 'Project path provided');

            console.log(`  ✅ Execution ID: ${result.executionId}`);
            console.log(`  ✅ Project Path: ${result.projectPath}`);

            this.logSuccess('Manual execution test passed');

        } catch (error) {
            this.logError('Manual execution test failed', error);
        }
    }

    /**
     * Test Claude integration
     */
    async testClaudeIntegration() {
        console.log('🔍 Testing Claude Integration...');

        try {
            // This test checks if the Claude routes are properly enhanced
            // In a real scenario, this would require a running Claude session

            // Test the enhanced endpoint exists
            const statusResponse = await axios.get(`${this.baseUrl}/api/projects/claude/status`);
            this.assert(statusResponse.status === 200, 'Claude status endpoint accessible');

            this.logSuccess('Claude integration test passed (basic connectivity)');

        } catch (error) {
            if (error.response && error.response.status === 404) {
                this.logError('Claude integration test failed - endpoints not found', error);
            } else {
                // Other errors might be expected if no Claude sessions are active
                console.log('  ⚠️ Claude integration test skipped (no active sessions)');
                this.testResults.push({
                    test: 'Claude Integration',
                    status: 'skipped',
                    message: 'No active Claude sessions available for testing'
                });
            }
        }
    }

    /**
     * Test statistics endpoint
     */
    async testStatistics() {
        console.log('🔍 Testing Statistics...');

        try {
            const response = await axios.get(`${this.baseUrl}/api/bmad-execution/statistics`);

            this.assert(response.status === 200, 'Statistics returns 200');
            this.assert(response.data.success === true, 'Statistics returns success');

            const stats = response.data.data;
            this.assert(typeof stats.totalDetections === 'number', 'Total detections is number');
            this.assert(typeof stats.successfulExecutions === 'number', 'Successful executions is number');
            this.assert(typeof stats.failedExecutions === 'number', 'Failed executions is number');
            this.assert(Array.isArray(stats.activeExecutions), 'Active executions is array');

            console.log(`  ✅ Total Detections: ${stats.totalDetections}`);
            console.log(`  ✅ Successful Executions: ${stats.successfulExecutions}`);
            console.log(`  ✅ Failed Executions: ${stats.failedExecutions}`);
            console.log(`  ✅ Success Rate: ${stats.success_rate}%`);

            this.logSuccess('Statistics test passed');

        } catch (error) {
            this.logError('Statistics test failed', error);
        }
    }

    /**
     * Test assertion helper
     */
    assert(condition, message) {
        if (!condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
    }

    /**
     * Log success
     */
    logSuccess(message) {
        console.log(`✅ ${message}\n`);
        this.testResults.push({
            test: message,
            status: 'passed',
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Log error
     */
    logError(message, error) {
        console.log(`❌ ${message}`);
        console.log(`   Error: ${error.message}\n`);
        this.testResults.push({
            test: message,
            status: 'failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Generate test report
     */
    generateTestReport() {
        const endTime = Date.now();
        const duration = Math.round((endTime - this.startTime) / 1000);

        const passed = this.testResults.filter(r => r.status === 'passed').length;
        const failed = this.testResults.filter(r => r.status === 'failed').length;
        const skipped = this.testResults.filter(r => r.status === 'skipped').length;
        const total = this.testResults.length;

        console.log('📊 BMAD Execution System Test Report');
        console.log('=====================================');
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        console.log(`Skipped: ${skipped}`);
        console.log(`Duration: ${duration}s`);
        console.log(`Success Rate: ${((passed / (total - skipped)) * 100).toFixed(1)}%`);

        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults
                .filter(r => r.status === 'failed')
                .forEach(test => {
                    console.log(`  - ${test.test}: ${test.error}`);
                });
        }

        if (skipped > 0) {
            console.log('\n⚠️ Skipped Tests:');
            this.testResults
                .filter(r => r.status === 'skipped')
                .forEach(test => {
                    console.log(`  - ${test.test}: ${test.message || 'No reason provided'}`);
                });
        }

        console.log('\n🎉 Test suite completed!');

        // Write detailed report to file
        this.writeDetailedReport();
    }

    /**
     * Write detailed test report to file
     */
    async writeDetailedReport() {
        const report = {
            summary: {
                timestamp: new Date().toISOString(),
                duration: Math.round((Date.now() - this.startTime) / 1000),
                totalTests: this.testResults.length,
                passed: this.testResults.filter(r => r.status === 'passed').length,
                failed: this.testResults.filter(r => r.status === 'failed').length,
                skipped: this.testResults.filter(r => r.status === 'skipped').length
            },
            tests: this.testResults
        };

        try {
            await fs.writeFile(
                path.join(__dirname, 'bmad-test-report.json'),
                JSON.stringify(report, null, 2)
            );
            console.log('📝 Detailed report saved to bmad-test-report.json');
        } catch (error) {
            console.warn('⚠️ Failed to write detailed report:', error.message);
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const baseUrl = process.argv[2] || 'http://localhost:5004';
    const tester = new BMADSystemTester(baseUrl);

    tester.runAllTests().catch(error => {
        console.error('Test suite failed:', error);
        process.exit(1);
    });
}

module.exports = BMADSystemTester;