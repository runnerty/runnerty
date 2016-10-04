"use strict";

var winston         = require('winston');
var fs              = require('fs');

module.exports.loadGeneralConfig = function loadGeneralConfig(configFilePath){
  return new Promise((resolve) => {
      var filePath = configFilePath;

  fs.stat(filePath, function(err, res){
    if(err){
      logger.log('error',`Load General conf file ${filePath} not exists.`, err);
      throw new Error(`Load General conf file ${filePath} not found.`);
      resolve();
    }else {
      try {
        fs.readFile(filePath, 'utf8', function (err, res) {
          if (err) {
            logger.log('error', 'Load General conf loadConfig readFile: ' + err);
            resolve();
          } else {
            var objConf = JSON.parse(res).config;

            //TODO: INCLUIR TODOS LOS PARAMTEROS OBLIGATORIOS DE CONFIG EN ESTA VALIDACIÓN:
            if (objConf.hasOwnProperty('general')) {
              resolve(objConf);
            } else {
              throw new Error('Invalid Config file, general not found.', objConf);
              resolve();
            }

          }
        });
      } catch (e) {
        throw new Error('Invalid Config file, incorrect JSON format: ' + e.message, e);
        resolve();
      }
    }
  });
});
};

module.exports.loadConfigSection = function loadConfigSection(config, section, id_config){
  return new Promise(function(resolve, reject) {

    if (config.hasOwnProperty(section)) {
      var sectionLength = config[section].length;
      var cnf = undefined;
      while (sectionLength--) {
        if (config[section][sectionLength].id === id_config) {
          cnf = config[section][sectionLength];
        }
      }

      if (cnf){
        resolve(cnf);
      }else{
        throw new Error(`Config for ${id_config} not found in section ${section}`);
        reject();
      }

    }else{
      throw new Error(`Section ${section} not found in config file.`, config);
      reject();
    }
  });
};

module.exports.loadSQLFile = function loadSQLFile(filePath){
  return new Promise((resolve) => {

  fs.stat(filePath, function(err, res){
    if(err){
      logger.log('error',`Load SQL file ${filePath} not exists.`, err);
      throw new Error(`Load SQL file ${filePath} not found.`);
      resolve();
    }else {
        fs.readFile(filePath, 'utf8', function (err, res) {
          if (err) {
            logger.log('error', 'Load SQL file readFile: ' + err);
            resolve();
          } else {
            resolve(res);
          }
        });
    }
  });
});
};

module.exports.replaceWith = function replaceWith(text, objParams){

  if(global.config.global_values){

    var gvl =  global.config.global_values.length;
    var gv = {};

    while(gvl--){
      var keymaster = Object.keys(global.config.global_values[gvl])[0];
      var valueObjects = global.config.global_values[gvl][keymaster];
      var keysValueObjects = Object.keys(valueObjects);
      var keysValueObjectsLength = keysValueObjects.length;

      while(keysValueObjectsLength--){
        var valueKey = keysValueObjects[keysValueObjectsLength];
        gv[keymaster.toUpperCase() + '_' + keysValueObjects[keysValueObjectsLength].toUpperCase()] = global.config.global_values[gvl][keymaster][valueKey];
      }
    }
    objParams = Object.assign(objParams, gv);
  }

  function pad(pad, str, padLeft) {
    if(!padLeft) padLeft = true;
    if (typeof str === 'undefined')
      return pad;
    if (padLeft) {
      return (pad + str).slice(-pad.length);
    } else {
      return (str + pad).substring(0, pad.length);
    }
  }

  var currentTime = new Date();
  objParams.DD   = pad('00',currentTime.getDate());
  objParams.MM   = pad('00',currentTime.getMonth() + 1);
  objParams.YY   = pad('00',currentTime.getFullYear().toString().substr(2,2));
  objParams.YYYY = pad('00',currentTime.getFullYear());
  objParams.HH   = pad('00',currentTime.getHours());
  objParams.mm   = pad('00',currentTime.getMinutes());
  objParams.ss   = pad('00',currentTime.getSeconds());

  var keys = Object.keys(objParams);

  function orderByLength(a, b) {
    if (a.length > b.length) {
      return 1;
    }
    if (a.length < b.length) {
      return -1;
    }
    return 0;
  }

  keys.sort(orderByLength);
  var keysLength = keys.length;

  while (keysLength--) {
    text = text.replace(new RegExp('\\:' + keys[keysLength], 'g'), objParams[keys[keysLength]] || '');
  }
  return text;
}

module.exports.logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({colorize: 'all', level: 'debug'}),
    // new (winston.transports.File)({name: 'info-file', filename: 'filelog-info.log', level: 'info'}),
    // new (winston.transports.File)({name: 'error-file',filename: 'filelog-error.log',level: 'error'}),
  ]
});