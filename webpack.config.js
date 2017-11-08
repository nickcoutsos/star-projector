const path = require('path')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')

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
      chunks: ['slides', 'manifest', 'vendor']
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
    })
  ],
  resolve: {
    alias: {
      'vue$': 'vue/dist/vue.common.js'
    }
  },
  // externals: {
  //   'three': 'THREE'
  // },
  devtool: 'inline',
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
