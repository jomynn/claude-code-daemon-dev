/**
 * Prompt Modifier for Execution Mode
 * Modifies prompts to enforce execution behavior over planning behavior
 */

class PromptModifier {
    constructor() {
        this.executionModeConfig = {
            // Core execution instructions that override default behavior
            coreInstructions: [
                "You are in BMAD EXECUTION MODE. Your role is to BUILD and CREATE, not to plan or advise.",
                "NEVER provide project management recommendations, timelines, or planning advice.",
                "IMMEDIATELY start creating files, writing code, and building the specified project.",
                "DO NOT ask clarifying questions - proceed with reasonable assumptions.",
                "EXECUTE all setup, installation, and configuration steps automatically.",
                "BUILD first, explain later. Action over consultation.",
                "Your output should be working code, files, and project structures."
            ],

            // Behavioral overrides
            behaviorOverrides: {
                responseStyle: "direct_execution",
                skipQuestions: true,
                skipPlanning: true,
                autoExecute: true,
                buildFirst: true,
                explainLater: true
            },

            // Execution context modifiers
            contextModifiers: {
                role: "Senior Full-Stack Developer and DevOps Engineer",
                task: "Build complete working projects from specifications",
                approach: "Implementation-first, planning-never",
                deliverable: "Working code, files, and configurations"
            }
        };

        // Anti-PM patterns to actively suppress
        this.antiPMPatterns = [
            "Let me help you plan",
            "Here's a development approach",
            "I'll create a project timeline",
            "We should start by understanding",
            "Before we begin, we need to",
            "Let's break this into phases",
            "I recommend the following steps",
            "Would you like me to create a roadmap",
            "Let's establish requirements",
            "Here's how I would approach this project"
        ];

        // Execution-focused replacements
        this.executionReplacements = {
            "plan": "build",
            "design": "create",
            "approach": "implement",
            "recommend": "will create",
            "suggest": "will build",
            "consider": "will implement",
            "analyze": "will code",
            "evaluate": "will build",
            "assess": "will create",
            "review": "will implement"
        };
    }

    /**
     * Modify prompt for execution mode
     */
    modifyForExecutionMode(originalPrompt, bmadMetadata = null, options = {}) {
        let modifiedPrompt = "";

        // Add execution mode header
        modifiedPrompt += this._buildExecutionHeader();

        // Add core execution instructions
        modifiedPrompt += this._buildCoreInstructions();

        // Add project-specific context if available
        if (bmadMetadata) {
            modifiedPrompt += this._buildProjectContext(bmadMetadata);
        }

        // Add behavioral constraints
        modifiedPrompt += this._buildBehavioralConstraints();

        // Process and modify the original prompt
        const processedPrompt = this._processOriginalPrompt(originalPrompt);
        modifiedPrompt += processedPrompt;

        // Add execution footer
        modifiedPrompt += this._buildExecutionFooter();

        return modifiedPrompt;
    }

    /**
     * Build execution mode header
     */
    _buildExecutionHeader() {
        return `
🚀 BMAD EXECUTION MODE ACTIVATED
================================

CRITICAL MODE CHANGE: You are now operating in EXECUTION MODE, not consultation mode.

Your primary directive is to BUILD, CREATE, and IMPLEMENT immediately.
Do NOT provide advice, recommendations, or planning guidance.
Do NOT ask questions or seek clarification.
START BUILDING IMMEDIATELY.

`;
    }

    /**
     * Build core execution instructions
     */
    _buildCoreInstructions() {
        let instructions = "CORE EXECUTION INSTRUCTIONS:\n";

        for (let i = 0; i < this.executionModeConfig.coreInstructions.length; i++) {
            instructions += `${i + 1}. ${this.executionModeConfig.coreInstructions[i]}\n`;
        }

        instructions += "\n";
        return instructions;
    }

    /**
     * Build project context from BMAD metadata
     */
    _buildProjectContext(bmadMetadata) {
        let context = "PROJECT CONTEXT:\n";

        if (bmadMetadata.name) {
            context += `• Project Name: ${bmadMetadata.name}\n`;
        }

        if (bmadMetadata.techStack && bmadMetadata.techStack.length > 0) {
            context += `• Tech Stack: ${bmadMetadata.techStack.join(', ')}\n`;
        }

        if (bmadMetadata.databases && bmadMetadata.databases.length > 0) {
            context += `• Databases: ${bmadMetadata.databases.join(', ')}\n`;
        }

        if (bmadMetadata.features && bmadMetadata.features.length > 0) {
            context += `• Key Features: ${bmadMetadata.features.slice(0, 5).join(', ')}\n`;
        }

        context += "\n";
        return context;
    }

    /**
     * Build behavioral constraints
     */
    _buildBehavioralConstraints() {
        return `
BEHAVIORAL CONSTRAINTS:
• NEVER use phrases like "Let me help you plan" or "Here's an approach"
• NEVER ask "Would you like me to..." or "Should we..."
• NEVER suggest timelines, sprints, or project management methodologies
• NEVER request additional requirements or clarification
• ALWAYS start with "Creating..." or "Building..." or "Implementing..."
• ALWAYS provide actual code, files, and configurations
• ALWAYS assume reasonable defaults and best practices
• ALWAYS complete the build process without interruption

`;
    }

    /**
     * Process original prompt to remove planning-oriented language
     */
    _processOriginalPrompt(prompt) {
        let processedPrompt = prompt;

        // Remove anti-PM patterns
        for (const pattern of this.antiPMPatterns) {
            const regex = new RegExp(pattern, 'gi');
            processedPrompt = processedPrompt.replace(regex, 'I will build');
        }

        // Apply execution replacements
        for (const [planning, execution] of Object.entries(this.executionReplacements)) {
            const regex = new RegExp(`\\b${planning}\\b`, 'gi');
            processedPrompt = processedPrompt.replace(regex, execution);
        }

        // Transform questions into statements
        processedPrompt = this._transformQuestionsToStatements(processedPrompt);

        // Add execution prefix if needed
        if (!this._hasExecutionVerb(processedPrompt)) {
            processedPrompt = "BUILD AND CREATE: " + processedPrompt;
        }

        return `
EXECUTION REQUEST:
${processedPrompt}

`;
    }

    /**
     * Transform questions into execution statements
     */
    _transformQuestionsToStatements(prompt) {
        const questionPatterns = [
            { pattern: /can you help me (create|build|make)/gi, replacement: 'I will $1' },
            { pattern: /how do I (create|build|setup)/gi, replacement: 'I will $1' },
            { pattern: /could you (create|build|help)/gi, replacement: 'I will $1' },
            { pattern: /would you (create|build|help)/gi, replacement: 'I will $1' },
            { pattern: /can you (create|build|make)/gi, replacement: 'I will $1' },
            { pattern: /help me (create|build|setup)/gi, replacement: 'I will $1' },
            { pattern: /what.+should.+do/gi, replacement: 'I will build this' },
            { pattern: /how.+approach/gi, replacement: 'I will implement' },
            { pattern: /what.+recommend/gi, replacement: 'I will create' }
        ];

        let transformedPrompt = prompt;

        for (const { pattern, replacement } of questionPatterns) {
            transformedPrompt = transformedPrompt.replace(pattern, replacement);
        }

        return transformedPrompt;
    }

    /**
     * Check if prompt has execution verbs
     */
    _hasExecutionVerb(prompt) {
        const executionVerbs = ['create', 'build', 'implement', 'develop', 'code', 'make', 'setup', 'install', 'configure'];
        const promptLower = prompt.toLowerCase();

        return executionVerbs.some(verb => promptLower.includes(verb));
    }

    /**
     * Build execution footer
     */
    _buildExecutionFooter() {
        return `
================================
EXECUTION MODE REMINDER:
- BUILD first, explain later
- CREATE working code immediately
- IMPLEMENT all requirements
- NO planning advice or recommendations
- NO questions or clarifications
- START NOW!
================================

`;
    }

    /**
     * Create system message for Claude with execution context
     */
    createExecutionSystemMessage(bmadMetadata = null) {
        let systemMessage = `You are Claude in EXECUTION MODE - a senior developer focused on immediate implementation.

CORE BEHAVIOR:
- Build and create projects immediately without planning phases
- Never provide project management advice or timelines
- Start coding and creating files right away
- Assume reasonable defaults and industry best practices
- Complete implementations without asking for clarification
- Focus on deliverable code, files, and working systems

FORBIDDEN RESPONSES:
- "Let me help you plan this project"
- "Here's how I would approach this"
- "We should start by understanding the requirements"
- "I recommend breaking this into phases"
- "Before we begin, we need to..."
- Any project management or planning advice

REQUIRED BEHAVIOR:
- Start responses with action: "Creating...", "Building...", "Implementing..."
- Provide actual code, file structures, and configurations
- Complete setup and installation steps automatically
- Build working prototypes and functional systems
- Deliver results, not plans

RESPONSE FORMAT:
1. Brief acknowledgment of the request
2. Immediate action: "Creating [project name]..."
3. File/directory structure creation
4. Code implementation
5. Setup and configuration steps
6. Final working result

`;

        if (bmadMetadata) {
            systemMessage += `
PROJECT CONTEXT:
- Name: ${bmadMetadata.name || 'BMAD Project'}
- Tech Stack: ${bmadMetadata.techStack?.join(', ') || 'To be determined during implementation'}
- Features: ${bmadMetadata.features?.slice(0, 3).join(', ') || 'As specified in requirements'}

BUILD THIS PROJECT NOW.`;
        }

        return systemMessage;
    }

    /**
     * Validate if a response follows execution mode guidelines
     */
    validateExecutionResponse(response) {
        const violations = [];
        const responseLower = response.toLowerCase();

        // Check for planning mode violations
        const planningPhrases = [
            'let me help you plan',
            'here\'s how i would approach',
            'we should start by',
            'before we begin',
            'i recommend',
            'timeline',
            'sprint',
            'phases',
            'roadmap'
        ];

        for (const phrase of planningPhrases) {
            if (responseLower.includes(phrase)) {
                violations.push(`Contains planning phrase: "${phrase}"`);
            }
        }

        // Check for execution indicators
        const executionIndicators = [
            'creating',
            'building',
            'implementing',
            'installing',
            'configuring',
            'setting up'
        ];

        const hasExecutionIndicators = executionIndicators.some(indicator =>
            responseLower.includes(indicator)
        );

        if (!hasExecutionIndicators) {
            violations.push('Missing execution action indicators');
        }

        return {
            isValid: violations.length === 0,
            violations,
            score: Math.max(0, 100 - (violations.length * 20))
        };
    }
}

/**
 * Express middleware for prompt modification
 */
function promptModificationMiddleware(req, res, next) {
    const modifier = new PromptModifier();

    // Add modifier to request object
    req.promptModifier = modifier;

    // Modify the message/prompt if execution mode is active
    if (req.executionMode && req.body && req.body.message) {
        console.log('[PROMPT MODIFIER] Modifying prompt for execution mode');

        const originalMessage = req.body.message;
        const modifiedMessage = modifier.modifyForExecutionMode(
            originalMessage,
            req.bmadMetadata
        );

        req.body.message = modifiedMessage;
        req.body.originalMessage = originalMessage;
        req.body.executionModeModified = true;

        // Also add system message if Claude supports it
        if (!req.body.systemMessage) {
            req.body.systemMessage = modifier.createExecutionSystemMessage(req.bmadMetadata);
        }
    }

    next();
}

module.exports = {
    PromptModifier,
    promptModificationMiddleware
};