var path            = require('path');

var config = {};
config.planFilePath = path.join(__dirname, '../plan.json');
config.binBackup = path.join(__dirname, '../bin.json');

config.refreshIntervalBinBackup = 2000;

config.mailOptions = {
  disable: true,
  from:'Runnerty <desawc@gmail.com>',
  transport: 'smtps://desawc%40gmail.com:nesoca..gmail@smtp.gmail.com/?pool=true',
  templateDir: path.join(__dirname, '../templates'),
  default_template: 'alerts'
};

config.slackToken = process.env.SLACK_API_TOKEN || 'xoxb-4640839314-gTegKMTv7ZtWJdnFB8BIK879';

config.api = {};
config.api.port = 3456;
config.api.secret = 'RUNNERTY_BY_CODERTY';
config.api.limite_req = '20mb';

config.api.propertiesExcludesInResponse = ["proc","scheduleCancel","scheduleRepeater"];

config.api.users = [{"user":"coderty", "password":"runnerty"},{"user":"usr_test", "password":"pass_test"}];

module.exports = config;