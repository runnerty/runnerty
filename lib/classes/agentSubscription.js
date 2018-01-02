"use strict";

const utils = require("../utils.js");
const crypto = require("crypto");
const logger = utils.logger;
let globalPlan = global.runtimePlan.plan;
const configAgent = global.config.general.agent;
const retryInterval = configAgent.retryInterval || 5000;
let executionInProgress = false;


class agentSubscription {
  constructor(subscription) {
    let _this = this;

    _this.queue = subscription.queue;

    // If host is setted need conection:
    if (subscription.host) {
      _this.typeRemote = true;
    } else {
      _this.typeRemote = false;
    }

    if (_this.queue === "zero"){
      _this.startExecutionQueueZero();
    }else{
      _this.startExecutionQueue();
    }

  }

  startExecutionQueue() {
    let _this = this;

    let nextChain = _this.getNext();

    if (nextChain){
      executionInProgress = true;
      _this.setRunningQueue(nextChain);
      globalPlan.startChain(nextChain.chainId, nextChain.inputValues, nextChain.customValues)
        .then((res)=>{
          _this.setEndedQueue(nextChain);
          executionInProgress = false;
          _this.startExecutionQueue();
        })
        .catch(err => {
          logger.log("error", `subscription startChain ${nextChain.chainId}`, err);
        });

    }else{
      if(!executionInProgress){
        setTimeout(()=>{
          _this.startExecutionQueue();
        }, retryInterval);
      }
    }

  }

  //Only for Zero Queue:
  startExecutionQueueZero() {
    let _this = this;

    let nextChain = _this.getNext();
    if (nextChain){
      globalPlan.startChain(nextChain.chainId, nextChain.inputValues, nextChain.customValues)
        .then(()=>{})
        .catch(err => {
          logger.log("error", `subscription startChain ${nextChain.chainId}`, err);
        });
      _this.setRunningQueue(nextChain);
      _this.startExecutionQueueZero();
    }else{
      setTimeout(() => {
        _this.startExecutionQueueZero();
      }, retryInterval);
    }

  }

  getNext(){
    let _this = this;
    if(_this.typeRemote){
      // TODO remote agent subscripttion
    }else{
      try {
        return global.processQueues[_this.queue].shift();
      }
      catch (err){
        return null;
      }
    }

  }

  setRunningQueue(chainData){
    let _this = this;
    let queueSecureName = crypto.createHash("sha256").update(_this.queue + "run").digest("hex");
    if(_this.typeRemote){
      // TODO remote agent subscripttion
    }else{

      if(!global.processQueues[_this.queue + "_" + queueSecureName + "_RUN"]){
        global.processQueues[_this.queue + "_" + queueSecureName + "_RUN"] = [];
      }

      global.processQueues[_this.queue + "_" + queueSecureName + "_RUN"].push(chainData);
    }

  }

  setEndedQueue(chain){
    let _this = this;
    let queueSecureName = crypto.createHash("sha256").update(_this.queue + "end").digest("hex");
    if(_this.typeRemote){
      // TODO remote agent subscripttion
    }else{
      if(!global.processQueues[_this.queue + "_" + queueSecureName + "_END"]){
        global.processQueues[_this.queue + "_" + queueSecureName + "_END"] = [];
      }

      global.processQueues[_this.queue + "_" + queueSecureName + "_END"].push(chain);
    }

  }

}

module.exports = agentSubscription;