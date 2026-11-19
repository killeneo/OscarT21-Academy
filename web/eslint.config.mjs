import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The CSP has to allow inline scripts (Next.js bootstrap), so raw-HTML sinks are the XSS line of defence:
  // the only one allowed is the static settings script in the locale layout.
  { rules: { "react/no-danger": "error" } },
  { files: ["app/[[]lang]/layout.tsx"], rules: { "react/no-danger": "off" } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
