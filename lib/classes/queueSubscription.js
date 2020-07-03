'use strict';

const logger = require('../logger.js');
const runtime = require('./runtime');
const configQueues = runtime.config.general.queues;
const refreshInterval = configQueues.refreshInterval || 5000;
let executionInProgress = false;

class queueSubscription {
  constructor(subscription) {
    const _this = this;

    _this.queue = subscription.queue;

    if (_this.queue === 'zero') {
      _this.startExecutionQueueZero();
    } else {
      _this.startExecutionQueue();
    }
  }

  startExecutionQueue() {
    const _this = this;

    const next = _this.getNext();

    if (next) {
      executionInProgress = true;
      _this.setRunningQueue(next);

      if (next.chainId) {
        runtime.plan
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
        const chain = runtime.plan.getChainById(next.chain.id, next.chain.uId);

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
    const _this = this;

    const next = _this.getNext();
    if (next) {
      runtime.plan
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
    if (runtime.processQueues[this.queue]) {
      return runtime.processQueues[this.queue].shift();
    } else {
      return null;
    }
  }

  removeRunningQueue(queue, chainId) {
    if (runtime.processQueues[queue + '_RUN']) {
      if (runtime.processQueues[queue + '_RUN'].hasOwnProperty(chainId)) {
        delete runtime.processQueues[queue + '_RUN'][chainId];
      }
    }
  }

  setRunningQueue(chainData) {
    if (!runtime.processQueues[this.queue + '_RUN']) {
      runtime.processQueues[this.queue + '_RUN'] = {};
    }
    runtime.processQueues[this.queue + '_RUN'][chainData.chainId] = chainData;
  }
}

module.exports = queueSubscription;
