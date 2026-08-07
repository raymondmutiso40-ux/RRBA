import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

/**
 * eslint-config-next 16 ships native flat configs, so they are spread in
 * directly. FlatCompat is only for legacy .eslintrc-style configs and throws
 * on these.
 */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    settings: {
      // Pinned rather than "detect": the bundled eslint-plugin-react 7.37
      // detects versions via context.getFilename(), which ESLint 10 removed.
      // An explicit version skips that code path. Keep in step with the
      // react version in package.json.
      react: { version: "19.2.8" },
    },
    rules: {
      // Server action signatures are fixed by React, so some parameters are
      // unused by design. A leading underscore marks that deliberately.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "supabase/migrations/**",
    ],
  },
];

export default eslintConfig;
