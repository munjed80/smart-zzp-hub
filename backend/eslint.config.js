export default [
  {
    ignores: ['node_modules', '../frontend', '../db', '../storage'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    linterOptions: {
      reportUnusedDisableDirectives: true
    },
    rules: {},
    files: ['src/**/*.js', 'tests/**/*.js']
  }
];
