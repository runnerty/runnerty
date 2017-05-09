"use strict";

var winston = require("winston");
var fs = require("fs");
var path = require("path");
var configSchema = require("./schemas/conf.json");
var Ajv = require("ajv");
var ajv = new Ajv({allErrors: true});
var crypto = require("crypto");
var moment = require("moment");
var ics = require("ical2json");
var redis = require("redis");
var mongoose = require("mongoose");
var lodash = require("lodash");

const algorithm = "aes-256-ctr";

var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({colorize: "all", level: "info"}),
    // new (winston.transports.File)({name: "info-file", filename: "filelog-info.log", level: "info"}),
    // new (winston.transports.File)({name: "error-file",filename: "filelog-error.log",level: "error"}),
  ]
});

module.exports.logger = logger;


function encrypt(text, password) {
  var cipher = crypto.createCipher(algorithm, password || global.cryptoPassword);
  var crypted = cipher.update(text, "utf8", "hex");
  crypted += cipher.final("hex");
  return crypted;
}

module.exports.encrypt = encrypt;

function decrypt(text, password) {
  var decipher = crypto.createDecipher(algorithm, password || global.cryptoPassword);
  var dec = decipher.update(text, "hex", "utf8");
  dec += decipher.final("utf8");
  return dec;
}

module.exports.decrypt = decrypt;

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
  return new Promise((resolve, reject) => {
    var filePath = configFilePath;

    fs.stat(filePath, function (err, stats) {

      if (err || !stats.isFile()) {
        if (stats && !stats.isFile()) {
          reject(`Conf.json must be file but is set ${filePath}`);
        } else {
          reject(`Load General conf file ${filePath} not exists.`);
        }
      } else {

        try {
          fs.readFile(filePath, "utf8", function (err, res) {
            if (err) {
              reject(`Loading general configuration: ${err}`);
            } else {

              // CONFIG DEFAULTS:
              fs.readFile(path.join(__dirname, "./config/defaults.json"), "utf8", function (err, defaults) {
                var fileParsed;
                var defaultsFileParsed;
                var configLoad;

                if (err) {
                  logger.log("warn", "Loading default config file", err);
                } else {
                  if (defaults) {
                    try {
                      defaultsFileParsed = JSON.parse(defaults);
                    } catch (err) {
                      logger.log("error", `Parsing default configuration: ${err} ${err.stack}`);
                    }
                  }
                }

                try {
                  fileParsed = JSON.parse(res);
                  if (defaultsFileParsed) {
                    configLoad = lodash.defaultsDeep(fileParsed, defaultsFileParsed);
                  } else {
                    configLoad = fileParsed;
                  }
                } catch (err) {
                  reject(`Parsing general configuration: ${err} ${err.stack}`);
                }

                // ADD NOTIFICATORS SCHEMAS:
                var notificatorsPath = configLoad.config.general.notificatorsPath || path.join(path.dirname(configFilePath), "node_modules");
                var promiseNotificatorsSchemas = loadNotificators(notificatorsPath, configLoad.config.notificators);

                // ADD EXECUTORS SCHEMAS:
                var executorsPath = configLoad.config.general.executorsPath || path.join(path.dirname(configFilePath), "node_modules");
                var promiseExecutorsSchemas = loadExecutors(executorsPath, configLoad.config.executors);

                Promise.all([promiseNotificatorsSchemas, promiseExecutorsSchemas]).then(() => {
                  ajv.addSchema(configSchema, "configSchema");
                  ajv.validate("configSchema", configLoad);
                  var objConf = configLoad.config;
                  resolve(objConf);
                })
                  .catch((err) => {
                    reject(`Invalid Config file: ${err}`);
                  });
              });
            }
          });
        } catch (err) {
          reject(`Invalid Config file, incorrect JSON format: ${err} ${err.message}`);
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
          if (cnf.hasOwnProperty("crypted_password")) {
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
  return new Promise((resolve, reject) => {
    fs.stat(filePath, function (err) {
      if (err) {
        reject(`Load SQL file: ${err}`);
      } else {
        fs.readFile(filePath, "utf8", function (err, res) {
          if (err) {
            reject(`Load SQL file readFile: ${err}`);
          } else {
            resolve(res);
          }
        });
      }
    });
  });
};

function replaceWith(text, objParams, ignoreGlobalValues) {

  text = text || "";

  objParams = objParams || {};

  if (global.config.global_values && !ignoreGlobalValues) {
    objParams = addGlobalValuesToObjParams(objParams);
  }
  objParams.DD = objParams.DD || getDateString("DD");
  objParams.MM = objParams.MM || getDateString("MM");
  objParams.YY = objParams.YY || getDateString("YY");
  objParams.YYYY = objParams.YYYY || getDateString("YYYY");
  objParams.HH = objParams.HH || getDateString("HH");
  objParams.HH12 = objParams.HH12 || getDateString("hh");
  objParams.mm = objParams.mm || getDateString("mm");
  objParams.ss = objParams.ss || getDateString("ss");

  // MONTHS MMMM_[LANG]
  var months = text.toString().match(/\:MMMM_\w{2}/ig);

  if (months) {
    var monthsLength = months.length;

    while (monthsLength--) {
      var month = months[monthsLength].substr(1, 7);
      var monthLang = months[monthsLength].substr(6, 2);
      if (!objParams[month]) {
        objParams[month] = getDateString("MMMM", true, monthLang);
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
        objParams[shortMonth] = getDateString("MMM", true, shortMonthLang);
      }
    }
  }

  // DAYS DDDD_[LANG]
  var days = text.toString().match(/\:DDDD_\w{2}/ig);

  if (days) {
    var daysLength = days.length;

    while (daysLength--) {
      var day = days[daysLength].substr(1, 7);
      let lang = days[daysLength].substr(6, 2);
      if (!objParams[day]) {
        objParams[day] = getDateString("dddd", true, lang);
      }
    }
  }

  // SHORT DAYS DDD_[LANG]
  var shortDays = text.toString().match(/\:DDD_\w{2}/ig);

  if (shortDays) {
    var shortDaysLength = shortDays.length;

    while (shortDaysLength--) {
      var shortDay = shortDays[shortDaysLength].substr(1, 6);
      let lang = shortDays[shortDaysLength].substr(5, 2);
      if (!objParams[shortDay]) {
        objParams[shortDay] = getDateString("ddd", true, lang);
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
    text = text.toString().replace(new RegExp("\\:" + keys[keysLengthFirst], "ig"), objParams[keys[keysLengthFirst]] || "");
  }

  // SECOND TURN
  while (keysLengthSecond--) {
    text = text.toString().replace(new RegExp("\\:" + keys[keysLengthSecond], "ig"), objParams[keys[keysLengthSecond]] || "");
  }

  return text;
}

module.exports.replaceWith = replaceWith;


function replaceWithNew(text, objParams, options) {

  //OPTIONS:
  var ignoreGlobalValues = options ? (options.ignoreGlobalValues || false) : false;
  var altValueReplace = options ? (options.altValueReplace || "") : "";
  var insensitiveCase = options ? ((options.insensitiveCase ? "i" : "") || "") : "";

  return new Promise(function (resolve) {
    text = text || "";

    objParams = objParams || {};
    text = text || "";

    objParams = objParams || {};

    if (global.config.global_values && !ignoreGlobalValues) {
      objParams = addGlobalValuesToObjParams(objParams);
    }

    objParams.DD = objParams.DD || getDateString("DD");
    objParams.MM = objParams.MM || getDateString("MM");
    objParams.YY = objParams.YY || getDateString("YY");
    objParams.YYYY = objParams.YYYY || getDateString("YYYY");
    objParams.HH = objParams.HH || getDateString("HH");
    objParams.HH12 = objParams.HH12 || getDateString("hh");
    objParams.mm = objParams.mm || getDateString("mm");
    objParams.ss = objParams.ss || getDateString("ss");

// MONTHS MMMM_[LANG]
    var months = text.toString().match(/\:MMMM_\w{2}/ig);

    if (months) {
      var monthsLength = months.length;

      while (monthsLength--) {
        var month = months[monthsLength].substr(1, 7);
        var monthLang = months[monthsLength].substr(6, 2);
        if (!objParams[month]) {
          objParams[month] = getDateString("MMMM", true, monthLang);
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
          objParams[shortMonth] = getDateString("MMM", true, shortMonthLang);
        }
      }
    }

// DAYS DDDD_[LANG]
    var days = text.toString().match(/\:DDDD_\w{2}/ig);

    if (days) {
      var daysLength = days.length;

      while (daysLength--) {
        var day = days[daysLength].substr(1, 7);
        let lang = days[daysLength].substr(6, 2);
        if (!objParams[day]) {
          objParams[day] = getDateString("dddd", true, lang);
        }
      }
    }

// SHORT DAYS DDD_[LANG]
    var shortDays = text.toString().match(/\:DDD_\w{2}/ig);

    if (shortDays) {
      var shortDaysLength = shortDays.length;

      while (shortDaysLength--) {
        var shortDay = shortDays[shortDaysLength].substr(1, 6);
        let lang = shortDays[shortDaysLength].substr(5, 2);
        if (!objParams[shortDay]) {
          objParams[shortDay] = getDateString("ddd", true, lang);
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
      text = text.toString().replace(new RegExp("\\:" + keys[keysLengthFirst], insensitiveCase + "g"), objParams[keys[keysLengthFirst]] || altValueReplace);
    }

// SECOND TURN
    while (keysLengthSecond--) {
      text = text.toString().replace(new RegExp("\\:" + keys[keysLengthSecond], insensitiveCase + "g"), objParams[keys[keysLengthSecond]] || altValueReplace);
    }

    if (altValueReplace) {
      text = text.toString().replace(new RegExp("\\:\\w+", insensitiveCase + "g"), altValueReplace);
    }

    resolve(text);
  });
}

module.exports.replaceWithNew = replaceWithNew;

function replaceWithSmart(inputObject, objParams, options) {

  //OPTIONS:
  var keysUpperCase = options ? (options.keysUpperCase || false) : false;

  return new Promise(function (resolve) {
    if (typeof inputObject === "string") {
      replaceWithNew(inputObject, objParams, options)
        .then((res) => {
          resolve(res);
        });
    } else {
      if (inputObject instanceof Array) {
        var promArr = [];
        for (var i = 0; i < inputObject.length; i++) {
          promArr.push(replaceWithSmart(inputObject[i], objParams, options));
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
                        if (keysUpperCase) {
                          resObject[_key.toUpperCase()] = _value;
                        } else {
                          resObject[_key] = _value;
                        }
                      });
                  })
                  .catch(function (err) {
                    logger.log("error", "replaceWithSmart function execSerie . Error ", err);
                  });
              });
            });
            return sequence;
          }

          execSerie(keys)
            .then(function () {
              resolve(resObject);
            })
            .catch(function (err) {
              logger.log("error", "replaceWithSmart execSerie. Error ", err);
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

        if (intialValue.format === "text") {

          if (intialValue.value instanceof Array) {

            var valuesLength = intialValue.value.length;
            var i = 0;
            var finalValue = "";

            while (valuesLength--) {
              var rtext = replaceWith(intialValue.value[i], objParams, true);

              var quotechar = intialValue.quotechar || "";
              var delimiter = intialValue.delimiter || "";

              if (valuesLength !== 0) {
                finalValue = finalValue + quotechar + rtext + quotechar + delimiter;
              } else {
                finalValue = finalValue + quotechar + rtext + quotechar;
              }
              i++;
            }
            gv[keymaster.toUpperCase() + "_" + keysValueObjects[keysValueObjectsLength].toUpperCase()] = finalValue;

          } else {
            let value = replaceWith(intialValue.value, objParams, true);
            gv[keymaster.toUpperCase() + "_" + keysValueObjects[keysValueObjectsLength].toUpperCase()] = value;
          }

        } else {

          if (intialValue.format === "json") {

            if (intialValue.value instanceof Object || intialValue.value instanceof Array) {
              gv[keymaster.toUpperCase() + "_" + keysValueObjects[keysValueObjectsLength].toUpperCase()] = replaceWith(JSON.stringify(intialValue.value), objParams, true);

            } else {
              gv[keymaster.toUpperCase() + "_" + keysValueObjects[keysValueObjectsLength].toUpperCase()] = replaceWith(intialValue.value, objParams, true);
            }
          }
        }

      } else {
        gv[keymaster.toUpperCase() + "_" + keysValueObjects[keysValueObjectsLength].toUpperCase()] = replaceWith(intialValue, objParams, true);
      }
    }
  }

  Object.assign(gv, objParams);

  return gv;
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
    case "==":
      return (oper_left === oper_right);
    case "!=":
      return (oper_left !== oper_right);
    case ">=":
      return (oper_left >= oper_right);
    case "<=":
      return (oper_left <= oper_right);
    default:
      return false;
  }
};

function requireDir(directory, modules) {

  var modulesTypes = [];
  if (modules) {
    for (var i = 0; i < modules.length; i++) {
      if (modules[i].type) {
        modulesTypes.push(modules[i].type);
      }
    }
  }

  // REQUIRE DIRECTORY:
  var container = {};
  var containerDirectory = directory;

  return new Promise((resolve, reject) => {
    fs.readdir(containerDirectory, function (err, items) {
      if (err) {
        reject(err);
      }

      var dirs = items ? items.filter(function (i) {
        return modulesTypes.includes(i);
      }) : [];

      var dirsLength = dirs.length;
      while (dirsLength--) {
        if (fs.statSync(path.join(containerDirectory, dirs[dirsLength])).isDirectory()) {
          if (fs.existsSync(path.join(containerDirectory, dirs[dirsLength], dirs[dirsLength] + ".js"))) {
            container[dirs[dirsLength]] = require(path.join(containerDirectory, dirs[dirsLength], dirs[dirsLength] + ".js"));
          } else {
            if (path.join(containerDirectory, dirs[dirsLength], "index.js")) {
              container[dirs[dirsLength]] = require(path.join(containerDirectory, dirs[dirsLength], "index.js"));
            }
          }
        }
      }
      resolve(container);
    });

  });
}
module.exports.requireDir = requireDir;

module.exports.chronometer = function chronometer(start) {
  if (start) {
    var endTime = process.hrtime(start);
    var duration = parseInt((endTime[0] * 1000) + (endTime[1] / 1000000));
    return [duration / 1000, moment.duration(duration).humanize()];
  } else {
    return process.hrtime();
  }
};

function isDateInEvents(date, events) {
  return new Promise((resolve) => {
    var evDate = parseInt(date.toISOString().slice(0, 10).replace(/-/g, ""));
    var lengthEvents = Object.keys(events).length;
    var found = false;
    while (lengthEvents-- && !found) {
      let key = Object.keys(events)[lengthEvents];
      let event = events[key];
      if (evDate >= event.start && evDate <= event.end) {
        found = true;
      }
    }
    resolve(found);
  });
}

module.exports.checkCalendar = function checkCalendar(calendars, execDate) {
  return new Promise(async function (resolve) {
    if (!execDate) {
      execDate = new Date();
    }

    var chainMustRun = true;
    if (calendars.enable && calendars.enable !== "") {
      if (global.calendars[calendars.enable]) {
        var enableEvents = global.calendars[calendars.enable];
        chainMustRun = await isDateInEvents(execDate, enableEvents);
      } else {
        logger.log("error", `Calendar enable ${calendars.enable} not found`);
      }
    }

    if (calendars.disable && calendars.disable !== "" && chainMustRun) {
      if (global.calendars[calendars.disable]) {
        var disableEvents = global.calendars[calendars.disable];
        chainMustRun = !await isDateInEvents(execDate, disableEvents);
      } else {
        logger.log("error", `Calendar disable ${calendars.disable} not found`);
      }
    }
    resolve(chainMustRun);
  });
};


function generateCalendar(file) {
  return new Promise((resolve) => {
    var fileName = path.parse(file).name;
    var fileExt = path.parse(file).ext;
    if (fileExt === ".ics") {
      var filePath = path.join(global.config.general.calendarsPath, file);
      var parsedCal = {};
      fs.readFile(filePath, {encoding: "utf8"}, function (err, data) {
        if (err) {
          logger.log("error", "Calendars readFile: ", err);
        } else {
          parsedCal = ics.convert(data).VCALENDAR[0].VEVENT;
          var calEvents = [];
          for (var i = 0; i < parsedCal.length; i++) {
            var event = {};
            event.start = parseInt(parsedCal[i]["DTSTART;VALUE=DATE"]);
            event.end = parseInt(parsedCal[i]["DTEND;VALUE=DATE"]);
            event.summary = parsedCal[i]["SUMMARY"];
            calEvents.push(event);
          }
          global.calendars[fileName] = calEvents;
          resolve();
        }
      });
    }
  });
}

module.exports.loadCalendars = function loadCalendars() {
  return new Promise((resolve) => {
    global.calendars = {};
    if (global.config.general.calendarsPath) {
      fs.readdir(global.config.general.calendarsPath, (err, files) => {
        for (var i = 0; i < files.length; i++) {
          generateCalendar(files[i]);
        }
        resolve();
      });
    }else{
      resolve();
    }
  });
};

module.exports.loadQueueNotifications = function loadQueueNotifications() {
  return new Promise((resolve) => {
    global.notificatorList = {};
    global.notificationsList = {};
    if (global.config.general.queue_notifications && global.config.general.queue_notifications.queue) {
      // REDIS QUEUE NOTIFICATIONS:
      if (global.config.general.queue_notifications.queue === "redis") {
        var redisClient = redis.createClient(global.config.general.queue_notifications.port || "6379", global.config.general.queue_notifications.host, global.config.general.queue_notifications.options);
        if (global.config.general.queue_notifications.password && global.config.general.queue_notifications.password !== "") {
          redisClient.auth(global.config.general.queue_notifications.password);
        }
        redisClient.on("error", function (err) {
          logger.log("error", `Could not connect to Redis (Queue): ${err}`);
          resolve();
        });

        redisClient.on("ready", function () {
          global.queueRedisCli = redisClient;
          global.config.queueNotificationsExternal = "redis";
          resolve();
        });
      }else{
        resolve();
      }
    }else{
      resolve();
    }
  });
};

module.exports.loadMongoHistory = function loadMongoHistory() {
  var config = global.config;
  return new Promise((resolve) => {
    if (config.general.history && config.general.history.mongodb && (config.general.history.disable !== true)) {
      global.config.historyEnabled = true;
      mongoose.connect(`mongodb://${config.general.history.mongodb.host}:${config.general.history.mongodb.port}/runnerty`)
        .then(() => {
          resolve();
        },
        err => {
          resolve();
          logger.log("error", `Mongodb connection error ${err}`);
        });
    } else {
      global.config.historyEnabled = false;
      resolve();
    }
  });
};

module.exports.mongooseCloseConnection = function mongooseCloseConnection() {
  mongoose.connection.close(function () {
    process.exit(0);
  });
};

function loadExecutors(executorsPath, executors) {
  return new Promise((resolve, reject) => {
    global.executors = {};
    requireDir(executorsPath, executors)
      .then((res) => {
        if (Object.keys(res).length !== 0) {
          let executorsInConfig = {};
          var items = {};
          items.anyOf = [];
          for (var i = 0; i < executors.length; i++) {
            let ex = executors[i].type;
            if (res[ex]) {
              let exSchema = path.join(executorsPath, ex, "schema.json");
              if (fs.existsSync(exSchema)) {
                executorsInConfig[ex] = res[ex];
                let schemaContent = require(exSchema);
                items.anyOf.push({"$ref": ex + "#/definitions/config"});
                ajv.addSchema(schemaContent, ex);

                if (!ajv.getSchema("exec_" + ex)) {
                  ajv.addSchema(schemaContent.definitions.params, "exec_" + ex);
                }

              } else {
                logger.log("error", `Schema not found in executor ${ex}`);
              }
            } else {
              logger.log("error", `Executor type ${ex} in config not found in executors path: ${executorsPath}`);
            }
          }
          configSchema.properties.config.properties.executors.items = items;
          global.executors = executorsInConfig;
        }
        resolve();
      })
      .catch((err) => {
        reject(err);
      });
  });
}
module.exports.loadExecutors = loadExecutors;

function loadNotificators(notificatorsPath, notificators) {
  return new Promise((resolve, reject) => {
    global.notificators = {};
    requireDir(notificatorsPath, notificators)
      .then((res) => {
        if (Object.keys(res).length !== 0) {
          let notificatorsInConfig = {};
          var items = {};
          items.anyOf = [];
          for (var i = 0; i < notificators.length;) {
            let no = notificators[i].type;
            if (res[no]) {
              let noSchema = path.join(notificatorsPath, no, "schema.json");
              if (fs.existsSync(noSchema)) {
                notificatorsInConfig[no] = res[no];
                let schemaContent = require(noSchema);
                items.anyOf.push({"$ref": no + "#/definitions/config"});
                ajv.addSchema(schemaContent, no);

                if (!ajv.getSchema("notif_" + no)) {
                  ajv.addSchema(schemaContent.definitions.params, "notif_" + no);
                }

              } else {
                logger.log("error", `Schema not found in executor ${no}`);
              }
              i++;
            } else {
              notificators.splice(i, 1);
              logger.log("error", `Notificators type ${no} in config not found in notificators path: ${notificatorsPath}`);
            }
          }
          configSchema.properties.config.properties.notificators.items = items;
          global.notificators = notificatorsInConfig;
        }
        resolve();
      })
      .catch((err) => {
        reject(err);
      });
  });
}
module.exports.loadNotificators = loadNotificators;

function checkExecutorParams(executor) {
  return new Promise((resolve, reject) => {
    let executorId = executor.type;

    if (ajv.getSchema("exec_" + executorId)) {
      var valid = false;
      try{
        valid = ajv.validate("exec_" + executorId, executor);
        if(valid){
          resolve();
        }else{
          reject(ajv.errors);
        }
      }catch(err){
        reject(`Executor params: ${err}`);
      }
    } else {
      reject(`Schema of params not found in executor ${executorId}`);
    }
  });
}
module.exports.checkExecutorParams = checkExecutorParams;

function checkNotificatorParams(notification) {
  return new Promise((resolve, reject) => {

    let notificatorId = notification.type;
    if (ajv.getSchema("notif_" + notificatorId)) {
      var valid = false;
      try{
        valid = ajv.validate("notif_" + notificatorId, notification);
        if(valid){
          resolve();
        }else{
          reject(ajv.errors);
        }
      }catch(err){
        reject(`Notificator params: ${err}`);
      }
    } else {
      reject(`Schema of params not found in notificator ${notificatorId}`);
    }
  });
}
module.exports.checkNotificatorParams = checkNotificatorParams;

function loadAPI() {
  if (global.config.general.api && global.config.general.api.port && global.config.general.api.users) {
    require("../api/api.js")();
  }
}
module.exports.loadAPI = loadAPI;