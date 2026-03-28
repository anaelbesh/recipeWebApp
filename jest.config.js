/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    // Load environment variables before tests run
    setupFilesAfterEnv: ['./jest.setup.js'],
    // This tells Jest to transform .ts files using ts-jest
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: 'tsconfig.test.json',
        }],
    },
    // Adjust this to match your folder structure exactly
    testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.spec.ts', '**/recipe_test.ts'],
    moduleFileExtensions: ['ts', 'js', 'json', 'node'],
    // Increase timeout for DB operations
    testTimeout: 30000,
    // Coverage configuration
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/server.ts',
        '!src/db.ts',
        '!src/index.ts',
        '!src/**/*.d.ts',
        '!src/config/**',
    ],
};