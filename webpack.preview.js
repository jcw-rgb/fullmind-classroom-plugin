/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * webpack.preview.js
 * Local visual-preview build — NOT part of the shipped plugin.
 * Aliases bigbluebutton-html-plugin-sdk to src/preview/mock-sdk.tsx so the
 * panel View components render with mock data in a plain browser window.
 *
 * Run: npm run preview  →  http://localhost:4702
 */
const path = require('path');

module.exports = {
  entry: './src/preview/preview.tsx',

  output: {
    filename: 'preview.js',
    path: path.resolve(__dirname, 'dist-preview'),
    publicPath: '/',
  },

  devServer: {
    host: '0.0.0.0',
    port: 4702,
    hot: false,
    liveReload: false,
    static: {
      directory: path.resolve(__dirname, 'src/preview'),
    },
    client: {
      overlay: false,
    },
  },

  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: { loader: 'babel-loader' },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },

  resolve: {
    extensions: ['.js', '.jsx', '.tsx', '.ts'],
    alias: {
      'bigbluebutton-html-plugin-sdk': path.resolve(__dirname, 'src/preview/mock-sdk.tsx'),
    },
  },
};
