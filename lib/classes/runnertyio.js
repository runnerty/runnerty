'use strict';
const io = require('socket.io-client');
const logger = require('../logger.js');
const version = require('../../package.json').version;
const queueProcess = require('../queue-process-memory.js');
const runtime = require('./runtime');

class Runnertyio {
  constructor() {}
  static init(config) {
    this.apikey = config.apikey;
    this.version = config.version;
    this.healthChecker = config.healthChecker || false;
    this.remoteControl = config.remoteControl || true;
    this.disable = config.disable || false;
    this.debug = config.debug || false;
    this.syncPlan = config.syncPlan || true;
    this.haveAccess = false;
    this.firstConnection = true;
    this.host = config.host;
    this.planTyped = '';
    this.events = {
      chain: 'chainlog',
      process: 'processlog',
      access: 'checkaccess',
      health: 'health',
      dead: 'dead'
    };

    this.healthCheckerRecursiveTimeout = 1000 * 60 * 5; // 5 minutes
    this.healthCheckerResponseTimeout = 1000 * 20; // 20 seconds
    const conectionOptions = {
      extraHeaders: { Authorization: `Bearer ${config.apikey}` }
    };

    if (this.version) {
      conectionOptions.path = `/${this.version}`;
    }

    this.socket = io.connect(config.host, conectionOptions);
    this.socket.connect();

    this.socket.on('connect', () => {
      if (this.firstConnection) {
        logger.log('info', 'Successful access to runnerty.io (websockets)');
        if (this.syncPlan) {
          try {
            if (runtime.planePlanChains) {
              const plan = {};
              plan.chains = runtime.planePlanChains;
              this.planTyped = this.setPlanTypes(plan);
            }
          } catch (err) {
            throw new Error(err);
          }
        }
      } else {
        logger.log('info', 'Connection restored with runnerty.io.');
      }
      this.socket.emit(this.events['access'], {
        version: version,
        remoteControl: this.remoteControl,
        healthChecker: this.healthChecker,
        plan: this.planTyped
      });
      this.haveAccess = true;
      this.firstConnection = false;
      if (this.healthChecker) this.healthCheckerRecursive();
    });

    this.socket.on('connect_error', error => {
      this.haveAccess = false;
      if (error?.data?.type == 'UnauthorizedError' || error?.data?.code == 'invalid_token') {
        logger.log('error', `runnerty.io access: your project apikey is invalid or has expired.`);
      } else if (error) {
        logger.log(
          'warn',
          `Lost connection with runnerty.io: The following access attempts could be ignored: ${error}`
        );
      }
    });

    this.socket.on('disconnect', () => {
      this.haveAccess = false;
      logger.log('warn', `Lost connection with runnerty.io: The following access attempts could be ignored.`);
    });

    this.socket.on('error', error => {
      this.haveAccess = false;
      logger.log(
        'warn',
        `Failure access to runnerty.io. The following access attempts could be ignored.\n${error.message}`
      );
    });

    this.socket.on('connect_timeout', error => {
      this.haveAccess = false;
      logger.log(
        'warn',
        `connect_timeout to runnerty.io. The following access attempts could be ignored.\n${error.message}`
      );
    });

    // REMOTE COMMANDS:
    this.socket.on('remote-commands', data => {
      if (this.debug) {
        logger.log('info', `DEBUG-runnerty.io [remote-commands].\nData:${JSON.stringify(data)}`);
      }
      if (this.remoteControl && data) {
        this.runCommand(data);
      }
    });
  }

  static setPlanTypes(plan) {
    for (const chain of plan.chains) {
      // Processes
      if (chain.processes && runtime.config.executors) {
        for (const process of chain.processes) {
          const type = runtime.config.executors.find(x => x.id === process.exec.id).type;
          process.exec.type = type;

          // Proccess Notification
          if (process.notifications && runtime.config.notifiers) {
            for (const event in process.notifications) {
              for (const notification of process.notifications[event]) {
                const type = runtime.config.notifiers.find(x => x.id === notification.id).type;
                notification.type = type;
              }
            }
          }
        }
      }
      // Trigger
      if (chain.triggers && runtime.config.triggers) {
        for (const trigger of chain.triggers) {
          const type = runtime.config.triggers.find(x => x.id === trigger.id).type;
          trigger.type = type;
        }
      }

      // Chain Notification
      if (chain.notifications && runtime.config.notifiers) {
        for (const event in chain.notifications) {
          for (const notification of chain.notifications[event]) {
            const type = runtime.config.notifiers.find(x => x.id === notification.id).type;
            notification.type = type;
          }
        }
      }
      // Chain Defaults Processes Notification
      if (chain.defaults_processes && chain.defaults_processes.notifications && runtime.config.notifiers) {
        for (const event in chain.defaults_processes.notifications) {
          for (const notification of chain.defaults_processes.notifications[event]) {
            const type = runtime.config.notifiers.find(x => x.id === notification.id).type;
            notification.type = type;
          }
        }
      }
    }
    return plan;
  }

  static async send(type, values) {
    if (this.haveAccess) {
      if (!this.events[type]) {
        throw new Error(`runnerty.io connector. type ${type} is not valid.`);
      }

      if (type !== 'dead') {
        if (!values.hasOwnProperty('id') || !values.hasOwnProperty('event')) {
          throw new Error('runnerty.io connector. Message not cotains id or event.');
        }
      }

      if (this.debug) {
        logger.log('info', `DEBUG-runnerty.io [send]. type:${type} \nvalues:${JSON.stringify(values)}`);
      }

      this.socket.emit(this.events[type], values);
    } else {
      if (this.debug) {
        logger.log('info', 'DEBUG-runnerty.io [send]. No access.');
      }
    }
  }

  static healthCheck() {
    if (this.haveAccess) {
      this.socket.emit(this.events['health']);
    } else {
      logger.log('warn', `There is no access to runnerty.io.`);
    }
  }

  static healthCheckerRecursive() {
    this.healthCheck();
    setTimeout(() => {
      this.healthCheckerRecursive();
    }, this.healthCheckerRecursiveTimeout);
  }

  static runCommand(data) {
    // RUN/CHAIN:
    if (data.command === 'run/chain' && data.chainId) {
      const chain = runtime.plan.getChainById(data.chainId);
      if (chain) {
        queueProcess.queueChain(chain, data.input || [], data.custom_values || {});
      }
    }
  }
}

module.exports = Runnertyio;
