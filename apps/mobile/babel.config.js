// babel-preset-expo lives inside the `expo` package and would load the worklets Babel plugin
// from the monorepo root (0.8.x, pulled in by the dashboard). The mobile app runs worklets 0.5.1
// (Expo SDK 54 / Expo Go), and the plugin must match the runtime, so load it from this app instead.
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
