var path            = require('path');

var config = {};
config.planFilePath = './plan.json';
config.binBackup = './bin.json';

config.refreshIntervalBinBackup = 2000;

config.mailOptions = {
  from:'Runnerty <desawc@gmail.com>',
  transport: 'smtps://desawc%40gmail.com:nesoca..gmail@smtp.gmail.com/?pool=true',
  templateDir: path.join(__dirname, '../templates'),
  default_template: 'alerts'
};

config.slackToken = process.env.SLACK_API_TOKEN || 'xoxb-4640839314-gTegKMTv7ZtWJdnFB8BIK879';

module.exports = config;