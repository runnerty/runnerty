"use strict";

var replaceWithSmart = require("../libs/utils.js").replaceWithSmart;
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
    _this.logger = logger;
    _this.process = process;
    _this.processId = process.id;
    _this.processName = process.name;
    _this.processUId = process.uId;

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
    var _this = this;
    return new Promise(function (resolve, reject) {
      logger.log('error', 'Method exec (execution) must be rewrite in child class');
      _this.process.execute_err_return = `Method exec (execution) must be rewrite in child class`;
      _this.process.execute_return = '';
      _this.process.error();
      reject();
    });
  }

  kill(process) {
    var _this = this;
    return new Promise(function (resolve) {
      logger.log('warn', 'Execution - Method kill must be rewrite in child class');
      _this.process.execute_err_return = `Execution - Method kill must be rewrite in child class`;
      _this.process.execute_return = '';
      _this.process.stop();
      resolve();
    });
  }

  end(options, resolve, reject){
    var _this = this;
    _this.process.execute_arg =options.execute_arg;
    _this.process.command_executed = options.command_executed;
    _this.process.execute_err_return = options.execute_err_return || '';
    _this.process.execute_return = options.execute_return || '';
    _this.process.execute_db_results = options.execute_db_results;
    _this.process.execute_db_results_object = options.execute_db_results_object;
    _this.process.execute_db_results_csv = options.execute_db_results_csv;
    _this.process.execute_db_fieldCount = options.execute_db_fieldCount;
    _this.process.execute_db_affectedRows = options.execute_db_affectedRows;
    _this.process.execute_db_changedRows = options.execute_db_changedRows;
    _this.process.execute_db_insertId = options.execute_db_insertId;
    _this.process.execute_db_warningCount = options.execute_db_warningCount;
    _this.process.execute_db_message = options.execute_db_message;
    _this.process.retries_count = options.retries_count;

    switch (options.end) {
      case 'error':
        _this.process.error();
        reject(options.messageLog || '');
        break;
      default:
        _this.process.end();
        resolve();
        break;
    }
  }

  paramsReplace(input, options){
    var _this = this;
    var useGlobalValues = options.useGlobalValues || true;
    var useArgsValues = options.useArgsValues || false;
    var useProcessValues = options.useProcessValues || false;
    var altValueReplace = options.altValueReplace || '';
    var useExtraValue = options.useExtraValue || false;

    var _options = {
      ignoreGlobalValues: !useGlobalValues,
      altValueReplace: altValueReplace
    };

    return new Promise(async function (resolve) {

      var replacerValues = {};
      //Process values
      if(useProcessValues){
        replacerValues =  Object.assign(replacerValues, _this.process.values());
      }
      //Params args process
      if(useArgsValues){
        replacerValues =  Object.assign(replacerValues, await _this.getArgs());
      }
      // Custom object values:
      if(useExtraValue){
        replacerValues =  Object.assign(replacerValues, useExtraValue);
      }

      replaceWithSmart(input, replacerValues, _options)
        .then(function (res) {
          resolve(res);
        })
        .catch(function (err) {
          logger.log('error', 'Execution - Method getValues:', err);
          _this.process.execute_err_return = 'Execution - Method getValues:' + err;
          _this.process.execute_return = '';
          _this.process.error();
          resolve();
        });
    });
  }

  // Return config and params values:
  getValues() {
    var _this = this;
    return new Promise(function (resolve) {
      _this.process.loadExecutorConfig()
        .then((configValues) => {
          var values = {};
          values = Object.assign(values, configValues);
          values = Object.assign(values, _this.process.exec);
          replaceWithSmart(values, _this.process.values())
            .then(function(res){
              resolve(res);
            })
            .catch(function(err){
              logger.log('error', 'Execution - Method getValues:',err);
              _this.process.execute_err_return = 'Execution - Method getValues:' + err;
              _this.process.execute_return = '';
              _this.process.error();
              resolve();
            });
        });
    });
  }

  getArgs() {
    var _this = this;
    return new Promise(function (resolve) {
      replaceWithSmart(_this.process.args, _this.process.values())
        .then((res) => {
          _this.process.execute_arg = res;
          resolve(res);
        });
    });
  }

  getParamValues() {
    return new Promise(function (resolve) {
      replaceWithSmart(_this.process.exec, _this.process.values())
        .then(function(res){
          resolve(res);
        })
        .catch(function(err){
          logger.log('error', 'Execution - Method getParamValues:',err);
          _this.process.execute_err_return = 'Execution - Method getParamValues:' + err;
          _this.process.execute_return = '';
          _this.process.error();
          resolve();
        });
    });
  }

  getConfigValues() {
    return new Promise(function (resolve) {
      _this.process.loadExecutorConfig()
        .then((configValues) => {
          replaceWithSmart(configValues, _this.process.values())
            .then(function(res){
              resolve(res);
            })
            .catch(function(err){
              logger.log('error', 'Execution - Method getConfigValues:',err);
              _this.process.execute_err_return = 'Execution - Method getConfigValues:' + err;
              _this.process.execute_return = '';
              _this.process.error();
              resolve();
            });
        });
    });
  }

}

module.exports = Execution;