'use strict';

const fs = require('fs');
const fsp = require('fs').promises;
const os = require('os');
const path = require('path');
const helmet = require('helmet');
const ical = require('node-ical');
const configSchema = require('./schemas/config.json');
const Ajv = require('ajv').default;
const ajv = new Ajv({
  strict: false,
  allErrors: true,
  verbose: true,
  allowUnionTypes: true
});
const betterAjvErrors = require('better-ajv-errors').default;

ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'));
const moment = require('moment');
const lodash = require('lodash');
const axios = require('axios');
const queue = require('./queue-process-memory.js');
const runtime = require('./classes/runtime');

const logger = require('./logger.js');
const interpreter = require('@runnerty/interpreter-core');

const schemas = {};
// Servers
const express = require('express');
const basicAuth = require('express-basic-auth');
const app = express();
const http = require('http');
const https = require('https');

module.exports.logger = logger;

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
    const rootModules = path.resolve(os.platform == 'win32' ? process.cwd().split(path.sep)[0] : '/', '/node_modules');
    if (initialPath === rootModules) {
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
  const chainSchema = require('./schemas/chain.json');
  const processSchema = require('./schemas/process.json');
  ajv.addSchema(processSchema, 'processSchema');
  ajv.addSchema(chainSchema, 'chainSchema');
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
    const confRep = await recursiveObjectInterpreter(configLoad.config);
    if (confRep.general.hasOwnProperty('plan')) {
      confRep.general.plan = configLoad.config.general.plan;
    }
    if (confRep.defaults) {
      confRep.defaults = configLoad.config.defaults;
    }

    return confRep;
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error(`Load General config file not found. Please set config file path.`);
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
    const repConfig = await recursiveObjectInterpreter(configLoad.config);
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

function recursiveObjectInterpreter(inputObject, objParams = {}, options) {
  return interpreter(
    inputObject,
    objParams,
    options,
    runtime.config?.interpreter_max_size,
    runtime.config?.global_values
  );
}

module.exports.recursiveObjectInterpreter = recursiveObjectInterpreter;

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
                reject(`Module ${moduleDir} not found`);
              }
            }
          }

          let dirsLength = dirs.length;
          while (dirsLength--) {
            if (fs.existsSync(path.join(containerDirectory, dirs[dirsLength]))) {
              if (fs.statSync(path.join(containerDirectory, dirs[dirsLength])).isDirectory()) {
                if (fs.existsSync(path.join(containerDirectory, dirs[dirsLength], dirs[dirsLength] + '.js'))) {
                  const modulePath = path.join(containerDirectory, dirs[dirsLength], dirs[dirsLength] + '.js');
                  container[dirs[dirsLength]] = require(modulePath);
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

function chronometer(start) {
  if (start) {
    const endTime = process.hrtime(start);
    const duration = parseInt(endTime[0] * 1000 + endTime[1] / 1000000);
    return [duration / 1000, moment.duration(duration).humanize()];
  } else {
    return process.hrtime();
  }
}
module.exports.chronometer = chronometer;

function isDateInEvents(date, events) {
  const evDate = date;
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

async function checkCalendar(calendars, execDate) {
  if (!execDate) {
    execDate = new Date();
  }

  let chainMustRun = true;
  if (calendars.allow && calendars.allow !== '') {
    if (runtime.calendars[calendars.allow]) {
      const allowEvents = runtime.calendars[calendars.allow];
      chainMustRun = isDateInEvents(execDate, allowEvents);
    } else {
      logger.log('error', `Calendar allow ${calendars.allow} not found`);
    }
  }

  if (calendars.disallow && calendars.disallow !== '' && chainMustRun) {
    if (runtime.calendars[calendars.disallow]) {
      const disallowEvents = runtime.calendars[calendars.disallow];
      chainMustRun = !isDateInEvents(execDate, disallowEvents);
    } else {
      logger.log('error', `Calendar disallow ${calendars.disallow} not found`);
    }
  }
  return chainMustRun;
}

module.exports.checkCalendar = checkCalendar;

function generateCalendar(filePath) {
  const fileName = path.parse(filePath).name;
  const fileExt = path.parse(filePath).ext;
  if (fs.existsSync(filePath)) {
    if (fileExt === '.ics') {
      const calEvents = ical.sync.parseFile(filePath);
      runtime.calendars[fileName] = calEvents;
    }
  } else {
    logger.log('error', `Calendars file not found: ${filePath}`);
  }
}

module.exports.loadCalendars = async function loadCalendars(configFilePath) {
  runtime.calendars = {};
  // calendarsFolder
  let configCalendarsFolder = runtime.config.general.calendarsFolder;
  if (configCalendarsFolder) {
    try {
      if (!fs.existsSync(configCalendarsFolder)) {
        const configCalendarsFolderAlt = path.join(path.dirname(configFilePath), configCalendarsFolder);
        if (!fs.existsSync(configCalendarsFolderAlt)) {
          throw new Error(`Calendars path not found in: ${configCalendarsFolder} and ${configCalendarsFolderAlt}`);
        } else {
          configCalendarsFolder = configCalendarsFolderAlt;
        }
      }

      const files = await fsp.readdir(configCalendarsFolder);
      for (let i = 0; i < files.length; i++) {
        generateCalendar(path.join(configCalendarsFolder, files[i]));
      }
    } catch (err) {
      throw err;
    }
  }

  // calendars
  const calendars = runtime.config.general.calendars;
  if (calendars) {
    for (const calendar in calendars) {
      if (!isUrl(calendars[calendar])) {
        if (!fs.existsSync(calendars[calendar])) {
          const configCalendarAlt = path.join(path.dirname(configFilePath), calendars[calendar]);
          if (!fs.existsSync(configCalendarAlt)) {
            throw new Error(`Calendar not found in: ${calendars[calendar]} and ${configCalendarAlt}`);
          } else {
            calendars[calendar] = configCalendarAlt;
          }
        }
      }

      generateCalendar(calendars[calendar], calendar);
    }
  }
};

module.exports.loadQueueNotifications = function loadQueueNotifications() {
  return new Promise(resolve => {
    runtime.notifierList = {};
    runtime.notificationsList = {};
    resolve();
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
    const params = {
      chain: chain,
      params: triggerParams,
      queue: queue,
      runtime: runtime,
      checkCalendar: checkCalendar,
      logger: logger
    };
    const trigger = new runtime.triggers[configValues.type](params);
    const triggerInitialized = await trigger.init();
    return triggerInitialized;
  } catch (err) {
    throw err;
  }
}
module.exports.loadTrigger = loadTrigger;

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
      const basicAuthUsers = {};
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
      express.urlencoded({
        extended: true
      })
    );

    if (server.limit_req) {
      app.use(express.json({ limit: server.limit_req }));
    } else {
      app.use(express.json());
    }
    // ================================================

    // = SECURITY =====================================
    app.use(helmet());
    app.disable('x-powered-by');

    app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
      next();
    });

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

function standardizeDependsProcesses(depends_process_obj) {
  if (depends_process_obj) {
    if (depends_process_obj instanceof Array) {
      const depends_process_obj_tmp = { $and: [] };
      for (const strItem of depends_process_obj) {
        if (typeof strItem === 'string') {
          depends_process_obj_tmp['$and'].push({ $end: strItem });
        } else {
          throw new Error(`getAction depends_process, is not valid. Arrays depends_process must be array of strings.`);
        }
      }
      depends_process_obj = depends_process_obj_tmp;
    } else {
      // depends_process is a string, this will be replaced by: "PROCESS_ID" -> {"$end":"PROCESS_ID"}
      if (typeof depends_process_obj === 'string') {
        depends_process_obj = { $end: depends_process_obj };
      } else {
        if (!(depends_process_obj instanceof Object)) {
          throw new Error('getAction depends_process, is not valid object.');
        }
      }
    }
  }
  return depends_process_obj;
}
module.exports.standardizeDependsProcesses = standardizeDependsProcesses;

async function forceInitChainExecution(program) {
  // If force execution chain on Start
  if (program.force_chain_exec) {
    const chainsIds = program.force_chain_exec.split(',');
    const initialProcess = program.force_process;

    if (initialProcess && chainsIds.length > 1)
      throw new Error(`Forcing a process is not allowed if it indicates more than one chain.`);

    runtime.forcedInitChainsIds = Object.assign([], chainsIds);
    if (program.end) runtime.endOnforcedInitChainsIds = true;
    if (program.force_chain_dependents) runtime.force_chain_dependents = true;
    if (program.force_process_dependents) runtime.force_process_dependents = true;

    let input_values = [];
    let custom_values_override = {};

    // PARSE CUSTOMS_VALUES:
    if (program.custom_values) {
      try {
        custom_values_override = JSON.parse(program.custom_values);
      } catch (err) {
        logger.log('error', `Parsing custom_values command-line: ${err} ${err.stack}`);
      }
    }

    // PARSE INPUT_VALUES
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

    for (const chainId of chainsIds) {
      runtime.plan.forceQueueChain(chainId, chainId + '_main', input_values, custom_values_override, initialProcess);
    }
  } else {
    if (program.force_process)
      throw new Error(
        `Missing CHAIN_ID for the process "${program.force_process}". CHAIN_ID is required when forcing process execution (-f CHAIN_ID)`
      );
  }
}
module.exports.forceInitChainExecution = forceInitChainExecution;

function consoleAjvErrors(schema, data, errors) {
  const output = betterAjvErrors(schema, data, errors, {
    format: 'cli',
    indent: 2
  });
  // eslint-disable-next-line no-console
  console.log(output);
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
