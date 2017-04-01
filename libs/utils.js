"use strict";

var winston = require('winston');
var fs = require('fs');
var path = require('path');
var configSchema = require('../schemas/conf.json');
var Ajv = require('ajv');
var ajv = new Ajv({allErrors: true});
var crypto = require('crypto');
var moment = require('moment');

const algorithm = 'aes-256-ctr';

var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({colorize: 'all', level: 'info'}),
    // new (winston.transports.File)({name: 'info-file', filename: 'filelog-info.log', level: 'info'}),
    // new (winston.transports.File)({name: 'error-file',filename: 'filelog-error.log',level: 'error'}),
  ]
});

module.exports.logger = logger;


function encrypt(text) {
  var cipher = crypto.createCipher(algorithm, global.cryptoPassword);
  var crypted = cipher.update(text, 'utf8', 'hex');
  crypted += cipher.final('hex');
  return crypted;
}

function decrypt(text) {
  var decipher = crypto.createDecipher(algorithm, global.cryptoPassword);
  var dec = decipher.update(text, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

function getDateString(format, uppercase, lang) {
  if (lang) {
    moment.locale(lang.toLowerCase());
  }

  var strDate = moment().format(format);
  if (uppercase) {
    strDate = strDate.toUpperCase();
  }

  return strDate;
}

module.exports.loadGeneralConfig = function loadGeneralConfig(configFilePath) {
  return new Promise((resolve) => {
    var filePath = configFilePath;

    fs.stat(filePath, function (err, res) {
      if (err) {
        logger.log('error', `Load General conf file ${filePath} not exists.`, err);
        throw new Error(`Load General conf file ${filePath} not found.`);
      } else {

        try {
          fs.readFile(filePath, 'utf8', function (err, res) {
            if (err) {
              logger.log('error', 'Load General conf loadConfig readFile: ', err);
              resolve();
            } else {

              var fileParsed;
              try {
                fileParsed = JSON.parse(res);
              } catch (err) {
                var newErr = new Error('Problem reading JSON file');
                newErr.stack += '\nCaused by: ' + err.stack;
                throw newErr;
              }

              // ADD NOTIFICATORS SCHEMAS:
              var promiseNotificatorsSchemas =
                requireDir('/../notificators/', 'schema.json')
                  .then((res) => {
                    //ajv.addSchema(configSchema, 'configSchema');
                    return new Promise((resolve) => {
                      var keys = Object.keys(res);
                      var keysLength = keys.length;
                      var items = {};
                      items.anyOf = [];
                      while (keysLength--) {
                        items.anyOf.push({"$ref": keys[keysLength] + "#/definitions/config"});
                        ajv.addSchema(res[keys[keysLength]], keys[keysLength]);
                      }
                      configSchema.properties.config.properties.notificators.items = items;
                      resolve();
                    });
                  })
                  .catch((err) => {
                    throw err;
                  });

              // ADD EXECUTORS SCHEMAS:
              var promiseExecutorsSchemas =
                requireDir('/../executors/', 'schema.json')
                  .then((res) => {
                    return new Promise((resolve) => {
                      var keys = Object.keys(res);
                      var keysLength = keys.length;
                      var items = {};
                      items.anyOf = [];
                      while (keysLength--) {
                        items.anyOf.push({"$ref": keys[keysLength] + "#/definitions/config"});
                        ajv.addSchema(res[keys[keysLength]], keys[keysLength]);
                      }
                      configSchema.properties.config.properties.executors.items = items;
                      resolve();
                    });
                  })
                  .catch((err) => {
                    throw err;
                  });

              Promise.all([promiseNotificatorsSchemas, promiseExecutorsSchemas]).then(values => {
                ajv.addSchema(configSchema, 'configSchema');

                var valid = ajv.validate('configSchema', fileParsed);

                if (!valid) {
                  logger.log('error', `Invalid Config file:`, ajv.errors);
                  throw new Error(`Invalid Config file:`, ajv.errors);
                }
                var objConf = fileParsed.config;
                resolve(objConf);
              });
            }
          });
        } catch (err) {
          throw new Error('Invalid Config file, incorrect JSON format: ' + err.message, err);
        }
      }
    });
  });
};

module.exports.loadConfigSection = function loadConfigSection(config, section, id_config) {

  return new Promise(function (resolve, reject) {

    if (config.hasOwnProperty(section)) {
      var sectionLength = config[section].length;
      var cnf;
      while (sectionLength--) {
        if (config[section][sectionLength].id === id_config) {
          cnf = config[section][sectionLength];
          if (cnf.hasOwnProperty('crypted_password')) {
            if (global.cryptoPassword) {
              cnf.password = decrypt(cnf.crypted_password);
            } else {
              reject(`No crypto password set for encrypt crypted_password of section ${section} id ${id_config}.`);
            }
          }
        }
      }

      if (cnf) {
        resolve(cnf);
      } else {
        reject(`Config for ${id_config} not found in section ${section}`);
      }
    } else {
      reject(`Section ${section} not found in config file.`, config);
    }
  });
};

module.exports.loadSQLFile = function loadSQLFile(filePath) {
  return new Promise((resolve) => {

    fs.stat(filePath, function (err, res) {
      if (err) {
        logger.log('error', `Load SQL file ${filePath} not exists.`, err);
        throw new Error(`Load SQL file ${filePath} not found.`);
      } else {
        fs.readFile(filePath, 'utf8', function (err, res) {
          if (err) {
            logger.log('error', 'Load SQL file readFile: ', err);
            resolve();
          } else {
            resolve(res);
          }
        });
      }
    });
  });
};

function replaceWith(text, objParams, ignoreGlobalValues) {

  text = text || '';

  objParams = objParams || {};

  if (global.config.global_values && !ignoreGlobalValues) {
    objParams = addGlobalValuesToObjParams(objParams);
  }

  function pad(pad, str, padLeft) {
    if (!padLeft) {
      padLeft = true;
    }
    if (typeof str === 'undefined') {
      return pad;
    }
    if (padLeft) {
      return (pad + str).slice(-pad.length);
    } else {
      return (str + pad).substring(0, pad.length);
    }
  }

  objParams.DD = objParams.DD || getDateString('DD');
  objParams.MM = objParams.MM || getDateString('MM');
  objParams.YY = objParams.YY || getDateString('YY');
  objParams.YYYY = objParams.YYYY || getDateString('YYYY');
  objParams.HH = objParams.HH || getDateString('HH');
  objParams.HH12 = objParams.HH12 || getDateString('hh');
  objParams.mm = objParams.mm || getDateString('mm');
  objParams.ss = objParams.ss || getDateString('ss');

  // MONTHS MMMM_[LANG]
  var months = text.toString().match(/\:MMMM_\w{2}/ig);

  if (months) {
    var monthsLength = months.length;

    while (monthsLength--) {
      var month = months[monthsLength].substr(1, 7);
      var monthLang = months[monthsLength].substr(6, 2);
      if (!objParams[month]) {
        objParams[month] = getDateString('MMMM', true, monthLang);
      }
    }
  }

  // SHORT MONTHS MMM_[LANG]
  var shortMonths = text.toString().match(/\:MMM_\w{2}/ig);

  if (shortMonths) {
    var shortMonthsLength = shortMonths.length;

    while (shortMonthsLength--) {
      var shortMonth = shortMonths[shortMonthsLength].substr(1, 6);
      var shortMonthLang = shortMonths[shortMonthsLength].substr(5, 2);
      if (!objParams[shortMonth]) {
        objParams[shortMonth] = getDateString('MMM', true, shortMonthLang);
      }
    }
  }

  // DAYS DDDD_[LANG]
  var days = text.toString().match(/\:DDDD_\w{2}/ig);

  if (days) {
    var daysLength = days.length;

    while (daysLength--) {
      var day = days[daysLength].substr(1, 7);
      var lang = days[daysLength].substr(6, 2);
      if (!objParams[day]) {
        objParams[day] = getDateString('dddd', true, lang);
      }
    }
  }

  // SHORT DAYS DDD_[LANG]
  var shortDays = text.toString().match(/\:DDD_\w{2}/ig);

  if (shortDays) {
    var shortDaysLength = shortDays.length;

    while (shortDaysLength--) {
      var shortDay = shortDays[shortDaysLength].substr(1, 6);
      var lang = shortDays[shortDaysLength].substr(5, 2);
      if (!objParams[shortDay]) {
        objParams[shortDay] = getDateString('ddd', true, lang);
      }
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
  var keysLengthFirst = keys.length;
  var keysLengthSecond = keys.length;

  // FIRST TURN
  while (keysLengthFirst--) {
    text = text.toString().replace(new RegExp('\\:' + keys[keysLengthFirst], 'ig'), objParams[keys[keysLengthFirst]] || '');
  }

  // SECOND TURN
  while (keysLengthSecond--) {
    text = text.toString().replace(new RegExp('\\:' + keys[keysLengthSecond], 'ig'), objParams[keys[keysLengthSecond]] || '');
  }

  return text;
}

module.exports.replaceWith = replaceWith;


function replaceWithNew(text, objParams, options) {

  //OPTIONS:
  var ignoreGlobalValues = options?(options.ignoreGlobalValues || false):false;
  var altValueReplace = options?(options.altValueReplace || ''):'';
  var insensitiveCase = options?((options.insensitiveCase?'i':'') || ''):'';

  return new Promise(function (resolve, reject) {
    text = text || '';

    objParams = objParams || {};
    text = text || '';

    objParams = objParams || {};

    if (global.config.global_values && !ignoreGlobalValues) {
      objParams = addGlobalValuesToObjParams(objParams);
    }

    function pad(pad, str, padLeft) {
      if (!padLeft) {
        padLeft = true;
      }
      if (typeof str === 'undefined') {
        return pad;
      }
      if (padLeft) {
        return (pad + str).slice(-pad.length);
      } else {
        return (str + pad).substring(0, pad.length);
      }
    }

    objParams.DD = objParams.DD || getDateString('DD');
    objParams.MM = objParams.MM || getDateString('MM');
    objParams.YY = objParams.YY || getDateString('YY');
    objParams.YYYY = objParams.YYYY || getDateString('YYYY');
    objParams.HH = objParams.HH || getDateString('HH');
    objParams.HH12 = objParams.HH12 || getDateString('hh');
    objParams.mm = objParams.mm || getDateString('mm');
    objParams.ss = objParams.ss || getDateString('ss');

// MONTHS MMMM_[LANG]
    var months = text.toString().match(/\:MMMM_\w{2}/ig);

    if (months) {
      var monthsLength = months.length;

      while (monthsLength--) {
        var month = months[monthsLength].substr(1, 7);
        var monthLang = months[monthsLength].substr(6, 2);
        if (!objParams[month]) {
          objParams[month] = getDateString('MMMM', true, monthLang);
        }
      }
    }

// SHORT MONTHS MMM_[LANG]
    var shortMonths = text.toString().match(/\:MMM_\w{2}/ig);

    if (shortMonths) {
      var shortMonthsLength = shortMonths.length;

      while (shortMonthsLength--) {
        var shortMonth = shortMonths[shortMonthsLength].substr(1, 6);
        var shortMonthLang = shortMonths[shortMonthsLength].substr(5, 2);
        if (!objParams[shortMonth]) {
          objParams[shortMonth] = getDateString('MMM', true, shortMonthLang);
        }
      }
    }

// DAYS DDDD_[LANG]
    var days = text.toString().match(/\:DDDD_\w{2}/ig);

    if (days) {
      var daysLength = days.length;

      while (daysLength--) {
        var day = days[daysLength].substr(1, 7);
        var lang = days[daysLength].substr(6, 2);
        if (!objParams[day]) {
          objParams[day] = getDateString('dddd', true, lang);
        }
      }
    }

// SHORT DAYS DDD_[LANG]
    var shortDays = text.toString().match(/\:DDD_\w{2}/ig);

    if (shortDays) {
      var shortDaysLength = shortDays.length;

      while (shortDaysLength--) {
        var shortDay = shortDays[shortDaysLength].substr(1, 6);
        var lang = shortDays[shortDaysLength].substr(5, 2);
        if (!objParams[shortDay]) {
          objParams[shortDay] = getDateString('ddd', true, lang);
        }
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
    var keysLengthFirst = keys.length;
    var keysLengthSecond = keys.length;

// FIRST TURN
    while (keysLengthFirst--) {
      text = text.toString().replace(new RegExp('\\:' + keys[keysLengthFirst], insensitiveCase + 'g'), objParams[keys[keysLengthFirst]] || altValueReplace);
    }

// SECOND TURN
    while (keysLengthSecond--) {
      text = text.toString().replace(new RegExp('\\:' + keys[keysLengthSecond], insensitiveCase + 'g'), objParams[keys[keysLengthSecond]] || altValueReplace);
    }

    if(altValueReplace){
      text = text.toString().replace(new RegExp('\\:\\w+', insensitiveCase + 'g'), altValueReplace);
    }

    resolve(text);
  });
}

module.exports.replaceWithNew = replaceWithNew;

function replaceWithSmart(inputObject, objParams, options) {

  //OPTIONS:
  var keysUpperCase = options?(options.keysUpperCase || false):false;

  return new Promise(function (resolve, reject) {
    if (typeof inputObject === "string") {
      replaceWithNew(inputObject, objParams, options)
        .then((res) => {
          resolve(res);
        });
    } else {
      if (inputObject instanceof Array) {
        var len = inputObject.length;
        var promArr = [];
        while (len--) {
          promArr.push(replaceWithSmart(inputObject[len], objParams, options));
        }
        Promise.all(promArr).then(values => {
          resolve(values);
        });
      } else {
        if (inputObject instanceof Object) {
          var keys = Object.keys(inputObject);
          var resObject = {};

          function execSerie(keys) {
            var sequence = Promise.resolve();
            keys.forEach(function (key) {
              sequence = sequence.then(function () {
                return replaceWithSmart(inputObject[key], objParams, options)
                  .then(function (res) {
                    var _value = res;
                    replaceWithNew(key, objParams, options)
                      .then(function (res) {
                        var _key = res;
                        if(keysUpperCase){
                          resObject[_key.toUpperCase()] = _value;
                        }else{
                          resObject[_key] = _value;
                        }
                      });
                  })
                  .catch(function (err) {
                    logger.log('error', 'replaceWithSmart function execSerie . Error ', err);
                  });
              });
            });
            return sequence;
          };

          execSerie(keys)
            .then(function () {
              resolve(resObject);
            })
            .catch(function (err) {
              logger.log('error', 'replaceWithSmart execSerie. Error ', err);
              resolve(inputObject);
            });
        } else {
          resolve(inputObject);
        }
      }
    }
  });
}

module.exports.replaceWithSmart = replaceWithSmart;

function addGlobalValuesToObjParams(objParams) {
  var gvl = global.config.global_values.length;
  var gv = {};

  while (gvl--) {
    var keymaster = Object.keys(global.config.global_values[gvl])[0];
    var valueObjects = global.config.global_values[gvl][keymaster];
    var keysValueObjects = Object.keys(valueObjects);
    var keysValueObjectsLength = keysValueObjects.length;

    while (keysValueObjectsLength--) {
      var valueKey = keysValueObjects[keysValueObjectsLength];
      var intialValue = global.config.global_values[gvl][keymaster][valueKey];

      if (intialValue instanceof Object) {

        if (intialValue.format === 'text') {

          if (intialValue.value instanceof Array) {

            var valuesLength = intialValue.value.length;
            var i = 0;
            var finalValue = '';

            while (valuesLength--) {
              var rtext = replaceWith(intialValue.value[i], objParams, true);

              var quotechar = intialValue.quotechar || '';
              var delimiter = intialValue.delimiter || '';

              if (valuesLength !== 0) {
                finalValue = finalValue + quotechar + rtext + quotechar + delimiter;
              } else {
                finalValue = finalValue + quotechar + rtext + quotechar;
              }
              i++;
            }
            gv[keymaster.toUpperCase() + '_' + keysValueObjects[keysValueObjectsLength].toUpperCase()] = finalValue;

          } else {
            let value = replaceWith(intialValue.value, objParams, true);
            gv[keymaster.toUpperCase() + '_' + keysValueObjects[keysValueObjectsLength].toUpperCase()] = value;
          }

        } else {

          if (intialValue.format === 'json') {

            if (intialValue.value instanceof Object || intialValue.value instanceof Array) {
              gv[keymaster.toUpperCase() + '_' + keysValueObjects[keysValueObjectsLength].toUpperCase()] = replaceWith(JSON.stringify(intialValue.value), objParams, true);

            } else {
              gv[keymaster.toUpperCase() + '_' + keysValueObjects[keysValueObjectsLength].toUpperCase()] = replaceWith(intialValue.value, objParams, true);
            }
          }
        }

      } else {
        gv[keymaster.toUpperCase() + '_' + keysValueObjects[keysValueObjectsLength].toUpperCase()] = replaceWith(intialValue, objParams, true);
      }
    }
  }

  return Object.assign(gv, objParams);
}

module.exports.getChainByUId = function getChainByUId(chains, uId) {

  return new Promise(function (resolve) {
    var chainLength = chains.length;

    var res = false;

    while (chainLength-- && !res) {
      var chain = chains[chainLength];
      if (chain.uId === uId) {
        res = chain;
      } else {
        if (chain.processes && chain.processes.length) {
          var chainProcessesLength = chain.processes.length;
          while (chainProcessesLength-- && !res) {
            var process = chain.processes[chainProcessesLength];
            if (process.childs_chains) {
              getChainByUId(process.childs_chains, uId)
                .then((_res) => {
                  if (_res) {
                    res = _res;
                  }
                });
            }
          }
        }
      }
    }
    resolve(res);
  });

};

module.exports.getProcessByUId = function getProcessByUId(chains, uId) {

  var chainLength = chains.length;

  var res = false;

  while (chainLength-- && !res) {
    var chain = chains[chainLength];

    if (chain.processes) {
      var chainProcessesLength = chain.processes.length;

      while (chainProcessesLength-- && !res) {
        var process = chain.processes[chainProcessesLength];
        if (process.uId === uId) {
          res = process;
        } else {
          if (process.childs_chains) {
            var result = getProcessByUId(process.childs_chains, uId);
            if (result) {
              res = result;
            }
          }
        }
      }
    }
  }
  return res;
};

module.exports.checkEvaluation = function checkEvaluation(oper_left, condition, oper_right, values) {

  oper_left = replaceWith(oper_left, values);
  oper_right = replaceWith(oper_right, values);

  switch (condition) {
    case '==':
      return (oper_left === oper_right);
      break;
    case '!=':
      return (oper_left !== oper_right);
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
};

module.exports.requireDir = requireDir;

function requireDir(directory, filename) {

  // REQUIRE DIRECTORY:
  var container = {};
  var containerDirectory = path.join(__dirname, directory);
  var excludes = ['node_modules', 'git', 'snv'];

  return new Promise((resolve, reject) => {
    fs.readdir(containerDirectory, function (err, items) {
      if (err) {
        reject(err);
      }

      var dirs = items ? items.filter(function (i) {
        return !excludes.includes(i);
      }) : [];

      var dirsLength = dirs.length;
      while (dirsLength--) {
        if (fs.statSync(containerDirectory + dirs[dirsLength]).isDirectory()) {

          if (filename) {
            if (fs.existsSync(path.join(containerDirectory, dirs[dirsLength], filename))) {
              container[dirs[dirsLength]] = require(path.join(containerDirectory, dirs[dirsLength], filename));
            }
          } else {
            if (fs.existsSync(path.join(containerDirectory, dirs[dirsLength], dirs[dirsLength] + '.js'))) {
              container[dirs[dirsLength]] = require(path.join(containerDirectory, dirs[dirsLength], dirs[dirsLength] + '.js'));
            } else {
              if (path.join(containerDirectory, dirs[dirsLength], 'index.js')) {
                container[dirs[dirsLength]] = require(path.join(containerDirectory, dirs[dirsLength], 'index.js'));
              }
            }
          }
        }
      }
      resolve(container);
    });

  });
}

module.exports.chronometer = function chronometer(start) {
  if (start) {
    var endTime = process.hrtime(start);
    var duration = parseInt((endTime[0] * 1000) + (endTime[1] / 1000000));
    return [duration / 1000, moment.duration(duration).humanize()];
  } else {
    return process.hrtime();
  }
};