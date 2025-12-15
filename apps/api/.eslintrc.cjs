/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ['@witnesschain/config/eslint/node'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
