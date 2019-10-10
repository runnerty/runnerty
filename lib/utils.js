'use strict';

const fs = require('fs');
const path = require('path');
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
const request = require('request');
const queue = require('./queue-process-memory.js');

let schemas = {};
// Servers
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const http = require('http');
const https = require('https');
const logger = require('./logger.js');
const interpret = require('./interpreter.js');

module.exports.logger = logger;

function encrypt(text, password, _algorithm) {
  const algorithm = _algorithm || global.config.general.crypto.algorithm;
  const IV_LENGTH = 16; // For AES, this is always 16
  let iv = crypto.randomBytes(IV_LENGTH);
  let cipher = crypto.createCipheriv(algorithm, Buffer.from(password), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

module.exports.encrypt = encrypt;

function decrypt(text, password, _algorithm) {
  let algorithm = _algorithm || global.config.general.crypto.algorithm;
  let textParts = text.split(':');
  let iv = Buffer.from(textParts.shift(), 'hex');
  let encryptedText = Buffer.from(textParts.join(':'), 'hex');
  let decipher = crypto.createDecipheriv(algorithm, Buffer.from(password), iv);
  try {
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    logger.log('error', `Decrypting (${algorithm}): ${text} - ${err.message}`);
    return '';
  }

  /*
  let algorithm = _algorithm || global.config.general.crypto.algorithm;
  let decipher = crypto.createDecipher(
    algorithm,
    password || global.cryptoPassword
  );
  try {
    let dec = decipher.update(text, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch (err) {
    logger.log('error', `Decrypting (${algorithm}): ${text} - ${err.message}`);
    return '';
  }
  */
}

module.exports.decrypt = decrypt;

function interpretAwait(objParams, inputObject, params, options) {
  return new Promise(resolve => {
    interpret(inputObject, params, options)
      .then(res => {
        resolve(res);
      })
      .catch(err => {
        logger.log(
          'error',
          'Interpreter:',
          objParams.CHAIN_ID ?
          'CHAIN: ' + objParams.CHAIN_ID :
          '' + objParams.PROCESS_ID ?
          ' PROCESS: ' + objParams.PROCESS_ID :
          '',
          ': ',
          err,
          'IN:',
          inputObject
        );
        resolve();
      });
  });
}

function mergeDefaultConfig(inputConfig) {
  return new Promise((resolve, reject) => {
    fs.readFile(
      path.join(__dirname, './config/defaults.json'),
      'utf8',
      (err, defaults) => {
        let fileParsed;
        let defaultsFileParsed;

        if (err) {
          logger.log('warn', 'Loading default config file', err);
        } else {
          if (defaults) {
            try {
              defaultsFileParsed = JSON.parse(defaults);
            } catch (err) {
              logger.log(
                'error',
                `Parsing default configuration: ${err} ${err.stack}`
              );
            }
          }
        }

        try {
          let conf;
          fileParsed = JSON.parse(inputConfig);

          // Compatibility json struct started with config object or without
          if (fileParsed.config) {
            conf = fileParsed.config;
          } else {
            conf = fileParsed;
          }
          if (defaultsFileParsed) {
            conf = lodash.defaultsDeep(conf, defaultsFileParsed);
          }
          resolve(conf);
        } catch (err) {
          reject(`Parsing general configuration: ${err} ${err.stack}`);
        }
      }
    );
  });
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

function loadConfigModules(mergedConfig, configFilePath) {
  return new Promise((resolve, reject) => {
    let modulesPath;
    if (mergedConfig.general.modulesPath) {
      modulesPath = path.join(
        path.resolve(mergedConfig.general.modulesPath),
        'node_modules'
      );
    } else {
      if (configFilePath) {
        modulesPath = path.join(
          path.resolve(path.dirname(configFilePath)),
          'node_modules'
        );
      } else {
        modulesPath = path.join(process.cwd(), 'node_modules');
      }
    }

    const nodeModulesPath = getNodeModulesPath(modulesPath);
    if (nodeModulesPath) {
      modulesPath = nodeModulesPath;
    } else {
      reject(`node_modules not found ${modulesPath}`);
    }

    // ADD NOTIFICATORS SCHEMAS:
    const notifiersPath = mergedConfig.general.notifiersPath || modulesPath;
    const promiseNotifiersSchemas = loadNotifiers(
      path.resolve(notifiersPath),
      mergedConfig.notifiers
    );

    // ADD EXECUTORS SCHEMAS:
    const executorsPath = mergedConfig.general.executorsPath || modulesPath;
    const promiseExecutorsSchemas = loadExecutors(
      path.resolve(executorsPath),
      mergedConfig.executors
    );

    // ADD TRIGGERS SCHEMAS:
    const triggersPath = mergedConfig.general.triggersPath || modulesPath;
    const promiseTriggersSchemas = loadTriggers(
      path.resolve(triggersPath),
      mergedConfig.triggers
    );

    Promise.all([
        promiseNotifiersSchemas,
        promiseExecutorsSchemas,
        promiseTriggersSchemas
      ])
      .then(() => {
        resolve(mergedConfig);
      })
      .catch(err => {
        reject(err);
      });
  });
}

function validateConfig(config) {
  return new Promise((resolve, reject) => {
    ajv.addSchema(configSchema, 'configSchema');
    const valid = ajv.validate('configSchema', config);

    if (!valid) {
      consoleAjvErrors(configSchema, config, ajv.errors);
      reject();
    } else {
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
          fs.readFile(filePath, 'utf8', async (err, res) => {
            if (err) {
              throw new Error(`Loading general configuration: ${err}`);
            } else {
              // CONFIG DEFAULTS:
              const mergedConfig = await mergeDefaultConfig(res);
              configLoad.config = await loadConfigModules(
                mergedConfig,
                configFilePath
              );

              validateConfig(configLoad)
                .then(async () => {
                  let res = await replaceWithSmart(configLoad.config);
                  if (res.general.hasOwnProperty('plan')) {
                    res.general.plan = configLoad.config.general.plan;
                  }
                  resolve(res);
                })
                .catch(err => {
                  throw new Error(
                    `Loading general validateConfig: ${JSON.stringify(err)}`
                  );
                });
            }
          });
        } catch (err) {
          throw new Error(
            `Invalid Config file, incorrect JSON format: ${err} ${err.message}`
          );
        }
      }
    });
  });
};

module.exports.loadRemoteGeneralConfig = function loadRemoteGeneralConfig(
  url,
  username,
  password
) {
  return new Promise(resolve => {
    let configLoad = {};
    loadRemoteFile(url, username, password)
      .then(async fileContent => {
        // CONFIG DEFAULTS:
        const mergedConfig = await mergeDefaultConfig(fileContent);
        configLoad.config = await loadConfigModules(mergedConfig);

        validateConfig(configLoad)
          .then(async () => {
            let res = await replaceWithSmart(configLoad.config);
            if (res.general.hasOwnProperty('plan')) {
              res.general.plan = configLoad.config.general.plan;
            }
            resolve(res);
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
      url: url
    };

    if (username && password) {
      options.auth = {
        user: username,
        pass: password
      };
    }

    request(options, async (error, response, body) => {
      if (error) {
        reject(error);
      } else {
        resolve(body);
      }
    });
  });
}

module.exports.loadRemoteFile = loadRemoteFile;

function loadConfigSection(config, section, id_config) {
  if (config) {
    return new Promise((resolve, reject) => {
      if (config.hasOwnProperty(section)) {
        let sectionLength = config[section].length;
        let cnf;
        while (sectionLength--) {
          if (config[section][sectionLength].id === id_config) {
            cnf = config[section][sectionLength];
            if (cnf.hasOwnProperty('crypted_password')) {
              if (global.cryptoPassword) {
                cnf.password = decrypt(cnf.crypted_password);
              } else {
                reject(
                  `No crypto password set for encrypt crypted_password of section ${section} id ${id_config}.`
                );
              }
            }
          }
        }

        if (cnf) {
          if (cnf.hasOwnProperty('type')) {
            // MODULES INSIDE @runnerty (Type replacing first dash by slash)
            if (cnf.type.startsWith('@') && cnf.type.indexOf(path.sep) === -1) {
              let fdash = cnf.type.indexOf('-');
              if (fdash) {
                let dir = cnf.type.substring(0, fdash);
                let module = cnf.type.substring(fdash + 1);
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
    });
  } else {
    throw 'Error: config must be defined.';
  }
}

module.exports.loadConfigSection = loadConfigSection;

module.exports.loadSQLFile = function loadSQLFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.stat(filePath, err => {
      if (err) {
        reject(`Load SQL file: ${err}`);
      } else {
        fs.readFile(filePath, 'utf8', (err, res) => {
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

function replaceWithSmart(inputObject, objParams = {}, options) {
  return new Promise(async resolve => {
    let params;

    if (objParams && Object.keys(objParams).length !== 0) {
      if (!objParams.objParamsIsReplaced) {
        objParams.objParamsReplaced = await replaceWithSmart(
          objParams, {},
          options
        );
        objParams.objParamsIsReplaced = true;
        params = objParams.objParamsReplaced;
      } else {
        params = objParams.objParamsReplaced;
      }
    }

    if (
      global.config &&
      global.config.global_values &&
      (!options || !options.ignoreGlobalValues)
    ) {
      params = await addGlobalValuesToObjParams(params);
    }

    if (typeof inputObject === 'string') {
      let res = await interpretAwait(objParams, inputObject, params, options);
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
            let _value = await replaceWithSmart(
              inputObject[key],
              objParams,
              options
            );
            let _key = await interpretAwait(objParams, key, params, options);
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
  let implicitAllowed = [];
  allowed.forEach(item => {
    let dotPos = item.indexOf('.');
    if (dotPos !== -1) {
      implicitAllowed.push(item.substring(0, dotPos));
    }
  });
  allowed = lodash.union(allowed, implicitAllowed);
  let objPrepick = lodash.pick(object, allowed);
  const keys = Object.keys(objPrepick);
  for (const key of keys) {
    let prefKey = key + '.';
    let subAllowed = allowed.map(item => {
      if (item.startsWith(prefKey)) return item.replace(prefKey, '');
    });
    subAllowed = subAllowed.filter(Boolean);
    if (object[key] instanceof Array) {
      let itemsAllowed = [];
      for (const items of object[key]) {
        let pickItem = pick(items, subAllowed);
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
    let rw_options = {
      ignoreGlobalValues: true
    };
    const gvs = global.config.global_values;
    let res = {};

    for (const gv of gvs) {
      const keymaster = Object.keys(gv)[0];
      const valueObjects = gv[keymaster];
      const keysValueObjects = Object.keys(valueObjects);

      for (const valueKey of keysValueObjects) {
        let intialValue = gv[keymaster][valueKey];

        if (intialValue instanceof Object) {
          if (intialValue.format === 'text') {
            if (intialValue.value instanceof Array) {
              let i = intialValue.value.length;
              let finalValue = '';

              for (const initValue of intialValue.value) {
                i--;
                let rtext = initValue;

                let quotechar = intialValue.quotechar || '';
                let delimiter = intialValue.delimiter || '';

                if (i !== 0) {
                  finalValue =
                    finalValue + quotechar + rtext + quotechar + delimiter;
                } else {
                  finalValue = finalValue + quotechar + rtext + quotechar;
                }
              }

              res[keymaster + '_' + valueKey] = finalValue;
            } else {
              let value = intialValue.value;
              res[keymaster + '_' + valueKey] = value;
            }
          } else {
            if (intialValue.format === 'json') {
              if (
                intialValue.value instanceof Object ||
                intialValue.value instanceof Array
              ) {
                res[keymaster + '_' + valueKey] = await interpretAwait(
                  objParams,
                  JSON.stringify(intialValue.value),
                  objParams,
                  rw_options
                );
              } else {
                res[keymaster + '_' + valueKey] = await interpretAwait(
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
  return new Promise(async resolve => {
    let res = {};
    for (const key of Object.keys(obj)) {
      let objValue = obj[key];
      let keyName = (startName ? startName + '_' : '') + key;

      if (objValue instanceof Object) {
        Object.assign(res, await objToKeyValue(objValue, keyName));
      } else {
        res[keyName] = objValue;
      }
    }
    resolve(res);
  });
}

module.exports.objToKeyValue = objToKeyValue;

module.exports.getChainByUId = function getChainByUId(chains, uId) {
  return new Promise(resolve => {
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
              getChainByUId(process.childs_chains, uId).then(_res => {
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
        // MODULES INSIDE @runnerty (Type replacing first dash by slash)
        if (modules[i].type.startsWith('@')) {
          let fdash = modules[i].type.indexOf('-');
          if (fdash) {
            let dir = modules[i].type.substring(0, fdash);
            let module = modules[i].type.substring(fdash + 1);
            modulesTypes.push(path.join(dir, module));
          }
        } else {
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
      } else {
        if (items) {
          // If type (module name) starts with @ return @module_name concat with all sub directories:
          let dirsItems = [];
          for (let i = 0; i < items.length; i++) {
            if (items[i].startsWith('@')) {
              let subDirs = fs.readdirSync(
                path.join(containerDirectory, items[i])
              );
              for (let z = 0; z < subDirs.length; z++) {
                dirsItems.push(path.join(items[i], subDirs[z]));
              }
            } else {
              dirsItems.push(items[i]);
            }
          }

          let dirs = [];
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
            if (
              fs.existsSync(path.join(containerDirectory, dirs[dirsLength]))
            ) {
              if (
                fs
                .statSync(path.join(containerDirectory, dirs[dirsLength]))
                .isDirectory()
              ) {
                if (
                  fs.existsSync(
                    path.join(
                      containerDirectory,
                      dirs[dirsLength],
                      dirs[dirsLength] + '.js'
                    )
                  )
                ) {
                  container[dirs[dirsLength]] = require(path.join(
                    containerDirectory,
                    dirs[dirsLength],
                    dirs[dirsLength] + '.js'
                  ));
                } else {
                  if (
                    path.join(containerDirectory, dirs[dirsLength], 'index.js')
                  ) {
                    container[dirs[dirsLength]] = require(path.join(
                      containerDirectory,
                      dirs[dirsLength],
                      'index.js'
                    ));
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
  return new Promise(resolve => {
    const evDate = parseInt(
      date
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '')
    );
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
  return new Promise(async resolve => {
    if (!execDate) {
      execDate = new Date();
    }

    let chainMustRun = true;
    if (calendars.enable && calendars.enable !== '') {
      if (global.calendars[calendars.enable]) {
        const enableEvents = global.calendars[calendars.enable];
        chainMustRun = await isDateInEvents(execDate, enableEvents);
      } else {
        logger.log('error', `Calendar enable ${calendars.enable} not found`);
      }
    }

    if (calendars.disable && calendars.disable !== '' && chainMustRun) {
      if (global.calendars[calendars.disable]) {
        const disableEvents = global.calendars[calendars.disable];
        chainMustRun = !(await isDateInEvents(execDate, disableEvents));
      } else {
        logger.log('error', `Calendar disable ${calendars.disable} not found`);
      }
    }
    resolve(chainMustRun);
  });
};

function generateCalendar(file) {
  return new Promise(resolve => {
    const fileName = path.parse(file).name;
    const fileExt = path.parse(file).ext;
    if (fileExt === '.ics') {
      const filePath = path.join(global.config.general.calendarsPath, file);
      let parsedCal = {};
      fs.readFile(
        filePath, {
          encoding: 'utf8'
        },
        (err, data) => {
          if (err) {
            logger.log('error', 'Calendars readFile: ', err);
          } else {
            parsedCal = ics.convert(data).VCALENDAR[0].VEVENT;
            let calEvents = [];
            for (let i = 0; i < parsedCal.length; i++) {
              let event = {};
              event.start = parseInt(parsedCal[i]['DTSTART;VALUE=DATE']);
              event.end = parseInt(parsedCal[i]['DTEND;VALUE=DATE']);
              event.summary = parsedCal[i]['SUMMARY'];
              calEvents.push(event);
            }
            global.calendars[fileName] = calEvents;
            resolve();
          }
        }
      );
    }
  });
}

module.exports.loadCalendars = function loadCalendars() {
  return new Promise(resolve => {
    global.calendars = {};
    if (global.config.general.calendarsPath) {
      fs.readdir(global.config.general.calendarsPath, (err, files) => {
        for (let i = 0; i < files.length; i++) {
          generateCalendar(files[i]);
        }
        resolve();
      });
    } else {
      resolve();
    }
  });
};

module.exports.loadQueueNotifications = function loadQueueNotifications() {
  return new Promise(resolve => {
    global.notifierList = {};
    global.notificationsList = {};
    if (
      global.config.general.queue_notifications &&
      global.config.general.queue_notifications.queue
    ) {
      // REDIS QUEUE NOTIFICATIONS:
      if (global.config.general.queue_notifications.queue === 'redis') {
        let redisClient = redis.createClient(
          global.config.general.queue_notifications.port || '6379',
          global.config.general.queue_notifications.host,
          global.config.general.queue_notifications.options
        );
        if (
          global.config.general.queue_notifications.password &&
          global.config.general.queue_notifications.password !== ''
        ) {
          redisClient.auth(global.config.general.queue_notifications.password);
        }
        redisClient.on('error', err => {
          logger.log('error', `Could not connect to Redis (Queue): ${err}`);
          resolve();
        });

        redisClient.on('ready', () => {
          global.queueRedisCli = redisClient;
          global.config.queueNotificationsExternal = 'redis';
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

function loadExecutors(executorsPath, executors) {
  return new Promise((resolve, reject) => {
    global.executors = {};
    requireDir(executorsPath, executors)
      .then(res => {
        const executorsKeys = Object.keys(res);
        const executorsLength = executorsKeys.length;
        if (executorsLength > 0) {
          let executorsInConfig = {};
          let items = {};
          items.anyOf = [];
          for (let i = 0; i < executorsLength; i++) {
            let ex = executorsKeys[i];
            if (res[ex]) {
              let exSchema = path.join(executorsPath, ex, 'schema.json');
              if (fs.existsSync(exSchema)) {
                executorsInConfig[ex] = res[ex];
                let schemaContent = require(exSchema);
                if (!schemaContent['$id'])
                  schemaContent['$id'] = ex.replace('\\', '-');
                if (
                  schemaContent.definitions.config &&
                  !schemaContent.definitions.config['$id']
                )
                  schemaContent.definitions.config['$id'] =
                  ex + '#/definitions/config';
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
              logger.log(
                'error',
                `Executor type ${ex} in config not found in executors path: ${executorsPath}`
              );
            }
          }
          configSchema.properties.config.properties.executors.items = items;
          global.executors = executorsInConfig;
        }
        resolve();
      })
      .catch(err => {
        reject(err);
      });
  });
}
module.exports.loadExecutors = loadExecutors;

function loadNotifiers(notifiersPath, notifiers) {
  return new Promise((resolve, reject) => {
    global.notifiers = {};
    requireDir(notifiersPath, notifiers)
      .then(res => {
        const notifiersKeys = Object.keys(res);
        const notifiersLength = notifiersKeys.length;
        if (notifiersLength !== 0) {
          let notifiersInConfig = {};
          let items = {};
          items.anyOf = [];
          for (let i = 0; i < notifiersLength;) {
            const no = notifiersKeys[i];
            if (res[no]) {
              let noSchema = path.join(notifiersPath, no, 'schema.json');
              if (fs.existsSync(noSchema)) {
                notifiersInConfig[no] = res[no];
                let schemaContent = require(noSchema);
                if (!schemaContent['$id'])
                  schemaContent['$id'] = no.replace('\\', '-');
                if (
                  schemaContent.definitions.config &&
                  !schemaContent.definitions.config['$id']
                )
                  schemaContent.definitions.config['$id'] =
                  no + '#/definitions/config';
                items.anyOf.push({
                  $ref: no + '#/definitions/config'
                });

                ajv.addSchema(schemaContent, no);
                schemas[no] = schemaContent;

                if (!ajv.getSchema('notif_' + no)) {
                  ajv.addSchema(
                    schemaContent.definitions.params,
                    'notif_' + no
                  );
                  schemas['notif_' + no] = schemaContent.definitions.params;
                }
              } else {
                logger.log('error', `Schema not found in notifier ${no}`);
              }
              i++;
            } else {
              notifiers.splice(i, 1);
              logger.log(
                'error',
                `Notifiers type ${no} in config not found in notifiers path: ${notifiersPath}`
              );
            }
          }
          configSchema.properties.config.properties.notifiers.items = items;
          global.notifiers = notifiersInConfig;
        }
        resolve();
      })
      .catch(err => {
        reject(err);
      });
  });
}
module.exports.loadNotifiers = loadNotifiers;

function loadTriggers(triggersPath, triggers) {
  return new Promise((resolve, reject) => {
    global.triggers = {};
    requireDir(triggersPath, triggers)
      .then(res => {
        const triggersKeys = Object.keys(res);
        const triggersLength = triggersKeys.length;
        if (triggersLength > 0) {
          let triggersInConfig = {};
          let items = {};
          items.anyOf = [];
          for (let i = 0; i < triggersLength; i++) {
            let tr = triggersKeys[i];
            if (res[tr]) {
              let trSchema = path.join(triggersPath, tr, 'schema.json');

              // If schema is not found in default trigger path will try in runnerty node_modules:
              // Needed for trigger-server
              if (!fs.existsSync(trSchema)) {
                const trLocalSchema = path.join(
                  __dirname,
                  '/../node_modules/',
                  tr,
                  'schema.json'
                );
                if (fs.existsSync(trLocalSchema)) {
                  trSchema = trLocalSchema;
                }
              }

              if (fs.existsSync(trSchema)) {
                triggersInConfig[tr] = res[tr];
                let schemaContent = require(trSchema);
                if (!schemaContent['$id'])
                  schemaContent['$id'] = tr.replace('\\', '-');
                if (
                  schemaContent.definitions.config &&
                  !schemaContent.definitions.config['$id']
                )
                  schemaContent.definitions.config['$id'] =
                  tr + '#/definitions/config';
                items.anyOf.push({
                  $ref: tr + '#/definitions/config'
                });

                ajv.addSchema(schemaContent, tr);
                schemas[tr] = schemaContent;

                if (!ajv.getSchema('trigger_' + tr)) {
                  ajv.addSchema(
                    schemaContent.definitions.params,
                    'trigger_' + tr
                  );
                  schemas['trigger_' + tr] = schemaContent.definitions.params;
                }
              } else {
                logger.log('error', `Schema not found in trigger ${tr}`);
              }
            } else {
              logger.log(
                'error',
                `Trigger type ${tr} in config not found in triggers path: ${triggersPath}`
              );
            }
          }
          configSchema.properties.config.properties.triggers.items = items;
          global.triggers = triggersInConfig;
        }
        resolve();
      })
      .catch(err => {
        reject(err);
      });
  });
}
module.exports.loadTriggers = loadTriggers;

function loadTriggerConfig(id) {
  return loadConfigSection(global.config, 'triggers', id);
}

function loadTrigger(chain, triggerParams) {
  return new Promise((resolve, reject) => {
    loadTriggerConfig(triggerParams.id)
      .then(configValues => {
        if (!triggerParams.type && configValues.type) {
          triggerParams.type = configValues.type;
        }
        triggerParams.config = configValues;

        checkTriggersParams(triggerParams)
          .then(() => {
            new global.triggers[configValues.type](chain, triggerParams)
              .then(res => {
                resolve(res);
              })
              .catch(err => {
                reject(err);
              });
          })
          .catch(_ => {
            reject();
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

    if (ajv.getSchema('exec_' + executorId)) {
      let valid = false;
      try {
        valid = ajv.validate('exec_' + executorId, executor);
        if (valid) {
          resolve();
        } else {
          consoleAjvErrors(
            ajv.getSchema('exec_' + executorId),
            executor,
            ajv.errors
          );

          reject(
            `Wrong parameters for the executor ${
              executor.id
            } (${executorId}): ${ajv.errorsText()}`
          );
        }
      } catch (err) {
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
    if (ajv.getSchema('notif_' + notifierId)) {
      let valid = false;
      try {
        valid = ajv.validate('notif_' + notifierId, notification);
        if (valid) {
          resolve();
        } else {
          consoleAjvErrors(
            ajv.getSchema('notif_' + notifierId),
            notification,
            ajv.errors
          );

          reject(
            `Wrong parameters for the notifier ${
              notification.id
            } (${notifierId}): ${ajv.errorsText()}`
          );
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
  return new Promise((resolve, reject) => {
    const triggerId = trigger.type;

    if (ajv.getSchema('trigger_' + triggerId)) {
      let valid = false;
      try {
        valid = ajv.validate('trigger_' + triggerId, trigger);
        if (valid) {
          resolve();
        } else {
          logger.log(
            'error',
            `Checking trigger ${triggerId} \n${JSON.stringify(ajv.errors)}`
          );
          consoleAjvErrors(
            ajv.getSchema('trigger_' + triggerId),
            trigger,
            ajv.errors
          );
          reject();
        }
      } catch (err) {
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
    if (
      global.config.general.api &&
      global.config.general.api.port &&
      global.config.general.api.users
    ) {
      require('../ws-api/ws-api.js')();
      resolve();
    } else {
      resolve();
    }
  });
}
module.exports.loadWSAPI = loadWSAPI;

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

    switch (true) {
      case !!server.ssl && !!server.key && !!server.cert && server.port:
        const privateKey = fs.readFileSync(server.key, 'utf8');
        const certificate = fs.readFileSync(server.cert, 'utf8');
        srv = https.createServer({
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
    //app.use(helmet());
    app.disable('x-powered-by');

    app.use((req, res, next) => {
      res.setHeader(
        'Access-Control-Allow-Headers',
        'X-Requested-With,content-type'
      );
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
    if (
      global.config.general.servers &&
      global.config.general.servers.length > 0
    ) {
      let creationServers = [];

      let serversIds = [];
      let serversEndpoints = [];
      let serversPorts = [];

      for (const server of global.config.general.servers) {
        // Check server duplicates:
        if (serversIds.indexOf(server.id) > -1) {
          reject(`Invalid servers config - server id duplicated: ${server.id}`);
        }
        serversIds.push(server.id);

        if (serversEndpoints.indexOf(server.endpoint) > -1) {
          reject(
            `Invalid servers config - server endpoints duplicated. id: ${server.id}, endpoint:${server.endpoint}`
          );
        }
        serversEndpoints.push(server.endpoint);

        if (serversPorts.indexOf(server.port) > -1) {
          reject(
            `Invalid servers config - server port duplicated. id: ${server.id}, port:${server.port}`
          );
        }
        serversPorts.push(server.port);

        creationServers.push(setUpServer(server));
      }

      Promise.all(creationServers)
        .then(res => {
          for (const server of res) {
            global.servers[server.id] = server;
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

function loadQueues() {
  return new Promise(resolve => {
    require('./queues.js')();
    resolve();
  });
}
module.exports.loadQueues = loadQueues;

function forceInitChainExecution(program) {
  // If force execution chain on Start
  if (program.force_chain_exec) {
    const chainsIds = program.force_chain_exec.split(',');

    global.forcedInitChainsIds = Object.assign([], chainsIds);
    if (program.end) {
      global.endOnforcedInitChainsIds = true;
    }

    chainsIds.forEach(async chainId => {
      let globalPlan = global.runtimePlan.plan;
      let input_values = [];
      let custom_values_override = {};

      let _res = globalPlan.getChainById(chainId, chainId + '_main');
      if (_res) {
        let chain = _res;

        if (program.custom_values) {
          try {
            custom_values_override = JSON.parse(program.custom_values);
          } catch (err) {
            logger.log(
              'error',
              `Parsing custom_values command-line: ${err} ${err.stack}`
            );
          }
        }

        if (program.input_values) {
          try {
            let parsed_input_values = JSON.parse(program.input_values);
            if (parsed_input_values instanceof Array) {
              input_values = parsed_input_values;
            } else {
              input_values = [await objToKeyValue(parsed_input_values)];
            }
          } catch (err) {
            logger.log(
              'error',
              `Parsing input_values command-line: ${err} ${err.stack}`
            );
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
    const {
      exec
    } = require('child_process');
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
  if (matcher.test(url)) {
    return true;
  } else {
    return false;
  }
}

module.exports.isUrl = isUrl;

function JSON2KV(objectToPlain, separator, prefix) {
  let res = {};

  // Sub función: Llamada recursiva para aplanamiento de objetos:
  function _iterateObject(key, object2KV) {
    // Si el objeto no está vacio:
    if (Object.keys(object2KV).length) {
      // Llamada recursiva para obtener clave/valor de todo el arbol del objeto:
      let sub_res = JSON2KV(object2KV, separator);
      let sub_res_keys = Object.keys(sub_res);
      // Recorre el resultado para incluir en "res" todas las claves/valor incluyendo la key actual:
      for (let i = 0; i < sub_res_keys.length; i++) {
        res[key + separator + sub_res_keys[i]] = sub_res[sub_res_keys[i]];
      }
    } else {
      // Si el objeto está vacio devolvemos key actual con valor null:
      res[key] = null;
    }
  }

  let eobjs = Object.keys(objectToPlain);

  // Iteramos por el objeto a aplanar:
  for (let i = 0; i < eobjs.length; i++) {
    // Generamos la clave a partir de la key del item de la iteración. En caso de llegar prefix se incluye y siempre hacemos uppercase:
    let key = prefix ?
      prefix + separator + eobjs[i].toUpperCase() :
      eobjs[i].toUpperCase();
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
        let arrValues = objectToPlain[eobjs[i]];
        let arrLength = arrValues.length;
        for (let z = 0; z < arrLength; z++) {
          // En caso de que el array tenga objetos:
          if (
            arrValues[z] &&
            typeof arrValues[z] === 'object' &&
            arrValues[z].constructor === Object
          ) {
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