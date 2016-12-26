"use strict";

var winston         = require('winston');
var fs              = require('fs');
var configSchema    = require('../schemas/conf.json');
var Ajv             = require('ajv');
var ajv             = new Ajv({allErrors: true});
var crypto          = require('crypto');
var moment          = require('moment');

const algorithm     = 'aes-256-ctr';


ajv.addSchema(configSchema, 'configSchema');

var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({colorize: 'all', level: 'info'}),
    // new (winston.transports.File)({name: 'info-file', filename: 'filelog-info.log', level: 'info'}),
    // new (winston.transports.File)({name: 'error-file',filename: 'filelog-error.log',level: 'error'}),
  ]
});

module.exports.logger = logger;


function encrypt(text){
  var cipher = crypto.createCipher(algorithm,global.cryptoPassword)
  var crypted = cipher.update(text,'utf8','hex')
  crypted += cipher.final('hex');
  return crypted;
}

function decrypt(text){
  var decipher = crypto.createDecipher(algorithm,global.cryptoPassword)
  var dec = decipher.update(text,'hex','utf8')
  dec += decipher.final('utf8');
  return dec;
}

function getDateString(format,uppercase,lang){
  if(lang) moment.locale(lang.toLowerCase());
  var strDate = moment().format(format);
  if(uppercase) strDate = strDate.toUpperCase();
  return strDate;
}

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

                var fileParsed;
                try {
                  fileParsed = JSON.parse(res);
                } catch(err) {
                  var newErr = new Error('Problem reading JSON file');
                  newErr.stack += '\nCaused by: '+err.stack;
                  throw newErr;
                }

                var valid = ajv.validate('configSchema', fileParsed);

                if (!valid) {
                  logger.log('error',`Invalid Config file:`,ajv.errors);
                  throw new Error(`Invalid Config file:`,ajv.errors);
                  resolve();
                }
                var objConf = fileParsed.config;

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
          if(cnf.hasOwnProperty('crypted_password')){
            if(global.cryptoPassword){
              cnf.password = decrypt(cnf.crypted_password);
            }else{
              reject(`No crypto password set for encrypt crypted_password of section ${section} id ${id_config}.`);
            }
          }
        }
      }

      if (cnf){
        resolve(cnf);
      }else{
        reject(`Config for ${id_config} not found in section ${section}`);
      }
    }else{
      reject(`Section ${section} not found in config file.`, config);
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

function replaceWith(text, objParams, ignoreGlobalValues){

  text = text || '';

  if(!objParams) objParams = {};

  if(global.config.global_values && !ignoreGlobalValues){
    objParams = addGlobalValuesToObjParams(objParams);
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

  objParams.DD   = objParams.DD   || getDateString('DD');
  objParams.MM   = objParams.MM   || getDateString('MM');
  objParams.YY   = objParams.YY   || getDateString('YY');
  objParams.YYYY = objParams.YYYY || getDateString('YYYY');
  objParams.HH   = objParams.HH   || getDateString('HH');
  objParams.HH12 = objParams.HH12 || getDateString('hh');
  objParams.mm   = objParams.mm   || getDateString('mm');
  objParams.ss   = objParams.ss   || getDateString('ss');

  // MONTHS MMMM_[LANG]
  var months = text.toString().match(/\:MMMM_\w{2}/ig);

  if(months){
    var monthsLength = months.length;

    while (monthsLength--){
      var month  = months[monthsLength].substr(1,7);
      var lang   = months[monthsLength].substr(6,2);
      objParams[month] = getDateString('MMMM',true,lang);
    }
  }

  // SHORT MONTHS MMM_[LANG]
  var shortMonths = text.toString().match(/\:MMM_\w{2}/ig);

  if(shortMonths){
    var shortMonthsLength = shortMonths.length;

    while (shortMonthsLength--){
      var shortMonth = shortMonths[shortMonthsLength].substr(1,6);
      var lang       = shortMonths[shortMonthsLength].substr(5,2);
      objParams[shortMonth] = getDateString('MMM',true,lang);
    }
  }

  // DAYS DDDD_[LANG]
  var days = text.toString().match(/\:DDDD_\w{2}/ig);

  if(days){
    var daysLength = days.length;

    while (daysLength--){
      var day  = days[daysLength].substr(1,7);
      var lang = days[daysLength].substr(6,2);
      objParams[day] = getDateString('dddd',true,lang);
    }
  }

  // SHORT DAYS DDD_[LANG]
  var shortDays = text.toString().match(/\:DDD_\w{2}/ig);

  if(shortDays){
    var shortDaysLength = shortDays.length;

    while (shortDaysLength--){
      var shortDay = shortDays[shortDaysLength].substr(1,6);
      var lang       = shortDays[shortDaysLength].substr(5,2);
      objParams[shortDay] = getDateString('ddd',true,lang);
    }
  }

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

  // FIRST TURN
  while (keysLength--) {
    text = text.toString().replace(new RegExp('\\:' + keys[keysLength], 'ig'), objParams[keys[keysLength]] || '');
  }

  // SECOND TURN
  var keysLength = keys.length;
  while (keysLength--) {
    text = text.toString().replace(new RegExp('\\:' + keys[keysLength], 'ig'), objParams[keys[keysLength]] || '');
  }

  return text;
}

module.exports.replaceWith = replaceWith;

  function addGlobalValuesToObjParams(objParams){

  var gvl =  global.config.global_values.length;
  var gv = {};

  while(gvl--){
    var keymaster = Object.keys(global.config.global_values[gvl])[0];
    var valueObjects = global.config.global_values[gvl][keymaster];
    var keysValueObjects = Object.keys(valueObjects);
    var keysValueObjectsLength = keysValueObjects.length;

    while(keysValueObjectsLength--){
      var valueKey = keysValueObjects[keysValueObjectsLength];
      var intialValue = global.config.global_values[gvl][keymaster][valueKey];

      if(intialValue instanceof Object){

        if(intialValue.format === 'text'){

          if(intialValue.value instanceof Array){

            var valuesLength = intialValue.value.length;
            var i = 0;
            var finalValue = '';

            while(valuesLength--){
              var rtext = replaceWith(intialValue.value[i], objParams, true);

              var quotechar = intialValue.quotechar || '';
              var delimiter = intialValue.delimiter || '';

              if(valuesLength !== 0){
                finalValue = finalValue + quotechar + rtext + quotechar + delimiter;
              }else{
                finalValue = finalValue + quotechar + rtext + quotechar;
              }
              i++;
            }
            gv[keymaster.toUpperCase() + '_' + keysValueObjects[keysValueObjectsLength].toUpperCase()] = finalValue;

          }else{
            value = replaceWith(intialValue.value, objParams, true);
            gv[keymaster.toUpperCase() + '_' + keysValueObjects[keysValueObjectsLength].toUpperCase()] = value;
          }

        }else{

          if(intialValue.format === 'json'){

            if(intialValue.value instanceof Object || intialValue.value instanceof Array){
              var value;
              value = replaceWith(JSON.stringify(intialValue.value), objParams, true);
              gv[keymaster.toUpperCase() + '_' + keysValueObjects[keysValueObjectsLength].toUpperCase()] = value;

            }else{
              var value;
              value = replaceWith(intialValue.value, objParams, true);
              gv[keymaster.toUpperCase() + '_' + keysValueObjects[keysValueObjectsLength].toUpperCase()] = value;
            }
          }
        }

      }else{
        var value;
        value = replaceWith(intialValue, objParams, true);
        gv[keymaster.toUpperCase() + '_' + keysValueObjects[keysValueObjectsLength].toUpperCase()] = value;
      }
    }
  }

  return Object.assign(gv, objParams);
}

module.exports.getChainByUId = function getChainByUId(chains, uId){

  var chainLength = chains.length;

  var res = false;

  while(chainLength-- && !res){
    var chain = chains[chainLength];
    if(chain.uId === uId){
      res = chain;
    }else{
      if(chain.processes && chain.processes.length){
        var chainProcessesLength = chain.processes.length;
        while(chainProcessesLength-- && !res){
          var process = chain.processes[chainProcessesLength];
          if(process.childs_chains){
            var result = getChainByUId(process.childs_chains, uId);
            if(result){
              res = result;
            }
          }
        }
      }
    }
  }
  return res;
}

module.exports.getProcessByUId = function getProcessByUId(chains, uId){

  var chainLength = chains.length;

  var res = false;

  while(chainLength-- && !res){
    var chain = chains[chainLength];

    if(chain.processes){
      var chainProcessesLength = chain.processes.length;

      while(chainProcessesLength-- && !res){
        var process = chain.processes[chainProcessesLength];
        if(process.uId === uId){
          res = process;
        }else{
          if(process.childs_chains){
            var result = getProcessByUId(process.childs_chains, uId);
            if(result){
              res = result;
            }
          }
        }
      }
    }
  }
  return res;
}

module.exports.checkEvaluation = function checkEvaluation(oper_left, condition, oper_right, values){

  var oper_left  = replaceWith(oper_left, values);
  var oper_right = replaceWith(oper_right, values);

  switch (condition) {
    case '==':
      return (oper_left == oper_right);
      break;
    case '!=':
      return (oper_left != oper_right);
      break;
    case '>=':
      return (oper_left >= oper_right);
      break;
    case '<=':
      return (oper_left <= oper_right);
      break;
    default:
      return false;
      break;
  }
}