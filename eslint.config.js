import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },

  js.configs.recommended,

  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.browser,
    },
    rules: {
      // The package promises zero network calls. These make a regression a lint
      // error rather than something a reviewer has to notice.
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message: 'This package makes no network calls — that belongs in onSendMessage.',
        },
        { name: 'XMLHttpRequest', message: 'This package makes no network calls.' },
        { name: 'WebSocket', message: 'This package makes no network calls.' },
      ],
      // innerHTML is the one thing that could turn consumer text into markup.
      // createStyleTag uses textContent, which is not HTML parsing.
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Build nodes with createElement/textContent instead.' },
        { property: 'outerHTML', message: 'Build nodes with createElement/textContent instead.' },
        {
          property: 'insertAdjacentHTML',
          message: 'Build nodes with createElement/textContent instead.',
        },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
    },
  },

  {
    // Only this file is allowed to touch window as a global namespace.
    files: ['src/umd.js'],
    languageOptions: { globals: globals.browser },
    rules: { 'no-restricted-globals': 'off' },
  },

  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
      'no-console': 'off',
    },
  },

  {
    files: ['scripts/**/*.mjs', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: { 'no-console': 'off' },
  },

  prettier,
];
