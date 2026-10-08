import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'react-refresh/only-export-components': [
        'error',
        {
          allowConstantExport: true,
          allowExportNames: [
            'badgeVariants',
            'buttonGroupVariants',
            'buttonVariants',
            'navigationMenuTriggerStyle',
            'toggleVariants',
            'useFormField',
            'useSidebar',
          ],
        },
      ],
    },
  },
  /* ------------------------------------------------------------------ */
  /* The journal keeps a named type scale. An arbitrary `text-[Npx]` is  */
  /* how that scale drifted into seventeen sizes on a single page, so    */
  /* the platform files are asked to take a step of the scale instead.   */
  /* `/game` is left out: the board is set at the size the board needs.  */
  /* Posted as a warning while the sizes already laid are folded back    */
  /* into the named steps; it becomes an error once the page is clean.   */
  /* ------------------------------------------------------------------ */
  {
    files: [
      'src/pages/**/*.{ts,tsx}',
      'src/components/{platform,site,home,online,desk,rules,results,setup}/**/*.{ts,tsx}',
    ],
    ignores: ['src/pages/Game.tsx', 'src/gl/**', 'src/components/game/**'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'Literal[value=/text-\\[[0-9.]+px\\]/]',
          message: 'Take a step of the type scale (micro-label, data-text, eyebrow-fell, title-card, h2-section, display-page, display-hero) rather than an arbitrary text-[Npx].',
        },
        {
          selector: 'TemplateElement[value.raw=/text-\\[[0-9.]+px\\]/]',
          message: 'Take a step of the type scale (micro-label, data-text, eyebrow-fell, title-card, h2-section, display-page, display-hero) rather than an arbitrary text-[Npx].',
        },
      ],
    },
  },
])
