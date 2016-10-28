module.exports = {
  entry: './src/index.js',
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
  devServer: {
    contentBase: './src',
    historyApiFallback: true
  }
}
