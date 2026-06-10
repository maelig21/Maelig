import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import securityPlugin from "eslint-plugin-security";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// P1 audit 2026-05-20 — Ajout eslint-plugin-security pour scanner :
//   - detect-buffer-noassert, detect-child-process, detect-disable-mustache-escape
//   - detect-eval-with-expression, detect-no-csrf-before-method-override
//   - detect-non-literal-fs-filename, detect-non-literal-regexp, detect-non-literal-require
//   - detect-object-injection (utile mais bruyant — on garde en warn)
//   - detect-possible-timing-attacks, detect-pseudoRandomBytes, detect-unsafe-regex
const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: { security: securityPlugin },
    rules: {
      "security/detect-buffer-noassert": "error",
      "security/detect-child-process": "error",
      "security/detect-disable-mustache-escape": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-new-buffer": "error",
      "security/detect-no-csrf-before-method-override": "error",
      "security/detect-non-literal-fs-filename": "warn",
      "security/detect-non-literal-regexp": "warn",
      "security/detect-non-literal-require": "error",
      "security/detect-possible-timing-attacks": "warn",
      "security/detect-pseudoRandomBytes": "error",
      "security/detect-unsafe-regex": "error",
      // detect-object-injection est très bruyant sur le code TS bien typé.
      // On le désactive ici, on s'appuie sur les types pour la sécurité.
      "security/detect-object-injection": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "scripts/**",
    ],
  },
];

export default eslintConfig;
