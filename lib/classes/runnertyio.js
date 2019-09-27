'use strict';
const http = require('request-promise-native');
const logger = require('../logger.js');

class Runnertyio {
  constructor() {
    let _this = this;
    let protocol = 'https';
    if (global.config.general.hasOwnProperty('runnerty.io')) {
      if (global.config.general['runnerty.io'].hasOwnProperty('protocol')) {
        protocol = global.config.general['runnerty.io']['protocol'];
      }
    }
    _this.haveAccess = false;
    _this.endpoints = {
      chain: protocol + '://telemetry.runnerty.io/api/chainlog',
      process: protocol + '://telemetry.runnerty.io/api/processlog',
      access: protocol + '://telemetry.runnerty.io/api/checkaccess',
      health: protocol + '://telemetry.runnerty.io/api/health',
      dead: protocol + '://telemetry.runnerty.io/api/dead'
    };
    _this._values = {
      headers: {
        'User-Agent': 'runnerty',
        'Content-Type': 'application/json'
      },
      method: 'POST',
      uri: '',
      json: true,
      auth: {
        bearer: ''
      },
      body: {}
    };
    _this.healthCheckerRecursiveTimeout = 1000 * 60 * 5; // 5 minutes
    _this.healthCheckerResponseTimeout = 1000 * 20; // 20 seconds

    return new Promise(async resolve => {
      if (
        global.config.general.hasOwnProperty('runnerty.io') &&
        global.config.general['runnerty.io'].hasOwnProperty('apikey') &&
        global.config.general['runnerty.io']['apikey'] !== '' &&
        !global.config.general['runnerty.io'].disable
      ) {
        await _this.checkAccess();
      }

      resolve(_this);
    });
  }

  checkAccess() {
    return new Promise(resolve => {
      let valuesSend = this._values;
      valuesSend.auth.bearer = global.config.general['runnerty.io']['apikey'];
      valuesSend.uri = this.endpoints.access;
      valuesSend.body.version = global.version;

      http(valuesSend)
        .then(_ => {
          logger.log('info', 'Successful access to runnerty.io');
          this.haveAccess = true;
          if (
            global.config.general.hasOwnProperty('runnerty.io') &&
            global.config.general['runnerty.io'].hasOwnProperty(
              'healthChecker'
            ) &&
            global.config.general['runnerty.io']['healthChecker'] === true
          ) {
            this.healthCheckerRecursive();
          }
          resolve();
        })
        .catch(err => {
          logger.log(
            'error',
            'Failure access to runnerty.io. The following access attempts will be ignored.\n',
            err.message
          );
          this.haveAccess = false;
          resolve();
        });
    });
  }

  send(type, values, timeout) {
    return new Promise((resolve, reject) => {
      if (this.haveAccess) {
        if (!this.endpoints[type]) {
          reject(`runnerty.io connector. type ${type} is not valid.`);
        }

        if (type !== 'dead') {
          if (!values.hasOwnProperty('id') || !values.hasOwnProperty('event')) {
            reject(`runnerty.io connector. Message not cotains id or event.`);
          }
        }

        let valuesSend = this._values;
        valuesSend.body = values || {};
        valuesSend.uri = this.endpoints[type];
        if (timeout) valuesSend.timeout = timeout;

        http(valuesSend)
          .then(_ => {
            resolve();
          })
          .catch(err => {
            reject(err);
          });
      } else {
        resolve();
      }
    });
  }

  healthChecker() {
    return new Promise((resolve, reject) => {
      if (this.haveAccess) {
        let valuesSend = this._values;
        valuesSend.uri = this.endpoints.health;
        valuesSend.timeout = this.healthCheckerResponseTimeout;

        http(valuesSend)
          .then(() => {
            resolve();
          })
          .catch(err => {
            reject(err);
          });
      } else {
        reject('There is no access to runnerty.io.');
      }
    });
  }

  healthCheckerRecursive() {
    this.healthChecker().catch(err => {
      logger.log(
        'error',
        'Failure health check to runnerty.io.\n',
        err.message
      );
    });
    setTimeout(async () => {
      this.healthCheckerRecursive();
    }, this.healthCheckerRecursiveTimeout);
  }
}

module.exports = Runnertyio;