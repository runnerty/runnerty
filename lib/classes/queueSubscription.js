"use strict";

const utils = require("../utils.js");
const crypto = require("crypto");
const logger = utils.logger;
let globalPlan = global.runtimePlan.plan;
const configQueues = global.config.general.queues;
const refreshInterval = configQueues.refreshInterval || 5000;
let executionInProgress = false;


class queueSubscription {
  constructor(subscription) {
    let _this = this;

    _this.queue = subscription.queue;

    if (_this.queue === "zero"){
      _this.startExecutionQueueZero();
    }else{
      _this.startExecutionQueue();
    }
  }

  startExecutionQueue() {
    let _this = this;

    let next = _this.getNext();

    if (next){
      executionInProgress = true;
      _this.setRunningQueue(next);

      if(next.chainId){
        globalPlan.startChain(next.chainId, next.uId, next.inputValues, next.customValues)
          .then(()=>{
            _this.setEndedQueue(next);
            executionInProgress = false;
            _this.startExecutionQueue();
          })
          .catch(err => {
            logger.log("error", `queueSubscription startExecutionQueue: startChain ${next.chainId} / ${next.uId}`, err);
          });
      }else{
        let chain = globalPlan.getChainById(next.chain.id,next.chain.uId);

        const options = {};
        options.waitEndChilds = true;

        if(next.retries){
          options.retries = next.retries;
        }

        chain.startProcesses(options,next.processId);

        executionInProgress = false;
        _this.startExecutionQueue();
      }

    }else{
      if(!executionInProgress){
        setTimeout(()=>{
          _this.startExecutionQueue();
        }, refreshInterval);
      }
    }
  }

  //Only for Zero Queue:
  startExecutionQueueZero() {
    let _this = this;

    let next = _this.getNext();
    if (next){
      globalPlan.startChain(next.chainId, next.uId, next.inputValues, next.customValues)
        .then(()=>{})
        .catch(err => {
          logger.log("error", `queueSubscription startExecutionQueueZero: startChain ${next.chainId} / ${next.uId} - ${next.id}`, err);
        });
      _this.setRunningQueue(next);
      _this.startExecutionQueueZero();
    }else{
      setTimeout(() => {
        _this.startExecutionQueueZero();
      }, refreshInterval);
    }
  }

  getNext(){
    let _this = this;
    try {
      return global.processQueues[_this.queue].shift();
    }
    catch (err){
      return null;
    }
  }

  setRunningQueue(chainData){
    let _this = this;
    let queueSecureName = crypto.createHash("sha256").update(_this.queue + "run").digest("hex");

    if(!global.processQueues[_this.queue + "_" + queueSecureName + "_RUN"]){
      global.processQueues[_this.queue + "_" + queueSecureName + "_RUN"] = [];
    }

    global.processQueues[_this.queue + "_" + queueSecureName + "_RUN"].push(chainData);
  }

  setEndedQueue(chain){
    let _this = this;
    let queueSecureName = crypto.createHash("sha256").update(_this.queue + "end").digest("hex");

    if(!global.processQueues[_this.queue + "_" + queueSecureName + "_END"]){
      global.processQueues[_this.queue + "_" + queueSecureName + "_END"] = [];
    }

    global.processQueues[_this.queue + "_" + queueSecureName + "_END"].push(chain);
  }

}

module.exports = queueSubscription;