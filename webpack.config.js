const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlInlineScriptPlugin = require('html-inline-script-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: './game.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.(png|jpe?g|gif|webp|svg)$/i,
        type: 'asset/inline' // Inline all images
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'index.html',
      filename: 'index.html',
      inject: 'body',
      minify: {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        useShortDoctype: true
      }
    }),
    new HtmlInlineScriptPlugin({
      compilationOptions: {
        async: false // Change to synchronous to ensure proper loading
      }
    })
  ],
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          format: {
            comments: false,
          },
          compress: {
            drop_console: true, // Remove console.logs
            drop_debugger: true, // Remove debugger statements
            pure_funcs: ['console.info', 'console.debug', 'console.warn'] // Remove more console functions
          }
        },
        extractComments: false
      }),
    ],
    // Disable splitChunks to ensure all code is in one bundle
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        defaultVendors: {
          name: 'vendors', // Set a single vendor chunk name
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          reuseExistingChunk: true,
        },
        default: {
          minChunks: 1,
          priority: -20,
          reuseExistingChunk: true,
        },
      },
    },
  }
};