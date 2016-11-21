"use strict";

var winston         = require('winston');
var fs              = require('fs');
var configSchema    = require('../schemas/conf.json');
var Ajv             = require('ajv');
var ajv             = new Ajv({allErrors: true});
var crypto          = require('crypto');

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

module.exports.replaceWith = function replaceWith(text, objParams, ignoreGlobalValues){

  if(!objParams) objParams = {};

  if(global.config.global_values && !ignoreGlobalValues){

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
  objParams.YYYY = currentTime.getFullYear().toString();
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