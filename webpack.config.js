// webpack.config.js - FIXED VERSION
const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = (env, argv) => {
  const isProduction = argv.mode === "production";

  return {
    entry: {
      background: "./src/background.ts",
      youtube: "./src/platforms/youtube/content.ts", 
      linkedin: "./src/platforms/linkedin/content.ts",
      popup: "./src/popup.ts",
    },
    
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].js",
      clean: true,
    },
    
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, "css-loader"],
        },
      ],
    },
    
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
    },
    
    plugins: [
      new MiniCssExtractPlugin({
        filename: "styles.css",
      }),
      
      new HtmlWebpackPlugin({
        template: "./src/popup.html",
        filename: "popup.html",
        chunks: ["popup"],
        minify: isProduction,
      }),
      
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "./src/manifest.json",
            to: "manifest.json",
          }
        ],
      }),
    ],
    
    devtool: isProduction ? false : "cheap-module-source-map",
    
    optimization: {
      minimize: isProduction,
    },
  };
};