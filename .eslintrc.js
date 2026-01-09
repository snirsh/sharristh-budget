module.exports = {
  root: true,
  extends: ['@sfam/config/eslint'],
  parserOptions: {
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: [
    'node_modules',
    'dist',
    '.next',
    '.expo',
    '*.config.js',
    '*.config.mjs',
    'scripts/*.mjs',
  ],
};
