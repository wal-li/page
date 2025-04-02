/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node', // Use 'jsdom' if testing browser code
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
