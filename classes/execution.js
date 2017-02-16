"use strict";

var replaceWithSmart = require("../libs/utils.js").replaceWithSmart;
var replaceWith = require("../libs/utils.js").replaceWith;
var requireDir = require("../libs/utils.js").requireDir;
var logger = require("../libs/utils.js").logger;
var Ajv = require('ajv');
var ajv = new Ajv({allErrors: true});

class Execution {
  constructor(process) {

    var _this = this;

    var params = Object.keys(process.exec);
    var paramsLength = params.length;

    while (paramsLength--) {
      _this[params[paramsLength]] = process.exec[params[paramsLength]];
    }

    _this.replaceWith = replaceWith;
    _this.logger = logger;

    return new Promise((resolve) => {
      process.loadExecutorConfig()
        .then((configValues) => {
          if (!_this.type && configValues.type) {
            _this.type = configValues.type;
          }
          _this.config = configValues;

          // ADD NOTIFICATORS SCHEMAS:
          requireDir('/../executors/', 'schema.json')
            .then((res) => {
              var keys = Object.keys(res);
              var keysLength = keys.length;
              while (keysLength--) {
                if (_this.type === keys[keysLength]) {

                  if (res[keys[keysLength]].hasOwnProperty('definitions') && res[keys[keysLength]].definitions.hasOwnProperty('params')) {

                    if (!ajv.getSchema('exec_' + keys[keysLength])) {
                      ajv.addSchema(res[keys[keysLength]].definitions.params, 'exec_' + keys[keysLength]);
                    }

                    var valid = ajv.validate('exec_' + keys[keysLength], _this);
                    if (!valid) {
                      logger.log('error', `Invalid params for executor ${_this.type}:`, ajv.errors);
                      throw new Error(`Invalid params for executor ${_this.type}:`, ajv.errors);
                      //resolve();
                    } else {
                      resolve(_this);
                    }
                    keysLength = 0;
                  }
                }
              }
              resolve(_this);
            })
            .catch((err) => {
              console.error(err);
              logger.log('warning', `Schema params for executor ${_this.type} not found`, err);
              resolve(_this);
            });
        })
        .catch(function (err) {
          logger.log('error', 'Executor loadConfig ', err);
          resolve();
        });
    });
  }

  exec(process) {
    return new Promise(function (resolve, reject) {
      logger.log('error', 'Method exec (execution) must be rewrite in child class');
      process.execute_err_return = `Method exec (execution) must be rewrite in child class`;
      process.execute_return = '';
      process.error();
      reject(process);
    });
  }

  kill(process) {
    return new Promise(function (resolve) {
      logger.log('error', 'Execution - Method kill must be rewrite in child class');
      process.execute_err_return = `Execution - Method kill must be rewrite in child class`;
      process.execute_return = '';
      process.stop();
      resolve();
    });
  }

  // Return config and params values:
  getValues(process) {
    return new Promise(function (resolve) {
      process.loadExecutorConfig()
        .then((configValues) => {
          var values = Object.assign(configValues, process.exec);
          replaceWithSmart(values, process.values())
            .then(function(res){
              resolve(res);
            })
            .catch(function(err){
              logger.log('error', 'Execution - Method getValues:',err);
              process.execute_err_return = 'Execution - Method getValues:' + err;
              process.execute_return = '';
              process.error();
              resolve();
            });
        });
    });
  }

  getParamValues(process) {
    return new Promise(function (resolve) {
      replaceWithSmart(process.exec, process.values())
        .then(function(res){
          resolve(res);
        })
        .catch(function(err){
          logger.log('error', 'Execution - Method getParamValues:',err);
          process.execute_err_return = 'Execution - Method getParamValues:' + err;
          process.execute_return = '';
          process.error();
          resolve();
        });
    });
  }

  getConfigValues(process) {
    return new Promise(function (resolve) {
      process.loadExecutorConfig()
        .then((configValues) => {
          replaceWithSmart(configValues, process.values())
            .then(function(res){
              resolve(res);
            })
            .catch(function(err){
              logger.log('error', 'Execution - Method getConfigValues:',err);
              process.execute_err_return = 'Execution - Method getConfigValues:' + err;
              process.execute_return = '';
              process.error();
              resolve();
            });
        });
    });
  }

}

module.exports = Execution;