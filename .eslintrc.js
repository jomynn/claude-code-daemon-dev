module.exports = {
    env: {
        browser: true,
        commonjs: true,
        es2021: true,
        node: true,
        jest: true
    },
    extends: [
        'eslint:recommended'
    ],
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
    },
    rules: {
        // Error prevention
        'no-unused-vars': ['error', {
            'argsIgnorePattern': '^_',
            'varsIgnorePattern': '^_'
        }],
        'no-console': 'off', // Allow console in daemon/server applications
        'no-debugger': 'error',
        'no-unreachable': 'error',
        'no-duplicate-case': 'error',
        'no-empty': ['error', { 'allowEmptyCatch': true }],

        // Best practices
        'eqeqeq': ['error', 'always'],
        'curly': ['error', 'all'],
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-new-func': 'error',
        'no-return-assign': 'error',
        'no-self-compare': 'error',
        'no-throw-literal': 'error',
        'no-unused-expressions': 'error',
        'no-useless-call': 'error',
        'no-useless-return': 'error',
        'prefer-promise-reject-errors': 'error',

        // Style
        'indent': ['error', 4, {
            'SwitchCase': 1,
            'VariableDeclarator': 1,
            'outerIIFEBody': 1
        }],
        'linebreak-style': ['error', 'unix'],
        'quotes': ['error', 'single', { 'allowTemplateLiterals': true }],
        'semi': ['error', 'always'],
        'comma-dangle': ['error', 'never'],
        'no-trailing-spaces': 'error',
        'eol-last': 'error',
        'no-multiple-empty-lines': ['error', { 'max': 2, 'maxEOF': 1 }],

        // ES6+
        'arrow-spacing': 'error',
        'no-duplicate-imports': 'error',
        'no-var': 'error',
        'prefer-const': 'error',
        'prefer-arrow-callback': 'error',
        'prefer-template': 'error',

        // Node.js specific
        'no-process-exit': 'off', // Allow process.exit in CLI tools
        'no-sync': 'off', // Allow sync methods in scripts
        'global-require': 'off' // Allow require() inside functions for dynamic loading
    },
    overrides: [
        {
            // Relaxed rules for configuration files
            files: ['*.config.js', '.eslintrc.js', 'jest.config.js'],
            rules: {
                'no-undef': 'off'
            }
        },
        {
            // Relaxed rules for test files
            files: ['**/*.test.js', '**/*.spec.js', '**/tests/**/*.js'],
            env: {
                jest: true
            },
            rules: {
                'no-unused-expressions': 'off'
            }
        },
        {
            // Relaxed rules for migration and setup scripts
            files: ['scripts/**/*.js', 'tools/**/*.js'],
            rules: {
                'no-console': 'off',
                'no-process-exit': 'off'
            }
        },
        {
            // Browser-specific rules for web assets
            files: ['src/web/public/js/**/*.js'],
            env: {
                browser: true,
                node: false
            },
            globals: {
                'io': 'readonly',
                'Chart': 'readonly'
            }
        }
    ],
    ignorePatterns: [
        'node_modules/',
        'dist/',
        'build/',
        'coverage/',
        'logs/',
        'data/',
        'temp/',
        'backup/',
        '*.min.js'
    ]
};