"use strict";

var utils = require("../utils.js");
var replaceWithSmart = utils.replaceWithSmart;
var logger = utils.logger;
var checkExecutorParams = utils.checkExecutorParams;

class Execution {
  constructor(process) {

    var _this = this;

    var params = Object.keys(process.exec);
    var paramsLength = params.length;

    while (paramsLength--) {
      if(params[paramsLength] === "type"){
        logger.log("error", `Params of "${process.id}" contains no allowed "type" parameter, will be ignored.`);
      }else{
        _this[params[paramsLength]] = process.exec[params[paramsLength]];
      }
    }
    _this.logger = logger;
    _this.process = process;
    _this.processId = process.id;
    _this.processName = process.name;
    _this.processUId = process.uId;

    return new Promise((resolve, reject) => {
      process.loadExecutorConfig()
        .then((configValues) => {
          if (!_this.type && configValues.type) {
            _this.type = configValues.type;
          }
          _this.config = configValues;

          checkExecutorParams(_this)
            .then((res) => {
              resolve(_this);
            })
            .catch((err) => {
              reject(err);
            });
        })
        .catch(function (err) {
          reject(err);
        });
    });
  }

  execMain(){
    var _this = this;
    return new Promise(function (resolve, reject) {
      _this.resolve = resolve;
      _this.reject = reject;
      _this.getValues()
        .then((res) => {
          _this.exec(res);
        })
        .catch((err) => {
          _this.process.execute_err_return = `Getting values ${err}`;
          _this.process.execute_return = "";
          _this.process.error();
          reject(`Getting values ${err}`);
        });
    });
  }

  exec() {
    var _this = this;
    return new Promise(function (resolve, reject) {
      logger.log("error", "Method exec (execution) must be rewrite in child class");
      _this.process.execute_err_return = `Method exec (execution) must be rewrite in child class`;
      _this.process.execute_return = "";
      _this.process.error();
      reject("Method exec (execution) must be rewrite in child class");
    });
  }

  kill(reason) {
    var _this = this;
    return new Promise(function (resolve, reject) {
      logger.log("warn", _this.id, "killed: ",reason);
      _this.process.execute_err_return = _this.id + " - killed: " + reason;
      _this.process.execute_return = "";
      reject(_this.id + " - killed: " + reason);
    });
  }

  end(options) {
    var _this = this;

    if(!options){
      var options = {};
      options.end = "end";
    }
    options.end = options.end || "end";

    var resolve = _this.resolve;
    var reject = _this.reject;

    _this.process.execute_arg = options.execute_arg;
    _this.process.command_executed = options.command_executed;
    _this.process.execute_err_return = options.execute_err_return || "";
    _this.process.execute_return = options.execute_return || "";
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
      case "error":
        _this.process.error();
        reject(options.messageLog || "");
        break;
      default:
        _this.process.end();
        resolve();
        break;
    }
  }

  paramsReplace(input, options) {
    var _this = this;
    var useGlobalValues = options.useGlobalValues || true;
    var useProcessValues = options.useProcessValues || false;
    var altValueReplace = options.altValueReplace || "";
    var useExtraValue = options.useExtraValue || false;

    var _options = {
      ignoreGlobalValues: !useGlobalValues,
      altValueReplace: altValueReplace
    };

    return new Promise(function (resolve, reject) {

      var replacerValues = {};
      //Process values
      if (useProcessValues) {
        Object.assign(replacerValues, _this.process.values());
      }
      // Custom object values:
      if (useExtraValue) {
        Object.assign(replacerValues, useExtraValue);
      }

      replaceWithSmart(input, replacerValues, _options)
        .then(function (res) {
          resolve(res);
        })
        .catch(function (err) {
          logger.log("error", "Execution - Method getValues:", err);
          _this.process.execute_err_return = "Execution - Method getValues:" + err;
          _this.process.execute_return = "";
          _this.process.error();
          reject(err);
        });
    });
  }

  // Return config and params values:
  getValues() {
    var _this = this;
    return new Promise(function (resolve, reject) {
      _this.process.loadExecutorConfig()
        .then((configValues) => {
          var values = {};
          Object.assign(values, configValues);
          Object.assign(values, _this.process.exec);

          if(_this.process.exec.type && configValues.type){
            values.type = configValues.type;
          }

          replaceWithSmart(values, _this.process.values())
            .then(function (res) {
              resolve(res);
            })
            .catch(function (err) {
              logger.log("error", "Execution - Method getValues:", err);
              _this.process.execute_err_return = "Execution - Method getValues:" + err;
              _this.process.execute_return = "";
              _this.process.error();
              reject(err);
            });
        })
        .catch(function (err) {
          logger.log("error", "Execution - Method getValues / loadExecutorConfig:", err);
          _this.process.execute_err_return = "Execution - Method getValues / loadExecutorConfig:" + err;
          _this.process.execute_return = "";
          _this.process.error();
          reject(err);
        });
    });
  }

  getParamValues() {
    return new Promise(function (resolve, reject) {
      replaceWithSmart(_this.process.exec, _this.process.values())
        .then(function (res) {
          resolve(res);
        })
        .catch(function (err) {
          logger.log("error", "Execution - Method getParamValues:", err);
          _this.process.execute_err_return = "Execution - Method getParamValues:" + err;
          _this.process.execute_return = "";
          _this.process.error();
          reject(err);
        });
    });
  }

  getConfigValues() {
    return new Promise(function (resolve) {
      _this.process.loadExecutorConfig()
        .then((configValues) => {
          replaceWithSmart(configValues, _this.process.values())
            .then(function (res) {
              resolve(res);
            })
            .catch(function (err) {
              logger.log("error", "Execution - Method getConfigValues:", err);
              _this.process.execute_err_return = "Execution - Method getConfigValues:" + err;
              _this.process.execute_return = "";
              _this.process.error();
              resolve();
            });
        })
        .catch(function (err) {
          logger.log("error", "Execution - Method getConfigValues / loadExecutorConfig:", err);
          _this.process.execute_err_return = "Execution - Method getConfigValues / loadExecutorConfig:" + err;
          _this.process.execute_return = "";
          _this.process.error();
          reject(err);
        });
    });
  }

}

module.exports = Execution;