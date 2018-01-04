"use strict";

const utils = require("../utils.js");
const queue = require("../queue-process-memory");
const replaceWithSmart = utils.replaceWithSmart;
const checkCalendar = utils.checkCalendar;
const logger = utils.logger;

class Trigger {
  constructor(chain, params) {
    let _this = this;
    _this.logger = logger;
    _this.params = params;
    _this.chain = chain;
    return new Promise(resolve => {
      resolve(_this);
    });
  }

  start() {
    let _this = this;
    return new Promise((resolve, reject) => {
      logger.log("error", "Method start (execution) must be rewrite in child class");
      _this.process.execute_err_return = "Method start (trigger) must be rewrite in child class";
      _this.process.msg_output = "";
      _this.process.error();
      reject("Method start (trigger) must be rewrite in child class");
    });
  }

  startChain(checkCalendar = true, inputValues, customValues){
    return new Promise((resolve, reject) => {
      let _this = this;
      let start = false;

      if(customValues){
        // Object.assign(_this.chain.custom_values || {}, customValues);
      }

      if(inputValues){
      //  Object.assign(_this.chain.input || {}, inputValues);
      }

      if (checkCalendar && _this.params.calendars) {
        checkCalendar(_this.params.calendars)
          .then(dateEnableOnDate => {
            if(dateEnableOnDate){
              start = true;
            }else{
              start = false;
              logger.log("debug", `Chain ${_this.id} not started: Date not enable in calendar.`);
              resolve();
            }
          })
          .catch(err => {
            start = false;
            logger.log("debug", `Chain ${_this.id} not started - checking calendars: ${err}`);
            reject(err);
          });
      }else{
        start = true;
      }

      if(start){
        queue.queueChain(_this.chain);
      }
    });
  }

  checkCalendar(calendars, execDate){
    return checkCalendar(calendars, execDate);
  }

  logger(type, menssage) {
    logger.log(type, menssage);
  }

  getParamValues() {
    let _this = this;
    return new Promise((resolve, reject) => {
      replaceWithSmart(_this.chain.triggers, _this.chain.values())
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          logger.log("error", "Trigger - Method getParamValues:", err);
          _this.chain.err_output = "Trigger - Method getParamValues:" + err;
          _this.chain.msg_output = "";
          _this.chain.error();
          reject(err);
        });
    });
  }

}

module.exports = Trigger;