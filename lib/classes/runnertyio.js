'use strict';
const http = require('axios');
const logger = require('../logger.js');
const version = require('../../package.json').version;

class Runnertyio {
  constructor() {}
  static init(config) {
    let protocol = 'https';
    if (config.hasOwnProperty('protocol')) {
      protocol = config['protocol'];
    }
    this.haveAccess = false;
    this.endpoints = {
      chain: protocol + '://telemetry.runnerty.io/api/chainlog',
      process: protocol + '://telemetry.runnerty.io/api/processlog',
      access: protocol + '://telemetry.runnerty.io/api/checkaccess',
      health: protocol + '://telemetry.runnerty.io/api/health',
      dead: protocol + '://telemetry.runnerty.io/api/dead'
    };
    this._values = {
      headers: {
        Authorization: 'Bearer ',
        'User-Agent': 'runnerty',
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      method: 'POST',
      data: {}
    };
    this.healthCheckerRecursiveTimeout = 1000 * 60 * 5; // 5 minutes
    this.healthCheckerResponseTimeout = 1000 * 20; // 20 seconds
    this.debug =
      config.hasOwnProperty('runnerty.io') && config.hasOwnProperty('debug') && config['debug'] === true ? true : false;
    this.apikey = config['apikey'];
  }

  static async checkAccess() {
    let valuesSend = this._values;
    valuesSend.headers.Authorization = valuesSend.headers.Authorization + this.apikey;
    valuesSend.url = this.endpoints.access;
    valuesSend.data.version = version;
    try {
      await http(valuesSend);
      this.haveAccess = true;
      logger.log('info', 'Successful access to runnerty.io');
      if (
        config.hasOwnProperty('runnerty.io') &&
        config.hasOwnProperty('healthChecker') &&
        config['healthChecker'] === true
      ) {
        this.healthCheckerRecursive();
      }
    } catch (err) {
      logger.log(
        'error',
        `Failure access to runnerty.io. The following access attempts will be ignored.\n${err.message}`
      );
      this.haveAccess = false;
    }
  }

  static async send(type, values, timeout) {
    if (this.haveAccess) {
      if (!this.endpoints[type]) {
        reject(`runnerty.io connector. type ${type} is not valid.`);
      }

      if (type !== 'dead') {
        if (!values.hasOwnProperty('id') || !values.hasOwnProperty('event')) {
          reject('runnerty.io connector. Message not cotains id or event.');
        }
      }

      let valuesSend = this._values;
      valuesSend.data = values || {};
      valuesSend.url = this.endpoints[type];
      if (timeout) valuesSend.timeout = timeout;

      if (this.debug) {
        logger.log('info', `DEBUG-runnerty.io [send]. type:${type} \nvalues:${JSON.stringify(valuesSend)}`);
      }

      try {
        await http(valuesSend);
        if (this.debug) {
          logger.log('info', 'DEBUG-runnerty.io [send]. HTTP-OK');
        }
      } catch (err) {
        if (this.debug) {
          logger.log('info', `DEBUG-runnerty.io [send]. HTTP-ERROR ${err}`);
        }
      }
    } else {
      if (this.debug) {
        logger.log('info', 'DEBUG-runnerty.io [send]. No access.');
      }
    }
  }

  static async healthChecker() {
    if (this.haveAccess) {
      let valuesSend = this._values;
      valuesSend.url = this.endpoints.health;
      valuesSend.timeout = this.healthCheckerResponseTimeout;
      try {
        await http(valuesSend);
      } catch (err) {
        throw err;
      }
    } else {
      throw new Error('There is no access to runnerty.io.');
    }
  }

  static healthCheckerRecursive() {
    this.healthChecker().catch(err => {
      logger.log('error', `Failure health check to runnerty.io.\n${err.message}`);
    });
    setTimeout(() => {
      this.healthCheckerRecursive();
    }, this.healthCheckerRecursiveTimeout);
  }
}

module.exports = Runnertyio;
