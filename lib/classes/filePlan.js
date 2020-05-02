'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils.js').logger;
const loadRemoteFile = require('../utils.js').loadRemoteFile;
const isUrl = require('../utils.js').isUrl;
const consoleAjvErrors = require('../utils.js').consoleAjvErrors;
const planSchema = require('../schemas/plan.json');
const chainSchema = require('../schemas/chain.json');
const processSchema = require('../schemas/process.json');
const Ajv = require('ajv');
const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  jsonPointers: true
});
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'));

const Plan = require('./plan.js');

function serializer() {
  let stack = [];
  let keys = [];

  return function(key, value) {
    if (stack.length > 0) {
      let thisPos = stack.indexOf(this);
      ~thisPos ? stack.splice(thisPos + 1) : stack.push(this);
      ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key);
      if (~stack.indexOf(value)) {
        if (stack[0] === value) {
          value = '[Circular ~]';
        }
        value =
          '[Circular ~.' + keys.slice(0, stack.indexOf(value)).join('.') + ']';
      }
    } else {
      stack.push(value);
    }
    return value;
  };
}

function parseAndValidate(fileContent, schema) {
  return new Promise((resolve, reject) => {
    let fileParsed;
    if (typeof fileContent === 'object') {
      fileParsed = fileContent;
    } else {
      try {
        fileParsed = JSON.parse(fileContent);
      } catch (err) {
        reject(`Invalid plan file, incorrect JSON: ${err}`);
      }
    }

    let valid = false;
    try {
      valid = ajv.validate(schema, fileParsed);
      if (valid) {
        resolve(fileParsed);
      } else {
        consoleAjvErrors(schema, fileParsed, ajv.errors);
        reject(ajv.errors);
      }
    } catch (err) {
      reject(err);
    }
  });
}

ajv.addFormat(
  'cron',
  /^(((([\*]{1}){1})|((\*\/){0,1}(([0-9]{1}){1}|(([1-5]{1}){1}([0-9]{1}){1}){1}))) ((([\*]{1}){1})|((\*\/){0,1}(([0-9]{1}){1}|(([1]{1}){1}([0-9]{1}){1}){1}|([2]{1}){1}([0-3]{1}){1}))) ((([\*]{1}){1})|((\*\/){0,1}(([1-9]{1}){1}|(([1-2]{1}){1}([0-9]{1}){1}){1}|([3]{1}){1}([0-1]{1}){1}))) ((([\*]{1}){1})|((\*\/){0,1}(([1-9]{1}){1}|(([1-2]{1}){1}([0-9]{1}){1}){1}|([3]{1}){1}([0-1]{1}){1}))|(jan|feb|mar|apr|may|jun|jul|aug|sep|okt|nov|dec)) ((([\*]{1}){1})|((\*\/){0,1}(([0-7]{1}){1}))|(sun|mon|tue|wed|thu|fri|sat)))$/
);
ajv.addSchema(planSchema, 'planSchema');
ajv.addSchema(processSchema, 'processSchema');
ajv.addSchema(chainSchema, 'chainSchema');

class FilePlan {
  constructor(filePath, planContent, config_user, config_password) {
    this.filePath = filePath;
    this.fileContent = '';
    this.lastHashPlan = '';
    this.plan = {};

    return new Promise((resolve, reject) => {
      let _this = this;

      if (planContent) {
        parseAndValidate(planContent, 'planSchema').then(res => {
          _this.fileContent = res;
          _this
            .loadChains()
            .then(res => {
              resolve(res);
            })
            .catch(err => {
              reject(err);
            });
        });
      } else {
        _this
          .loadFileContent(filePath, 'planSchema', config_user, config_password)
          .then(res => {
            _this.fileContent = res;
            _this
              .loadChains()
              .then(res => {
                resolve(res);
              })
              .catch(err => {
                reject(err);
              });
          })
          .catch(err => {
            reject(err);
          });
      }
    });
  }

  async loadChains() {
    try {
      const chains = await this.getChains(this.fileContent);
      const plan = new Plan('', chains);
      this.plan = await plan.init();
      if (global.planRestored) {
        this.startAutoRefreshBinBackup();
      }
      return this;
    } catch (err) {
      throw err;
    }
  }

  loadFileContent(filePath, schema, config_user, config_password) {
    let _this = this;
    return new Promise(async (resolve, reject) => {
      // Check if Plan file is an URL:
      if (isUrl(filePath)) {
        loadRemoteFile(filePath, config_user, config_password)
          .then(res => {
            parseAndValidate(res, schema)
              .then(res => {
                resolve(res);
              })
              .catch(err => {
                reject(err);
              });
          })
          .catch(err => {
            reject(err);
          });
      } else {
        _this
          ._locateChainFile(filePath)
          .then(file => {
            try {
              fs.readFile(file, 'utf8', (err, res) => {
                if (err) {
                  reject(`File loadFileContent (${file}) readFile: ${err}`);
                } else {
                  parseAndValidate(res, schema)
                    .then(res => {
                      resolve(res);
                    })
                    .catch(err => {
                      reject(err);
                    });
                }
              });
            } catch (err) {
              reject(err);
            }
          })
          .catch(err => {
            reject(`File ${filePath} not exists: ${err}`);
          });
      }
    });
  }

  _locateChainFile(chainFilePath) {
    let _this = this;

    return new Promise((resolve, reject) => {
      fs.stat(chainFilePath, err => {
        if (err) {
          const localChainFilePath = path.join(
            path.dirname(_this.filePath),
            chainFilePath
          );
          fs.stat(localChainFilePath, err => {
            if (err) {
              reject(err);
            } else {
              resolve(localChainFilePath);
            }
          });
        } else {
          resolve(chainFilePath);
        }
      });
    });
  }

  getChains(json) {
    let _this = this;
    let loadChains = [];

    function getAllChains(chain) {
      loadChains.push(_this.getChain(chain));
    }

    return new Promise((resolve, reject) => {
      if (json.hasOwnProperty('chains')) {
        if (json.chains instanceof Array) {
          json.chains.map(getAllChains);
          Promise.all(loadChains)
            .then(res => {
              resolve(res);
            })
            .catch(err => {
              reject(err);
            });
        } else {
          reject('Invalid PlanFile, chain is not an array.');
        }
      } else {
        reject('Invalid PlanFile, chain property not found.');
      }
    });
  }

  getChain(chain) {
    return new Promise((resolve, reject) => {
      if (chain.hasOwnProperty('chain_path')) {
        this
          .loadFileContent(chain.chain_path, 'chainSchema')
          .then(res => {
            this
              .getChain(res)
              .then(res => {
                resolve(res);
              })
              .catch(err => {
                reject(err);
              });
          })
          .catch(err => {
            reject(err);
          });
      } else {
        if (this.chainIsValid(chain, false)) {
          resolve(chain);
        } else {
          reject(`Chain ${chain.id} is not valid.`);
        }
      }
    });
  }

  chainIsValid(chain, silent) {
    try {
      const valid = ajv.validate('chainSchema', chain);
      if (!valid) {
        if (!silent) {
          logger.log(
            'error',
            `Invalid chain, id ${chain.id} for schema chainSchema:\n${ajv.errors}`
          );
          consoleAjvErrors(chainSchema, chain, ajv.errors);
        }
        return false;
      } else {
        return true;
      }
    } catch (err) {
      if (!silent) {
        logger.log(
          'error',
          `Invalid chain, id ${chain.id} for schema chainSchema: ${err}`
        );
      }
      return false;
    }
  }

  refreshBinBackup() {
    const plan = this.plan;
    let objStr = {};

    try {
      objStr = JSON.stringify(plan);
    } catch (err) {
      try {
        objStr = JSON.stringify(plan, serializer());
      } catch (err) {
        logger.log('error', err);
        throw err;
      }
    }

    const hashPlan = crypto
      .createHash('sha256')
      .update(objStr)
      .digest('hex');

    if (this.lastHashPlan !== hashPlan) {
      this.lastHashPlan = hashPlan;
      logger.log('debug', `> REFRESING hashPlan: ${hashPlan}`);
      fs.writeFileSync(global.config.general.binBackup, objStr, null);
    }
  }

  startAutoRefreshBinBackup() {
    setTimeout(() => {
      this.refreshBinBackup();
    }, global.config.general.refreshIntervalBinBackup);
  }
}

module.exports = FilePlan;
