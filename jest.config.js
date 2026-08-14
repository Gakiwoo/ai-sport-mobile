/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.jest.json',
      },
    ],
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    // 与 metro.config.js 的 alias 对齐：@ai-sport/core 直接指向共享包 TS 源码，
    // 避免 jest 解析到 dist 的 ESM（ts-jest 不转换 node_modules 中的 ESM）
    '^@ai-sport/core$': '<rootDir>/../packages/ai-sport-core/src/index.ts',
    '^@ai-sport/core/(.*)$': '<rootDir>/../packages/ai-sport-core/src/$1',
    '^react-native-svg$': '<rootDir>/src/__mocks__/react-native-svg.tsx',
    '^react-native$': '<rootDir>/src/__mocks__/react-native.tsx',
    '^@sentry/react-native$': '<rootDir>/src/__mocks__/sentry-react-native.ts',
    '^expo-file-system/legacy$': '<rootDir>/src/__mocks__/expo-file-system-legacy.ts',
    '^expo-sharing$': '<rootDir>/src/__mocks__/expo-sharing.ts',
    '^expo-localization$': '<rootDir>/src/__mocks__/expo-localization.ts',
    '\\.html$': '<rootDir>/src/mediapipe/__mocks__/htmlModule.js',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    '!src/__mocks__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'lcov'],
  // 仅对核心算法与工具层设门槛；screens 等 UI 纳入报告但不卡 CI
  coverageThreshold: {
    './src/services/counters/': {
      lines: 75,
      statements: 75,
      functions: 74,
      branches: 55,
    },
    './src/utils/': {
      lines: 80,
      statements: 80,
      functions: 80,
      branches: 70,
    },
    './src/mediapipe/': {
      lines: 90,
      statements: 90,
      functions: 90,
      branches: 80,
    },
  },
};
