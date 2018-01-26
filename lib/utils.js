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
const request = require("request");
const interpret = require("./interpreter.js");
const queue = require("./queue-process-memory.js");

const algorithm = "aes-256-ctr";

const debugMode = (process.env.RUNNERTY_DEBUG == "true");
const testMode = (process.env.RUNNERTY_TEST == "true");

const logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({colorize:(testMode)?false:"all", level: (debugMode)?"debug":"info"})
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


function mergeDefaultConfig(inputConfig){
  return new Promise((resolve, reject) => {
    fs.readFile(path.join(__dirname, "./config/defaults.json"), "utf8", (err, defaults) => {
      let fileParsed;
      let defaultsFileParsed;


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
        fileParsed = JSON.parse(inputConfig);

        // Compatibility json struct started with config object or without
        if(fileParsed.config){
          conf = fileParsed.config;
        }else{
          conf = fileParsed;
        }
        if (defaultsFileParsed) {
          conf = lodash.defaultsDeep(conf, defaultsFileParsed);
        }
        resolve(conf);
      } catch (err) {
        reject(`Parsing general configuration: ${err} ${err.stack}`);
      }
    });
  });
}

function loadConfigModules(mergedConfig, configFilePath){
  return new Promise((resolve, reject) => {
    let modulesPath;
    if(mergedConfig.general.modulesPath){
      modulesPath = path.join(path.resolve(mergedConfig.general.modulesPath), "node_modules");
    }else{
      if(configFilePath){
        modulesPath = path.join(path.resolve(path.dirname(configFilePath)), "node_modules");
      }else{
        modulesPath = path.join(process.cwd(), "node_modules");
      }
    }

    // ADD NOTIFICATORS SCHEMAS:
    const notifiersPath = mergedConfig.general.notifiersPath || modulesPath;
    const promiseNotifiersSchemas = loadNotifiers(path.resolve(notifiersPath), mergedConfig.notifiers);

    // ADD EXECUTORS SCHEMAS:
    const executorsPath = mergedConfig.general.executorsPath || modulesPath;
    const promiseExecutorsSchemas = loadExecutors(path.resolve(executorsPath), mergedConfig.executors);

    // ADD TRIGGERS SCHEMAS:
    const triggersPath = mergedConfig.general.triggersPath || modulesPath;
    const promiseTriggersSchemas = loadTriggers(path.resolve(triggersPath), mergedConfig.triggers);

    Promise.all([promiseNotifiersSchemas, promiseExecutorsSchemas, promiseTriggersSchemas]).then(() => {
      resolve(mergedConfig);
    })
      .catch((err) => {
        reject(`Invalid Config file: ${err}`);
      });
  });
}

function validateConfig(config){
  return new Promise((resolve, reject) => {
    ajv.addSchema(configSchema, "configSchema");
    const valid = ajv.validate("configSchema", config);

    if(!valid){
      reject(ajv.errors);
    }else{
      resolve();
    }
  });
}

module.exports.loadGeneralConfig = function loadGeneralConfig(configFilePath) {
  return new Promise(resolve => {
    const filePath = configFilePath;
    let configLoad = {};

    fs.stat(filePath, (err, stats) => {

      if (err || !stats.isFile()) {
        if (stats && !stats.isFile()) {
          throw new Error(`config.json must be file but is set ${filePath}`);
        } else {
          throw new Error(`Load General conf file ${filePath} not exists.`);
        }
      } else {

        try {
          fs.readFile(filePath, "utf8", async (err, res) => {
            if (err) {
              throw new Error(`Loading general configuration: ${err}`);
            } else {

              // CONFIG DEFAULTS:
              const mergedConfig = await mergeDefaultConfig(res);
              configLoad.config = await loadConfigModules(mergedConfig, configFilePath);

              validateConfig(configLoad)
                .then(() => {
                  resolve(configLoad.config);
                })
                .catch(err => {
                  throw new Error(`Loading general validateConfig: ${err}`);
                });
            }

          });
        } catch (err) {
          throw new Error(`Invalid Config file, incorrect JSON format: ${err} ${err.message}`);
        }
      }
    });
  });
};


module.exports.loadRemoteGeneralConfig = function loadRemoteGeneralConfig(url, username, password) {
  return new Promise(resolve => {
    let configLoad = {};
    loadRemoteFile(url, username, password)
      .then(async fileContent => {
        // CONFIG DEFAULTS:
        const mergedConfig = await mergeDefaultConfig(fileContent);
        configLoad.config = await loadConfigModules(mergedConfig);

        validateConfig(configLoad)
          .then(() => {
            resolve(configLoad.config);
          })
          .catch(err => {
            throw new Error(`Loading remote general validateConfig: ${err}`);
          });
      })
      .catch(err => {
        throw new Error(`Loading general loadRemoteFile: ${err}`);
      });
  });
};

function loadRemoteFile(url, username, password) {
  return new Promise((resolve, reject) => {
    let options = {
      "url": url
    };

    if (username && password){
      options.auth = {
        "user": username,
        "pass": password
      };
    }

    request(options, async (error, response, body) => {
      if (error){
        reject(error);
      }else{
        resolve(body);
      }
    });
  });
}

module.exports.loadRemoteFile = loadRemoteFile;

function loadConfigSection(config, section, id_config) {
  if (config){
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
  } else {
    throw "Error: config must be defined.";
  }
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


function replaceWithSmart(inputObject, objParams, options) {

  return new Promise(async (resolve) => {

    // TODO: && !options.ignoreGlobalValues
    if (global.config.global_values) {
      objParams = await addGlobalValuesToObjParams(objParams);
    }

    if (typeof inputObject === "string") {
      let res = await interpret(inputObject, objParams, options);
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
            let _key = await interpret(key, objParams, options);
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
                let rtext = initValue; // await interpret(initValue, objParams, rw_options);

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
              let value = intialValue.value; // await interpret(intialValue.value, objParams, rw_options);
              res[keymaster + "_" + valueKey] = value;
            }

          } else {

            if (intialValue.format === "json") {

              if (intialValue.value instanceof Object || intialValue.value instanceof Array) {
                res[keymaster + "_" + valueKey] = await interpret(JSON.stringify(intialValue.value), objParams, rw_options);

              } else {
                res[keymaster + "_" + valueKey] = await interpret(intialValue.value, objParams, rw_options);
              }
            }
          }

        } else {
          res[keymaster + "_" + valueKey] = intialValue; // await interpret(intialValue, objParams, rw_options);
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
            const process = chain.processes[chainProcessesLength];
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
            const result = getProcessByUId(process.childs_chains, uId);
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
    const endTime = process.hrtime(start);
    const duration = parseInt((endTime[0] * 1000) + (endTime[1] / 1000000));
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
            let event = {};
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
    global.notifierList = {};
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

function loadNotifiers(notifiersPath, notifiers) {
  return new Promise((resolve, reject) => {
    global.notifiers = {};
    requireDir(notifiersPath, notifiers)
      .then((res) => {
        const notifiersKeys = Object.keys(res);
        const notifiersLength = notifiersKeys.length;
        if (notifiersLength !== 0) {
          let notifiersInConfig = {};
          let items = {};
          items.anyOf = [];
          for (let i = 0; i < notifiersLength;) {
            const no = notifiersKeys[i];
            if (res[no]) {
              let noSchema = path.join(notifiersPath, no, "schema.json");
              if (fs.existsSync(noSchema)) {
                notifiersInConfig[no] = res[no];
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
              notifiers.splice(i, 1);
              logger.log("error", `Notifiers type ${no} in config not found in notifiers path: ${notifiersPath}`);
            }
          }
          configSchema.properties.config.properties.notifiers.items = items;
          global.notifiers = notifiersInConfig;
        }
        resolve();
      })
      .catch((err) => {
        reject(err);
      });
  });
}
module.exports.loadNotifiers = loadNotifiers;

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

function checkNotifierParams(notification) {
  return new Promise((resolve, reject) => {

    const notifierId = notification.type;
    if (ajv.getSchema("notif_" + notifierId)) {
      let valid = false;
      try{
        valid = ajv.validate("notif_" + notifierId, notification);
        if(valid){
          resolve();
        }else{
          reject(ajv.errors);
        }
      }catch(err){
        reject(`Notifier params: ${err}`);
      }
    } else {
      reject(`Schema of params not found in notifier ${notifierId}`);
    }
  });
}
module.exports.checkNotifierParams = checkNotifierParams;

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

function loadQueues() {
  return new Promise(resolve => {
    require("./queues.js")();
    resolve();
  });
}
module.exports.loadQueues = loadQueues;


function forceInitChainExecution(program) {

// If force execution chain on Start
  if(program.force_chain_exec){

    const chainsIds = program.force_chain_exec.split(",");

    chainsIds.forEach((chainId) => {

      let globalPlan = global.runtimePlan.plan;

      let _res = globalPlan.getChainById(chainId, "main");
      if (_res) {
        let chain = _res;

        if(program.custom_values){
          try {
            chain.custom_values = JSON.parse(program.custom_values);
          } catch (err) {
            logger.log("error", `Parsing custom_values command-line: ${err} ${err.stack}`);
          }
        }

        if(program.input_values){
          try {
            chain.input = JSON.parse(program.input_values);
          } catch (err) {
            logger.log("error", `Parsing input_values command-line: ${err} ${err.stack}`);
          }
        }
        queue.queueChain(chain);

      }
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


function isUrl(url) {
  const matcher = /^(?:\w+:)?\/\/([^\s\.]+\.\S{2}|localhost[\:?\d]*)\S*$/i;
  if(matcher.test(url)){
    return true;
  }else{
    return false;
  }
}

module.exports.isUrl = isUrl;