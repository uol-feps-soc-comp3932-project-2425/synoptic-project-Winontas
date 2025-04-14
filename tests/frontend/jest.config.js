module.exports = {
    setupFiles: ['<rootDir>/setup.js'], // Run before module imports
    testEnvironment: 'jsdom',
    moduleFileExtensions: ['js'],
    transform: {
        '^.+\\.js$': 'babel-jest'
    }
};