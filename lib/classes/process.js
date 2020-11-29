'use strict';

const utils = require('../utils.js');
const logger = require('../logger.js');
const runtime = require('./runtime');
const runnertyio = require('./runnertyio.js');
const loadConfigSection = utils.loadConfigSection;
const recursiveObjectInterpreter = utils.recursiveObjectInterpreter;
const checkExecutorParams = utils.checkExecutorParams;
const getChainByUId = utils.getChainByUId;
const chronometer = utils.chronometer;
const lodash = require('lodash');
const crypto = require('crypto');
const bytes = require('bytes');
const fs = require('fs-extra');
const fsp = require('fs').promises;
const path = require('path');
const sizeof = require('object-sizeof');
const ms = require('ms');

const notificationEvent = require('./notificationEvent.js');

class Process {
  constructor(process) {
    this.id = process.id;
    this.name = process.name;
    this.uId = '';
    this.queue = process.queue;
    this.priority = process.priority || 0;
    this.parentUId = process.parentUId;
    this.parentExecutionId = process.parentExecutionId;
    this.executionId = process.executionId || '';
    this.depends_process = process.depends_process || [];
    this.exec = process.exec;

    this.chain_action_on_fail = process.chain_action_on_fail || 'abort';
    if (typeof process.ignore_in_final_chain_status === 'undefined') {
      this.ignore_in_final_chain_status = this.chain_action_on_fail === 'continue';
    } else {
      this.ignore_in_final_chain_status = process.ignore_in_final_chain_status;
    }
    this.fail_on_child_fail = process.fail_on_child_fail || false;

    this.retries = process.retries;
    this.retry_delay = process.retry_delay;
    this.timeout = process.timeout;

    this.output = process.output;
    this.output_iterable = process.output_iterable;
    this.custom_values = process.custom_values || {};
    this.output_share = process.output_share;
    this.output_filter = process.output_filter;
    this.output_order = process.output_order;
    this.notificate_only_last_fail = process.notificate_only_last_fail || false;
    this.notifications_plane = process.notifications_plane || lodash.cloneDeep(process.notifications);
    this.notifications = this.notifications_plane || process.notifications;

    //Runtime attributes:
    this.status = process.status || 'stop';
    this.msg_output = process.msg_output;
    this.err_output = process.err_output;
    this.started_at = process.started_at;
    this.ended_at = process.ended_at;
    this.chain = process.chain;
  }

  async init() {
    try {
      await this.setUid();
      this.notifications = await this.loadProcessNotifications(this.notifications);
      return this;
    } catch (err) {
      logger.log('error', `init Process:`, err);
      throw err;
    }
  }

  setUid() {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buffer) => {
        if (err) reject(err);
        this.uId = this.id + '_' + buffer.toString('hex');
        resolve();
      });
    });
  }

  values() {
    const chain_values = this.chain.chainValues;
    const process_values = {
      CHAIN_ID: chain_values.CHAIN_ID,
      CHAIN_NAME: chain_values.CHAIN_NAME,
      CHAIN_EXEC_ID: chain_values.CHAIN_EXEC_ID,
      CHAIN_UID: chain_values.CHAIN_UID,
      CHAIN_PARENT_UID: chain_values.CHAIN_PARENT_UID,
      CHAIN_PARENT_PROCESS_UID: chain_values.CHAIN_PARENT_PROCESS_UID,
      CHAIN_PARENT_EXECUTION_ID: chain_values.CHAIN_PARENT_EXECUTION_ID,
      CHAIN_EXECUTION_ID: chain_values.CHAIN_EXECUTION_ID,
      CHAIN_STARTED_AT: chain_values.CHAIN_STARTED_AT,
      CHAIN_DURATION_SECONDS: chain_values.CHAIN_DURATION_SECONDS,
      CHAIN_DURATION_HUMANIZED: chain_values.CHAIN_DURATION_HUMANIZED,
      CHAIN_RETRIES_COUNT: chain_values.CHAIN_RETRIES_COUNT,
      CHAIN_RETRIES: chain_values.CHAIN_RETRIES,
      PROCESS_ID: this.id,
      PROCESS_UID: this.uId,
      PROCESS_PARENT_UID: this.parentUId,
      PROCESS_PARENT_EXECUTION_ID: this.parentExecutionId,
      PROCESS_EXECUTION_ID: this.executionId,
      PROCESS_NAME: this.name,
      PROCESS_EXEC_COMMAND: this.exec instanceof Object ? this.exec.command : this.exec,
      PROCESS_EXEC_ID: this.exec instanceof Object ? this.exec.id : '',
      PROCESS_EXEC_COMMAND_EXECUTED: this.command_executed,
      PROCESS_EXEC_OUTPUT_SHARE: this.execute_output_share,
      PROCESS_STARTED_AT: this.started_at,
      PROCESS_ENDED_AT: this.ended_at,
      PROCESS_DURATION_SECONDS: this.duration_seconds,
      PROCESS_DURATION_HUMANIZED: this.duration_humanized,
      PROCESS_RETRIES_COUNT: this.retries_count,
      PROCESS_RETRIES: this.retries,
      PROCESS_DEPENDS_FILES_READY: this.depends_files_ready,
      PROCESS_FIRST_DEPEND_FILE_READY:
        this.depends_files_ready && this.depends_files_ready.length > 0 ? this.depends_files_ready[0] : [],
      PROCESS_LAST_DEPEND_FILE_READY:
        this.depends_files_ready && this.depends_files_ready.length > 0
          ? this.depends_files_ready[this.depends_files_ready.length - 1]
          : [],
      PROCESS_EXEC_MSG_OUTPUT: this.msg_output,
      PROCESS_EXEC_DATA_OUTPUT: this.data_output,
      PROCESS_EXEC_ERR_OUTPUT: this.err_output
    };

    const values = {};
    Object.assign(values, process_values);
    // EXTRA OUTPUT EXECUTORS:
    if (this.extra_output) Object.assign(values, this.extra_output);
    Object.assign(values, this.execute_input);
    Object.assign(values, this.custom_values);
    return values;
  }

  /**
   * Load plan process notifications and create notifications events.
   * Used in class Process creation.
   * @param notifications (plan process object)
   * @returns {Promise} Empty
   */
  async loadProcessNotifications(notifications) {
    const processNotificationsPromises = [];

    if (notifications instanceof Object) {
      const events = Object.keys(notifications);
      let eventsLength = events.length;
      if (events instanceof Array) {
        if (eventsLength > 0) {
          while (eventsLength--) {
            const event = notifications[events[eventsLength]];
            if (event.length) {
              const _notificationEvent = new notificationEvent(events[eventsLength], event);
              processNotificationsPromises.push(_notificationEvent.init());
            }
          }

          try {
            let notificationsArr = await Promise.all(processNotificationsPromises);
            notificationsArr = notificationsArr.filter(Boolean); // Remove undefined items
            const notifications = {};
            let notificationsArrLength = notificationsArr.length;
            while (notificationsArrLength--) {
              const e = notificationsArr[notificationsArrLength];
              const key = Object.keys(e);
              notifications[key[0]] = e[key[0]];
            }
            return notifications;
          } catch (err) {
            throw new Error(err);
          }
        } else {
          // Process without
          logger.log('warn', 'Process, without notifications');
        }
      }
    } else {
      logger.log('warn', `Process ${this.id}, notifications is not set`);
    }
  }

  loadExecutorConfig() {
    return loadConfigSection(runtime.config, 'executors', this.exec.id);
  }

  async notificate(event) {
    if (this.hasOwnProperty('notifications') && this.notifications !== undefined) {
      if (this.notifications.hasOwnProperty(event)) {
        const notificationsPromises = [];
        this.notifications[event].map(_notification => {
          notificationsPromises.push(_notification.notificate(this.values()));
        });

        await Promise.all(notificationsPromises);
      }
    }
  }

  historicize(event) {
    const values = {
      id: this.id,
      uId: this.uId,
      parentUId: this.parentUId,
      parentExecutionId: this.parentExecutionId,
      executionId: this.executionId,
      event: event || this.status,
      name: this.name,
      exec: this.exec,
      depends_process: this.depends_process,
      retries: this.retries,
      retry_delay: this.retry_delay,
      timeout: this.timeout,
      chain_action_on_fail: this.chain_action_on_fail,
      command_executed: this.command_executed,
      retries_count: this.retries_count,
      output: this.output,
      output_iterable: this.output_iterable,
      custom_values: this.custom_values,
      output_share: this.execute_output_share,
      msg_output: this.msg_output,
      err_output: this.err_output,
      started_at: this.started_at,
      ended_at: this.ended_at,
      duration_seconds: this.duration_seconds,
      output_size:
        sizeof(this.msg_output || '') +
        sizeof(this.messageLog || '') +
        sizeof(this.err_output || '') +
        sizeof(this.data_output || '') +
        sizeof(this.extra_output || '')
    };

    // RunnertyIO History
    const valuesSec = Object.assign({}, values);
    runnertyio.send('process', valuesSec).catch(err => {
      logger.log(
        'error',
        `RunnertyIO - error historicize ${valuesSec.event} process ${this.id} ${err}.\n values:${valuesSec}`
      );
    });
  }

  isStopped() {
    return this.status === 'stop';
  }

  isEnded() {
    return this.status === 'end';
  }

  isRunning() {
    return this.status === 'running';
  }

  isErrored() {
    return this.status === 'error';
  }

  isIgnored() {
    return this.status === 'ignored';
  }

  stopChildChains() {
    //If have childs_chains
    if (this.childs_chains) {
      // Set All childs_chains to stopped
      this.childs_chains_status = 'stop';
      let childsChainsLength = this.childs_chains.length;
      while (childsChainsLength--) {
        this.childs_chains[childsChainsLength].stop();
      }
    }
  }

  stop(reason) {
    if (this.executor && !this.isStopped() && !this.isEnded() && !this.isErrored() && !this.isIgnored()) {
      this.status = 'stop';
      if (!reason) reason = `Process ${this.id} stopped`;
      this.executor.killMain(reason);
      this.stopChildChains();
    } else {
      this.status = 'stop';
    }
  }

  async end(notificate, writeOutput) {
    const duration = chronometer(this.hr_started_time);
    this.duration_seconds = duration[0];
    this.duration_humanized = duration[1];
    notificate = notificate || true;
    writeOutput = writeOutput || true;

    this.status = 'end';
    const currentDate = new Date();
    this.ended_at = currentDate.toISOString();

    if (notificate) {
      await this.notificate('on_end');
    }
    this.depends_files_ready = [];

    if (writeOutput) {
      await this.write_output();
    }
    await this.setOutputShare();
    this.historicize();
  }

  async endChildChains(abortIfEndCausedByAnProcessError) {
    if (abortIfEndCausedByAnProcessError) {
      this.childs_chains_status = 'error';
      this.notificate('on_fail_childs');

      if (this.fail_on_child_fail) {
        await this.error(false);
      }
    } else {
      this.childs_chains_status = 'end';
      this.notificate('on_end_childs');
    }

    const globalPlanChains = runtime.plan.chains;

    const chainParentFound = getChainByUId(globalPlanChains, this.parentUId);
    if (chainParentFound) {
      await chainParentFound.refreshChainStatus();
    }
  }

  startChildChains() {
    this.notificate('on_start_childs');
    this.childs_chains_status = 'running';
  }

  async startChildChainsDependients() {
    let chainsLength = runtime.plan.chains.length;
    const chainsToRun = [];

    const output_iterable_string = this.values()[this.output_iterable];
    let childChainsinputIterable;

    if (output_iterable_string && output_iterable_string.length) {
      try {
        childChainsinputIterable = JSON.parse(output_iterable_string);
      } catch (err) {
        throw new Error(`Invalid input (${output_iterable_string}), incorrect JSON` + '\nCaused by: ' + err.stack);
      }
    }

    if (childChainsinputIterable && childChainsinputIterable.length > 0) {
      while (chainsLength--) {
        const itemChain = runtime.plan.chains[chainsLength];
        const procValues = this.values();

        if (
          itemChain.hasOwnProperty('depends_chains') &&
          itemChain.depends_chains.hasOwnProperty('chain_id') &&
          itemChain.depends_chains.hasOwnProperty('process_id') &&
          itemChain.depends_chains.chain_id === procValues.CHAIN_ID &&
          itemChain.depends_chains.process_id === this.id
        ) {
          if (itemChain.isEnded()) {
            itemChain.status = 'stop';
          }
          const executeInmediate = true;
          const childChain = runtime.plan.scheduleChain(
            itemChain,
            this,
            executeInmediate,
            childChainsinputIterable,
            this.custom_values
          );
          if (childChain) chainsToRun.push(childChain);
        }
      }

      if (chainsToRun.length) {
        this.startChildChains();
        try {
          await Promise.all(chainsToRun);
        } catch (err) {
          throw new Error(err);
        }
      } else {
        logger.log('debug', `Process ${this.id} whitout childs chains to run.`);
      }
    } else {
      logger.log('debug', `Process ${this.id} whitout output_iterable items.`);
    }
  }

  refreshProcessChildsChainsStatus(abortIfEndCausedByAnProcessError) {
    let childsChainsLength = this.childs_chains.length;
    let statusChildsChains = 'end';

    let chainsError = 0;
    let chainsRunning = 0;
    let chainsStop = 0;
    let chainsEnd = 0;

    while (childsChainsLength--) {
      switch (this.childs_chains[childsChainsLength].status) {
        case 'stop':
          chainsStop += 1;
          break;
        case 'running':
          chainsRunning += 1;
          break;
        case 'error':
          chainsError += 1;
          break;
        case 'end':
          chainsEnd += 1;
          break;
        default:
          break;
      }
    }

    if (chainsRunning > 0 || chainsStop > 0) {
      // If childs chain series ends or error caused by process error and abort_iteration_serie_on_error is true: ends
      if ((chainsEnd > 0 || chainsError > 0) && abortIfEndCausedByAnProcessError) {
        statusChildsChains = 'end';
      } else {
        statusChildsChains = 'running';
      }
    } else {
      if (chainsError > 0) {
        statusChildsChains = 'error';
      } else {
        statusChildsChains = 'end';
      }
    }

    this.childs_chains_status = statusChildsChains;
    return statusChildsChains;
  }

  async setOutputShare() {
    if (this.hasOwnProperty('output_share') && this.output_share) {
      const options = {
        ignoreGlobalValues: false,
        altValueReplace: ''
      };

      this.execute_output_share = await recursiveObjectInterpreter(this.output_share, this.values(), options);
      this.execute_output_share.forEach(valOS => {
        const _valOS = {};
        _valOS[valOS.key] = {};
        _valOS[valOS.key][valOS.name] = valOS.value;

        // OVERWRITE - GLOBAL VALUES RAW
        if (!runtime.config.global_values) {
          runtime.config.global_values = [];
        }

        const gvresLength = runtime.config.global_values.length;
        let vReplaced = false;

        for (let i = 0; i < gvresLength; i++) {
          const valKey = Object.keys(_valOS)[0];
          const gvKey = Object.keys(runtime.config.global_values[i])[0];
          if (valKey === gvKey) {
            runtime.config.global_values[i] = lodash.defaultsDeep(_valOS, runtime.config.global_values[i]);
            vReplaced = true;
          }
        }

        if (!vReplaced) {
          runtime.config.global_values.push(_valOS);
        }
      });
    }
  }

  async error(notificate, writeOutput, willRetry) {
    if (!willRetry) this.status = 'error';

    if (notificate === undefined) notificate = true;
    writeOutput = writeOutput || true;

    if (notificate) {
      await this.notificate('on_fail');
    }

    if (writeOutput) {
      this.write_output();
    }
    this.historicize();
  }

  retry() {
    this.notificate('on_retry');
  }

  waiting_dependencies() {
    this.notificate('on_waiting_dependencies');
  }

  queue_up() {
    this.notificate('on_queue');
  }

  ignore() {
    this.status = 'ignored';
    this.notificate('on_ignore');
  }

  time_out() {
    this.notificate('on_timeout');
  }

  start(isRetry) {
    return new Promise(async (resolve, reject) => {
      this.clean();
      this.started_at = new Date().toISOString();
      this.status = 'running';
      this.hr_started_time = chronometer();

      if (!isRetry || isRetry === undefined) {
        await this.notificate('on_start');
        this.historicize('start');
      }

      if (this.exec.id) {
        try {
          const configValues = await this.loadExecutorConfig();
          if (configValues.type) {
            if (runtime.executors[configValues.type]) {
              const params = {
                process: this,
                recursiveObjectInterpreter: recursiveObjectInterpreter,
                checkExecutorParams: checkExecutorParams,
                logger: logger
              };
              const executor = new runtime.executors[configValues.type](params);
              this.executor = await executor.init();
              //Timeout control:
              if (this.timeout) {
                this.executor.timeout = setTimeout(() => {
                  const options = {};
                  options.end = this.timeout.action;
                  this.executor.killMain('timeout', options);
                  this.time_out();
                }, ms('' + this.timeout.delay));
              }
              //Execution
              this.executor.execMain(resolve, reject);
            } else {
              this.err_output = `Executor ${this.exec.id} type is not valid`;
              this.msg_output = '';
              await this.error();
              reject(`Executor ${this.exec.id} type is not valid`);
            }
          } else {
            this.err_output = `Executor ${this.exec.id} type is not valid`;
            this.msg_output = '';
            await this.error();
            reject(`Executor ${this.exec.id} type is not valid`);
          }
        } catch (err) {
          this.err_output = `Executor ${this.exec.id} error.`;
          this.msg_output = err;
          await this.error();
          reject(`Executor ${this.exec.id}: ${err}`);
        }
      } else {
        // DUMMY PROCESS:
        if (Object.keys(this.exec).length === 0 || this.exec === '') {
          this.end().then(() => {
            resolve();
          });
        } else {
          reject(`Incorrect exec ${this.exec}`);
        }
      }
    });
  }

  async generateOutput(output) {
    try {
      const _output = await recursiveObjectInterpreter(output, this.values());
      if (_output && _output.file_name && _output.write.length > 0) {
        const filePath = _output.file_name;
        let output_stream = _output.write.filter(Boolean).join('\n');
        let output_stream_length = output_stream.length;
        let maxSizeBytes = 0;

        if (_output.maxsize) {
          maxSizeBytes = bytes(_output.maxsize);
          if (output_stream_length > maxSizeBytes) {
            output_stream = output_stream.slice(output_stream_length - maxSizeBytes, output_stream_length);
            output_stream_length = maxSizeBytes;
            logger.log(
              'debug',
              `output_stream truncated output_stream_length (${output_stream_length}) > maxSizeBytes (${maxSizeBytes})`
            );
          }
        }
        if (_output.concat) {
          if (_output.maxsize) {
            let fileSizeInBytes = 0;
            try {
              const stats = await fsp.stat(filePath);
              fileSizeInBytes = stats.size || 0;
            } catch (err) {
              fileSizeInBytes = 0;
            }

            //IF THE SUM OF THE FILE SIZE AND THE OUTPUT TO WRITE OF THE PROCESS EXCEED THE MAXIMUM ALLOWED
            const totalSizeToWrite = fileSizeInBytes + output_stream_length;
            if (totalSizeToWrite > maxSizeBytes) {
              //GET THE PART OF THE FILE THAT TOGETHER WITH THE OUTPUT ADD THE TOTAL ALLOWED TO WRITE IT (SUSTAINING THE FILE)
              const positionFileRead = totalSizeToWrite - maxSizeBytes;
              const lengthFileRead = fileSizeInBytes - positionFileRead;

              const fd = await fsp.open(filePath, 'r');
              if (lengthFileRead > 0) {
                const buffer = Buffer.allocUnsafe(lengthFileRead);
                await fd.read(buffer, 0, buffer.length, positionFileRead);
                let data = buffer.toString('utf8', 0, buffer.length);
                data = data.concat('\n', output_stream);
                await fd.close();
                await this.writeFile(filePath, 'w', data);
              } else {
                await fd.close();
                //IF WILL NOT WRITE ANYTHING OF THE CURRENT FILE:
                await this.writeFile(filePath, 'w', output_stream);
              }
            } else {
              await this.writeFile(filePath, 'a+', output_stream);
            }
          } else {
            await this.writeFile(filePath, 'a+', output_stream);
          }
        } else {
          await this.writeFile(filePath, 'w+', output_stream);
        }
      }
    } catch (err) {
      throw err;
    }
  }

  async writeFile(filePath, mode, os) {
    const dirname = path.dirname(filePath);
    try {
      await fs.ensureDir(dirname);
      const fd = await fsp.open(filePath, mode);
      await fd.write(os, null, 'utf8');
      await fd.close();
    } catch (err) {
      logger.log('error', `Writing output file ${filePath} in ${this.id}: ${err}`);
      throw err;
    }
  }

  async write_output() {
    try {
      if (this.output instanceof Array) {
        let outputCountItems = this.output.length;
        const promisesGO = [];
        while (outputCountItems--) {
          promisesGO.push(this.generateOutput(this.output[outputCountItems]));
        }
        await Promise.all(promisesGO);
      } else {
        await this.generateOutput(this.output);
      }
    } catch (err) {
      logger.log('debug', err);
    }
  }

  clean() {
    delete this.ended_at;
    delete this.command_executed;
    delete this.execute_output_share;
    delete this.retries_count;
    delete this.msg_output;
    delete this.err_output;
    delete this.data_output;
    delete this.extra_output;
    delete this.duration_seconds;
    delete this.childs_chains;
    delete this.childs_chains_status;
  }
}

module.exports = Process;
