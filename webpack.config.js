const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlWebpackInlineSourcePlugin = require('html-webpack-inline-source-plugin');

module.exports = {
  mode: 'production',
  entry: './game.js',        // или точка входа, где вы подключаете все модули
  output: {
    filename: 'bundle.js',   // временный бандл, затем инлайнится
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'babel-loader',  // если вы пользуетесь Babel
      },
      {
        test: /\.(png|jpe?g|gif|webp|svg)$/,
        use: {
          loader: 'url-loader',
          options: {
            limit: Infinity,  // всегда инлайнить ассеты как data:URI
            esModule: false
          }
        }
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'index.html',     // ваш исходный HTML
      inlineSource: '.(js|css)$'  // инлайнить все JS и CSS
    }),
    new HtmlWebpackInlineSourcePlugin()
  ],
  optimization: {
    minimize: true
  }
};
