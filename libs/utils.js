"use strict";

var winston         = require('winston');

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

module.exports.replaceWith = function replaceWith(text, objParams){

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