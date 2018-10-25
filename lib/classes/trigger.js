"use strict";

const utils = require("../utils.js");
const queue = require("../queue-process-memory");
const replaceWithSmart = utils.replaceWithSmart;
const checkCalendar = utils.checkCalendar;
const logger = require("../logger.js");

class Trigger {
  constructor(chain, params) {
    let _this = this;
    _this.logger = logger;
    _this.chain = chain;
    if (params.config.server && params.server){
      params.server = Object.assign(params.config.server, params.server);
    }

    return new Promise(async (resolve, reject) => {
      _this.params = await replaceWithSmart(params, _this.chain.values());
      // SERVER:
      if(_this.params.server) {
        if(global.servers[_this.params.server.id]){
          _this.params.server = Object.assign(_this.params.server, global.servers[_this.params.server.id]);
        }else{
          reject(`Trigger Error. Server Id ${_this.params.server.id} not found.`);
        }
      }

      resolve(_this);
    });
  }

  start() {
    let _this = this;
    return new Promise((resolve, reject) => {
      if(_this.params.server) {
        _this.params.server.router[_this.params.server.method.toLowerCase()](_this.params.server.path || "/",(req, res) => {
          _this.params.server.req = req;
          _this.params.server.res = res;
          return _this.on_request(req);
        });

      } else {
        logger.log("error", "Method start (execution) must be rewrite in child class");
        _this.process.execute_err_return = "Method start (trigger) must be rewrite in child class";
        _this.process.msg_output = "";
        _this.process.error();
        reject("Method start (trigger) must be rewrite in child class");
      }
    });
  }

  on_request() {
    let _this = this;
    return new Promise((resolve, reject) => {
      logger.log("error", "Method on_request (execution) must be rewrite in child class");
      _this.process.execute_err_return = "Method on_request (trigger) must be rewrite in child class";
      _this.process.msg_output = "";
      _this.process.error();
      reject("Method on_request (trigger) must be rewrite in child class");
    });
  }

  startChain(checkCalendar = true, inputValues, customValues, responseServerObject){
    return new Promise(async (resolve, reject) => {
      let _this = this;
      let start = false;

      if(_this.params.server) {

        let statusCode = 200;
        let resObject = responseServerObject;

        if(responseServerObject && responseServerObject.statusCode){
          statusCode = responseServerObject.statusCode;
          resObject = {};
        }

        if(responseServerObject && responseServerObject.object){
          resObject = responseServerObject.object;
        }

        _this.params.server.res.status(statusCode).json(resObject);
      }

      if(customValues){
        Object.assign(_this.chain.custom_values || {}, await utils.objToKeyValue(customValues));
      }

      if(inputValues){

        if(!(inputValues instanceof Array)){
          inputValues = [inputValues];
        }

        if(!_this.chain.input.length){
          for(const val of inputValues){
            _this.chain.input.push(await utils.objToKeyValue(val));
          }
        }else{
          for(const val of inputValues){
            Object.assign(_this.chain.input[0], await utils.objToKeyValue(val));
          }
        }
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