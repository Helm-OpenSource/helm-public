// Vitest shim for Next.js's `server-only` package. The real package throws
// when imported in a client bundle; under vitest (node env), the module
// is a no-op so server-only modules can be imported by tests.
export {};
