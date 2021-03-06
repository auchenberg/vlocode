const merge = require('webpack-merge').smart;
const common = require('./webpack.common.js');

const devModeConfig = {
    mode: 'development',
    devtool: 'source-map',
}

module.exports = [
    merge(common.extestion, devModeConfig),
    merge(common.tests, devModeConfig),
    merge(common.views, devModeConfig)
];