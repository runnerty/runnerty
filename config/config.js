var path            = require('path');

var config = {};
//config.planFilePath = path.join(__dirname, '../plan.json');
//config.binBackup = path.join(__dirname, '../bin.json');
//config.configFilePath = path.join(__dirname, '../conf.json');

config.planFilePath   = path.join('/etc/runnerty/plan.json');
config.binBackup      = path.join('/etc/runnerty/bin.json');
config.configFilePath = path.join('/etc/runnerty/conf.json');

config.refreshIntervalBinBackup = 2000;

config.mailOptions = {
  disable: true,
  from:'Runnerty <desawc@gmail.com>',
  transport: 'smtps://desawc%40gmail.com:nesoca..gmail@smtp.gmail.com/?pool=true',
  templateDir: path.join(__dirname, '../templates'),
  default_template: 'alerts'
};

config.api = {};
config.api.port = 3456;
config.api.secret = 'RUNNERTY_BY_CODERTY';
config.api.limite_req = '20mb';

config.api.propertiesExcludesInResponse = ["proc","scheduleCancel","scheduleRepeater","file_watchers","depends_files_ready"];

config.api.users = [{"user":"coderty", "password":"runnerty"},{"user":"usr_test", "password":"pass_test"}];

module.exports = config;