'use strict';

const utils = require('../utils.js');
const queue = require('../queue-process-memory');
const replaceWithSmart = utils.replaceWithSmart;
const checkCalendar = utils.checkCalendar;
const logger = require('../logger.js');

class Trigger {
  constructor(chain, params) {
    this.logger = logger;
    this.chain = chain;
    this.params = params;
    if (this.params.config.server && this.params.server) {
      this.params.server = Object.assign(this.params.config.server, this.params.server);
    }
  }

  async init() {
    try {
      this.params = await replaceWithSmart(this.params, this.chain.values());
      // SERVER:
      if (this.params.server) {
        if (global.servers[this.params.server.id]) {
          this.params.server = Object.assign(this.params.server, global.servers[this.params.server.id]);
        } else {
          logger.log('error', `Trigger Error. Server Id ${this.params.server.id} not found.`);
          throw new Error(`Trigger Error. Server Id ${this.params.server.id} not found.`);
        }
      }
      return this;
    } catch (err) {
      logger.log('error', `init Notification:`, err);
      throw err;
    }
  }

  async start() {
    if (this.params.server) {
      this.params.server.router[this.params.server.method.toLowerCase()](this.params.server.path || '/', (req, res) => {
        this.params.server.req = req;
        this.params.server.res = res;
        return this.on_request(req);
      });
    } else {
      logger.log('error', 'Method start (execution) must be rewrite in child class');
      this.process.execute_err_return = 'Method start (trigger) must be rewrite in child class';
      this.process.msg_output = '';
      this.process.error();
      throw new Error('Method start (trigger) must be rewrite in child class');
    }
  }

  async on_request() {
    logger.log('error', 'Method on_request (execution) must be rewrite in child class');
    this.process.execute_err_return = 'Method on_request (trigger) must be rewrite in child class';
    this.process.msg_output = '';
    this.process.error();
    throw new Error('Method on_request (trigger) must be rewrite in child class');
  }

  startChain(checkCalendar = true, inputValues, customValues, responseServerObject) {
    return new Promise(async (resolve, reject) => {
      const _this = this;
      let start = false;

      if (_this.params.server) {
        let statusCode = 200;
        let resObject = responseServerObject;

        if (responseServerObject && responseServerObject.statusCode) {
          statusCode = responseServerObject.statusCode;
          resObject = {};
        }

        if (responseServerObject && responseServerObject.object) {
          resObject = responseServerObject.object;
        }

        _this.params.server.res.status(statusCode).json(resObject);
      }

      if (checkCalendar && _this.params.calendars) {
        checkCalendar(_this.params.calendars)
          .then(dateEnableOnDate => {
            if (dateEnableOnDate) {
              start = true;
            } else {
              start = false;
              logger.log('debug', `Chain ${_this.id} not started: Date not enable in calendar.`);
              resolve();
            }
          })
          .catch(err => {
            start = false;
            logger.log('debug', `Chain ${_this.id} not started - checking calendars: ${err}`);
            reject(err);
          });
      } else {
        start = true;
      }

      if (start) {
        queue.queueChain(_this.chain, inputValues, customValues);
      }
    });
  }

  checkCalendar(calendars, execDate) {
    return checkCalendar(calendars, execDate);
  }

  logger(type, menssage) {
    logger.log(type, menssage);
  }

  async getParamValues() {
    try {
      const values = await replaceWithSmart(this.chain.triggers, this.chain.values());
      return values;
    } catch (err) {
      logger.log('error', `Trigger - Method getParamValues: ${err}`);
      this.chain.err_output = 'Trigger - Method getParamValues:' + err;
      this.chain.msg_output = '';
      this.chain.error();
      throw err;
    }
  }
}

module.exports = Trigger;
