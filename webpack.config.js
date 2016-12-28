module.exports = {
  entry: './src/app.js',
  output: { path: './build/', filename: 'bundle.js' },
  module: {
    loaders: [
      {
        test: /\.jsx?$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        query: {
          presets: ['es2015']
        }
      },
      { test: /\.json$/, loader: 'json' }
    ]
  },
  resolve: {
    alias: {
      'vue$': 'vue/dist/vue.common.js'
    }
  },
  devServer: {
    contentBase: './src',
    historyApiFallback: true
  },
  node: {
    fs: 'empty'
  }
}
