// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "convex/_generated/**",
      "storybook-static/**",
    ],
  },
  {
    rules: {
      // Disable React Compiler rules until we enable reactCompiler in next.config
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/refs": "off",
      "@next/next/no-img-element": "off",
    },
  },
  ...storybook.configs["flat/recommended"],
];

export default eslintConfig;
