'use strict';

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const helmet = require('helmet');
const sizeof = require('object-sizeof');
const configSchema = require('./schemas/config.json');
const Ajv = require('ajv');
const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  jsonPointers: true
});
const betterAjvErrors = require('better-ajv-errors');

ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'));
const crypto = require('crypto');
const moment = require('moment');
const ics = require('ical2json');
const redis = require('redis');
const lodash = require('lodash');
const axios = require('axios');
const queue = require('./queue-process-memory.js');
const runtime = require('./classes/runtime');

const schemas = {};
// Servers
const express = require('express');
const basicAuth = require('express-basic-auth');
const bodyParser = require('body-parser');
const app = express();
const http = require('http');
const https = require('https');
const logger = require('./logger.js');
const interpret = require('./interpreter.js');

module.exports.logger = logger;

function encrypt(text, password, _algorithm) {
  const algorithm = _algorithm || runtime.config.general.crypto.algorithm;
  const IV_LENGTH = 16; // For AES, this is always 16
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(password), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

module.exports.encrypt = encrypt;

function decrypt(text, password, _algorithm) {
  const algorithm = _algorithm || runtime.config.general.crypto.algorithm;
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(password), iv);
  try {
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    logger.log('error', `Decrypting (${algorithm}): ${text} - ${err.message}`);
    return '';
  }
}

module.exports.decrypt = decrypt;

function interpretAwait(objParams, inputObject, params, options) {
  try {
    const interpret_res = interpret(inputObject, params, options);
    return interpret_res;
  } catch (err) {
    let msg = '';
    if (objParams.CHAIN_ID) {
      msg = 'CHAIN: ' + objParams.CHAIN_ID;
    } else if ('' + objParams.PROCESS_ID) {
      msg = ' PROCESS: ' + objParams.PROCESS_ID;
    }
    logger.log('error', `Interpreter:${msg} : ${err} IN: ${inputObject}`);
  }
}

async function mergeDefaultConfig(inputConfig) {
  try {
    const defaults = await fsp.readFile(path.join(__dirname, './config/defaults.json'), 'utf8');
    const fileParsed = JSON.parse(inputConfig);
    const defaultsFileParsed = JSON.parse(defaults);
    let conf;

    // Compatibility json struct started with config object or without
    if (fileParsed.config) {
      conf = fileParsed.config;
    } else {
      conf = fileParsed;
    }
    if (defaultsFileParsed) {
      conf = lodash.defaultsDeep(conf, defaultsFileParsed);
    }
    return conf;
  } catch (err) {
    throw new Error(`MergeDefaultConfig: ${err}`);
  }
}

function getNodeModulesPath(initialPath) {
  if (fs.existsSync(initialPath)) {
    return initialPath;
  } else {
    if (initialPath === '/node_modules') {
      return false;
    } else {
      const previousDir = path.resolve(initialPath, '..', '..', 'node_modules');
      return getNodeModulesPath(previousDir);
    }
  }
}

async function loadConfigModules(mergedConfig, configFilePath) {
  let modulesPath;
  if (mergedConfig.general.modulesPath) {
    modulesPath = path.join(path.resolve(mergedConfig.general.modulesPath), 'node_modules');
  } else {
    if (configFilePath) {
      modulesPath = path.join(path.resolve(path.dirname(configFilePath)), 'node_modules');
    } else {
      modulesPath = path.join(process.cwd(), 'node_modules');
    }
  }

  const nodeModulesPath = getNodeModulesPath(modulesPath);
  if (nodeModulesPath) {
    modulesPath = nodeModulesPath;
  } else {
    throw new Error(
      `node_modules not found ${modulesPath}. This problem is usually solved by installing the dependencies with npm install`
    );
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

  try {
    await Promise.all([promiseNotifiersSchemas, promiseExecutorsSchemas, promiseTriggersSchemas]);
    return mergedConfig;
  } catch (err) {
    throw err;
  }
}

function validateConfig(config) {
  ajv.addSchema(configSchema, 'configSchema');
  const valid = ajv.validate('configSchema', config);

  if (!valid) {
    consoleAjvErrors(configSchema, config, ajv.errors);
    throw new Error(`Validate config ${ajv.errors}`);
  }
}

module.exports.loadGeneralConfig = async function loadGeneralConfig(configFilePath) {
  try {
    await fsp.access(configFilePath, fs.constants.F_OK | fs.constants.W_OK);
    const configContent = await fsp.readFile(configFilePath, 'utf8');
    // CONFIG DEFAULTS:
    const configLoad = {};
    const mergedConfig = await mergeDefaultConfig(configContent);
    configLoad.config = await loadConfigModules(mergedConfig, configFilePath);
    validateConfig(configLoad);
    const confRep = await replaceWithSmart(configLoad.config);
    if (confRep.general.hasOwnProperty('plan')) {
      confRep.general.plan = configLoad.config.general.plan;
    }
    return confRep;
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error(`Load General conf file not found. Please set config file path.`);
    throw new Error(`Loading general config: ${err}.`);
  }
};

module.exports.loadRemoteGeneralConfig = async function loadRemoteGeneralConfig(url, username, password) {
  const configLoad = {};
  try {
    const fileContent = await loadRemoteFile(url, username, password);
    // CONFIG DEFAULTS:
    const mergedConfig = await mergeDefaultConfig(fileContent);
    configLoad.config = await loadConfigModules(mergedConfig);

    validateConfig(configLoad);
    const repConfig = await replaceWithSmart(configLoad.config);
    if (repConfig.general.hasOwnProperty('plan')) {
      repConfig.general.plan = configLoad.config.general.plan;
    }
    return repConfig;
  } catch (err) {
    throw new Error(`Loading general loadRemoteFile: ${err}`);
  }
};

async function loadRemoteFile(url, username, password) {
  const options = {
    url: url,
    headers: {
      'User-Agent': 'runnerty',
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    method: 'GET'
  };
  if (username && password) {
    options.auth = {
      user: username,
      pass: password
    };
  }
  try {
    await axios(options);
  } catch (err) {
    throw err;
  }
}

module.exports.loadRemoteFile = loadRemoteFile;

function loadConfigSection(config, section, id_config) {
  return new Promise((resolve, reject) => {
    if (config) {
      if (config.hasOwnProperty(section)) {
        let sectionLength = config[section].length;
        let cnf;
        while (sectionLength--) {
          if (config[section][sectionLength].id === id_config) {
            cnf = config[section][sectionLength];
            if (cnf.hasOwnProperty('crypted_password')) {
              if (runtime.cryptoPassword) {
                cnf.password = decrypt(cnf.crypted_password);
              } else {
                reject(`No crypto password set for encrypt crypted_password of section ${section} id ${id_config}.`);
              }
            }
          }
        }

        if (cnf) {
          if (cnf.hasOwnProperty('type')) {
            // MODULES INSIDE @runnerty (Type replacing first dash by slash)
            if (cnf.type.startsWith('@') && cnf.type.indexOf(path.sep) === -1) {
              const fdash = cnf.type.indexOf('-');
              if (fdash) {
                const dir = cnf.type.substring(0, fdash);
                const module = cnf.type.substring(fdash + 1);
                cnf.type = dir + path.sep + module;
              }
            }
          }
          resolve(cnf);
        } else {
          reject(`Config for ${id_config} not found in section ${section}`);
        }
      } else {
        reject(`Section ${section} not found in config file.`);
      }
    } else {
      throw new Error('config must be defined.');
    }
  });
}

module.exports.loadConfigSection = loadConfigSection;

module.exports.loadSQLFile = async function loadSQLFile(filePath) {
  try {
    await fsp.access(filePath, fs.constants.F_OK | fs.constants.W_OK);
    const sqlFileContent = await fsp.readFile(filePath, 'utf8');
    return sqlFileContent;
  } catch (err) {
    throw new Error(`Load SQLFile: ${err}`);
  }
};

function replaceWithSmart(inputObject, objParams = {}, options) {
  const REPLACE_BIT_LIMIT = 10000000;
  return new Promise(async resolve => {
    let params;
    if(sizeof(inputObject)>REPLACE_BIT_LIMIT){
     resolve(inputObject);
    }

    if (objParams && Object.keys(objParams).length !== 0) {
      if (!objParams.objParamsIsReplaced) {
        objParams.objParamsReplaced = await replaceWithSmart(objParams, {}, options);
        objParams.objParamsIsReplaced = true;
        params = objParams.objParamsReplaced;
      } else {
        params = objParams.objParamsReplaced;
      }
    }

    if (runtime.config && runtime.config.global_values && (!options || !options.ignoreGlobalValues)) {
      params = await addGlobalValuesToObjParams(params);
    }

    if (typeof inputObject === 'string') {
      const res = interpretAwait(objParams, inputObject, params, options);
      resolve(res);
    } else {
      if (inputObject instanceof Array) {
        const promArr = [];
        for (let i = 0; i < inputObject.length; i++) {
          promArr.push(replaceWithSmart(inputObject[i], objParams, options));
        }
        Promise.all(promArr).then(values => {
          resolve(values);
        });
      } else {
        if (inputObject instanceof Object) {
          const keys = Object.keys(inputObject);
          const resObject = {};

          for (const key of keys) {
            const _value = await replaceWithSmart(inputObject[key], objParams, options);
            const _key = interpretAwait(objParams, key, params, options);
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

function pick(object, allowed) {
  const implicitAllowed = [];
  allowed.forEach(item => {
    const dotPos = item.indexOf('.');
    if (dotPos !== -1) {
      implicitAllowed.push(item.substring(0, dotPos));
    }
  });
  allowed = lodash.union(allowed, implicitAllowed);
  const objPrepick = lodash.pick(object, allowed);
  const keys = Object.keys(objPrepick);
  for (const key of keys) {
    const prefKey = key + '.';
    let subAllowed = allowed.map(item => {
      if (item.startsWith(prefKey)) return item.replace(prefKey, '');
    });
    subAllowed = subAllowed.filter(Boolean);
    if (object[key] instanceof Array) {
      const itemsAllowed = [];
      for (const items of object[key]) {
        const pickItem = pick(items, subAllowed);
        if (pickItem) {
          itemsAllowed.push(pickItem);
        }
      }
      objPrepick[key] = itemsAllowed;
    } else {
      if (object[key] instanceof Object) {
        objPrepick[key] = pick(object[key], subAllowed);
      }
    }
  }
  return objPrepick;
}

module.exports.pick = pick;

function addGlobalValuesToObjParams(objParams) {
  return new Promise(async resolve => {
    const rw_options = {
      ignoreGlobalValues: true
    };
    const gvs = runtime.config.global_values;
    const res = {};

    for (const gv of gvs) {
      const keymaster = Object.keys(gv)[0];
      const valueObjects = gv[keymaster];
      const keysValueObjects = Object.keys(valueObjects);

      for (const valueKey of keysValueObjects) {
        const intialValue = gv[keymaster][valueKey];

        if (intialValue instanceof Object) {
          if (intialValue.format === 'text') {
            if (intialValue.value instanceof Array) {
              let i = intialValue.value.length;
              let finalValue = '';

              for (const initValue of intialValue.value) {
                i--;
                const rtext = initValue;

                const quotechar = intialValue.quotechar || '';
                const delimiter = intialValue.delimiter || '';

                if (i !== 0) {
                  finalValue = finalValue + quotechar + rtext + quotechar + delimiter;
                } else {
                  finalValue = finalValue + quotechar + rtext + quotechar;
                }
              }

              res[keymaster + '_' + valueKey] = finalValue;
            } else {
              const value = intialValue.value;
              res[keymaster + '_' + valueKey] = value;
            }
          } else {
            if (intialValue.format === 'json') {
              if (intialValue.value instanceof Object || intialValue.value instanceof Array) {
                res[keymaster + '_' + valueKey] = interpretAwait(
                  objParams,
                  JSON.stringify(intialValue.value),
                  objParams,
                  rw_options
                );
              } else {
                res[keymaster + '_' + valueKey] = interpretAwait(
                  objParams,
                  JSON.stringify(intialValue.value),
                  objParams,
                  rw_options
                );
              }
            }
          }
        } else {
          res[keymaster + '_' + valueKey] = intialValue;
        }
      }
    }
    Object.assign(res, objParams);
    resolve(res);
  });
}

function objToKeyValue(obj, startName) {
  const res = {};
  for (const key of Object.keys(obj)) {
    const objValue = obj[key];
    const keyName = (startName ? startName + '_' : '') + key;

    if (objValue instanceof Object) {
      Object.assign(res, objToKeyValue(objValue, keyName));
    } else {
      res[keyName] = objValue;
    }
  }
  return res;
}

module.exports.objToKeyValue = objToKeyValue;

module.exports.getChainByUId = function getChainByUId(chains, uId) {
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
            const foundChain = getChainByUId(process.childs_chains, uId);
            if (foundChain) {
              res = foundChain;
            }
          }
        }
      }
    }
  }
  return res;
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
  return new Promise((resolve, reject) => {
    const modulesTypes = [];
    if (modules) {
      for (let i = 0; i < modules.length; i++) {
        if (modules[i].type) {
          // MODULES INSIDE @runnerty (Type replacing first dash by slash)
          if (modules[i].type.startsWith('@')) {
            const fdash = modules[i].type.indexOf('-');
            if (fdash) {
              const dir = modules[i].type.substring(0, fdash);
              const module = modules[i].type.substring(fdash + 1);
              modulesTypes.push(path.join(dir, module));
            }
          } else {
            modulesTypes.push(modules[i].type);
          }
        }
      }
    }

    // REQUIRE DIRECTORY:
    const container = {};
    const containerDirectory = directory;

    fs.readdir(containerDirectory, (err, items) => {
      if (err) {
        reject(err);
      } else {
        if (items) {
          // If type (module name) starts with @ return @module_name concat with all sub directories:
          const dirsItems = [];
          for (let i = 0; i < items.length; i++) {
            if (items[i].startsWith('@')) {
              const subDirs = fs.readdirSync(path.join(containerDirectory, items[i]));
              for (let z = 0; z < subDirs.length; z++) {
                dirsItems.push(path.join(items[i], subDirs[z]));
              }
            } else {
              dirsItems.push(items[i]);
            }
          }

          const dirs = [];
          for (const moduleDir of modulesTypes) {
            if (dirsItems.includes(moduleDir)) {
              if (dirs.indexOf(moduleDir) === -1) {
                dirs.push(moduleDir);
              }
            } else {
              if (moduleDir === '@runnerty/trigger-server') {
                dirs.push(moduleDir);
              } else {
                throw new Error(`Module ${moduleDir} not found.`);
              }
            }
          }

          let dirsLength = dirs.length;
          while (dirsLength--) {
            if (fs.existsSync(path.join(containerDirectory, dirs[dirsLength]))) {
              if (fs.statSync(path.join(containerDirectory, dirs[dirsLength])).isDirectory()) {
                if (fs.existsSync(path.join(containerDirectory, dirs[dirsLength], dirs[dirsLength] + '.js'))) {
                  container[dirs[dirsLength]] = require(path.join(
                    containerDirectory,
                    dirs[dirsLength],
                    dirs[dirsLength] + '.js'
                  ));
                } else {
                  if (path.join(containerDirectory, dirs[dirsLength], 'index.js')) {
                    container[dirs[dirsLength]] = require(path.join(containerDirectory, dirs[dirsLength], 'index.js'));
                  }
                }
              }
            } else {
              container[dirs[dirsLength]] = require(dirs[dirsLength]);
            }
          }
          resolve(container);
        } else {
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
    const duration = parseInt(endTime[0] * 1000 + endTime[1] / 1000000);
    return [duration / 1000, moment.duration(duration).humanize()];
  } else {
    return process.hrtime();
  }
};

function isDateInEvents(date, events) {
  const evDate = parseInt(date.toISOString().slice(0, 10).replace(/-/g, ''));
  let lengthEvents = Object.keys(events).length;
  let found = false;
  while (lengthEvents-- && !found) {
    const key = Object.keys(events)[lengthEvents];
    const event = events[key];
    if (evDate >= event.start && evDate <= event.end) {
      found = true;
    }
  }
  return found;
}

module.exports.checkCalendar = async function checkCalendar(calendars, execDate) {
  if (!execDate) {
    execDate = new Date();
  }

  let chainMustRun = true;
  if (calendars.enable && calendars.enable !== '') {
    if (runtime.calendars[calendars.enable]) {
      const enableEvents = runtime.calendars[calendars.enable];
      chainMustRun = isDateInEvents(execDate, enableEvents);
    } else {
      logger.log('error', `Calendar enable ${calendars.enable} not found`);
    }
  }

  if (calendars.disable && calendars.disable !== '' && chainMustRun) {
    if (runtime.calendars[calendars.disable]) {
      const disableEvents = runtime.calendars[calendars.disable];
      chainMustRun = !isDateInEvents(execDate, disableEvents);
    } else {
      logger.log('error', `Calendar disable ${calendars.disable} not found`);
    }
  }
  return chainMustRun;
};

function generateCalendar(file) {
  const fileName = path.parse(file).name;
  const fileExt = path.parse(file).ext;
  if (fileExt === '.ics') {
    const filePath = path.join(runtime.config.general.calendarsPath, file);
    let parsedCal = {};
    fs.readFile(
      filePath,
      {
        encoding: 'utf8'
      },
      (err, data) => {
        if (err) {
          logger.log('error', `Calendars readFile: ${err}`);
        } else {
          parsedCal = ics.convert(data).VCALENDAR[0].VEVENT;
          const calEvents = [];
          for (let i = 0; i < parsedCal.length; i++) {
            const event = {};
            event.start = parseInt(parsedCal[i]['DTSTART;VALUE=DATE']);
            event.end = parseInt(parsedCal[i]['DTEND;VALUE=DATE']);
            event.summary = parsedCal[i]['SUMMARY'];
            calEvents.push(event);
          }
          runtime.calendars[fileName] = calEvents;
        }
      }
    );
  }
}

module.exports.loadCalendars = async function loadCalendars() {
  runtime.calendars = {};
  if (runtime.config.general.calendarsPath) {
    try {
      const files = await fsp.readdir(runtime.config.general.calendarsPath);
      for (let i = 0; i < files.length; i++) {
        generateCalendar(files[i]);
      }
    } catch (err) {
      throw err;
    }
  }
};

module.exports.loadQueueNotifications = function loadQueueNotifications() {
  return new Promise(resolve => {
    runtime.notifierList = {};
    runtime.notificationsList = {};
    if (runtime.config.general.queue_notifications && runtime.config.general.queue_notifications.queue) {
      // REDIS QUEUE NOTIFICATIONS:
      if (runtime.config.general.queue_notifications.queue === 'redis') {
        const redisClient = redis.createClient(
          runtime.config.general.queue_notifications.port || '6379',
          runtime.config.general.queue_notifications.host,
          runtime.config.general.queue_notifications.options
        );
        if (
          runtime.config.general.queue_notifications.password &&
          runtime.config.general.queue_notifications.password !== ''
        ) {
          redisClient.auth(runtime.config.general.queue_notifications.password);
        }
        redisClient.on('error', err => {
          logger.log('error', `Could not connect to Redis (Queue): ${err}`);
          resolve();
        });

        redisClient.on('ready', () => {
          runtime.queueRedisCli = redisClient;
          runtime.config.queueNotificationsExternal = 'redis';
          resolve();
        });
      } else {
        resolve();
      }
    } else {
      resolve();
    }
  });
};

async function loadExecutors(executorsPath, executors) {
  try {
    const res = await requireDir(executorsPath, executors);
    const executorsKeys = Object.keys(res);
    const executorsLength = executorsKeys.length;
    if (executorsLength > 0) {
      const executorsInConfig = {};
      const items = {};
      items.anyOf = [];
      for (let i = 0; i < executorsLength; i++) {
        const ex = executorsKeys[i];
        if (res[ex]) {
          const exSchema = path.join(executorsPath, ex, 'schema.json');
          if (fs.existsSync(exSchema)) {
            executorsInConfig[ex] = res[ex];
            const schemaContent = require(exSchema);
            if (!schemaContent['$id']) schemaContent['$id'] = ex.replace('\\', '-');
            if (schemaContent.definitions.config && !schemaContent.definitions.config['$id'])
              schemaContent.definitions.config['$id'] = ex + '#/definitions/config';
            items.anyOf.push({
              $ref: ex + '#/definitions/config'
            });
            ajv.addSchema(schemaContent, ex);

            schemas[ex] = schemaContent;

            if (!ajv.getSchema('exec_' + ex)) {
              ajv.addSchema(schemaContent.definitions.params, 'exec_' + ex);
              schemas['exec_' + ex] = schemaContent.definitions.params;
            }
          } else {
            logger.log('error', `Schema not found in executor ${ex}`);
          }
        } else {
          logger.log('error', `Executor type ${ex} in config not found in executors path: ${executorsPath}`);
        }
      }
      configSchema.properties.config.properties.executors.items = items;
      runtime.executors = executorsInConfig;
    }
  } catch (err) {
    throw new Error(`Load Executors: ${err}`);
  }
}
module.exports.loadExecutors = loadExecutors;

async function loadNotifiers(notifiersPath, notifiers) {
  try {
    const res = await requireDir(notifiersPath, notifiers);
    const notifiersKeys = Object.keys(res);
    const notifiersLength = notifiersKeys.length;
    if (notifiersLength !== 0) {
      const notifiersInConfig = {};
      const items = {};
      items.anyOf = [];
      for (let i = 0; i < notifiersLength; ) {
        const no = notifiersKeys[i];
        if (res[no]) {
          const noSchema = path.join(notifiersPath, no, 'schema.json');
          if (fs.existsSync(noSchema)) {
            notifiersInConfig[no] = res[no];
            const schemaContent = require(noSchema);
            if (!schemaContent['$id']) schemaContent['$id'] = no.replace('\\', '-');
            if (schemaContent.definitions.config && !schemaContent.definitions.config['$id'])
              schemaContent.definitions.config['$id'] = no + '#/definitions/config';
            items.anyOf.push({
              $ref: no + '#/definitions/config'
            });

            ajv.addSchema(schemaContent, no);
            schemas[no] = schemaContent;

            if (!ajv.getSchema('notif_' + no)) {
              ajv.addSchema(schemaContent.definitions.params, 'notif_' + no);
              schemas['notif_' + no] = schemaContent.definitions.params;
            }
          } else {
            logger.log('error', `Schema not found in notifier ${no}`);
          }
          i++;
        } else {
          notifiers.splice(i, 1);
          logger.log('error', `Notifiers type ${no} in config not found in notifiers path: ${notifiersPath}`);
        }
      }
      configSchema.properties.config.properties.notifiers.items = items;
      runtime.notifiers = notifiersInConfig;
    }
  } catch (err) {
    throw new Error(`Load Notifiers: ${err}`);
  }
}
module.exports.loadNotifiers = loadNotifiers;

async function loadTriggers(triggersPath, triggers) {
  try {
    const res = await requireDir(triggersPath, triggers);
    const triggersKeys = Object.keys(res);
    const triggersLength = triggersKeys.length;
    if (triggersLength > 0) {
      const triggersInConfig = {};
      const items = {};
      items.anyOf = [];
      for (let i = 0; i < triggersLength; i++) {
        const tr = triggersKeys[i];
        if (res[tr]) {
          let trSchema = path.join(triggersPath, tr, 'schema.json');

          // If schema is not found in default trigger path will try in runnerty node_modules:
          // Needed for trigger-server
          if (!fs.existsSync(trSchema)) {
            const trLocalSchema = path.join(__dirname, '/../node_modules/', tr, 'schema.json');
            if (fs.existsSync(trLocalSchema)) {
              trSchema = trLocalSchema;
            }
          }

          if (fs.existsSync(trSchema)) {
            triggersInConfig[tr] = res[tr];
            const schemaContent = require(trSchema);
            if (!schemaContent['$id']) schemaContent['$id'] = tr.replace('\\', '-');
            if (schemaContent.definitions.config && !schemaContent.definitions.config['$id'])
              schemaContent.definitions.config['$id'] = tr + '#/definitions/config';
            items.anyOf.push({
              $ref: tr + '#/definitions/config'
            });

            ajv.addSchema(schemaContent, tr);
            schemas[tr] = schemaContent;

            if (!ajv.getSchema('trigger_' + tr)) {
              ajv.addSchema(schemaContent.definitions.params, 'trigger_' + tr);
              schemas['trigger_' + tr] = schemaContent.definitions.params;
            }
          } else {
            logger.log('error', `Schema not found in trigger ${tr}`);
          }
        } else {
          logger.log('error', `Trigger type ${tr} in config not found in triggers path: ${triggersPath}`);
        }
      }
      configSchema.properties.config.properties.triggers.items = items;
      runtime.triggers = triggersInConfig;
    }
  } catch (err) {
    throw new Error(`Load Triggers: ${err}`);
  }
}
module.exports.loadTriggers = loadTriggers;

function loadTriggerConfig(id) {
  return loadConfigSection(runtime.config, 'triggers', id);
}

async function loadTrigger(chain, triggerParams) {
  try {
    const configValues = await loadTriggerConfig(triggerParams.id);
    if (!triggerParams.type && configValues.type) {
      triggerParams.type = configValues.type;
    }
    triggerParams.config = configValues;
    checkTriggersParams(triggerParams);
    const trigger = new runtime.triggers[configValues.type](chain, triggerParams);
    const triggerInitialized = await trigger.init();
    return triggerInitialized;
  } catch (err) {
    throw err;
  }
}
module.exports.loadTrigger = loadTrigger;

function checkExecutorParams(executor) {
  const executorId = executor.type;
  if (ajv.getSchema('exec_' + executorId)) {
    let valid = false;
    try {
      valid = ajv.validate('exec_' + executorId, executor);
      if (!valid) {
        consoleAjvErrors(ajv.getSchema('exec_' + executorId), executor, ajv.errors);
        throw new Error(`Wrong parameters for the executor ${executor.id} (${executorId}): ${ajv.errorsText()}`);
      }
    } catch (err) {
      throw new Error(`Executor params: ${err}`);
    }
  } else {
    throw new Error(`Schema of params not found in executor ${executorId}`);
  }
}
module.exports.checkExecutorParams = checkExecutorParams;

function checkNotifierParams(notification) {
  return new Promise((resolve, reject) => {
    const notifierId = notification.type;
    if (ajv.getSchema('notif_' + notifierId)) {
      let valid = false;
      try {
        valid = ajv.validate('notif_' + notifierId, notification);
        if (valid) {
          resolve();
        } else {
          consoleAjvErrors(ajv.getSchema('notif_' + notifierId), notification, ajv.errors);

          reject(`Wrong parameters for the notifier ${notification.id} (${notifierId}): ${ajv.errorsText()}`);
        }
      } catch (err) {
        reject(`Notifier params: ${err}`);
      }
    } else {
      reject(`Schema of params not found in notifier ${notifierId}`);
    }
  });
}
module.exports.checkNotifierParams = checkNotifierParams;

function checkTriggersParams(trigger) {
  const triggerId = trigger.type;

  if (ajv.getSchema('trigger_' + triggerId)) {
    let valid = false;
    try {
      valid = ajv.validate('trigger_' + triggerId, trigger);
      if (!valid) {
        consoleAjvErrors(ajv.getSchema('trigger_' + triggerId), trigger, ajv.errors);
        throw new Error(`Checking trigger ${triggerId} \n${JSON.stringify(ajv.errors)}`);
      }
    } catch (err) {
      throw new Error(`Trigger params: ${err}`);
    }
  } else {
    throw new Error(`Schema of params not found in trigger ${triggerId}`);
  }
}
module.exports.checkTriggersParams = checkTriggersParams;

function loadWSAPI() {
  return new Promise(resolve => {
    if (runtime.config.general.api && runtime.config.general.api.port && runtime.config.general.api.users) {
      require('../ws-api/ws-api.js')();
      resolve();
    } else {
      resolve();
    }
  });
}
module.exports.loadWSAPI = loadWSAPI;

function middlewareApiKey(apiKey) {
  return (req, res, next) => {
    if (req.headers['x-api-key']) {
      const headerApiKey = req.headers['x-api-key'];
      // Header x-api-key:
      if (headerApiKey == apiKey) {
        delete req.headers['x-api-key'];
        return next();
      } else {
        return res.status(401).send({ error: 'Invalid API-KEY' });
      }
    }
    // Query API_KEY:
    if (req.query.api_key) {
      const queryApiKey = req.query.api_key;
      if (queryApiKey == apiKey) {
        delete req.query.api_key;
        return next();
      }
    }
    return res.status(401).send({ error: 'Invalid API-KEY' });
  };
}

function setUpServer(server) {
  function errorHandler(err, req, res, next) {
    logger.error('error server:', {
      error: err
    });
    res.status(500);
    next();
  }

  return new Promise(resolve => {
    let srv;
    let port;

    // SERVERS BASIC-AUTH:
    if (server.users) {
      let basicAuthUsers = {};
      server.users.forEach(user => {
        basicAuthUsers[user.user] = user.password;
      });
      app.use(
        basicAuth({
          users: basicAuthUsers
        })
      );
    }

    // SERVERS API-KEY:
    if (server.apikey) {
      app.use(middlewareApiKey(server.apikey));
    }

    switch (true) {
      case !!server.ssl && !!server.key && !!server.cert && server.port:
        const privateKey = fs.readFileSync(server.key, 'utf8');
        const certificate = fs.readFileSync(server.cert, 'utf8');
        srv = https.createServer(
          {
            key: privateKey,
            cert: certificate
          },
          app
        );
        port = server.port;
        break;
      case !!server.unix_socket:
        srv = http.createServer(app);
        port = server.unix_socket;
        break;
      case !!server.port:
        srv = http.createServer(app);
        port = server.port;
        break;
      default:
        srv = null;
        port = null;
    }

    if (srv) {
      srv.listen(port, err => {
        if (err) {
          logger.error('Cannot start the server');
          logger.error(err);
        } else {
          logger.debug('Listening on ', server.port);
        }
      });
    } else {
      logger.error('Not private API server provided');
    }
    // ================================================

    app.use((req, res, next) => {
      res.header('Content-Type', 'application/json');
      next();
    });

    app.use(
      bodyParser.urlencoded({
        extended: true
      })
    );
    //app.use(bodyParser.json({ limit: server.limite_req }));
    // ================================================

    // = SECURITY =====================================
    app.use(helmet());
    app.disable('x-powered-by');

    app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
      next();
    });

    app.use(bodyParser.json());
    server.router = express.Router();
    app.use(server.endpoint, server.router);
    app.use(errorHandler);

    resolve(server);
  });
}

function loadServers() {
  return new Promise((resolve, reject) => {
    if (runtime.config.general.servers && runtime.config.general.servers.length > 0) {
      const creationServers = [];

      const serversIds = [];
      const serversEndpoints = [];
      const serversPorts = [];

      for (const server of runtime.config.general.servers) {
        // Check server duplicates:
        if (serversIds.indexOf(server.id) > -1) {
          reject(`Invalid servers config - server id duplicated: ${server.id}`);
        }
        serversIds.push(server.id);

        if (serversEndpoints.indexOf(server.endpoint) > -1) {
          reject(`Invalid servers config - server endpoints duplicated. id: ${server.id}, endpoint:${server.endpoint}`);
        }
        serversEndpoints.push(server.endpoint);

        if (serversPorts.indexOf(server.port) > -1) {
          reject(`Invalid servers config - server port duplicated. id: ${server.id}, port:${server.port}`);
        }
        serversPorts.push(server.port);

        creationServers.push(setUpServer(server));
      }

      Promise.all(creationServers)
        .then(res => {
          for (const server of res) {
            runtime.servers[server.id] = server;
          }
          resolve();
        })
        .catch(err => {
          reject(`Invalid Config file: ${err}`);
        });
    } else {
      resolve();
    }
  });
}
module.exports.loadServers = loadServers;

function forceInitChainExecution(program) {
  // If force execution chain on Start
  if (program.force_chain_exec) {
    const chainsIds = program.force_chain_exec.split(',');

    runtime.forcedInitChainsIds = Object.assign([], chainsIds);
    if (program.end) {
      runtime.endOnforcedInitChainsIds = true;
    }

    chainsIds.forEach(async chainId => {
      const globalPlan = runtime.plan;
      let input_values = [];
      let custom_values_override = {};

      const _res = globalPlan.getChainById(chainId, chainId + '_main');
      if (_res) {
        const chain = _res;

        if (program.custom_values) {
          try {
            custom_values_override = JSON.parse(program.custom_values);
          } catch (err) {
            logger.log('error', `Parsing custom_values command-line: ${err} ${err.stack}`);
          }
        }

        if (program.input_values) {
          try {
            const parsed_input_values = JSON.parse(program.input_values);
            if (parsed_input_values instanceof Array) {
              input_values = parsed_input_values;
            } else {
              input_values = [objToKeyValue(parsed_input_values)];
            }
          } catch (err) {
            logger.log('error', `Parsing input_values command-line: ${err} ${err.stack}`);
          }
        }

        queue.queueChain(chain, input_values, custom_values_override);
      }
    });
  }
}
module.exports.forceInitChainExecution = forceInitChainExecution;

function consoleAjvErrors(schema, data, errors) {
  const output = betterAjvErrors(schema, data, errors, {
    format: 'cli',
    indent: 2
  });
  /* eslint-disable no-console */
  console.log(output);
  /* eslint-enable no-console */
}

module.exports.consoleAjvErrors = consoleAjvErrors;

function setMemoryLimit(memoryLimitMb) {
  memoryLimitMb = memoryLimitMb.replace(/[.,\s]/g, '');
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process');
    exec('npm config get prefix', (error, stdout, stderr) => {
      if (error) {
        reject(`Error: ${error}. ${stderr}`);
      } else {
        const npmPath = stdout.replace(/[\n\r]/g, '').trim();
        const runnertyBin = path.join(npmPath, 'bin/runnerty');
        fs.stat(runnertyBin, err => {
          if (err) {
            reject(`Error ${runnertyBin}: ${err}`);
          } else {
            let contents = fs.readFileSync(runnertyBin).toString();
            contents = contents.replace(
              /node\b(?: --max-old-space-size=[0-9]+)?/gm,
              `node --max-old-space-size=${memoryLimitMb}`
            );
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
  return matcher.test(url);
}

module.exports.isUrl = isUrl;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports.sleep = sleep;

function JSON2KV(objectToPlain, separator, prefix) {
  const res = {};

  // Sub función: Llamada recursiva para aplanamiento de objetos:
  function _iterateObject(key, object2KV) {
    // Si el objeto no está vacio:
    if (Object.keys(object2KV).length) {
      // Llamada recursiva para obtener clave/valor de todo el arbol del objeto:
      const sub_res = JSON2KV(object2KV, separator);
      const sub_res_keys = Object.keys(sub_res);
      // Recorre el resultado para incluir en "res" todas las claves/valor incluyendo la key actual:
      for (let i = 0; i < sub_res_keys.length; i++) {
        res[key + separator + sub_res_keys[i]] = sub_res[sub_res_keys[i]];
      }
    } else {
      // Si el objeto está vacio devolvemos key actual con valor null:
      res[key] = null;
    }
  }

  const eobjs = Object.keys(objectToPlain);

  // Iteramos por el objeto a aplanar:
  for (let i = 0; i < eobjs.length; i++) {
    // Generamos la clave a partir de la key del item de la iteración. En caso de llegar prefix se incluye y siempre hacemos uppercase:
    const key = prefix ? prefix + separator + eobjs[i].toUpperCase() : eobjs[i].toUpperCase();
    // Comprobamos si es un objeto:
    if (
      objectToPlain[eobjs[i]] &&
      typeof objectToPlain[eobjs[i]] === 'object' &&
      objectToPlain[eobjs[i]].constructor === Object
    ) {
      // Llamada a la sub-función:
      _iterateObject(key, objectToPlain[eobjs[i]]);
    } else {
      // Si en lugar de un objeto se trata de un array, se crearán tantos clave/valor como items haya en el array incluyendo en el key la posición del valor:
      if (Array.isArray(objectToPlain[eobjs[i]])) {
        const arrValues = objectToPlain[eobjs[i]];
        const arrLength = arrValues.length;
        for (let z = 0; z < arrLength; z++) {
          // En caso de que el array tenga objetos:
          if (arrValues[z] && typeof arrValues[z] === 'object' && arrValues[z].constructor === Object) {
            // Llamada a la sub-función, incluyendo la posición del array en la key:
            _iterateObject(key + separator + z, arrValues[z]);
          } else {
            // Si no es un objeto incluimos en res el valor en la key con la posición del array:
            res[key + separator + z] = arrValues[z];
          }
        }
      } else {
        // Si no es ni object ni array, devolvemos el valor con la key
        res[key] = objectToPlain[eobjs[i]];
      }
    }
  }
  // Devuelve los valores acumulados en res de todo el arbol del objeto:
  return res;
}
module.exports.JSON2KV = JSON2KV;
