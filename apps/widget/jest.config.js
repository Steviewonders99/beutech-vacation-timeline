// eslint-disable-next-line no-undef
module.exports = {
  setupFilesAfterEnv: ["./test/jest-setup.ts"],
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "\\.svg": "<rootDir>/__mocks__/svg.js",
    "\\.css$": "<rootDir>/__mocks__/styleMock.js",
    "^nanoid(/(.*)|$)": "nanoid$1",
  },
  transformIgnorePatterns: ["\\/node_modules\\/(?!(nanoid))\\/"],
  testMatch: [
    "**/__tests__/**/*.test.[jt]s?(x)",
    "**/*.test.[jt]s?(x)",
  ],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/index.tsx",
    "!src/dev.ts",
  ],
  coverageReporters: ["text", "lcov", "html", "text-summary"],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },
};
