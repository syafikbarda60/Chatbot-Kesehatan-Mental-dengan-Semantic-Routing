// The worklets Babel plugin must match the worklets runtime the app ships (0.10.x on SDK 57),
// so it is resolved from this app rather than from wherever babel-preset-expo sits in the monorepo.
const path = require('path');

const presetExpo = require.resolve('babel-preset-expo', { paths: [path.dirname(require.resolve('expo/package.json'))] });
const workletsPlugin = require.resolve('react-native-worklets/plugin', { paths: [__dirname] });

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [[presetExpo, { worklets: false }]],
    plugins: [workletsPlugin], // must stay last
  };
};
