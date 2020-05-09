'use strict';

const logger = require('./logger.js');

// Used to order array by priority.
function sortPriority() {
  const sortOrder = -1;
  const priority = 'priority';

  return function (a, b) {
    let result = a[priority] < b[priority] ? -1 : a[priority] > b[priority] ? 1 : 0;
    return result * sortOrder;
  };
}

function queueChain(chain, input_values, custom_values_overwrite) {
  // PROCESSES QUEUES: Create IF NOT EXISTS:
  if (!global.processQueues) {
    global.processQueues = [];
    global.processQueues[chain.queue] = [];
  } else {
    if (!global.processQueues.hasOwnProperty(chain.queue)) {
      global.processQueues[chain.queue] = [];
    }
  }

  // IF ignore_on_concurrence CHECK IT:
  let ignoreChain = false;
  if (chain.ignore_on_concurrence) {
    // Look for pending executions in your queue
    let queueLength = global.processQueues[chain.queue].length;
    while (queueLength-- && !ignoreChain) {
      if (global.processQueues[chain.queue][queueLength].chainId === chain.id) {
        ignoreChain = true;
      }
    }

    //RUN QUEUE: look for ongoing executions of the same chain
    let chainQueueRunName = chain.queue + '_RUN';
    if (global.processQueues[chainQueueRunName] && global.processQueues[chainQueueRunName][chain.id]) {
      ignoreChain = true;
    }
  }

  if (!ignoreChain) {
    let processToQueue = {
      chainId: chain.id,
      uId: chain.uId,
      priority: chain.priority || 0,
      input_values: input_values,
      custom_values_overwrite: custom_values_overwrite,
      queue: chain.queue
    };

    chain.queue_up();

    global.processQueues[chain.queue].push(processToQueue);
    // Order by priority:
    global.processQueues[chain.queue].sort(sortPriority());
  } else {
    logger.debug(`Chain ${chain.id} ignored, no queued`, chain.id, global.processQueues);
  }
}

module.exports.queueChain = queueChain;

function queueProcess(process, chain, options) {
  // QUEUE MEMORY
  process.priority = process.priority || 0;

  // PROCESSES QUEUES: Create IF NOT EXISTS:
  if (!global.processQueues.hasOwnProperty(process.queue)) {
    global.processQueues[process.queue] = [];
  }

  let processToQueue = {
    processId: process.id,
    uId: process.uId,
    priority: process.priority,
    process: process,
    chain: chain,
    retries: options.retries
  };

  global.processQueues[process.queue].push(processToQueue);
  // Order by priority:
  global.processQueues[process.queue].sort(sortPriority());
}

module.exports.queueProcess = queueProcess;
