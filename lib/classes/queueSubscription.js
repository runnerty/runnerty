'use strict';

const logger = require('../logger.js');
const runtime = require('./runtime');
const configQueues = runtime.config.general.queues;
const refreshInterval = configQueues.refreshInterval || 5000;
class queueSubscription {
  constructor(subscription) {
    this.queue = subscription.queue;
    this.executionInProgress = false;

    if (this.queue === 'zero') {
      this.startExecutionQueueZero();
    } else {
      this.startExecutionQueue();
    }
  }

  startExecutionQueue() {
    const next = this.getNext();

    if (next) {
      this.executionInProgress = true;
      this.setRunningQueue(next);

      if (next.chainId) {
        runtime.plan
          .startChain(
            next.chainId,
            next.uId,
            next.input_values,
            next.custom_values_overwrite,
            undefined,
            next.initialProcess
          )
          .then(() => {
            this.removeRunningQueue(next.queue, next.chainId);
            this.executionInProgress = false;
            this.startExecutionQueue();
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

        this.executionInProgress = false;
        this.startExecutionQueue();
      }
    } else {
      if (!this.executionInProgress) {
        setTimeout(() => {
          this.startExecutionQueue();
        }, refreshInterval);
      }
    }
  }

  //Only for Zero Queue:
  startExecutionQueueZero() {
    const next = this.getNext();
    if (next) {
      runtime.plan
        .startChain(
          next.chainId,
          next.uId,
          next.input_values,
          next.custom_values_overwrite,
          undefined,
          next.initialProcess
        )
        .then(() => {
          this.removeRunningQueue(next.queue, next.chainId);
        })
        .catch(err => {
          logger.log(
            'error',
            `queueSubscription startExecutionQueueZero: startChain ${next.chainId} / ${next.uId} - ${next.id}. ${err}`
          );
        });
      this.setRunningQueue(next);
      this.startExecutionQueueZero();
    } else {
      setTimeout(() => {
        this.startExecutionQueueZero();
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
