/** @type {import("eslint").Linter.Config} */
module.exports = {
  // extends: ["@repo/eslint-config/react.js"],
  extends: ["@repo/eslint-config/index.js"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: true,
  },
};
