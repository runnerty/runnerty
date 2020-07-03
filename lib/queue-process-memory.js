'use strict';

const logger = require('./logger.js');
const runtime = require('./classes/runtime');

// Used to order array by priority.
function sortPriority() {
  const sortOrder = -1;
  const priority = 'priority';

  return function (a, b) {
    const result = a[priority] < b[priority] ? -1 : a[priority] > b[priority] ? 1 : 0;
    return result * sortOrder;
  };
}

function queueChain(chain, input_values, custom_values_overwrite) {
  // PROCESSES QUEUES: Create IF NOT EXISTS:
  if (!runtime.processQueues) {
    runtime.processQueues = [];
    runtime.processQueues[chain.queue] = [];
  } else {
    if (!runtime.processQueues.hasOwnProperty(chain.queue)) {
      runtime.processQueues[chain.queue] = [];
    }
  }

  // IF ignore_on_concurrence CHECK IT:
  let ignoreChain = false;
  if (chain.ignore_on_concurrence) {
    // Look for pending executions in your queue
    let queueLength = runtime.processQueues[chain.queue].length;
    while (queueLength-- && !ignoreChain) {
      if (runtime.processQueues[chain.queue][queueLength].chainId === chain.id) {
        ignoreChain = true;
      }
    }

    //RUN QUEUE: look for ongoing executions of the same chain
    const chainQueueRunName = chain.queue + '_RUN';
    if (runtime.processQueues[chainQueueRunName] && runtime.processQueues[chainQueueRunName][chain.id]) {
      ignoreChain = true;
    }
  }

  if (!ignoreChain) {
    const processToQueue = {
      chainId: chain.id,
      uId: chain.uId,
      priority: chain.priority || 0,
      input_values: input_values,
      custom_values_overwrite: custom_values_overwrite,
      queue: chain.queue
    };

    chain.queue_up();

    runtime.processQueues[chain.queue].push(processToQueue);
    // Order by priority:
    runtime.processQueues[chain.queue].sort(sortPriority());
  } else {
    logger.debug(`Chain ${chain.id} ignored, no queued`, chain.id, runtime.processQueues);
  }
}

module.exports.queueChain = queueChain;

function queueProcess(process, chain, options) {
  // QUEUE MEMORY
  process.priority = process.priority || 0;

  // PROCESSES QUEUES: Create IF NOT EXISTS:
  if (!runtime.processQueues.hasOwnProperty(process.queue)) {
    runtime.processQueues[process.queue] = [];
  }

  const processToQueue = {
    processId: process.id,
    uId: process.uId,
    priority: process.priority,
    process: process,
    chain: chain,
    retries: options.retries
  };

  runtime.processQueues[process.queue].push(processToQueue);
  // Order by priority:
  runtime.processQueues[process.queue].sort(sortPriority());
}

module.exports.queueProcess = queueProcess;
