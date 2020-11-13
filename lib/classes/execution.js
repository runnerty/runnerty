'use strict';

const utils = require('../utils.js');
const ms = require('millisecond');
const recursiveObjectInterpreter = utils.recursiveObjectInterpreter;
const logger = require('../logger.js');
const checkExecutorParams = utils.checkExecutorParams;
const stringify = require('json-stringify-safe');

class Execution {
  constructor(process) {
    const params = Object.keys(process.exec);
    let paramsLength = params.length;

    while (paramsLength--) {
      if (params[paramsLength] === 'type') {
        logger.log('error', `Params of "${process.id}" contains no allowed "type" parameter, will be ignored.`);
      } else {
        this[params[paramsLength]] = process.exec[params[paramsLength]];
      }
    }
    this.logger = logger;
    this.process = process;
    this.processId = process.id;
    this.processName = process.name;
    this.processUId = process.uId;
  }

  async init() {
    try {
      const configValues = await this.process.loadExecutorConfig();
      if (!this.type && configValues.type) {
        this.type = configValues.type;
      }
      this.config = configValues;
      const execToCheck = Object.assign({}, this.process.exec);
      execToCheck.config = configValues;
      execToCheck.type = this.type;
      checkExecutorParams(execToCheck);
      return this;
    } catch (err) {
      logger.log('error', `init Executor:`, err);
      throw err;
    }
  }

  async execMain(process_resolve, process_reject) {
    this.resolve = process_resolve;
    this.reject = process_reject;
    try {
      const values = await this.getValues();
      this.exec(values);
    } catch (err) {
      logger.log('error', `execMain Executor:`, err);
      this.process.execute_err_return = `execMain Executor: ${err}`;
      this.process.msg_output = '';
      await this.process.error();
      this.reject(`execMain Executor: ${err}`);
    }
  }

  async exec() {
    logger.log('error', 'Method exec (execution) must be rewrite in child class');
    this.process.execute_err_return = 'Method exec (execution) must be rewrite in child class';
    this.process.msg_output = '';
    await this.process.error();
    throw new Error('Method exec (execution) must be rewrite in child class');
  }

  async killMain(reason, options) {
    try {
      const values = await this.getValues();
      this.kill(values, reason, options);
    } catch (err) {
      logger.log('error', `killMain Executor:`, err);
      this.process.execute_err_return = `killMain Execution ${err}`;
      this.process.msg_output = '';
      await this.process.error();
      throw new Error(`killMain Execution ${err}`);
    }
  }

  kill(params, reason, options) {
    logger.log('warn', this.id, 'killed: ', reason);
    this.process.execute_err_return = this.id + ' - killed: ' + reason;
    this.process.msg_output = '';
    this.end(options);
  }

  async end(options) {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    if (!options) {
      options = {};
    }
    options.end = options.end || 'end';

    this.process.execute_arg = options.execute_arg;
    this.process.command_executed = options.command_executed;

    let outputParsed;
    //OUTPUT FILTER (data_output):
    if (this.process.output_filter && options.data_output) {
      try {
        if (options.data_output instanceof Object) {
          outputParsed = options.data_output;
        } else {
          outputParsed = JSON.parse(options.data_output);
        }
        //OVERRIDE DATA OUTPUT:
        options.data_output = await utils.applyOuputFilter(this.process.output_filter, outputParsed);
        outputParsed = options.data_output;
      } catch (err) {
        logger.log('warn', `The output of process ${this.process.id}, is not a filterable object.`);
      }
    }

    //OUTPUT ORDER (data_output):
    if (this.process.output_order && options.data_output) {
      try {
        if (!outputParsed) {
          if (options.data_output instanceof Object) {
            outputParsed = options.data_output;
          } else {
            outputParsed = JSON.parse(options.data_output);
          }
        }
        //OVERRIDE DATA OUTPUT:
        options.data_output = utils.applyOutputOrder(this.process.output_order, outputParsed);
      } catch (err) {
        logger.log('warn', `The output of process ${this.process.id}, is not a sortable object.`);
      }
    }

    let extraOutputParsed;
    //OUTPUT FILTER (extra_output):
    if (this.process.output_filter && options.extra_output) {
      try {
        if (options.extra_output instanceof Object) {
          extraOutputParsed = options.extra_output;
        } else {
          extraOutputParsed = JSON.parse(options.extra_output);
        }
        //OVERRIDE DATA OUTPUT:
        options.extra_output = await utils.applyOuputFilter(this.process.output_filter, extraOutputParsed);
        extraOutputParsed = options.extra_output;
      } catch (err) {
        logger.log('warn', `The extra_output of process ${this.process.id}, is not a filterable object.`);
      }
    }

    //OUTPUT ORDER (extra_output):
    if (this.process.output_order && options.extra_output) {
      try {
        if (!extraOutputParsed) {
          if (options.data_output instanceof Object) {
            extraOutputParsed = options.extra_output;
          } else {
            extraOutputParsed = JSON.parse(options.extra_output);
          }
        }
        //OVERRIDE DATA OUTPUT:
        options.extra_output = utils.applyOutputOrder(this.process.output_order, extraOutputParsed);
      } catch (err) {
        logger.log('warn', `The extra_output of process ${this.process.id}, is not a sortable object.`);
      }
    }

    //STANDARD OUPUT:
    this.process.data_output =
      options.data_output instanceof Object ? stringify(options.data_output) : options.data_output || '';
    this.process.msg_output = options.msg_output || '';

    //EXTRA DATA OUTPUT:
    if (options.extra_output) {
      this.process.extra_output = utils.JSON2KV(options.extra_output, '_', 'PROCESS_EXEC');
    }

    switch (options.end) {
      case 'error':
        if (this.process.retries && !this.process.retries_count) this.process.retries_count = 0;

        // RETRIES:
        if (this.process.retries && this.process.retries_count < this.process.retries) {
          const willRetry = true;
          const writeOutput = true;
          this.process.err_output = options.err_output;
          // NOTIFICATE ONLY LAST FAIL: notificate_only_last_fail
          await this.process.error(!this.process.notificate_only_last_fail, writeOutput, willRetry);

          // RETRIES DELAY:
          setTimeout(() => {
            this.process.retries_count = (this.process.retries_count || 0) + 1;
            this.process.err_output = '';
            this.process.retry();
            this.execMain(this.resolve, this.reject);
          }, ms(this.process.retry_delay));
        } else {
          this.process.err_output = options.err_output;
          await this.process.error();
          this.reject(options.messageLog || '');
        }
        break;
      default:
        await this.process.end();
        this.resolve();
        break;
    }
  }

  async paramsReplace(input, options) {
    const useGlobalValues = options.useGlobalValues || true;
    const useProcessValues = options.useProcessValues || false;
    const useExtraValue = options.useExtraValue || false;

    const _options = {
      ignoreGlobalValues: !useGlobalValues
    };

    if (options.altValueReplace) {
      _options.altValueReplace = options.altValueReplace;
    }

    const replacerValues = {};
    //Process values
    if (useProcessValues) {
      Object.assign(replacerValues, this.process.values());
    }
    // Custom object values:
    if (useExtraValue) {
      Object.assign(replacerValues, useExtraValue);
    }

    try {
      const replacedValues = await recursiveObjectInterpreter(input, replacerValues, _options);
      return replacedValues;
    } catch (err) {
      logger.log('error', 'Execution - Method getValues:', err);
      this.process.err_output = 'Execution - Method getValues:' + err;
      this.process.msg_output = '';
      await this.process.error();
      throw err;
    }
  }

  // Return config and params values:
  async getValues() {
    try {
      const configValues = await this.process.loadExecutorConfig();

      const values = {};
      Object.assign(values, configValues);
      Object.assign(values, this.process.exec);
      if (this.process.exec.type && configValues.type) {
        values.type = configValues.type;
      }
      const repacedValues = await recursiveObjectInterpreter(values, this.process.values());
      return repacedValues;
    } catch (err) {
      logger.log('error', 'Execution - Method getValues / loadExecutorConfig:', err);
      this.process.err_output = 'Execution - Method getValues / loadExecutorConfig:' + err;
      this.process.msg_output = '';
      await this.process.error();
      throw err;
    }
  }

  async getParamValues() {
    try {
      const res = await recursiveObjectInterpreter(this.process.exec, this.process.values());
      return res;
    } catch (err) {
      logger.log('error', 'Execution - Method getParamValues:', err);
      this.process.err_output = 'Execution - Method getParamValues:' + err;
      this.process.msg_output = '';
      await this.process.error();
      throw err;
    }
  }

  async getConfigValues() {
    try {
      const configValues = await this.chain.loadExecutorConfig();
      const replacedValues = await recursiveObjectInterpreter(configValues, this.process.values());
      return replacedValues;
    } catch (err) {
      logger.log('error', 'Execution - Method getConfigValues:', err);
      this.process.err_output = 'Execution - Method getConfigValues:' + err;
      this.process.msg_output = '';
      await this.process.error();
      throw err;
    }
  }
}

module.exports = Execution;
