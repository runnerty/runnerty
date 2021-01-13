'use strict';

const utils = require('../utils.js');
const lodash = require('lodash');
const recursiveObjectInterpreter = utils.recursiveObjectInterpreter;
const dependsProcess = require('../depends-process.js');
const logger = require('../logger.js');
const getProcessByUId = utils.getProcessByUId;
const chronometer = utils.chronometer;
const crypto = require('crypto');
const ms = require('ms');

const Process = require('./process.js');
const notificationEvent = require('./notificationEvent.js');
const runtime = require('./runtime');
const runnertyio = require('./runnertyio.js');
const loadTrigger = utils.loadTrigger;

const queue = require('../queue-process-memory');

class Chain {
  constructor(chain, isMainChain) {
    this.id = chain.id;
    this.name = chain.name;
    this.uId = '';
    this.execId = chain.execId;
    this.executionId = '';
    this.namespace = chain.namespace;
    this.queue = chain.queue || 'zero';
    this.priority = chain.priority || 0;
    this.iterable = chain.iterable;
    this.ignore_on_concurrence = chain.ignore_on_concurrence === false ? false : !this.iterable;
    this.abort_iteration_serie_on_error = chain.abort_iteration_serie_on_error;
    this.parentUId = chain.parentUId;
    this.parentProcessUId = chain.parentProcessUId;
    this.parentExecutionId = chain.parentExecutionId;
    this.input = chain.input || [];
    this.custom_values = Object.assign({}, chain.custom_values, chain.custom_values_overwrite) || {};
    this.custom_values_overwrite = {};
    this.depends_chains = chain.depends_chains || [];
    this.calendars = chain.calendars;
    this.status = chain.status || 'stop';
    this.started_at = chain.started_at;
    this.ended_at = chain.ended_at;
    this.defaults_processes = chain.defaults_processes;
    this.retries = chain.retries || 0;
    this.retry_delay = chain.retry_delay || 0;
    this.mustEnd = false;
    this.processes = chain.processes;
    this.triggers = chain.triggers;
    this.notifications_plane = chain.notifications_plane || lodash.cloneDeep(chain.notifications);
    this.notifications = this.notifications_plane || chain.notifications;
    this.isMainChain = isMainChain;
    this.meta = chain.meta;
  }

  async init() {
    try {
      this.execId = await recursiveObjectInterpreter(this.execId, this.values());

      if (this.isMainChain) {
        this.uId = this.id + '_main';

        this.triggers = await this.loadChainTriggers(this.triggers, this);

        if (this.triggers) {
          this.triggers.forEach(trigger => {
            trigger.start();
          });
        }
      } else {
        await this.setUid();
      }
      this.processes = await this.loadProcesses(this.processes, this.defaults_processes);
      this.notifications = await this.loadChainNotifications(this.notifications);
      return this;
    } catch (err) {
      logger.log('error', `init Chain:`, err);
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

  setExecutionId() {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(14, (err, buffer) => {
        if (err) reject(err);
        this.executionId = new Date().toISOString() + '_' + this.id + '_' + buffer.toString('hex');
        resolve();
      });
    });
  }

  // Executed in construction:
  async loadProcesses(processes, defaults_processes) {
    const chainProcessPromises = [];
    let processesLength = processes.length;
    if (processes instanceof Array) {
      if (processesLength > 0) {
        while (processesLength--) {
          processes[processesLength].chain = this;

          // Load Chain Defaults/Processes
          if (defaults_processes) {
            //  output:
            if (defaults_processes.output && !processes[processesLength].output) {
              processes[processesLength].output = defaults_processes.output;
            }
            //  notifications:
            if (defaults_processes.notifications && !processes[processesLength].notifications) {
              processes[processesLength].notifications = defaults_processes.notifications;
            }
            if (defaults_processes.notifications && processes[processesLength].notifications) {
              for (const notif_event in defaults_processes.notifications) {
                if (!processes[processesLength].notifications[notif_event]) {
                  processes[processesLength].notifications[notif_event] = defaults_processes.notifications[notif_event];
                }
              }
            }
            //  chain_action_on_fail:
            if (defaults_processes.chain_action_on_fail && !processes[processesLength].chain_action_on_fail) {
              processes[processesLength].chain_action_on_fail = defaults_processes.chain_action_on_fail;
            }
            // ignore_in_final_chain_status:
            if (
              typeof defaults_processes.ignore_in_final_chain_status !== 'undefined' &&
              typeof processes[processesLength].ignore_in_final_chain_status === 'undefined'
            ) {
              processes[processesLength].ignore_in_final_chain_status = defaults_processes.ignore_in_final_chain_status;
            }
          }
          const _process = new Process(processes[processesLength]);
          chainProcessPromises.push(_process.init());
        }

        try {
          const processes = await Promise.all(chainProcessPromises);
          return processes;
        } catch (err) {
          throw err;
        }
      }
    } else {
      throw new Error(`Chain ${this.id} processes is not array`);
    }
  }

  /**
   * Load plan chain triggers.
   * Used in class Chain creation.
   * @param triggers (plan chain object)
   * @returns {Promise} Empty
   */
  async loadChainTriggers(triggers, chain) {
    try {
      const processTriggersPromises = [];
      if (triggers instanceof Array) {
        let triggersLength = triggers.length;
        if (triggersLength > 0) {
          while (triggersLength--) {
            const trigger = triggers[triggersLength];
            if (trigger.id) {
              processTriggersPromises.push(loadTrigger(chain, trigger));
            } else {
              throw new Error(`Trigger without id: check the trigger configuration of the chain ${chain.id}`);
            }
          }
          const triggersArr = await Promise.all(processTriggersPromises);
          return triggersArr;
        } else {
          logger.log('debug', `Chain ${chain.id} triggers is empty`);
        }
      } else {
        logger.log('debug', `Chain ${chain.id} triggers is not set`);
      }
    } catch (err) {
      throw err;
    }
  }

  /**
   * Load plan chain notifications and create notifications events.
   * Used in class Chain creation.
   * @param notifications (plan chain object)
   * @returns {Promise} Empty
   */
  async loadChainNotifications(notifications) {
    const processNotificationsPromises = [];

    if (notifications instanceof Object) {
      const events = Object.keys(notifications);
      let eventsLength = events.length;
      if (eventsLength > 0) {
        while (eventsLength--) {
          const event = notifications[events[eventsLength]];
          if (event.length) {
            const _notificationEvent = new notificationEvent(events[eventsLength], event);
            processNotificationsPromises.push(_notificationEvent.init());
          } else {
            logger.log('debug', `Chain ${this.id} event ${events[eventsLength]} without notifications`);
          }
        }

        try {
          const notificationsArr = await Promise.all(processNotificationsPromises);
          const notifications = {};
          let notificationsArrLength = notificationsArr.length;
          while (notificationsArrLength--) {
            const e = notificationsArr[notificationsArrLength];
            const key = Object.keys(e);
            notifications[key[0]] = e[key[0]];
          }
          return notifications;
        } catch (err) {
          throw err;
        }
      } else {
        logger.log('debug', `Chain ${this.id} notifications is empty`);
      }
    } else {
      logger.log('debug', `Chain ${this.id} notifications is not set`);
    }
  }

  getProcessById(processId, _pick) {
    function byId(process) {
      return process.id === processId;
    }

    if (_pick) {
      return utils.pick(this.processes.find(byId), _pick);
    } else {
      return this.processes.find(byId);
    }
  }

  values() {
    const chain_values = {
      CHAIN_ID: this.id,
      CHAIN_EXEC_ID: this.execId,
      CHAIN_UID: this.uId,
      CHAIN_PARENT_UID: this.parentUId,
      CHAIN_PARENT_PROCESS_UID: this.parentProcessUId,
      CHAIN_PARENT_EXECUTION_ID: this.parentExecutionId || this.executionId,
      CHAIN_EXECUTION_ID: this.executionId,
      CHAIN_NAME: this.name,
      CHAIN_STARTED_AT: this.started_at,
      CHAIN_DURATION_SECONDS: this.duration_seconds,
      CHAIN_DURATION_HUMANIZED: this.duration_humanized,
      CHAIN_RETRIES_COUNT: this.retries_count || 0,
      CHAIN_RETRIES: this.retries
    };
    const values = {};
    Object.assign(values, chain_values);
    Object.assign(values, this.execute_input);
    Object.assign(values, this.custom_values);
    return values;
  }

  get chainValues() {
    return this.values();
  }

  async notificate(event) {
    try {
      if (this.hasOwnProperty('notifications') && this.notifications !== undefined) {
        if (this.notifications.hasOwnProperty(event)) {
          let notificationsLength = this.notifications[event].length;
          const promNotif = [];
          while (notificationsLength--) {
            promNotif.push(this.notifications[event][notificationsLength].notificate(this.values()));
          }
          await Promise.all(promNotif);
        }
      }
    } catch (err) {
      throw new Error(`Notificte chain ${this.id}: ${err}.`);
    }
  }

  historicize(event) {
    const values = {
      id: this.id,
      uId: this.uId,
      parentUId: this.parentUId,
      parentProcessUId: this.parentProcessUId,
      execId: this.execId,
      executionId: this.executionId,
      parentExecutionId: this.parentExecutionId || this.executionId,
      name: this.name,
      queue: this.queue,
      priority: this.priority,
      event: event || this.status,
      iterable: this.iterable,
      input: this.execute_input,
      custom_values: this.custom_values,
      started_at: this.started_at,
      ended_at: this.ended_at,
      duration_seconds: this.duration_seconds,
      depends_chains: this.depends_chains
    };

    // Runnerty.io debug:
    if (runnertyio.debug) {
      logger.log('info', `DEBUG-runnerty.io [pre-send] from CHAIN ${this.id} (${this.uId}).`);
    }

    // RunnertyIO History
    runnertyio.send('chain', values).catch(err => {
      logger.log(
        'error',
        `RunnertyIO - error historicize ${values.event} chain ${this.id}.\n${err}\n values:${values}`
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

  stop() {
    this.status = 'stop';
    let processesLength = this.processes.length;
    while (processesLength--) {
      this.processes[processesLength].stop();
    }
  }

  async error() {
    if (!this.isErrored()) {
      this.ended_at = new Date().toISOString();
      this.status = 'error';
      const duration = chronometer(this.hr_started_time);
      this.duration_seconds = duration[0];
      this.duration_humanized = duration[1];
      await this.notificate('on_fail');
      this.historicize();
      this.causedByAnProcessError = true;
      await this.refreshParentProcessChildsChainsStatus();
      this.killRunnertyOnForcedInitChainsStop();
    }
  }

  async end(causedByAnProcessError) {
    if (!this.isEnded()) {
      this.ended_at = new Date().toISOString();
      this.status = 'end';
      this.causedByAnProcessError = causedByAnProcessError || false;
      const duration = chronometer(this.hr_started_time);
      this.duration_seconds = duration[0];
      this.duration_humanized = duration[1];
      await this.notificate('on_end');
      this.historicize();
      await this.refreshParentProcessChildsChainsStatus();
      this.killRunnertyOnForcedInitChainsStop();
    }
  }

  async refreshParentProcessChildsChainsStatus() {
    const globalPlanChains = runtime.plan.chains;
    const processParentFound = getProcessByUId(globalPlanChains, this.parentProcessUId);

    if (processParentFound) {
      let abortIfEndCausedByAnProcessError = false;
      if (this.abort_iteration_serie_on_error && this.causedByAnProcessError) {
        abortIfEndCausedByAnProcessError = true;
      }

      try {
        const processChildsChainsStatus = processParentFound.refreshProcessChildsChainsStatus(
          abortIfEndCausedByAnProcessError
        );
        if (processChildsChainsStatus === 'end') {
          await processParentFound.endChildChains(abortIfEndCausedByAnProcessError);
        }
      } catch (err) {
        logger.log('error', 'Error in chain refreshParentProcessChildsChainsStatus:', err);
      }
    }
  }

  async running() {
    this.status = 'running';
    this.started_at = new Date().toISOString();
    this.hr_started_time = chronometer();
    await this.notificate('on_start');
    this.historicize('start');
  }

  async queue_up() {
    await this.notificate('on_queue');
    this.historicize('queue');
  }

  //Start Chain
  async start(options) {
    this.mustEnd = false;

    if (options.inputIteration) {
      this.execute_input = {};
      if (Array.isArray(this.input)) {
        let inputLength = this.input.length;

        while (inputLength--) {
          const key = Object.keys(this.input[inputLength])[0];
          const value = this.input[inputLength][key];
          this.execute_input[key] = options.inputIteration[value];
        }
      } else if (typeof this.input === 'string') {
        this.execute_input[this.input] = options.inputIteration;
      }
    } else {
      this.execute_input = await recursiveObjectInterpreter(this.input[0], this.values());
    }

    this.clean();

    if (this.hasOwnProperty('processes')) {
      if (this.processes instanceof Array && this.processes.length > 0) {
        if (options.executeInmediate || options.inputIteration) {
          await this.run(options);
        }
      } else {
        logger.log('error', `Chain ${this.id} dont have processes`);
        throw new Error(`Chain ${this.id} dont have processes`);
      }
    } else {
      logger.log('error', `Invalid chain ${this.id}, processes property not found.`);
      throw new Error(`Invalid chain ${this.id}, processes property not found.`);
    }
  }

  retry(options) {
    let _delay = 0;
    if (options.retry_delay) {
      _delay = options.retry_delay;
    }
    setTimeout(async () => {
      try {
        await this.notificate('on_retry');
        await this.setChainToInitState();
        await this.run(options);
      } catch (err) {
        logger.log('error', 'Error retry chain: ', err);
      }
    }, ms('' + _delay));
  }

  async run(options) {
    try {
      this.mustEnd = false;
      await this.startProcesses(options);
      runtime.plan.scheduleChains();
    } catch (err) {
      logger.log('error', 'Error in run (chain):', err);
    }
  }

  async waiting_dependencies() {
    await this.notificate('on_waiting_dependencies');
  }

  async setChainToInitState() {
    if (this.isRunning() || this.isErrored()) {
      await this.end();
    }

    this.execute_input = {};
    //Warning
    if (this.isRunning()) {
      logger.log('warn', `This chain ${this.id} is running yet and is being initialized`);
    }
    // Set All Process to stopped
    let processesLength = this.processes.length;
    while (processesLength--) {
      this.processes[processesLength].stop();
    }
    this.executionId = '';
    this.parentExecutionId = undefined;
  }

  async refreshChainStatus(causedByAnProcessError) {
    let processesLength = this.processes.length;
    let statusChain = 'end';

    let processesError = 0;
    let processesRunning = 0;
    let processesIgnored = 0;
    let processesStop = 0;
    let processesEnded = 0;

    while (processesLength--) {
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
          // IGNORE ERRORS IF PROCESS SET ignore_in_final_chain_status
          if (this.processes[processesLength].ignore_in_final_chain_status) {
            processesEnded += 1;
          } else {
            processesError += 1;
          }
          break;
        default:
          break;
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
        if (this.processes.length === processesIgnored + processesEnded) {
          statusChain = 'end';
        } else {
          if (processesIgnored > 0) {
            statusChain = 'ignore';
          } else {
            if (this.status === 'end') {
              statusChain = 'ignore';
            } else {
              statusChain = 'end';
            }
          }
        }
      }
    }

    switch (statusChain) {
      case 'end':
        await this.end();
        break;
      case 'error':
        await this.error(causedByAnProcessError);
        break;
      default:
        this.status = statusChain;
        break;
    }

    return statusChain;
  }

  startProcess(process, options) {
    const _this = this;
    const waitEndChilds = options.waitEndChilds;

    return new Promise(async resolve => {
      process.execute_input = _this.execute_input;

      if (process.isStopped()) {
        logger.log('debug', `Process ${process.id} scheduled`);

        process.clean();
        const processMustDo = await _this.checkProcessActionToDo(process);

        switch (processMustDo) {
          case 'run':
            logger.log('debug', `Starting ${process.id}`);

            if (process.execute_input) {
              Object.assign(process.execute_input, _this.execute_input);
            } else {
              process.execute_input = _this.execute_input;
            }

            if (process.isRunning()) {
              resolve();
            } else {
              process
                .start()
                .then(() => {
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
                  async function functEnd() {
                    const causedByAnProcessError = true;
                    await _this.refreshChainStatus(causedByAnProcessError);
                    resolve();
                  }

                  let action = '';
                  if (process.chain_action_on_fail) {
                    // Backward compatibility: chain_action_on_fail: {"action": "..."}
                    if (typeof process.chain_action_on_fail === 'object' && process.chain_action_on_fail.action) {
                      process.chain_action_on_fail = process.chain_action_on_fail.action;
                    }

                    if (typeof process.chain_action_on_fail === 'string') {
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
                        case 'continue':
                          action = 'continue';
                          break;
                        default:
                          action = '';
                          break;
                      }
                    } else {
                      logger.log('warn', `the property of process ${process.id} must be of type string`);
                    }
                  }

                  switch (action) {
                    case 'abort':
                      functEnd();
                      break;
                    case 'retry':
                      if (options.retries) {
                        options.retries -= 1;
                        if (_this.retries_count) {
                          _this.retries_count += 1;
                        } else {
                          _this.retries_count = 1;
                        }
                      } else {
                        options.retry_delay = _this.retry_delay;
                        options.retries = _this.retries;
                      }

                      if (options.retries > 0) {
                        _this.retry(options);
                      } else {
                        _this.startProcessesCtrl(options, resolve);
                      }
                      break;
                    case 'continue':
                      _this.startProcessesCtrl(options, resolve);
                      break;
                    default:
                      if (process.chain_action_on_fail)
                        logger.log(
                          'warn',
                          `Ignored incorrect chain_action_on_fail declaration of process ${process.id}: ${process.chain_action_on_fail}`
                        );
                      // Try run process on fail:
                      _this.startProcessesCtrl(options, resolve);
                      break;
                  }
                });
            }

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
            logger.log('debug', `End ignored: Only executed on_fail ${process.id}`);
            const notificateEnd = false;
            await process
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
        resolve();
      }
    });
  }

  async startProcessesCtrl(options, _resolve) {
    try {
      await this.startProcesses(options);
      _resolve();
    } catch (err) {
      logger.log('error', 'Error in startProcesses:', err);
      _resolve();
    }
  }

  async startProcesses(options, processQueueReleased) {
    const _this = this;
    const runningBeforeRefresh = _this.isRunning();
    const waitEndChilds = options.waitEndChilds;

    function execSerie(processes) {
      let sequence = Promise.resolve();
      processes.forEach(itemProcess => {
        sequence = sequence.then(() => {
          itemProcess.executionId = _this.executionId;
          if (itemProcess.id === processQueueReleased) itemProcess.queue_released = true;
          return _this.startProcess(itemProcess, options);
        });
      });
      return sequence;
    }

    try {
      const chainStatus = await _this.refreshChainStatus();
      if (chainStatus === 'running' && !runningBeforeRefresh) {
        await _this.setExecutionId();
        await _this.running();
      }
      // If Chains is running:
      if (chainStatus === 'running') {
        if (waitEndChilds) {
          //Serie
          await execSerie(_this.processes, waitEndChilds);
        } else {
          const processRuns = [];
          let processesLength = _this.processes.length;

          while (processesLength--) {
            _this.processes[processesLength].executionId = _this.executionId;
            _this.processes[processesLength].parentExecutionId = _this.parentExecutionId || _this.executionId;
            processRuns.push(_this.startProcess(_this.processes[processesLength], options));
          }
          await Promise.all(processRuns);
        }
      } else {
        await _this.refreshChainStatus();
      }
    } catch (err) {
      logger.log('error', 'Error en chain startProcesses: ', err);
    }
  }

  async checkProcessActionToDo(process) {
    // If process have depends_process:
    if (process.hasOwnProperty('depends_process')) {
      try {
        const action = await dependsProcess.getAction(process, this.processes, this.values());
        if (
          action === 'run' &&
          process.queue &&
          process.queue !== '' &&
          (!process.queue_released || process.queue_released === false)
        ) {
          return 'queue';
        } else {
          delete process.queue_released;
          return action;
        }
      } catch (err) {
        throw err;
      }
    }
  }

  clean() {
    delete this.retries_count;
    delete this.duration_seconds;
    delete this.ended_at;
  }

  killRunnertyOnForcedInitChainsStop() {
    let timeToWait = 500;
    if (runtime.forcedInitChainsIds && runtime.endOnforcedInitChainsIds) {
      for (let i = 0; i < runtime.forcedInitChainsIds.length; i++) {
        if (runtime.forcedInitChainsIds[i] === this.id) {
          if (this.retries) {
            timeToWait += ms('' + this.retry_delay) * 1.5 || 0;
          }

          setTimeout(() => {
            if (!this.isErrored && !this.isEnded) {
              this.mustEnd = false;
            }

            if (!this.retries || this.mustEnd) {
              runtime.forcedInitChainsIds.splice(i, 1);
            }

            if (runtime.forcedInitChainsIds.length === 0) {
              process.exit();
            }

            if (this.isErrored || this.isEnded) {
              this.mustEnd = true;
              this.killRunnertyOnForcedInitChainsStop();
            }
          }, timeToWait);
        }
      }
    }
  }
}

module.exports = Chain;
