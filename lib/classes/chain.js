'use strict';

const utils = require('../utils.js');
const replaceWithSmart = utils.replaceWithSmart;
const dependsProcess = require('../depends-process.js');
const logger = require('../logger.js');
const getProcessByUId = utils.getProcessByUId;
const chronometer = utils.chronometer;
const crypto = require('crypto');
const ms = require('millisecond');

const Process = require('./process.js');
const notificationEvent = require('./notificationEvent.js');
const loadTrigger = utils.loadTrigger;

const queue = require('../queue-process-memory');

class Chain {
  constructor(chain, isMainChain) {
    this.id = chain.id;
    this.name = chain.name;
    this.uId = '';
    this.execId = chain.execId;
    this.executionId = '';
    this.queue = chain.queue || 'zero';
    this.priority = chain.priority || 0;
    this.ignore_on_concurrence =
      chain.ignore_on_concurrence === false ?
      false :
      this.iterable ?
      false :
      true;
    this.iterable = chain.iterable;
    this.abort_iteration_serie_on_error = chain.abort_iteration_serie_on_error;
    this.parentUId = chain.parentUId;
    this.parentProcessUId = chain.parentProcessUId;
    this.parentExecutionId = chain.parentExecutionId;
    this.input = chain.input || [];
    this.custom_values =
      Object.assign({}, chain.custom_values, chain.custom_values_overwrite) || {};
    this.custom_values_overwrite = {};
    this.depends_chains = chain.depends_chains || [];
    this.calendars = chain.calendars;
    this.notifications = {};
    this.status = chain.status || 'stop';
    this.started_at = chain.started_at;
    this.ended_at = chain.ended_at;
    this.processes = {};

    return new Promise(async resolve => {
      let _this = this;

      _this.execId = await replaceWithSmart(this.execId, this.values());

      if (isMainChain) {
        _this.uId = _this.id + '_main';

        _this.triggers = await _this.loadChainTriggers(chain.triggers, _this);
        if (_this.triggers) {
          _this.triggers.forEach(trigger => {
            trigger.start();
          });
        }
      } else {
        await _this.setUid();
      }

      _this.processes = await _this.loadProcesses(chain.processes);
      _this.notifications = await _this.loadChainNotifications(
        chain.notifications
      );

      resolve(_this);
    });
  }

  setUid() {
    let _this = this;
    return new Promise(resolve => {
      crypto.randomBytes(16, (err, buffer) => {
        _this.uId = _this.id + '_' + buffer.toString('hex');
        resolve();
      });
    });
  }

  setExecutionId() {
    return new Promise(resolve => {
      let _this = this;
      crypto.randomBytes(14, (err, buffer) => {
        _this.executionId =
          new Date().toISOString() +
          '_' +
          _this.id +
          '_' +
          buffer.toString('hex');
        resolve();
      });
    });
  }

  // Executed in construction:
  loadProcesses(processes) {
    let _this = this;
    return new Promise((resolve, reject) => {
      let chainProcessPromises = [];
      let processesLength = processes.length;
      if (processes instanceof Array) {
        if (processesLength > 0) {
          while (processesLength--) {
            processes[processesLength].parentUId = _this.uId;
            processes[processesLength].executionId = _this.executionId;
            processes[processesLength].parentExecutionId =
              _this.parentExecutionId || _this.executionId;
            processes[processesLength].custom_values = _this.custom_values;
            processes[processesLength].chain_values = _this.values();
            chainProcessPromises.push(
              _this.loadProcess(processes[processesLength])
            );
          }

          Promise.all(chainProcessPromises)
            .then(processes => {
              resolve(processes);
            })
            .catch(err => {
              reject(err);
            });
        } else {
          resolve();
        }
      } else {
        reject(`Chain ${_this.id} processes is not array`);
      }
    });
  }

  loadProcess(process) {
    return new Process(process);
  }

  /**
   * Load plan chain triggers.
   * Used in class Chain creation.
   * @param triggers (plan chain object)
   * @returns {Promise} Empty
   */
  loadChainTriggers(triggers, chain) {
    return new Promise((resolve, reject) => {
      let processTriggersPromises = [];

      if (triggers instanceof Array) {
        let triggersLength = triggers.length;
        if (triggersLength > 0) {
          while (triggersLength--) {
            let trigger = triggers[triggersLength];
            processTriggersPromises.push(loadTrigger(chain, trigger));
          }

          Promise.all(processTriggersPromises)
            .then(triggersArr => {
              resolve(triggersArr);
            })
            .catch(err => {
              //logger.log("error", `Chain ${_this.id} notifications: ` + err);
              reject(err);
            });
        } else {
          logger.log('debug', `Chain ${chain.id} triggers is empty`);
          resolve();
        }
      } else {
        logger.log('debug', `Chain ${chain.id} triggers is not set`);
        resolve();
      }
    });
  }

  /**
   * Load plan chain notifications and create notifications events.
   * Used in class Chain creation.
   * @param notifications (plan chain object)
   * @returns {Promise} Empty
   */
  loadChainNotifications(notifications) {
    let _this = this;
    return new Promise((resolve, reject) => {
      let processNotificationsPromises = [];

      if (notifications instanceof Object) {
        let events = Object.keys(notifications);
        let eventsLength = events.length;
        if (eventsLength > 0) {
          while (eventsLength--) {
            let event = notifications[events[eventsLength]];
            if (event.length) {
              processNotificationsPromises.push(
                new notificationEvent(events[eventsLength], event)
              );
            } else {
              logger.log(
                'debug',
                `Chain ${_this.id} event ${events[eventsLength]} without notifications`
              );
            }
          }

          Promise.all(processNotificationsPromises)
            .then(notificationsArr => {
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
              //logger.log("error", `Chain ${_this.id} notifications: ` + err);
              reject(err);
            });
        } else {
          logger.log('debug', `Chain ${_this.id} notifications is empty`);
          resolve();
        }
      } else {
        logger.log('debug', `Chain ${_this.id} notifications is not set`);
        resolve();
      }
    });
  }

  getProcessById(processId, _pick) {
    let _this = this;

    function byId(process) {
      return process.id === processId;
    }

    if (_pick) {
      return utils.pick(_this.processes.find(byId), _pick);
    } else {
      return _this.processes.find(byId);
    }
  }

  values() {
    let _this = this;

    let chain_values = {
      CHAIN_ID: _this.id,
      CHAIN_EXEC_ID: _this.execId,
      CHAIN_UID: _this.uId,
      CHAIN_PARENT_UID: _this.parentUId,
      CHAIN_PARENT_PROCESS_UID: _this.parentProcessUId,
      CHAIN_PARENT_EXECUTION_ID: _this.parentExecutionId || _this.executionId,
      CHAIN_EXECUTION_ID: _this.executionId,
      CHAIN_NAME: _this.name,
      CHAIN_STARTED_AT: _this.started_at,
      CHAIN_DURATION_SECONDS: _this.duration_seconds,
      CHAIN_DURATION_HUMANIZED: _this.duration_humanized
    };
    let values = {};
    Object.assign(values, chain_values);
    Object.assign(values, _this.execute_input);
    Object.assign(values, _this.custom_values);
    return values;
  }

  notificate(event) {
    let _this = this;
    if (
      _this.hasOwnProperty('notifications') &&
      _this.notifications !== undefined
    ) {
      if (_this.notifications.hasOwnProperty(event)) {
        let notificationsLength = _this.notifications[event].length;
        while (notificationsLength--) {
          _this.notifications[event][notificationsLength].notificate(
            _this.values()
          );
        }
      }
    }
  }

  historicize(event) {
    let _this = this;

    const values = {
      id: _this.id,
      uId: _this.uId,
      parentUId: _this.parentUId,
      parentProcessUId: _this.parentProcessUId,
      execId: _this.execId,
      executionId: _this.executionId,
      parentExecutionId: _this.parentExecutionId || _this.executionId,
      name: _this.name,
      queue: _this.queue,
      priority: _this.priority,
      event: event || _this.status,
      iterable: _this.iterable,
      input: _this.execute_input,
      custom_values: _this.custom_values,
      started_at: _this.started_at,
      ended_at: _this.ended_at,
      duration_seconds: _this.duration_seconds,
      depends_chains: _this.depends_chains
    };

    // RunnertyIO History
    global.runnertyio.send('chain', values).catch(err => {
      logger.log(
        'error',
        `RunnertyIO - error historicize ${values.event} chain ${_this.id}`,
        err,
        'values:',
        values
      );
    });
  }

  isStopped() {
    let _this = this;
    return _this.status === 'stop';
  }

  isEnded() {
    let _this = this;
    return _this.status === 'end';
  }

  isRunning() {
    let _this = this;
    return _this.status === 'running';
  }

  isErrored() {
    let _this = this;
    return _this.status === 'error';
  }

  stop() {
    let _this = this;
    _this.status = 'stop';
    let processesLength = _this.processes.length;
    while (processesLength--) {
      _this.processes[processesLength].stop();
    }
  }

  error() {
    let _this = this;
    if (!_this.isErrored()) {
      _this.ended_at = new Date().toISOString();
      _this.status = 'error';
      let duration = chronometer(_this.hr_started_time);
      _this.duration_seconds = duration[0];
      _this.duration_humanized = duration[1];
      _this.notificate('on_fail');
      _this.historicize();
      _this.causedByAnProcessError = true;
      _this.refreshParentProcessChildsChainsStatus();
    }
  }

  end(causedByAnProcessError) {
    let _this = this;

    if (!_this.isEnded()) {
      _this.ended_at = new Date().toISOString();
      _this.status = 'end';
      _this.causedByAnProcessError = causedByAnProcessError || false;
      let duration = chronometer(_this.hr_started_time);
      _this.duration_seconds = duration[0];
      _this.duration_humanized = duration[1];
      _this.notificate('on_end');
      _this.historicize();
      _this.refreshParentProcessChildsChainsStatus();
    }
  }

  refreshParentProcessChildsChainsStatus() {
    let _this = this;
    const globalPlanChains = global.runtimePlan.plan.chains;

    let processParentFound = getProcessByUId(
      globalPlanChains,
      _this.parentProcessUId
    );

    if (processParentFound) {
      let abortIfEndCausedByAnProcessError = false;
      if (
        _this.abort_iteration_serie_on_error &&
        _this.causedByAnProcessError
      ) {
        abortIfEndCausedByAnProcessError = true;
      }
      processParentFound
        .refreshProcessChildsChainsStatus(abortIfEndCausedByAnProcessError)
        .then(processChildsChainsStatus => {
          if (processChildsChainsStatus === 'end') {
            processParentFound.endChildChains(abortIfEndCausedByAnProcessError);
          }
        })
        .catch(err => {
          logger.log(
            'error',
            'Error in chain refreshParentProcessChildsChainsStatus:',
            err
          );
        });
    }
  }

  running() {
    let _this = this;
    _this.status = 'running';
    _this.started_at = new Date().toISOString();
    _this.hr_started_time = chronometer();

    _this.notificate('on_start');
    _this.historicize('start');
  }

  queue_up() {
    let _this = this;
    _this.notificate('on_queue');
    _this.historicize('queue');
  }

  //Start Chain
  async start(options) {
    let _this = this;

    if (options.inputIteration) {
      let inputLength = _this.input.length;
      _this.execute_input = {};

      while (inputLength--) {
        let key = Object.keys(_this.input[inputLength])[0];
        let value = _this.input[inputLength][key];
        _this.execute_input[key] = options.inputIteration[value];
      }
    } else {
      _this.execute_input = await replaceWithSmart(
        _this.input[0],
        _this.values()
      );
    }

    return new Promise(resolve => {
      _this.clean();

      if (_this.hasOwnProperty('processes')) {
        if (_this.processes instanceof Array && _this.processes.length > 0) {
          if (options.executeInmediate || options.inputIteration) {
            _this
              .run(options)
              .then(() => {
                resolve();
              })
              .catch(() => {
                resolve();
              });
          } else {
            resolve();
          }
        } else {
          logger.log('error', `Chain ${_this.id} dont have processes`);
          throw new Error(`Chain ${_this.id} dont have processes`);
        }
      } else {
        logger.log(
          'error',
          `Invalid chain ${_this.id}, processes property not found.`
        );
        throw new Error(
          `Invalid chain ${_this.id}, processes property not found.`
        );
      }
    });
  }

  retry(options) {
    let _this = this;
    let _delay = 0;
    if (options.retrieDelay) {
      _delay = options.retrieDelay;
    }

    setTimeout(() => {
      _this.notificate('on_retry');
      _this
        .setChainToInitState()
        .then(() => {
          _this
            .run(options)
            .then(() => {})
            .catch(() => {});
        })
        .catch(err => {
          logger.log('error', 'Error retry chain: ', err);
        });
    }, ms(_delay));
  }

  runInitializing(options) {
    let _this = this;

    // If options is not setted, waitEndChilds to true:
    if (!options) {
      options = {
        waitEndChilds: true
      };
    }

    if (_this.isStopped() || _this.isEnded()) {
      _this
        .setChainToInitState()
        .then(() => {
          _this
            .run(options)
            .then(() => {})
            .catch(() => {});
        })
        .catch(err => {
          logger.log('error', 'Error setChainToInitState: ', err);
        });
    } else {
      logger.log(
        'debug',
        `Trying start processes of ${_this.id} but this is running`
      );
    }
  }

  run(options) {
    let _this = this;
    return new Promise(resolve => {
      _this
        .startProcesses(options)
        .then(() => {
          global.runtimePlan.plan.scheduleChains();
          resolve();
        })
        .catch(err => {
          logger.log('error', 'Error in run (chain):', err);
          resolve();
        });
    });
  }

  waiting_dependencies() {
    let _this = this;
    _this.notificate('on_waiting_dependencies');
  }

  setChainToInitState() {
    let _this = this;

    if (_this.isRunning() || _this.isErrored()) {
      _this.end();
    }

    return new Promise(resolve => {
      _this.execute_input = {};
      //Warning
      if (_this.isRunning()) {
        logger.log(
          'warn',
          `This chain ${_this.id} is running yet and is being initialized`
        );
      }
      // Set All Process to stopped
      let processesLength = _this.processes.length;
      while (processesLength--) {
        _this.processes[processesLength].stop();
      }
      _this.executionId = '';
      _this.parentExecutionId = undefined;
      resolve();
    });
  }

  refreshChainStatus() {
    let _this = this;
    return new Promise(resolve => {
      let processesLength = this.processes.length;
      let statusChain = 'end';

      let processesError = 0;
      let processesRunning = 0;
      let processesIgnored = 0;
      let processesStop = 0;
      let processesEnded = 0;

      while (processesLength--) {
        if (!this.processes[processesLength].ignore_in_chain_status) {
          switch (this.processes[processesLength].status) {
            case 'end':
              processesEnded += 1;
              break;
            case 'stop':
              processesStop += 1;
              break;
            case 'running':
              processesRunning += 1;
              break;
            case 'ignored':
              processesIgnored += 1;
              break;
            case 'error':
              processesError += 1;
              break;
            default:
              break;
          }
        }
      }

      processesLength = this.processes.length;
      while (processesLength--) {
        switch (this.processes[processesLength].childs_chains_status) {
          case 'stop':
            processesStop += 1;
            break;
          case 'running':
            processesRunning += 1;
            break;
          case 'ignored':
            processesIgnored += 1;
            break;
          case 'error':
            processesError += 1;
            break;
          default:
            break;
        }
      }

      //Set Chain Status
      if (processesRunning > 0 || processesStop > 0) {
        statusChain = 'running';
      } else {
        if (processesError > 0) {
          statusChain = 'error';
        } else {
          if (_this.processes.length === processesIgnored + processesEnded) {
            statusChain = 'end';
          } else {
            if (processesIgnored > 0) {
              statusChain = 'ignore';
            } else {
              if (_this.status === 'end') {
                statusChain = 'ignore';
              } else {
                statusChain = 'end';
              }
            }
          }
        }
      }

      if (statusChain === 'end') {
        this.end();
      } else {
        if (statusChain === 'error') {
          this.error();
        } else {
          this.status = statusChain;
        }
      }

      resolve(statusChain);
    });
  }

  startProcess(process, options) {
    let _this = this;
    const waitEndChilds = options.waitEndChilds;

    function checkAnyNotEnded(proc) {
      return !(proc.isEnded() || proc.isIgnored());
    }

    return new Promise(async resolve => {
      process.execute_input = _this.execute_input;

      if (process.isStopped()) {
        logger.log('debug', `Process ${process.id} scheduled`);

        const processMustDo = await _this.checkProcessActionToDo(process);

        switch (processMustDo) {
          case 'run':
            logger.log('debug', `Starting ${process.id}`);

            if (process.execute_input) {
              Object.assign(process.execute_input, _this.execute_input);
            } else {
              process.execute_input = _this.execute_input;
            }

            process
              .start()
              .then(() => {
                options.retries = {};
                process
                  .startChildChainsDependients(waitEndChilds)
                  .then(() => {
                    _this.startProcessesCtrl(options, resolve);
                  })
                  .catch(err => {
                    logger.debug('error', 'Error in startProcess:', err);
                    _this.startProcessesCtrl(options, resolve);
                  });
              })
              .catch(err => {
                err = err || process.execute_err_return;
                logger.debug('error', 'Process ' + process.id, err);

                let functEnd = () => {
                  const causedByAnProcessError = true;
                  _this.end(causedByAnProcessError);
                  resolve();
                };

                let action = '';
                let action_options = {};

                if (
                  process.chain_action_on_fail &&
                  typeof process.chain_action_on_fail === 'object'
                ) {
                  if (process.chain_action_on_fail.action) {
                    switch (process.chain_action_on_fail.action) {
                      case 'abort':
                        action = 'abort';
                        break;
                        // Backward compatibility: end === abort:
                      case 'end':
                        action = 'abort';
                        break;
                      case 'retry':
                        action = 'retry';
                        if (process.chain_action_on_fail.delay)
                          action_options.delay =
                          process.chain_action_on_fail.delay;
                        if (process.chain_action_on_fail.retries)
                          action_options.retries =
                          process.chain_action_on_fail.retries;
                        break;
                      default:
                        action = '';
                        break;
                    }
                  }
                } else {
                  if (
                    process.chain_action_on_fail &&
                    typeof process.chain_action_on_fail === 'string'
                  ) {
                    switch (process.chain_action_on_fail) {
                      case 'abort':
                        action = 'abort';
                        break;
                        // Backward compatibility: end === abort:
                      case 'end':
                        action = 'abort';
                        break;
                      case 'retry':
                        action = 'retry';
                        break;
                      default:
                        action = '';
                        break;
                    }
                  }
                }

                switch (action) {
                  case 'abort':
                    functEnd();
                    break;
                  case 'retry':
                    if (options.retries) {
                      if (options.retries)
                        options.retries = options.retries - 1;
                    } else {
                      options.retrieDelay = process.chain_action_on_fail.delay;
                      options.retries = action_options.retries;
                    }

                    if (options.retries > 0) {
                      _this.retry(options);
                    } else {
                      _this.startProcessesCtrl(options, resolve);
                    }

                    break;
                  default:
                    if (process.chain_action_on_fail)
                      logger.log(
                        'warn',
                        `Ignored incorrect chain_action_on_fail declaration of process ${process.id}:`,
                        process.chain_action_on_fail
                      );
                    // Try run process on fail:
                    _this.startProcessesCtrl(options, resolve);
                    break;
                }
              });

            break;
          case 'queue':
            process.queue_up();
            queue.queueProcess(process, _this, options);
            resolve();
            break;
          case 'wait':
            process.waiting_dependencies();
            resolve();
            break;
          case 'ignore':
            logger.log('debug', `Process ignored: ${process.id}`);
            process.ignore();
            _this.startProcessesCtrl(options, resolve);
            break;
          case 'end':
            logger.log(
              'debug',
              `End ignored: Only executed on_fail ${process.id}`
            );
            const notificateEnd = false;
            process
              .end(notificateEnd)
              .then(() => {
                _this.startProcessesCtrl(options, resolve);
              })
              .catch(err => {
                logger.log('startProcess error', err);
                resolve();
              });
            break;
          default:
            break;
        }
      } else {
        // IF ALL PROCESS OF CHAIN ARE IN STATE DISTINCT OF STOP - RESOLVE - ELSE NOT DO NOTHING
        if (!_this.processes.find(checkAnyNotEnded)) {
          resolve();
        } else {
          resolve();
        }
      }
    });
  }

  startProcessesCtrl(options, _resolve) {
    let _this = this;
    _this
      .startProcesses(options)
      .then(() => {
        _resolve();
      })
      .catch(err => {
        logger.log('error', 'Error in startProcesses:', err);
        _resolve();
      });
  }

  startProcesses(options, processQueueReleased) {
    let _this = this;
    const runningBeforeRefresh = _this.isRunning();
    const waitEndChilds = options.waitEndChilds;

    function execSerie(processes, waitEndChilds) {
      let sequence = Promise.resolve();
      processes.forEach(itemProcess => {
        sequence = sequence.then(() => {
          itemProcess.executionId = _this.executionId;
          if (itemProcess.id === processQueueReleased)
            itemProcess.queue_released = true;
          return _this
            .startProcess(itemProcess, options)
            .then(() => {})
            .catch(err => {
              logger.log(
                'error',
                'chain startProcesses execSerie startProcesses waitEndChilds. Error ',
                err
              );
            });
        });
      });
      return sequence;
    }

    return new Promise(resolve => {
      _this
        .refreshChainStatus()
        .then(async chainStatus => {
          if (chainStatus === 'running' && !runningBeforeRefresh) {
            await _this.setExecutionId();
            _this.running();
          }

          // If Chains is running:
          if (chainStatus === 'running') {
            if (waitEndChilds) {
              //Serie

              execSerie(_this.processes, waitEndChilds)
                .then(() => {
                  resolve();
                })
                .catch(err => {
                  logger.log(
                    'error',
                    'chain startProcesses execSerie waitEndChilds. Error ',
                    err
                  );
                  resolve();
                });
            } else {
              let processRuns = [];
              let processesLength = _this.processes.length;

              while (processesLength--) {
                _this.processes[processesLength].executionId = _this.executionId;
                _this.processes[processesLength].parentExecutionId =
                  _this.parentExecutionId || _this.executionId;
                processRuns.push(
                  _this.startProcess(_this.processes[processesLength], options)
                );
              }

              Promise.all(processRuns)
                .then(() => {
                  resolve();
                })
                .catch(err => {
                  logger.log('error', 'chain startProcesses:', err);
                  resolve();
                });
            }
          } else {
            if (chainStatus === 'end') {
              _this.end();
              resolve();
            } else {
              if (chainStatus === 'error') {
                _this.error();
                resolve();
              } else {
                resolve();
              }
            }
          }
        })
        .catch(err => {
          logger.log(
            'error',
            'Error en chain startProcesses refreshChainStatus: ',
            err
          );
          resolve();
        });
    });
  }

  checkProcessActionToDo(process) {
    let _this = this;
    return new Promise((resolve, reject) => {
      // If process have depends_process:
      if (process.hasOwnProperty('depends_process')) {
        dependsProcess
          .getAction(process.depends_process, _this.processes, _this.values())
          .then(res => {
            if (
              res === 'run' &&
              (process.queue && process.queue !== '') &&
              (!process.queue_released || process.queue_released === false)
            ) {
              resolve('queue');
            } else {
              delete process.queue_released;
              resolve(res);
            }
          })
          .catch(err => {
            reject(err);
          });
      }
    });
  }

  clean() {
    let _this = this;
    delete _this.duration_seconds;
    delete _this.ended_at;
  }
}

module.exports = Chain;