'use strict';

const utils = require('../utils.js');
const logger = require('../logger.js');
const loadConfigSection = utils.loadConfigSection;
const replaceWithSmart = utils.replaceWithSmart;
const getChainByUId = utils.getChainByUId;
const chronometer = utils.chronometer;
const lodash = require('lodash');
const crypto = require('crypto');
const bytes = require('bytes');
const fs = require('fs-extra');
const path = require('path');
const sizeof = require('object-sizeof');
const ms = require('millisecond');

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
      this.ignore_in_final_chain_status = this.chain_action_on_fail === 'continue' ? true : false;
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
    this.notificate_only_last_fail = process.notificate_only_last_fail || false;
    this.notifications = process.notifications;

    //Runtime attributes:
    this.status = process.status || 'stop';
    this.msg_output = process.msg_output;
    this.err_output = process.err_output;
    this.started_at = process.started_at;
    this.ended_at = process.ended_at;
    this.chain_values = process.chain_values;
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
    return new Promise(resolve => {
      crypto.randomBytes(16, (err, buffer) => {
        this.uId = this.id + '_' + buffer.toString('hex');
        resolve();
      });
    });
  }

  values() {
    const process_values = {
      CHAIN_ID: this.chain_values.CHAIN_ID,
      CHAIN_NAME: this.chain_values.CHAIN_NAME,
      CHAIN_STARTED_AT: this.chain_values.CHAIN_STARTED_AT,
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

    let values = {};
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
  loadProcessNotifications(notifications) {
    return new Promise((resolve, reject) => {
      let processNotificationsPromises = [];

      if (notifications instanceof Object) {
        let events = Object.keys(notifications);
        let eventsLength = events.length;
        if (events instanceof Array) {
          if (eventsLength > 0) {
            while (eventsLength--) {
              let event = notifications[events[eventsLength]];
              if (event.length) {
                const _notificationEvent = new notificationEvent(events[eventsLength], event);
                processNotificationsPromises.push(_notificationEvent.init());
              }
            }

            Promise.all(processNotificationsPromises)
              .then(notificationsArr => {
                notificationsArr = notificationsArr.filter(Boolean); // Remove undefined items
                let notifications = {};
                let notificationsArrLength = notificationsArr.length;
                while (notificationsArrLength--) {
                  let e = notificationsArr[notificationsArrLength];
                  let key = Object.keys(e);
                  notifications[key[0]] = e[key[0]];
                }
                resolve(notifications);
              })
              .catch(err => {
                reject(err);
              });
          } else {
            // Process without
            logger.log('warn', 'Process, without notifications');
            resolve();
          }
        }
      } else {
        logger.log('warn', `Process ${this.id}, notifications is not set`);
        resolve();
      }
    });
  }

  loadExecutorConfig() {
    return loadConfigSection(global.config, 'executors', this.exec.id);
  }

  async notificate(event) {
    if (this.hasOwnProperty('notifications') && this.notifications !== undefined) {
      if (this.notifications.hasOwnProperty(event)) {
        let notificationsPromises = [];
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
    global.runnertyio.send('process', valuesSec).catch(err => {
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

    const globalPlanChains = global.runtimePlan.plan.chains;

    const chainParentFound = await getChainByUId(globalPlanChains, this.parentUId);
    if (chainParentFound) {
      await chainParentFound.refreshChainStatus();
    }
  }

  startChildChains() {
    this.notificate('on_start_childs');
    this.childs_chains_status = 'running';
  }

  startChildChainsDependients() {
    let _this = this;

    return new Promise((resolve, reject) => {
      let chainsLength = global.runtimePlan.plan.chains.length;
      let chainsToRun = [];

      let output_iterable_string = _this.values()[_this.output_iterable];
      let childChainsinputIterable;

      if (output_iterable_string && output_iterable_string.length) {
        try {
          childChainsinputIterable = JSON.parse(output_iterable_string);
        } catch (err) {
          reject(`Invalid input (${output_iterable_string}), incorrect JSON` + '\nCaused by: ' + err.stack);
        }
      }

      if (childChainsinputIterable && childChainsinputIterable.length > 0) {
        while (chainsLength--) {
          let itemChain = global.runtimePlan.plan.chains[chainsLength];
          let procValues = _this.values();

          if (
            itemChain.hasOwnProperty('depends_chains') &&
            itemChain.depends_chains.hasOwnProperty('chain_id') &&
            itemChain.depends_chains.hasOwnProperty('process_id') &&
            itemChain.depends_chains.chain_id === procValues.CHAIN_ID &&
            itemChain.depends_chains.process_id === _this.id
          ) {
            if (itemChain.isEnded()) {
              itemChain.status = 'stop';
            }
            let executeInmediate = true;
            let childChain = global.runtimePlan.plan.scheduleChain(
              itemChain,
              _this,
              executeInmediate,
              childChainsinputIterable,
              _this.custom_values
            );
            if (childChain) chainsToRun.push(childChain);
          }
        }

        if (chainsToRun.length) {
          _this.startChildChains();
          Promise.all(chainsToRun)
            .then(() => {
              resolve();
            })
            .catch(err => {
              reject(err);
            });
        } else {
          logger.log('debug', `Process ${_this.id} whitout childs chains to run.`);
          resolve();
        }
      } else {
        logger.log('debug', `Process ${_this.id} whitout output_iterable items.`);
        resolve();
      }
    });
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
      let options = {
        ignoreGlobalValues: false,
        altValueReplace: ''
      };

      this.execute_output_share = await replaceWithSmart(this.output_share, this.values(), options);
      this.execute_output_share.forEach(valOS => {
        let _valOS = {};
        _valOS[valOS.key] = {};
        _valOS[valOS.key][valOS.name] = valOS.value;

        // OVERWRITE - GLOBAL VALUES RAW
        if (!global.config.global_values) {
          global.config.global_values = [];
        }

        let gvresLength = global.config.global_values.length;
        let vReplaced = false;

        for (let i = 0; i < gvresLength; i++) {
          let valKey = Object.keys(_valOS)[0];
          let gvKey = Object.keys(global.config.global_values[i])[0];
          if (valKey === gvKey) {
            global.config.global_values[i] = lodash.defaultsDeep(_valOS, global.config.global_values[i]);
            vReplaced = true;
          }
        }

        if (!vReplaced) {
          global.config.global_values.push(_valOS);
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
      let _this = this;

      _this.clean();
      _this.started_at = new Date().toISOString();
      _this.status = 'running';
      _this.hr_started_time = chronometer();

      if (!isRetry || isRetry === undefined) {
        await _this.notificate('on_start');
        _this.historicize('start');
      }

      if (_this.exec.id) {
        _this
          .loadExecutorConfig()
          .then(async configValues => {
            if (configValues.type) {
              if (global.executors[configValues.type]) {
                const executor = new global.executors[configValues.type](_this);
                executor
                  .init()
                  .then(res => {
                    _this.executor = res;
                    //Timeout control:
                    if (_this.timeout) {
                      _this.executor.timeout = setTimeout(() => {
                        const options = {};
                        options.end = _this.timeout.action;
                        _this.executor.killMain('timeout', options);
                        _this.time_out();
                      }, ms(_this.timeout.delay));
                    }
                    //Execution
                    res.execMain(resolve, reject);
                  })
                  .catch(async err => {
                    _this.err_output = err;
                    _this.msg_output = '';
                    await _this.error();
                    reject(err);
                  });
              } else {
                _this.err_output = `Executor ${_this.exec.id} type is not valid`;
                _this.msg_output = '';
                await _this.error();
                reject(`Executor ${_this.exec.id} type is not valid`);
              }
            } else {
              _this.err_output = `Executor ${_this.exec.id} type is not valid`;
              _this.msg_output = '';
              await _this.error();
              reject(`Executor ${_this.exec.id} type is not valid`);
            }
          })
          .catch(async err => {
            _this.err_output = `Process start loadExecutorConfig: ${err}`;
            _this.msg_output = '';
            await _this.error();
            reject(err);
          });
      } else {
        // DUMMY PROCESS:
        if (Object.keys(_this.exec).length === 0 || _this.exec === '') {
          _this.end().then(() => {
            resolve();
          });
        } else {
          reject(`Incorrect exec ${_this.exec}`);
        }
      }
    });
  }

  write_output() {
    let _this = this;

    function writeFile(filePath, mode, os) {
      return new Promise((resolve, reject) => {
        const dirname = path.dirname(filePath);

        fs.ensureDir(dirname, err => {
          if (err) {
            logger.log('error', `Creating directory ${dirname} in ensureDir in ${_this.id}: `, err);
            reject(err);
          } else {
            fs.open(filePath, mode, (err, fd) => {
              if (err) {
                logger.log('error', `Writing output, open file ${filePath} in ${_this.id}: ${err}`);
                reject(err);
              } else {
                fs.write(fd, os, null, 'utf8')
                  .then(() => {
                    fs.close(fd, err => {
                      if (err) {
                        logger.log('error', `Closing file ${filePath} in writeFile in ${_this.id}: ${err}`);
                        reject(err);
                      } else {
                        resolve();
                      }
                    });
                  })
                  .catch(err => {
                    logger.log('error', `Writing output file ${filePath} in ${_this.id}: ${err}`);
                    reject(err);
                  });
              }
            });
          }
        });
      });
    }

    function generateOutput(output) {
      return new Promise((resolve, reject) => {
        replaceWithSmart(output, _this.values()).then(_output => {
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
                fs.stat(filePath, (error, stats) => {
                  let fileSizeInBytes = 0;
                  if (!error) {
                    fileSizeInBytes = stats.size;
                  }
                  //SI LA SUMA DEL TAMAÑO DEL FICHERO Y EL OUTPUT A ESCRIBIR DEL PROCESO SUPERAN EL MAXIMO PERMITIDO
                  const totalSizeToWrite = fileSizeInBytes + output_stream_length;

                  if (totalSizeToWrite > maxSizeBytes) {
                    //SE OBTIENE LA PARTE DEL FICHERO QUE JUNTO CON EL OUTPUT SUMAN EL TOTAL PERMITIDO PARA ESCRIBIRLO (SUSTIUYENDO EL FICHERO)
                    const positionFileRead = totalSizeToWrite - maxSizeBytes;
                    const lengthFileRead = fileSizeInBytes - positionFileRead;

                    fs.open(filePath, 'r', (error, fd) => {
                      if (lengthFileRead > 0) {
                        let buffer = Buffer.allocUnsafe(lengthFileRead);

                        fs.read(fd, buffer, 0, buffer.length, positionFileRead, (error, bytesRead, buffer) => {
                          let data = buffer.toString('utf8', 0, buffer.length);
                          data = data.concat('\n', output_stream);
                          fs.close(fd, err => {
                            if (err) {
                              logger.log('error', `Closing file ${filePath} in ${_this.id}: ${err}`);
                            }
                            writeFile(filePath, 'w', data).then(
                              () => {
                                resolve();
                              },
                              err => {
                                reject(err);
                              }
                            );
                          });
                        });
                      } else {
                        //IF WILL NOT WRITE ANYTHING OF THE CURRENT FILE:
                        writeFile(filePath, 'w', output_stream).then(
                          () => {
                            resolve();
                          },
                          err => {
                            reject(err);
                          }
                        );
                      }
                    });
                  } else {
                    writeFile(filePath, 'a+', output_stream).then(
                      () => {
                        resolve();
                      },
                      err => {
                        reject(err);
                      }
                    );
                  }
                });
              } else {
                writeFile(filePath, 'a+', output_stream).then(
                  () => {
                    resolve();
                  },
                  err => {
                    reject(err);
                  }
                );
              }
            } else {
              writeFile(filePath, 'w+', output_stream).then(
                () => {
                  resolve();
                },
                err => {
                  reject(err);
                }
              );
            }
          } else {
            resolve();
          }
        });
      });
    }

    return new Promise(resolve => {
      if (_this.output instanceof Array) {
        let outputCountItems = _this.output.length;
        let promisesGO = [];

        while (outputCountItems--) {
          promisesGO.push(generateOutput(_this.output[outputCountItems]));
        }

        Promise.all(promisesGO)
          .then(() => {
            resolve();
          })
          .catch(err => {
            resolve(err);
          });
      } else {
        generateOutput(_this.output)
          .then(() => {
            resolve();
          })
          .catch(err => {
            resolve(err);
          });
      }
    });
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
  }
}

module.exports = Process;
