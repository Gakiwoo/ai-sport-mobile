globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const originalConsoleError = console.error;

console.error = (...args) => {
  const firstArg = String(args[0] ?? '');

  if (firstArg.includes('react-test-renderer is deprecated')) {
    return;
  }

  originalConsoleError(...args);
};

afterAll(() => {
  console.error = originalConsoleError;
});
