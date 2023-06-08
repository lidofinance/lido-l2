module.exports = {
  env: {
    browser: false,
    es2021: true,
    mocha: true,
    node: true,
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "standard",
    "plugin:prettier/recommended",
    "plugin:node/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 12,
  },
  settings: {
    node: {
      tryExtensions: [".js", ".ts"],
    },
  },
  globals: {
    Awaited: "readonly",
  },
  rules: {
    "no-useless-constructor": "off",
    camelcase: ["error", { allow: [".+__factory$"], properties: "never" }],
    "node/no-unpublished-import": "off",
    "node/no-unsupported-features/es-syntax": [
      "error",
      { ignores: ["modules"], version: ">=12.0.0" },
    ],
  },
};
