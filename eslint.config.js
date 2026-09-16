export default [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly', document: 'readonly', console: 'readonly',
        process: 'readonly', Buffer: 'readonly', global: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly',
        URL: 'readonly', Blob: 'readonly', fetch: 'readonly',
        navigator: 'readonly', sessionStorage: 'readonly', localStorage: 'readonly',
        FormData: 'readonly', requestAnimationFrame: 'readonly',
        IntersectionObserver: 'readonly', alert: 'readonly', confirm: 'readonly',
        // Browser globals used by the js/ front-end bundle. no-undef stays an
        // error — these are declared because they genuinely exist at runtime,
        // not to silence the rule.
        location: 'readonly', URLSearchParams: 'readonly', EventSource: 'readonly',
        CustomEvent: 'readonly', Notification: 'readonly', atob: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-var': 'off',
      'prefer-const': 'off',
      eqeqeq: ['warn', 'smart'],
      'no-console': 'off',
    },
  },
  {
    ignores: ['node_modules/', 'dist/', 'data/', 'coverage/', 'sw.js'],
  },
];
