'use strict';

const queueSubscription = require('./classes/queue-subscription.js');
const runtime = require('./classes/runtime');
const logger = require('./logger.js');

const queues = ['zero'];
runtime.processQueues = [];

module.exports.init = function init() {
  let chainsLength = runtime.plan.chains.length;
  while (chainsLength--) {
    const chain = runtime.plan.chains[chainsLength];
    if (chain.queue) {
      if (queues.indexOf(chain.queue) === -1) queues.push(chain.queue);
    }

    let processLength = chain.processes.length;
    while (processLength--) {
      const process = chain.processes[processLength];
      if (process.queue && process.queue !== '') {
        if (chain.queue === process.queue) {
          logger.log(
            'warn',
            `Error, declaration of blocking queues. Chain (${chain.id}) and child process (${process.id}) with the same queue (${process.queue}): Process queue ignored.`
          );
          delete process.queue;
        }

        if (queues.indexOf(process.queue) === -1) queues.push(process.queue);
      }
    }
  }

  for (const queue of queues) {
    const subscriptionData = {};
    subscriptionData.queue = queue;
    runtime.queueSubscriptions.push(new queueSubscription(subscriptionData));
  }
};
