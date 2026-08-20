module.exports = {
  rootDir: ".",
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  setupFiles: ["<rootDir>/tests/setupEnv.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  clearMocks: true,
  testTimeout: 20000,
  verbose: true,
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
  },
};