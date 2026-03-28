const base = require('./jest.config');

module.exports = {
  ...base,
  collectCoverageFrom: [
    'src/controllers/**/*.ts',
    'src/middleware/**/*.ts',
    '!src/controllers/common.ts',
  ],
};
