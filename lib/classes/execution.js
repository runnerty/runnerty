'use strict';

const utils = require('../utils.js');
const ms = require('millisecond');
const replaceWithSmart = utils.replaceWithSmart;
const logger = require('../logger.js');
const checkExecutorParams = utils.checkExecutorParams;

class Execution {
  constructor(process) {
    let _this = this;

    const params = Object.keys(process.exec);
    let paramsLength = params.length;

    while (paramsLength--) {
      if (params[paramsLength] === 'type') {
        logger.log(
          'error',
          `Params of "${
            process.id
          }" contains no allowed "type" parameter, will be ignored.`
        );
      } else {
        _this[params[paramsLength]] = process.exec[params[paramsLength]];
      }
    }
    _this.logger = logger;
    _this.process = process;
    _this.processId = process.id;
    _this.processName = process.name;
    _this.processUId = process.uId;

    return new Promise((resolve, reject) => {
      process
        .loadExecutorConfig()
        .then(configValues => {
          if (!_this.type && configValues.type) {
            _this.type = configValues.type;
          }
          _this.config = configValues;

          checkExecutorParams(_this)
            .then(() => {
              resolve(_this);
            })
            .catch(err => {
              reject(err);
            });
        })
        .catch(function(err) {
          reject(err);
        });
    });
  }

  execMain(process_resolve, process_reject) {
    let _this = this;
    _this.resolve = process_resolve;
    _this.reject = process_reject;
    _this
      .getValues()
      .then(res => {
        _this.exec(res);
      })
      .catch(err => {
        _this.process.execute_err_return = `Getting values ${err}`;
        _this.process.msg_output = '';
        _this.process.error();
        _this.reject(`Getting values ${err}`);
      });
  }

  exec() {
    let _this = this;
    return new Promise(function(resolve, reject) {
      logger.log(
        'error',
        'Method exec (execution) must be rewrite in child class'
      );
      _this.process.execute_err_return =
        'Method exec (execution) must be rewrite in child class';
      _this.process.msg_output = '';
      _this.process.error();
      reject('Method exec (execution) must be rewrite in child class');
    });
  }

  killMain(reason, options) {
    let _this = this;
    _this
      .getValues()
      .then(res => {
        _this.kill(res, reason, options);
      })
      .catch(err => {
        _this.process.execute_err_return = `Getting values ${err}`;
        _this.process.msg_output = '';
        _this.process.error();
        _this.reject(`Getting values ${err}`);
      });
  }

  kill(params, reason, options) {
    let _this = this;
    logger.log('warn', _this.id, 'killed: ', reason);
    _this.process.execute_err_return = _this.id + ' - killed: ' + reason;
    _this.process.msg_output = '';
    _this.end(options);
  }

  end(options) {
    let _this = this;

    if (_this.timeout) {
      clearTimeout(_this.timeout);
    }

    if (!options) {
      options = {};
    }
    options.end = options.end || 'end';

    let resolve = _this.resolve;
    let reject = _this.reject;

    _this.process.execute_arg = options.execute_arg;
    _this.process.command_executed = options.command_executed;

    //STANDARD OUPUT:
    _this.process.data_output =
      options.data_output instanceof Object
        ? JSON.stringify(options.data_output)
        : options.data_output || '';
    _this.process.msg_output = options.msg_output || '';

    //EXTRA DATA OUTPUT:
    if (options.extra_output) {
      _this.process.extra_output = utils.JSON2KV(options.extra_output,'_','PROCESS_EXEC');
    }

    switch (options.end) {
      case 'error':
        if (_this.process.retries && !_this.process.retries_count)
          _this.process.retries_count = 0;

        // RETRIES:
        if (
          _this.process.retries &&
          _this.process.retries_count < _this.process.retries
        ) {
          // NOTIFICATE  ONLY LAST FAIL: notificate_only_last_fail
          _this.process.error(!_this.process.notificate_only_last_fail);

          // RETRIES DELAY:
          setTimeout(function() {
            _this.process.retries_count =
              (_this.process.retries_count || 0) + 1;
            _this.process.retry();
            _this.execMain(_this.resolve, _this.reject);
          }, ms(_this.process.retry_delay));
        } else {
          _this.process.err_output = options.err_output;
          _this.process.error();
          reject(options.messageLog || '');
        }
        break;
      default:
        _this.process.end().then(() => {
          resolve();
        });
        break;
    }
  }

  paramsReplace(input, options) {
    let _this = this;
    const useGlobalValues = options.useGlobalValues || true;
    const useProcessValues = options.useProcessValues || false;
    const useExtraValue = options.useExtraValue || false;

    let _options = {
      ignoreGlobalValues: !useGlobalValues
    };

    if (options.altValueReplace) {
      _options.altValueReplace = options.altValueReplace;
    }

    return new Promise(function(resolve, reject) {
      let replacerValues = {};
      //Process values
      if (useProcessValues) {
        Object.assign(replacerValues, _this.process.values());
      }
      // Custom object values:
      if (useExtraValue) {
        Object.assign(replacerValues, useExtraValue);
      }

      replaceWithSmart(input, replacerValues, _options)
        .then(res => {
          resolve(res);
        })
        .catch(err => {
          logger.log('error', 'Execution - Method getValues:', err);
          _this.process.err_output = 'Execution - Method getValues:' + err;
          _this.process.msg_output = '';
          _this.process.error();
          reject(err);
        });
    });
  }

  // Return config and params values:
  getValues() {
    let _this = this;
    return new Promise((resolve, reject) => {
      _this.process
        .loadExecutorConfig()
        .then(configValues => {
          let values = {};
          Object.assign(values, configValues);
          Object.assign(values, _this.process.exec);

          if (_this.process.exec.type && configValues.type) {
            values.type = configValues.type;
          }

          replaceWithSmart(values, _this.process.values())
            .then(res => {
              resolve(res);
            })
            .catch(err => {
              logger.log('error', 'Execution - Method getValues:', err);
              _this.process.err_output = 'Execution - Method getValues:' + err;
              _this.process.msg_output = '';
              _this.process.error();
              reject(err);
            });
        })
        .catch(err => {
          logger.log(
            'error',
            'Execution - Method getValues / loadExecutorConfig:',
            err
          );
          _this.process.err_output =
            'Execution - Method getValues / loadExecutorConfig:' + err;
          _this.process.msg_output = '';
          _this.process.error();
          reject(err);
        });
    });
  }

  getParamValues() {
    let _this = this;
    return new Promise((resolve, reject) => {
      replaceWithSmart(_this.process.exec, _this.process.values())
        .then(res => {
          resolve(res);
        })
        .catch(err => {
          logger.log('error', 'Execution - Method getParamValues:', err);
          _this.process.err_output = 'Execution - Method getParamValues:' + err;
          _this.process.msg_output = '';
          _this.process.error();
          reject(err);
        });
    });
  }

  getConfigValues() {
    let _this = this;
    return new Promise((resolve, reject) => {
      _this.chain
        .loadExecutorConfig()
        .then(configValues => {
          replaceWithSmart(configValues, _this.process.values())
            .then(res => {
              resolve(res);
            })
            .catch(err => {
              logger.log('error', 'Execution - Method getConfigValues:', err);
              _this.process.err_output =
                'Execution - Method getConfigValues:' + err;
              _this.process.msg_output = '';
              _this.process.error();
              resolve();
            });
        })
        .catch(err => {
          logger.log(
            'error',
            'Execution - Method getConfigValues / loadExecutorConfig:',
            err
          );
          _this.process.err_output =
            'Execution - Method getConfigValues / loadExecutorConfig:' + err;
          _this.process.msg_output = '';
          _this.process.error();
          reject(err);
        });
    });
  }
}

module.exports = Execution;
