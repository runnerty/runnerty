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
    this.runnertyio = chain['runnerty.io'];
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
      CHAIN_RETRIES: this.retries,
      CHAIN_QUEUE: this.queue
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
      throw new Error(`Notificate chain ${this.id}: ${err}.`);
    }
  }

  async historicize(event) {
    const values = {
      id: this.id,
      uId: this.uId,
      parentUId: this.parentUId,
      parentProcessUId: this.parentProcessUId,
      execId: this.execId,
      executionId: this.executionId,
      parentExecutionId: this.parentExecutionId || this.executionId,
      name: this.name,
      namespace: this.namespace,
      meta: this.meta,
      remoteControl: this?.runnertyio?.remoteControl !== false,
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

    // Meta id_extra:
    if (event === 'start' && this?.meta?.extra_id) {
      values.extraId = await recursiveObjectInterpreter(this?.meta?.extra_id, this.values());
    }

    // Runnerty.io debug:
    if (runnertyio.debug) {
      logger.log('info', `DEBUG-runnerty.io [pre-send] from CHAIN ${this.id} (${this.uId}).`);
    }

    // RunnertyIO History
    if (this?.runnertyio?.sync?.events !== false) {
      runnertyio.send('chain', values).catch(err => {
        logger.log(
          'error',
          `RunnertyIO - error historicize ${values.event} chain ${this.id}.\n${err}\n values:${values}`
        );
      });
    }
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
      this.startChainsDependients();
      this.killRunnertyOnForcedInitChainsStop();
    }
  }

  isOwnDependsChains(depends_chains) {
    if (
      depends_chains.hasOwnProperty('chain_id') &&
      !depends_chains.hasOwnProperty('process_id') &&
      depends_chains.chain_id === this.id
    ) {
      return true;
    }
    return false;
  }

  isChainDependient(chainToCheck) {
    let isDependient = false;
    if (chainToCheck.hasOwnProperty('depends_chains') && chainToCheck.depends_chains !== null) {
      // Object:
      if (chainToCheck.depends_chains instanceof Object) {
        isDependient = this.isOwnDependsChains(chainToCheck.depends_chains);
      }
      // Array:
      if (chainToCheck.depends_chains instanceof Array) {
        for (const chainToCheckDeps of chainToCheck.depends_chains) {
          if (chainToCheckDeps instanceof Object) {
            if (this.isOwnDependsChains(chainToCheckDeps)) isDependient = true;
          } else {
            if (typeof chainToCheckDeps === 'string') {
              if (this.isOwnDependsChains({ chain_id: chainToCheckDeps })) isDependient = true;
            }
          }
        }
      }
      // String:
      if (chainToCheck.depends_chains instanceof String) {
        if (this.isOwnDependsChains({ chain_id: chainToCheck.depends_chains })) isDependient = true;
      }
    }
    return isDependient;
  }

  isIterable(chain) {
    const _chainToCheck = this || chain;
    return _chainToCheck.hasOwnProperty('iterable') && _chainToCheck.iterable && _chainToCheck.iterable !== '';
  }

  async startChainsDependients() {
    for (const itemChain of runtime.plan.chains) {
      if (this.isChainDependient(itemChain)) {
        if (runtime.forcedInitChainsIds) {
          if (runtime.forceDependents) {
            queue.queueChain(itemChain);
            runtime.forcedInitChainsIds.push(itemChain.id);
          }
        } else {
          queue.queueChain(itemChain);
        }
      }
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
        if (processChildsChainsStatus === 'end' || (processChildsChainsStatus === 'error' && !this.isIterable())) {
          // If child not iterable (chails dependent) parent must end on error:
          if (processChildsChainsStatus === 'error' && !this.isIterable()) {
            abortIfEndCausedByAnProcessError = true;
          }
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

  async extractDependsProcess(dependencies, resObject = []) {
    if (dependencies instanceof Array) {
      const promArr = [];
      for (let i = 0; i < dependencies.length; i++) {
        promArr.push(await this.extractDependsProcess(dependencies[i], resObject));
      }
      Promise.all(promArr).then(values => {
        return values;
      });
    } else {
      if (dependencies instanceof Object) {
        const keys = Object.keys(dependencies);
        for (const key of keys) {
          switch (key) {
            case '$end':
            case '$fail':
              resObject.push(dependencies[key]);
              break;
            default:
              await this.extractDependsProcess(dependencies[key], resObject);
              break;
          }
        }
        return resObject;
      } else {
        return dependencies;
      }
    }
  }

  getDependentsOf(initialProcess, totalDeps, ownDependets = []) {
    let dependents = ownDependets || [];
    for (const dep of totalDeps) {
      if (dep.deps.indexOf(initialProcess) != -1) {
        if (dependents.indexOf(dep.id) == -1) dependents.push(dep.id);
        dependents = this.getDependentsOf(dep.id, totalDeps, dependents);
      }
    }
    return dependents;
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

  async retry(options) {
    let _delay = 0;
    const sleep = require('util').promisify(setTimeout);
    if (options.retry_delay) {
      _delay = options.retry_delay;
    }
    await sleep(ms('' + _delay));
    try {
      await this.notificate('on_retry');
      await this.setChainToInitState();
      await this.run(options);
    } catch (err) {
      logger.log('error', 'Error retry chain: ', err);
    }
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
    let countTotalProcesses = 0;

    while (processesLength--) {
      switch (this.processes[processesLength].status) {
        case 'end':
          processesEnded += 1;
          countTotalProcesses += 1;
          break;
        case 'stop':
          processesStop += 1;
          countTotalProcesses += 1;
          break;
        case 'running':
          processesRunning += 1;
          countTotalProcesses += 1;
          break;
        case 'ignored':
          processesIgnored += 1;
          countTotalProcesses += 1;
          break;
        case 'error':
          // IGNORE ERRORS IF PROCESS SET ignore_in_final_chain_status
          if (this.processes[processesLength].ignore_in_final_chain_status) {
            processesEnded += 1;
          } else {
            processesError += 1;
          }
          countTotalProcesses += 1;
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
          countTotalProcesses += 1;
          break;
        case 'running':
          processesRunning += 1;
          countTotalProcesses += 1;
          break;
        case 'ignored':
          processesIgnored += 1;
          countTotalProcesses += 1;
          break;
        case 'error':
          if (this.processes[processesLength].fail_on_child_fail) {
            processesError += 1;
          } else {
            processesEnded += 1;
          }
          countTotalProcesses += 1;
          break;
        default:
          break;
      }
    }

    //Set Chain Status
    if (processesRunning > 0 || (processesStop > 0 && !causedByAnProcessError)) {
      statusChain = 'running';
    } else {
      if (processesError > 0) {
        statusChain = 'error';
      } else {
        if (countTotalProcesses === processesIgnored + processesEnded) {
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

  async startProcess(process, options) {
    try {
      if (process.isStopped()) {
        const waitEndChilds = options.waitEndChilds;
        process.execute_input = this.execute_input;
        logger.log('debug', `Process ${process.id} scheduled`);
        process.clean();
        const processMustDo = await this.checkProcessActionToDo(process);
        switch (processMustDo) {
          case 'run':
            await this.startProcessRun(process, options, waitEndChilds);
            break;
          case 'queue':
            process.queue_up();
            queue.queueProcess(process, this, options);
            break;
          case 'wait':
            process.waiting_dependencies();
            break;
          case 'ignore':
            logger.log('debug', `Process ignored: ${process.id}`);
            process.ignore();
            await this.startProcessesCtrl(options);
            break;
          case 'end':
            logger.log('debug', `End ignored: Only executed on_fail ${process.id}`);
            const notificateEnd = false;
            await process.end(notificateEnd);
            await this.startProcessesCtrl(options);
            break;
          default:
            break;
        }
      }
    } catch (err) {
      logger.log('startProcess error', err);
    }
  }

  async startProcessRun(process, options, waitEndChilds) {
    logger.log('debug', `Starting ${process.id}`);

    if (process.execute_input) {
      Object.assign(process.execute_input, this.execute_input);
    } else {
      process.execute_input = this.execute_input;
    }

    if (!process.isRunning()) {
      try {
        await process.start();
        try {
          await process.startChildChainsDependients(waitEndChilds);
        } catch (err) {
          logger.debug('error', 'Error in startProcess:', err);
        }
        try {
          await this.startProcessesCtrl(options);
        } catch (err) {
          logger.debug('debug', err);
        }
      } catch (err) {
        // process.start fails:
        err = err || process.execute_err_return;
        logger.debug('error', 'Process ' + process.id, err);
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
            const causedByAnProcessError = true;
            await this.refreshChainStatus(causedByAnProcessError);
            break;
          case 'retry':
            if (options.retries) {
              options.retries -= 1;
              if (this.retries_count) {
                this.retries_count += 1;
              } else {
                this.retries_count = 1;
              }
            } else {
              options.retry_delay = this.retry_delay;
              options.retries = this.retries;
            }

            if (options.retries > 0) {
              await this.retry(options);
            } else {
              await this.startProcessesCtrl(options);
            }
            break;
          case 'continue':
            await this.startProcessesCtrl(options);
            break;
          default:
            if (process.chain_action_on_fail)
              logger.log(
                'warn',
                `Ignored incorrect chain_action_on_fail declaration of process ${process.id}: ${process.chain_action_on_fail}`
              );
            // Try run process on fail:
            await this.startProcessesCtrl(options);
            break;
        }
      }
    }
  }

  async startProcessesCtrl(options) {
    try {
      await this.startProcesses(options);
    } catch (err) {
      logger.log('error', 'Error in startProcesses:', err);
    }
  }

  async startProcessesSerie(processes, processQueueReleased, options) {
    let sequence = Promise.resolve();
    processes.forEach(itemProcess => {
      sequence = sequence.then(() => {
        itemProcess.executionId = this.executionId;
        if (itemProcess.id === processQueueReleased) itemProcess.queue_released = true;
        return this.startProcess(itemProcess, options);
      });
    });
    return sequence;
  }

  async startProcesses(options, processQueueReleased) {
    const runningBeforeRefresh = this.isRunning();
    const waitEndChilds = options.waitEndChilds;

    try {
      const chainStatus = await this.refreshChainStatus();
      if (chainStatus === 'running' && !runningBeforeRefresh) {
        await this.setExecutionId();
        await this.running();
      }
      // If Chains is running:
      if (chainStatus === 'running') {
        // FORCED INITIAL PROCCESS:
        if (options.initialProcess) {
          const totalDeps = [];
          for (const proc of this.processes) {
            if (proc.depends_process) {
              const standDepsProc = utils.standardizeDependsProcesses(proc.depends_process);
              totalDeps.push({ id: proc.id, deps: await this.extractDependsProcess(standDepsProc) });
            }
          }
          const initialDepens = this.getDependentsOf(options.initialProcess, totalDeps);
          for (const proc of this.processes) {
            if (initialDepens.indexOf(proc.id) == -1 && proc.id != options.initialProcess) {
              proc.status = 'end';
            }
            if (options.initialProcess === proc.id) proc.depends_process = [];
          }
        }

        if (waitEndChilds) {
          //Serie
          await this.startProcessesSerie(this.processes, processQueueReleased, options);
        } else {
          const processRuns = [];
          let processesLength = this.processes.length;

          while (processesLength--) {
            this.processes[processesLength].executionId = this.executionId;
            this.processes[processesLength].parentExecutionId = this.parentExecutionId || this.executionId;
            processRuns.push(this.startProcess(this.processes[processesLength], options));
          }
          await Promise.all(processRuns);
        }
      } else {
        await this.refreshChainStatus();
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
