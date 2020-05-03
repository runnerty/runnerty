'use strict';

const logger = require('../logger.js');
let globalPlan = global.runtimePlan.plan;
const configQueues = global.config.general.queues;
const refreshInterval = configQueues.refreshInterval || 5000;
let executionInProgress = false;

class queueSubscription {
  constructor(subscription) {
    let _this = this;

    _this.queue = subscription.queue;

    if (_this.queue === 'zero') {
      _this.startExecutionQueueZero();
    } else {
      _this.startExecutionQueue();
    }
  }

  startExecutionQueue() {
    let _this = this;

    let next = _this.getNext();

    if (next) {
      executionInProgress = true;
      _this.setRunningQueue(next);

      if (next.chainId) {
        globalPlan
          .startChain(next.chainId, next.uId, next.input_values, next.custom_values_overwrite)
          .then(() => {
            _this.removeRunningQueue(next.queue, next.chainId);
            executionInProgress = false;
            _this.startExecutionQueue();
          })
          .catch(err => {
            logger.log(
              'error',
              `queueSubscription startExecutionQueue: startChain ${next.chainId} / ${next.uId}. ${err}`
            );
          });
      } else {
        let chain = globalPlan.getChainById(next.chain.id, next.chain.uId);

        const options = {};
        options.waitEndChilds = true;

        options.retries = chain.retries;
        options.retry_delay = chain.retry_delay;

        chain.startProcesses(options, next.processId);

        executionInProgress = false;
        _this.startExecutionQueue();
      }
    } else {
      if (!executionInProgress) {
        setTimeout(() => {
          _this.startExecutionQueue();
        }, refreshInterval);
      }
    }
  }

  //Only for Zero Queue:
  startExecutionQueueZero() {
    let _this = this;

    let next = _this.getNext();
    if (next) {
      globalPlan
        .startChain(next.chainId, next.uId, next.input_values, next.custom_values_overwrite)
        .then(() => {
          _this.removeRunningQueue(next.queue, next.chainId);
        })
        .catch(err => {
          logger.log(
            'error',
            `queueSubscription startExecutionQueueZero: startChain ${next.chainId} / ${next.uId} - ${next.id}. ${err}`
          );
        });
      _this.setRunningQueue(next);
      _this.startExecutionQueueZero();
    } else {
      setTimeout(() => {
        _this.startExecutionQueueZero();
      }, refreshInterval);
    }
  }

  getNext() {
    try {
      return global.processQueues[this.queue].shift();
    } catch (err) {
      return null;
    }
  }

  removeRunningQueue(queue, chainId) {
    if (global.processQueues[queue + '_RUN']) {
      if (global.processQueues[queue + '_RUN'].hasOwnProperty(chainId)) {
        delete global.processQueues[queue + '_RUN'][chainId];
      }
    }
  }

  setRunningQueue(chainData) {
    if (!global.processQueues[this.queue + '_RUN']) {
      global.processQueues[this.queue + '_RUN'] = {};
    }
    global.processQueues[this.queue + '_RUN'][chainData.chainId] = chainData;
  }
}

module.exports = queueSubscription;
