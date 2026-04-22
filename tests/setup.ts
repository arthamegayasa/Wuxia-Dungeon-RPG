import '@testing-library/jest-dom/vitest';

// Wipe browser storage between tests.
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
