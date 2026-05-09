module.exports = [
  {
    ignores: ["node_modules/**"],
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "warn",
    },
  },
];
