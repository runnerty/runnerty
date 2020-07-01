'use strict';
const io = require('socket.io-client');
const logger = require('../logger.js');
const version = require('../../package.json').version;
const queueProcess = require('../queue-process-memory.js');

class Runnertyio {
  constructor() {}
  static init(config) {
    this.apikey = config.apikey;
    this.healthChecker = config.healthChecker || false;
    this.remoteControl = config.remoteControl || true;
    this.disable = config.disable || false;
    this.debug = config.debug || false;
    this.haveAccess = false;
    this.firstConnection = true;
    this.host = config.host;
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

    this.socket = io.connect(config.host, conectionOptions);
    this.socket.connect();

    this.socket.on('connect', () => {
      this.socket.emit(this.events['access'], {
        version: version,
        remoteControl: this.remoteControl,
        healthChecker: this.healthChecker
      });
      this.haveAccess = true;
      if (this.firstConnection) logger.log('info', 'Successful access to runnerty.io (websockets)');
      this.firstConnection = false;
      if (this.healthChecker) this.healthCheckerRecursive();
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

    this.socket.on('reconnect', () => {
      this.haveAccess = true;
      logger.log('info', 'Connection restored with runnerty.io.');
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
      throw new Error('There is no access to runnerty.io.');
    }
  }

  static healthCheckerRecursive() {
    this.healthCheck();
    setTimeout(() => {
      this.healthCheckerRecursive();
    }, this.healthCheckerRecursiveTimeout);
  }

  static runCommand(data) {
    const globalPlan = global.runtimePlan.plan;
    // RUN/CHAIN:
    if (data.command === 'run/chain' && data.chainId) {
      const chain = globalPlan.getChainById(data.chainId);
      if (chain) {
        queueProcess.queueChain(chain, data.input || [], data.custom_values || {});
      }
    }
    // KILL/CHAIN
    if (data.command === 'kill/chain' && data.chainId) {
      globalPlan.stopChain(data.chainId, data.uniqueId);
    }
  }
}

module.exports = Runnertyio;
