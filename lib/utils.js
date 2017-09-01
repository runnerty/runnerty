"use strict";

const winston = require("winston");
const fs = require("fs");
const path = require("path");
const configSchema = require("./schemas/config.json");
const Ajv = require("ajv");
const ajv = new Ajv({allErrors: true});
const crypto = require("crypto");
const moment = require("moment");
const ics = require("ical2json");
const redis = require("redis");
const mongoose = require("mongoose");
const lodash = require("lodash");

const algorithm = "aes-256-ctr";

const debugMode = (process.env.RUNNERTY_DEBUG == "true");
const logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({colorize: "all", level: (debugMode)?"debug":"info"})
  ]
});

module.exports.logger = logger;


function encrypt(text, password) {
  let cipher = crypto.createCipher(algorithm, password || global.cryptoPassword);
  let crypted = cipher.update(text, "utf8", "hex");
  crypted += cipher.final("hex");
  return crypted;
}

module.exports.encrypt = encrypt;

function decrypt(text, password) {
  let decipher = crypto.createDecipher(algorithm, password || global.cryptoPassword);
  let dec = decipher.update(text, "hex", "utf8");
  dec += decipher.final("utf8");
  return dec;
}

module.exports.decrypt = decrypt;

function getDateString(format, uppercase, lang, increment) {
  if (lang && lang !== "") {
    moment.locale(lang.toLowerCase());
  }else{
    moment.locale("en");
  }

  let strDate = "";

  if (increment){
    strDate = moment().add(increment.number, increment.period).format(format);
  }else{
    strDate = moment().format(format);
  }

  if (uppercase) {
    strDate = strDate.toUpperCase();
  }

  return strDate;
}

module.exports.loadGeneralConfig = function loadGeneralConfig(configFilePath) {
  return new Promise((resolve, reject) => {
    const filePath = configFilePath;

    fs.stat(filePath, (err, stats) => {

      if (err || !stats.isFile()) {
        if (stats && !stats.isFile()) {
          reject(`config.json must be file but is set ${filePath}`);
        } else {
          reject(`Load General conf file ${filePath} not exists.`);
        }
      } else {

        try {
          fs.readFile(filePath, "utf8", (err, res) => {
            if (err) {
              reject(`Loading general configuration: ${err}`);
            } else {

              // CONFIG DEFAULTS:
              fs.readFile(path.join(__dirname, "./config/defaults.json"), "utf8", (err, defaults) => {
                let fileParsed;
                let defaultsFileParsed;
                let configLoad = {};

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
                  let conf;
                  fileParsed = JSON.parse(res);

                  // Compatibility json struct started with config object or without
                  if(fileParsed.config){
                    conf = fileParsed.config;
                  }else{
                    conf = fileParsed;
                  }
                  if (defaultsFileParsed) {
                    conf = lodash.defaultsDeep(conf, defaultsFileParsed);
                  }
                  configLoad.config = conf;
                } catch (err) {
                  reject(`Parsing general configuration: ${err} ${err.stack}`);
                }

                // ADD NOTIFICATORS SCHEMAS:
                const notificatorsPath = configLoad.config.general.notificatorsPath || path.join(path.dirname(configFilePath), "node_modules");
                const promiseNotificatorsSchemas = loadNotificators(notificatorsPath, configLoad.config.notificators);

                // ADD EXECUTORS SCHEMAS:
                const executorsPath = configLoad.config.general.executorsPath || path.join(path.dirname(configFilePath), "node_modules");
                const promiseExecutorsSchemas = loadExecutors(executorsPath, configLoad.config.executors);

                // ADD TRIGGERS SCHEMAS:
                const triggersPath = configLoad.config.general.triggersPath || path.join(path.dirname(configFilePath), "node_modules");
                const promiseTriggersSchemas = loadTriggers(triggersPath, configLoad.config.triggers);

                Promise.all([promiseNotificatorsSchemas, promiseExecutorsSchemas, promiseTriggersSchemas]).then(() => {

                  ajv.addSchema(configSchema, "configSchema");
                  const valid = ajv.validate("configSchema", configLoad);

                  if(!valid){
                    reject(ajv.errors);
                  }else{
                    resolve(configLoad.config);
                  }
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

function loadConfigSection(config, section, id_config) {
  return new Promise((resolve, reject) => {

    if (config.hasOwnProperty(section)) {
      let sectionLength = config[section].length;
      let cnf;
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
        if(cnf.hasOwnProperty("type")){
          // MODULES INSIDE @runnerty (Tyoe replacing first dash by slash)
          if(cnf.type.startsWith("@") && cnf.type.indexOf(path.sep) === -1){
            let fdash = cnf.type.indexOf("-");
            if(fdash){
              let dir = cnf.type.substring(0,fdash);
              let module = cnf.type.substring(fdash+1);
              cnf.type = dir + path.sep + module;
            }
          }
        }
        resolve(cnf);
      } else {
        reject(`Config for ${id_config} not found in section ${section}`);
      }
    } else {
      reject(`Section ${section} not found in config file.`, config);
    }
  });
}

module.exports.loadConfigSection = loadConfigSection;

module.exports.loadSQLFile = function loadSQLFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (err) => {
      if (err) {
        reject(`Load SQL file: ${err}`);
      } else {
        fs.readFile(filePath, "utf8", (err, res) => {
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

/**
 * Get Environment variables.
 * @param text
 * @returns {Promise}
 */
function getENVs(text) {
  return new Promise(resolve => {
    let objParams = {};

    //:ENV_[ENVIRONMENT VARIABLE NAME]
    const envs = text.toString().match(/:ENV_\w+/g);
    if (envs) {
      let envsLength = envs.length;

      while (envsLength--) {
        let envName = envs[envsLength].substr(5, envs[envsLength].length);
        objParams[envs[envsLength].substr(1)] = (process.env[envName])?process.env[envName]:"";
      }
    }
    resolve(objParams);
  });
}

/**
 * Generate date values with language and/or increment.
 * @param text
 * @returns {Promise}
 */
function getObjsCustomDates(text){

  return new Promise(async (resolve) => {
    let objParams = {};

    // YEARS YYYY_[INCREMENT]
    const yearsInc = text.toString().match(/:YYYY_[-,+]?[0-9]{1,2}(?!_)\b/ig);

    if (yearsInc) {
      let yearsIncLength = yearsInc.length;

      while (yearsIncLength--) {
        const year = yearsInc[yearsIncLength].substr(1, 7);
        const yearInc = yearsInc[yearsIncLength].substr(6, year.length);
        let incremetObj = {};
        incremetObj.period = "years";
        incremetObj.number = yearInc;
        if (!objParams[year]) {
          objParams[year] = getDateString("YYYY", true, "", incremetObj);
        }
      }
    }

    // YEARS YY_[INCREMENT]
    const shortYearsInc = text.toString().match(/:YY_[-,+]?[0-9]{1,2}(?!_)\b/ig);

    if (shortYearsInc) {
      let shortYearsIncLength = shortYearsInc.length;

      while (shortYearsIncLength--) {
        const shortYear = shortYearsInc[shortYearsIncLength].substr(1, 5);
        const shortYearInc = shortYearsInc[shortYearsIncLength].substr(4, shortYear.length);
        let incremetObj = {};
        incremetObj.period = "years";
        incremetObj.number = shortYearInc;
        if (!objParams[shortYear]) {
          objParams[shortYear] = getDateString("YY", true, "", incremetObj);
        }
      }
    }

    // MONTHS MMMM_[LANG]
    const months = text.toString().match(/:MMMM_[a-zA-Z]{2}/ig);

    if (months) {
      let monthsLength = months.length;

      while (monthsLength--) {
        const month = months[monthsLength].substr(1, 7);
        const monthLang = months[monthsLength].substr(6, 2);
        if (!objParams[month]) {
          objParams[month] = getDateString("MMMM", true, monthLang);
        }
      }
    }


    // MONTHS MMMM_[INCREMENT]
    const monthsInc = text.toString().match(/:MMMM_[-,+]?[0-9]{1,2}(?!_)\b/ig);

    if (monthsInc) {
      let monthsIncLength = monthsInc.length;

      while (monthsIncLength--) {
        const month = monthsInc[monthsIncLength].substr(1, 7);
        const monthInc = monthsInc[monthsIncLength].substr(6, month.length);
        let incremetObj = {};
        incremetObj.period = "months";
        incremetObj.number = monthInc;
        if (!objParams[month]) {
          objParams[month] = getDateString("MMMM", true, "", incremetObj);
        }
      }
    }

    // MONTHS MMMM_[INCREMENT]_[LANG]
    const monthsIncLang = text.toString().match(/:MMMM_[-,+]?[0-9]{1,2}_[a-zA-Z]{2}/ig);

    if (monthsIncLang) {
      let monthsLength = monthsIncLang.length;

      while (monthsLength--) {
        const month = monthsIncLang[monthsLength];
        const incLang = month.substr(6, month.length);
        const posInitLang = incLang.indexOf("_");
        const monthIncremet = incLang.substr(0,posInitLang);
        const monthLang = incLang.substr(posInitLang+1);

        let incremetObj = {};
        incremetObj.period = "months";
        incremetObj.number = monthIncremet;

        if (!objParams[month.substr(1)]) {
          objParams[month.substr(1)] = getDateString("MMMM", true, monthLang, incremetObj);
        }
      }
    }


    // SHORT MONTHS MMM_[LANG]
    const shortMonths = text.toString().match(/:MMM_[a-zA-Z]{2}/ig);

    if (shortMonths) {
      let shortMonthsLength = shortMonths.length;

      while (shortMonthsLength--) {
        const shortMonth = shortMonths[shortMonthsLength].substr(1, 6);
        const shortMonthLang = shortMonths[shortMonthsLength].substr(5, 2);
        if (!objParams[shortMonth]) {
          objParams[shortMonth] = getDateString("MMM", true, shortMonthLang);
        }
      }
    }

    // SHORT MONTHS MMM_[INCREMENT]
    const shortMonthsInc = text.toString().match(/:MMM_[-,+]?[0-9]{1,2}(?!_)\b/ig);

    if (shortMonthsInc) {
      let shortMonthsIncLength = shortMonthsInc.length;

      while (shortMonthsIncLength--) {
        const shortMonth = shortMonthsInc[shortMonthsIncLength];
        const shortMonthInc = shortMonthsInc[shortMonthsIncLength].substr(5, shortMonth.length);
        let incremetObj = {};
        incremetObj.period = "months";
        incremetObj.number = shortMonthInc;

        if (!objParams[shortMonth.substr(1)]) {
          objParams[shortMonth.substr(1)] = getDateString("MMM", true, "", incremetObj);
        }
      }
    }

    // SHORT MONTHS MMM_[INCREMENT]_[LANG]
    const shortmonthsIncLang = text.toString().match(/:MMM_[-,+]?[0-9]{1,2}_[a-zA-Z]{2}/ig);

    if (shortmonthsIncLang) {
      let shortMonthsLength = shortmonthsIncLang.length;

      while (shortMonthsLength--) {
        const shortMonth = shortmonthsIncLang[shortMonthsLength];
        const incLang = shortMonth.substr(5, shortMonth.length);
        const posInitLang = incLang.indexOf("_");
        const shortMonthIncremet = incLang.substr(0,posInitLang);
        const shortMonthLang = incLang.substr(posInitLang+1);

        let incremetObj = {};
        incremetObj.period = "months";
        incremetObj.number = shortMonthIncremet;

        if (!objParams[shortMonth.substr(1)]) {
          objParams[shortMonth.substr(1)] = getDateString("MMM", true, shortMonthLang, incremetObj);
        }
      }
    }

    // MONTHS NUM. MM_[INCREMENT]
    const monthsNumInc = text.toString().match(/:MM_[-,+]?[0-9]{1,2}(?!_)\b/ig);

    if (monthsNumInc) {
      let monthsNumIncLength = monthsNumInc.length;

      while (monthsNumIncLength--) {
        const month = monthsNumInc[monthsNumIncLength];
        const monthInc = monthsNumInc[monthsNumIncLength].substr(4, month.length);
        let incremetObj = {};
        incremetObj.period = "months";
        incremetObj.number = monthInc;
        if (!objParams[month.substr(1)]) {
          objParams[month.substr(1)] = getDateString("MM", true, "", incremetObj);
        }
      }
    }

    // MONTHS NUM. OUTPUT YEAR OR WEEK: MM_[INCREMENT]_[YYYY|YY|WW]
    const monthsNumIncY = text.toString().match(/:MM_[-,+]?[0-9]{1,2}_(YYYY|YY|WW)/ig);

    if (monthsNumIncY) {
      let monthsNumIncLength = monthsNumIncY.length;

      while (monthsNumIncLength--) {
        const month = monthsNumIncY[monthsNumIncLength];
        const outputFormatPosition = month.lastIndexOf("_");
        const outputFormat = month.substr(outputFormatPosition+1, month.length - outputFormatPosition).toUpperCase();
        const monthInc = month.substr(4, outputFormatPosition - 4);
        let incremetObj = {};
        incremetObj.period = "months";
        incremetObj.number = monthInc;
        if (!objParams[month.substr(1)]) {
          objParams[month.substr(1)] = getDateString(outputFormat, true, "", incremetObj);
        }
      }
    }

    // WEEKS WW_[INCREMENT]
    const weeksInc = text.toString().match(/:WW_[-,+]?[0-9]{1,2}(?!_)\b/ig);

    if (weeksInc) {
      let weeksIncLength = weeksInc.length;

      while (weeksIncLength--) {
        const week = weeksInc[weeksIncLength];
        const weekInc = weeksInc[weeksIncLength].substr(4, week.length);
        let incremetObj = {};
        incremetObj.period = "weeks";
        incremetObj.number = weekInc;
        if (!objParams[week.substr(1)]) {
          objParams[week.substr(1)] = getDateString("WW", true, "", incremetObj);
        }
      }
    }

    // WEEKS OUTPUT YEAR OR MONTHS: WW_[INCREMENT]_[YYYY|YY|MM]
    const weeksIncYM = text.toString().match(/:WW_[-,+]?[0-9]{1,2}_(YYYY|YY|MM)/ig);

    if (weeksIncYM) {
      let weeksIncYMLength = weeksIncYM.length;

      while (weeksIncYMLength--) {
        const week = weeksIncYM[weeksIncYMLength];
        const outputFormatPosition = week.lastIndexOf("_");
        const outputFormat = week.substr(outputFormatPosition+1, week.length - outputFormatPosition).toUpperCase();
        const weekInc = week.substr(4, outputFormatPosition - 4);
        let incremetObj = {};
        incremetObj.period = "weeks";
        incremetObj.number = weekInc;
        if (!objParams[week.substr(1)]) {
          objParams[week.substr(1)] = getDateString(outputFormat, true, "", incremetObj);
        }
      }
    }

    // DAYS DDDD_[LANG]
    const days = text.toString().match(/:DDDD_[a-zA-Z]{2}/ig);

    if (days) {
      let daysLength = days.length;

      while (daysLength--) {
        const day = days[daysLength].substr(1, 7);
        const lang = days[daysLength].substr(6, 2);
        if (!objParams[day]) {
          objParams[day] = getDateString("dddd", true, lang);
        }
      }
    }

    // DAYS DDDD_[INCREMENT]
    const daysInc = text.toString().match(/:DDDD_[-,+]?[0-9]{1,2}(?!_)\b/ig);

    if (daysInc) {
      let daysIncLength = daysInc.length;

      while (daysIncLength--) {
        const day = daysInc[daysIncLength].substr(1, 7);
        const dayInc = daysInc[daysIncLength].substr(6, day.length);
        let incremetObj = {};
        incremetObj.period = "days";
        incremetObj.number = dayInc;
        if (!objParams[day]) {
          objParams[day] = getDateString("dddd", true, "", incremetObj);
        }
      }
    }

    // DAYS DDDD_[INCREMENT]_[LANG]
    const daysIncLang = text.toString().match(/:DDDD_[-,+]?[0-9]{1,2}_[a-zA-Z]{2}/ig);

    if (daysIncLang) {
      let daysLength = daysIncLang.length;

      while (daysLength--) {
        const day = daysIncLang[daysLength];
        const incLang = day.substr(6, day.length);
        const posInitLang = incLang.indexOf("_");
        const dayIncremet = incLang.substr(0,posInitLang);
        const dayLang = incLang.substr(posInitLang+1);

        let incremetObj = {};
        incremetObj.period = "days";
        incremetObj.number = dayIncremet;

        if (!objParams[day.substr(1)]) {
          objParams[day.substr(1)] = getDateString("dddd", true, dayLang, incremetObj);
        }
      }
    }

    // SHORT DAYS DDD_[LANG]
    const shortDays = text.toString().match(/:DDD_[a-zA-Z]{2}/ig);

    if (shortDays) {
      let shortDaysLength = shortDays.length;

      while (shortDaysLength--) {
        const shortDay = shortDays[shortDaysLength].substr(1, 6);
        const lang = shortDays[shortDaysLength].substr(5, 2);
        if (!objParams[shortDay]) {
          objParams[shortDay] = getDateString("ddd", true, lang);
        }
      }
    }

    // DAYS DDD_[INCREMENT]
    const shortDaysInc = text.toString().match(/:DDD_[-,+]?[0-9]{1,2}(?!_)\b/ig);

    if (shortDaysInc) {
      let shortDaysIncLength = shortDaysInc.length;

      while (shortDaysIncLength--) {
        const shortDay = shortDaysInc[shortDaysIncLength].substr(1, 6);
        const shortDayInc = shortDaysInc[shortDaysIncLength].substr(5, shortDay.length);

        let incremetObj = {};
        incremetObj.period = "days";
        incremetObj.number = shortDayInc;

        if (!objParams[shortDay]) {
          objParams[shortDay] = getDateString("ddd", true, "", incremetObj);
        }
      }
    }

    // SHORT DAYS DDD_[INCREMENT]_[LANG]
    const shortdaysInc = text.toString().match(/:DDD_[-,+]?[0-9]{1,2}_[a-zA-Z]{2}/ig);

    if (shortdaysInc) {
      let shortdaysLength = shortdaysInc.length;

      while (shortdaysLength--) {
        const shortday = shortdaysInc[shortdaysLength];
        const incLang = shortday.substr(5, shortday.length);
        const posInitLang = incLang.indexOf("_");
        const shortdayIncremet = incLang.substr(0,posInitLang);
        const shortdayLang = incLang.substr(posInitLang+1);

        let incremetObj = {};
        incremetObj.period = "days";
        incremetObj.number = shortdayIncremet;

        if (!objParams[shortday.substr(1)]) {
          objParams[shortday.substr(1)] = getDateString("ddd", true, shortdayLang, incremetObj);
        }
      }
    }

    // DAYS OUTPUT WEEK, YEAR OR MONTH: DD_[INCREMENT]_[YYYY|YY|MM|WW]
    const dayNumInc = text.toString().match(/:DD_[-,+]?[0-9]{1,3}(?:_(YYYY|YY|MM|WW))?/ig);

    if (dayNumInc) {
      let dayNumIncLength = dayNumInc.length;

      while (dayNumIncLength--) {
        const day = dayNumInc[dayNumIncLength];
        let outputFormatPosition = day.lastIndexOf("_");
        let outputFormat = day.substr(outputFormatPosition+1, day.length - outputFormatPosition).toUpperCase();
        if (outputFormatPosition === 3){
          outputFormat = "DD";
          outputFormatPosition = day.length;
        }
        const daysInc = day.substr(4, outputFormatPosition - 4);
        let incremetObj = {};
        incremetObj.period = "days";
        incremetObj.number = daysInc;
        if (!objParams[day.substr(1)]) {
          objParams[day.substr(1)] = getDateString(outputFormat, true, "", incremetObj);
        }
      }
    }

    resolve(objParams);
  });

}

function replaceWith(text, objParams, options) {
  //OPTIONS:
  const ignoreGlobalValues = options ? (options.ignoreGlobalValues || false) : false;
  const altValueReplace = options ? (options.altValueReplace || "") : "";
  const insensitiveCase = options ? ((options.insensitiveCase ? "i" : "") || "") : "";

  return new Promise(async (resolve) => {
    text = text || "";

    objParams = objParams || {};
    text = text || "";

    objParams = objParams || {};

    if (global.config.global_values && !ignoreGlobalValues) {
      objParams = await addGlobalValuesToObjParams(objParams);
    }

    //Escape separator values
    objParams["#"] = "";

    objParams.DDDD = objParams.DDDD || getDateString("dddd",true);
    objParams.DDD = objParams.DDD || getDateString("ddd",true);
    objParams.DD = objParams.DD || getDateString("DD",true);
    objParams.WW = objParams.WW || getDateString("WW");
    objParams.MMMM = objParams.MMMM || getDateString("MMMM",true);
    objParams.MMM = objParams.MMM || getDateString("MMM",true);
    objParams.MM = objParams.MM || getDateString("MM",true);
    objParams.YY = objParams.YY || getDateString("YY");
    objParams.YYYY = objParams.YYYY || getDateString("YYYY");
    objParams.HH = objParams.HH || getDateString("HH");
    objParams.HH12 = objParams.HH12 || getDateString("hh");
    objParams.mm = objParams.mm || getDateString("mm");
    objParams.ss = objParams.ss || getDateString("ss");

    let envs = await getENVs(text);
    lodash.defaults(objParams, envs);

    let customDatesValues = await getObjsCustomDates(text);
    lodash.defaults(objParams, customDatesValues);

    let keys = Object.keys(objParams);

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
    let keysLengthFirst = keys.length;

    let replaMatch = false;
    for (let i = keysLengthFirst -1; i >= 0; i--) {
      if (replaMatch){
        envs = await getENVs(text);
        lodash.defaults(objParams, envs);
        customDatesValues = await getObjsCustomDates(text);
        lodash.defaults(objParams, customDatesValues);
        keys = Object.keys(objParams);
        keys.sort(orderByLength);
        i = keysLengthFirst -1;
      }
      replaMatch = false;

      if(typeof objParams[keys[i]] !== "undefined"){
        let keysEscape = keys[i].toString().replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
        let textRep = text.toString().replace(new RegExp("\\:" + keysEscape, insensitiveCase + "g"), objParams[keys[i]] || altValueReplace);
        if(text !== textRep && keys[i] !== "#") replaMatch = true;
        text = textRep;
      }
    }

    if (options && options.hasOwnProperty("altValueReplace")) {
      text = text.toString().replace(new RegExp("\\:\\w+", insensitiveCase + "g"), altValueReplace);
    }

    resolve(text);
  });
}

function replaceWithSmart(inputObject, objParams, options) {

  return new Promise(async (resolve) => {
    if (typeof inputObject === "string") {
      let res = await replaceWith(inputObject, objParams, options);
      resolve(res);
    } else {
      if (inputObject instanceof Array) {
        let promArr = [];
        for (let i = 0; i < inputObject.length; i++) {
          promArr.push(replaceWithSmart(inputObject[i], objParams, options));
        }
        Promise.all(promArr).then(values => {
          resolve(values);
        });
      } else {
        if (inputObject instanceof Object) {
          const keys = Object.keys(inputObject);
          let resObject = {};

          for (const key of keys) {
            let _value = await replaceWithSmart(inputObject[key], objParams, options);
            let _key = await replaceWith(key, objParams, options);
            resObject[_key] = _value;
          }
          resolve(resObject);
        } else {
          resolve(inputObject);
        }
      }
    }
  });
}

module.exports.replaceWithSmart = replaceWithSmart;

function pick(object, allowed){
  let implicitAllowed = [];
  allowed.forEach(item => {
    let dotPos = item.indexOf(".");
    if(dotPos !== -1){
      implicitAllowed.push(item.substring(0,dotPos));
    }
  });
  allowed = lodash.union(allowed, implicitAllowed);
  let objPrepick = lodash.pick(object, allowed);
  const keys = Object.keys(objPrepick);
  for (const key of keys) {
    let prefKey = key + ".";
    let subAllowed = allowed.map(function (item) { if (item.startsWith(prefKey)) return item.replace(prefKey,"");});
    subAllowed = subAllowed.filter(Boolean);
    if (object[key] instanceof Array) {
      let itemsAllowed = [];
      for (const items of object[key]) {
        let pickItem = pick(items, subAllowed);
        if(pickItem){
          itemsAllowed.push(pickItem);
        }
      }
      objPrepick[key] = itemsAllowed;
    }else{
      if (object[key] instanceof Object) {
        objPrepick[key] = pick(object[key], subAllowed);
      }
    }
  }
  return objPrepick;
}

module.exports.pick = pick;

function addGlobalValuesToObjParams(objParams) {

  return new Promise(async (resolve) => {
    const gvs = global.config.global_values;
    let res = {};
    let rw_options = {
      ignoreGlobalValues: true
    };

    for (const gv of gvs) {
      const keymaster = Object.keys(gv)[0];
      const valueObjects = gv[keymaster];
      const keysValueObjects = Object.keys(valueObjects);

      for (const valueKey of keysValueObjects) {
        let intialValue = gv[keymaster][valueKey];

        if (intialValue instanceof Object) {

          if (intialValue.format === "text") {

            if (intialValue.value instanceof Array) {

              let i = intialValue.value.length;
              let finalValue = "";

              for (const initValue of intialValue.value) {
                i--;
                let rtext = await replaceWith(initValue, objParams, rw_options);

                let quotechar = intialValue.quotechar || "";
                let delimiter = intialValue.delimiter || "";

                if (i !== 0) {
                  finalValue = finalValue + quotechar + rtext + quotechar + delimiter;
                } else {
                  finalValue = finalValue + quotechar + rtext + quotechar;
                }
              }

              res[keymaster + "_" + valueKey] = finalValue;

            } else {
              let value = await replaceWith(intialValue.value, objParams, rw_options);
              res[keymaster + "_" + valueKey] = value;
            }

          } else {

            if (intialValue.format === "json") {

              if (intialValue.value instanceof Object || intialValue.value instanceof Array) {
                res[keymaster + "_" + valueKey] = await replaceWith(JSON.stringify(intialValue.value), objParams, rw_options);

              } else {
                res[keymaster + "_" + valueKey] = await replaceWith(intialValue.value, objParams, rw_options);
              }
            }
          }

        } else {
          res[keymaster + "_" + valueKey] = await replaceWith(intialValue, objParams, rw_options);
        }
      }
    }
    Object.assign(res, objParams);
    resolve(res);
  });
}

module.exports.getChainByUId = function getChainByUId(chains, uId) {

  return new Promise((resolve) => {
    let chainLength = chains.length;
    let res = false;

    while (chainLength-- && !res) {
      const chain = chains[chainLength];
      if (chain.uId === uId) {
        res = chain;
      } else {
        if (chain.processes && chain.processes.length) {
          let chainProcessesLength = chain.processes.length;
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

  let chainLength = chains.length;
  let res = false;

  while (chainLength-- && !res) {
    const chain = chains[chainLength];

    if (chain.processes) {
      let chainProcessesLength = chain.processes.length;

      while (chainProcessesLength-- && !res) {
        const process = chain.processes[chainProcessesLength];
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

function requireDir(directory, modules) {
  let modulesTypes = [];
  if (modules) {
    for (let i = 0; i < modules.length; i++) {
      if (modules[i].type) {
        // MODULES INSIDE @runnerty (Tyoe replacing first dash by slash)
        if(modules[i].type.startsWith("@")){
          let fdash = modules[i].type.indexOf("-");
          if(fdash){
            let dir = modules[i].type.substring(0,fdash);
            let module = modules[i].type.substring(fdash+1);
            modulesTypes.push(path.join(dir,module));
          }
        }else{
          modulesTypes.push(modules[i].type);
        }
      }
    }
  }

  // REQUIRE DIRECTORY:
  let container = {};
  let containerDirectory = directory;

  return new Promise((resolve, reject) => {
    fs.readdir(containerDirectory, (err, items) => {
      if (err) {
        reject(err);
      }else{

        if(items){
          // If type (module name) starts with @ return @module_name concat with all sub directories:
          let dirsItems = [];
          for (let i = 0; i < items.length; i++) {

            if (items[i].startsWith("@")) {
              let subDirs = fs.readdirSync(path.join(containerDirectory,items[i]));
              for (let z = 0; z < subDirs.length; z++) {
                dirsItems.push(path.join(items[i] ,subDirs[z]));
              }
            }else{
              dirsItems.push(items[i]);
            }
          }

          let dirs = [];
          for(const moduleDir of modulesTypes){
            if(dirsItems.includes(moduleDir)){
              if (dirs.indexOf(moduleDir) === -1) {
                dirs.push(moduleDir);
              }
            }else{
              throw new Error(`Module ${moduleDir} not found.`);
            }
          }

          let dirsLength = dirs.length;
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
        }else{
          resolve(container);
        }
      }
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
    const evDate = parseInt(date.toISOString().slice(0, 10).replace(/-/g, ""));
    let lengthEvents = Object.keys(events).length;
    let found = false;
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
  return new Promise(async (resolve) => {
    if (!execDate) {
      execDate = new Date();
    }

    let chainMustRun = true;
    if (calendars.enable && calendars.enable !== "") {
      if (global.calendars[calendars.enable]) {
        const enableEvents = global.calendars[calendars.enable];
        chainMustRun = await isDateInEvents(execDate, enableEvents);
      } else {
        logger.log("error", `Calendar enable ${calendars.enable} not found`);
      }
    }

    if (calendars.disable && calendars.disable !== "" && chainMustRun) {
      if (global.calendars[calendars.disable]) {
        const disableEvents = global.calendars[calendars.disable];
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
    const fileName = path.parse(file).name;
    const fileExt = path.parse(file).ext;
    if (fileExt === ".ics") {
      const filePath = path.join(global.config.general.calendarsPath, file);
      let parsedCal = {};
      fs.readFile(filePath, {encoding: "utf8"}, (err, data) => {
        if (err) {
          logger.log("error", "Calendars readFile: ", err);
        } else {
          parsedCal = ics.convert(data).VCALENDAR[0].VEVENT;
          let calEvents = [];
          for (let i = 0; i < parsedCal.length; i++) {
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
        for (let i = 0; i < files.length; i++) {
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
        let redisClient = redis.createClient(global.config.general.queue_notifications.port || "6379", global.config.general.queue_notifications.host, global.config.general.queue_notifications.options);
        if (global.config.general.queue_notifications.password && global.config.general.queue_notifications.password !== "") {
          redisClient.auth(global.config.general.queue_notifications.password);
        }
        redisClient.on("error", (err) => {
          logger.log("error", `Could not connect to Redis (Queue): ${err}`);
          resolve();
        });

        redisClient.on("ready", () => {
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
  const config = global.config;
  return new Promise((resolve) => {
    if (config.general.history && config.general.history.mongodb && (config.general.history.disable !== true)) {
      global.config.historyEnabled = true;
      mongoose.Promise = global.Promise;
      mongoose.connect(`mongodb://${config.general.history.mongodb.host}:${config.general.history.mongodb.port||"27017"}/${config.general.history.mongodb.database}`, {useMongoClient: true})
        .then(() => {
          logger.log("info", `Mongo History is enabled: ${config.general.history.mongodb.host}:${config.general.history.mongodb.port||"27017"} - DB:${config.general.history.mongodb.database}`);
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
  mongoose.connection.close(() => {
    process.exit(0);
  });
};

function loadExecutors(executorsPath, executors) {
  return new Promise((resolve, reject) => {
    global.executors = {};
    requireDir(executorsPath, executors)
      .then((res) => {
        const executorsKeys = Object.keys(res);
        const executorsLength = executorsKeys.length;
        if (executorsLength > 0) {
          let executorsInConfig = {};
          let items = {};
          items.anyOf = [];
          for (let i = 0; i < executorsLength; i++) {
            let ex = executorsKeys[i];
            if (res[ex]) {
              let exSchema = path.join(executorsPath, ex, "schema.json");
              if (fs.existsSync(exSchema)) {
                executorsInConfig[ex] = res[ex];
                let schemaContent = require(exSchema);
                if(!schemaContent.id) schemaContent.id = ex.replace("\\","-");
                if(schemaContent.definitions.config && !schemaContent.definitions.config.id) schemaContent.definitions.config.id = ex + "#/definitions/config";
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
        const notificatorsKeys = Object.keys(res);
        const notificatorsLength = notificatorsKeys.length;
        if (notificatorsLength !== 0) {
          let notificatorsInConfig = {};
          let items = {};
          items.anyOf = [];
          for (let i = 0; i < notificatorsLength;) {
            const no = notificatorsKeys[i];
            if (res[no]) {
              let noSchema = path.join(notificatorsPath, no, "schema.json");
              if (fs.existsSync(noSchema)) {
                notificatorsInConfig[no] = res[no];
                let schemaContent = require(noSchema);
                if(!schemaContent.id) schemaContent.id = no.replace("\\","-");
                if(schemaContent.definitions.config && !schemaContent.definitions.config.id) schemaContent.definitions.config.id = no + "#/definitions/config";
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

function loadTriggers(triggersPath, triggers) {
  return new Promise((resolve, reject) => {
    global.triggers = {};
    requireDir(triggersPath, triggers)
      .then((res) => {
        const triggersKeys = Object.keys(res);
        const triggersLength = triggersKeys.length;
        if (triggersLength > 0) {
          let triggersInConfig = {};
          let items = {};
          items.anyOf = [];
          for (let i = 0; i < triggersLength; i++) {
            let tr = triggersKeys[i];
            if (res[tr]) {
              let trSchema = path.join(triggersPath, tr, "schema.json");
              if (fs.existsSync(trSchema)) {
                triggersInConfig[tr] = res[tr];
                let schemaContent = require(trSchema);
                if(!schemaContent.id) schemaContent.id = tr.replace("\\","-");
                if(schemaContent.definitions.config && !schemaContent.definitions.config.id) schemaContent.definitions.config.id = tr + "#/definitions/config";
                items.anyOf.push({"$ref": tr + "#/definitions/config"});
                ajv.addSchema(schemaContent, tr);

                if (!ajv.getSchema("trigger_" + tr)) {
                  ajv.addSchema(schemaContent.definitions.params, "trigger_" + tr);
                }

              } else {
                logger.log("error", `Schema not found in trigger ${tr}`);
              }
            } else {
              logger.log("error", `Trigger type ${tr} in config not found in triggers path: ${triggersPath}`);
            }
          }
          configSchema.properties.config.properties.triggers.items = items;
          global.triggers = triggersInConfig;
        }
        resolve();
      })
      .catch((err) => {
        reject(err);
      });
  });
}
module.exports.loadTriggers = loadTriggers;

function loadTriggerConfig(id) {
  return loadConfigSection(global.config, "triggers", id);
}

function loadTrigger(chain, triggerParams) {
  let res = {};

  return new Promise((resolve, reject) => {
    loadTriggerConfig(triggerParams.id)
      .then((configValues) => {
        if (!triggerParams.type && configValues.type) {
          triggerParams.type = configValues.type;
        }
        triggerParams.config = configValues;

        checkTriggersParams(triggerParams)
          .then(async () => {
            res = await new global.triggers[configValues.type](chain, triggerParams);
            resolve(res);
          })
          .catch((err) => {
            reject(err);
          });
      })
      .catch(err => {
        reject(err);
      });
  });
}
module.exports.loadTrigger = loadTrigger;

function checkExecutorParams(executor) {
  return new Promise((resolve, reject) => {
    const executorId = executor.type;

    if (ajv.getSchema("exec_" + executorId)) {
      let valid = false;
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

    const notificatorId = notification.type;
    if (ajv.getSchema("notif_" + notificatorId)) {
      let valid = false;
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

function checkTriggersParams(trigger) {
  return new Promise((resolve, reject) => {
    const triggerId = trigger.type;

    if (ajv.getSchema("trigger_" + triggerId)) {
      let valid = false;
      try{
        valid = ajv.validate("trigger_" + triggerId, trigger);
        if(valid){
          resolve();
        }else{
          reject(ajv.errors);
        }
      }catch(err){
        reject(`Trigger params: ${err}`);
      }
    } else {
      reject(`Schema of params not found in trigger ${triggerId}`);
    }
  });
}
module.exports.checkTriggersParams = checkTriggersParams;

function loadWSAPI() {
  return new Promise(resolve => {
    if (global.config.general.api && global.config.general.api.port && global.config.general.api.users) {
      require("../ws-api/ws-api.js")();
      resolve();
    }else{
      resolve();
    }
  });
}
module.exports.loadWSAPI = loadWSAPI;


function forceInitChainExecution(program) {

// If force execution chain on Start
  if(program.force_chain_exec){
    const chainId = program.force_chain_exec;
    let apiPlan = global.runtimePlan.plan;
    let inputValues = {};
    let customValues = {};

    if(program.custom_values){
      try {
        customValues = JSON.parse(program.custom_values);
      } catch (err) {
        logger.log("error", `Parsing custom_values command-line: ${err} ${err.stack}`);
      }
    }

    if(program.input_values){
      try {
        inputValues = JSON.parse(program.input_values);
      } catch (err) {
        logger.log("error", `Parsing input_values command-line: ${err} ${err.stack}`);
      }
    }

    apiPlan.startChain(chainId, inputValues, customValues)
      .then(() => {
        logger.log("info", `Execution of ${chainId} forced.`);
      })
      .catch((err) => {
        logger.error(`Forcing ${chainId} execution:`, err);
      });
  }
}
module.exports.forceInitChainExecution = forceInitChainExecution;

function setMemoryLimit(memoryLimitMb) {
  memoryLimitMb = memoryLimitMb.replace(/[.,\s]/g, "");
  return new Promise((resolve, reject) => {
    const {exec} = require("child_process");
    exec("npm config get prefix", (error, stdout, stderr) => {
      if (error) {
        reject(`Error: ${error}. ${stderr}`);
      }else{
        const npmPath = stdout.replace(/[\n\r]/g, "").trim();
        const runnertyBin = path.join(npmPath,"bin/runnerty");
        fs.stat(runnertyBin, function(err) {
          if(err) {
            reject(`Error ${runnertyBin}: ${err}`);
          } else {
            let contents = fs.readFileSync(runnertyBin).toString();
            contents = contents.replace(/node\b(?: --max-old-space-size=[0-9]+)?/gm, `node --max-old-space-size=${memoryLimitMb}`);
            fs.writeFileSync(runnertyBin, contents);
            resolve(memoryLimitMb);
          }
        });
      }
    });
  });
}

module.exports.setMemoryLimit = setMemoryLimit;