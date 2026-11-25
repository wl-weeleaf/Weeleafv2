import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated output and third-party/minified bundles are not Site source.
    "dist/**",
    ".vinext/**",
    ".wrangler/**",
    "public/**",
    "vendor/**",
    ".sites-runtime/**",
  ]),
  {
    // CommonJS Electron entry points legitimately use require().
    files: ["**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // Test doubles patch module/this to fake browser and Node APIs.
    files: ["tests/**/*.mjs"],
    rules: {
      "@typescript-eslint/no-this-alias": "off",
      "@next/next/no-assign-module-variable": "off",
    },
  },
  {
    // Hydrating client state from localStorage after mount is intentional here
    // (avoids SSR hydration mismatches).
    files: [
      "components/wardrobe/Wardrobe.tsx",
      "components/leafy/LeafyServerNotes.tsx",
      "components/leafy/LeafyWorkspace.tsx",
      "components/orb/OrbDemo.tsx",
    ],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  {
    files: ["components/ui/**/*.{ts,tsx}", "hooks/use-mobile.ts"],
    rules: {
      // These files are vendored verbatim from shadcn@4.17.0. Keep the
      // registry source intact while applying the stricter rules to Site code.
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
