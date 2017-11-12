const path = require('path')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const ExtractTextPlugin = require("extract-text-webpack-plugin")

const presentationCss = new ExtractTextPlugin('presentation/[name].css')

module.exports = {
  entry: {
    app: path.resolve(__dirname, 'src/app.js'),
    slides: path.resolve(__dirname, 'src/presentation/index.js')
  },
  output: {
    filename: '[name].[chunkhash].js',
    path: path.resolve(__dirname, 'build')
  },
  module: {
    loaders: [
      {
        test: /\.jsx?$/,
        loader: 'babel-loader',
        exclude: /node_modules/
      },
      { test: /\.json$/, loader: 'json' },
      { test: /\.html$/, loader: 'html-loader' },
      {
        test: /\.worker\.js$/,
        use: [
          { loader: 'worker-loader' },
          { loader: 'babel-loader' }
        ]
      },
      {
        test: /\.(png|jpe?g)/,
        use: 'file-loader'
      },
      {
        test: /\.css$/,
        use: presentationCss.extract({
          publicPath: '../',
          fallback: "style-loader",
          use: "css-loader"
        })
      }
    ]
  },
  plugins: [
     new HtmlWebpackPlugin({
       template: './src/index.html',
       filename: 'index.html',
       chunks: ['app', 'manifest', 'vendor']
     }),
    new HtmlWebpackPlugin({
      template: './src/presentation/index.html',
      filename: 'presentation/index.html',
      chunks: ['slides', 'manifest', 'vendor', 'vendor-css']
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: 'vendor-css',
      minChunks: function (module) {
       return (
         module.context &&
         module.context.indexOf('node_modules') !== -1 &&
         module.context.match(/\.css$/)
        )
      }
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: 'vendor',
      minChunks: function (module) {
       return (
         module.context &&
         module.context
          .indexOf('node_modules') !== -1
        )
      }
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: 'manifest'
    }),
    presentationCss
  ],
  resolve: {
    alias: {
      'vue$': 'vue/dist/vue.common.js'
    }
  },
  // externals: {
  //   'three': 'THREE'
  // },
  devtool: 'source',
  devServer: {
    contentBase: './src',
    historyApiFallback: true,
    hot: false,
    inline: false
  },
  node: {
    fs: 'empty'
  }
}
