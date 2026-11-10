// ESLint (code style and mistake checker) for the backend. Run with: npm run lint
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  // Folders that are generated or installed, not written by us
  { ignores: ['dist/', 'node_modules/', 'data/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { globals: globals.node }
  }
);
