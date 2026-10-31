import nextConfig from "eslint-config-next";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextConfig,
  ...nextCoreWebVitals,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "generated/**",
      "storage/**",
      "coverage/**",
      ".agents/**",
      "next-env.d.ts",
    ],
  },
  // Test/lab code: dynamic imports and any-casts are fine there.
  {
    files: ["tests/**", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default eslintConfig;
