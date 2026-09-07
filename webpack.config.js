const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => ({
  entry: {
    background: './src/background/background.js',
    offscreen: './src/offscreen/offscreen.js',
    content: './src/widget/index.js',
    options: './src/options/options.js',
    popup: './src/popup/popup.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  // A Chrome Web Store upload ships whatever `dist/` contains: a production
  // build carries no source map, so it doesn't distribute readable source or
  // bloat the package. `npm run dev`/`watch` (mode=development) keep one for
  // local debugging.
  devtool: argv.mode === 'production' ? false : 'source-map',
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      {
        // CSS is imported as a raw string everywhere (not injected via <link>/style-loader)
        // because the widget bundle must manually append its stylesheet into a SHADOW ROOT,
        // not document.head. Options/popup pages use the same helper (shared/injectCss.js)
        // for consistency — one CSS-loading strategy for the whole project.
        test: /\.css$/,
        type: 'asset/source',
      },
      {
        // Momentum icon SVGs are inlined as markup (see widget/ui/MomentumIcon.jsx)
        // so they can be recoloured via currentColor inside the shadow root.
        test: /\.svg$/,
        type: 'asset/source',
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
    // The `webex` package (offscreen.js's only heavy dependency) drags in
    // several Node-oriented internal plugins with old CommonJS deps that
    // assume Node core modules exist. Webpack 5 no longer auto-polyfills
    // these, so they're wired to browser equivalents explicitly. `fs` has no
    // meaningful browser equivalent — it's only reachable through a
    // content-sniffing code path (file-type) that this extension never
    // exercises, so it's stubbed to `false` (unresolved import becomes `{}`).
    fallback: {
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      util: require.resolve('util/'),
      url: require.resolve('url/'),
      os: require.resolve('os-browserify/browser'),
      querystring: require.resolve('querystring-es3'),
      vm: require.resolve('vm-browserify'),
      fs: false,
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: require.resolve('process/browser.js'),
      Buffer: ['buffer', 'Buffer'],
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'src/options/options.html', to: 'options.html' },
        { from: 'src/popup/popup.html', to: 'popup.html' },
        { from: 'src/offscreen/offscreen.html', to: 'offscreen.html' },
        { from: 'icons', to: 'icons' },
      ],
    }),
  ],
});
