"use strict";

// Used to order array by priority.
function sortPriority() {
  const sortOrder = -1;
  const priority = "priority";

  return function (a,b) {
    let result = (a[priority] < b[priority]) ? -1 : (a[priority] > b[priority]) ? 1 : 0;
    return result * sortOrder;
  };
}

function queueChain(chain) {
  // PROCESSES QUEUES: Create IF NOT EXISTS:
  if (!global.processQueues.hasOwnProperty(chain.queue)) {
    global.processQueues[chain.queue] = [];
  }

  // IF ignore_on_concurrence CHECK IT:
  let ignoreChain = false;
  if (chain.ignore_on_concurrence){
    let queueLength = global.processQueues[chain.queue].length;
    while (queueLength-- && !ignoreChain) {
      if (global.processQueues[chain.queue][queueLength].chainId === chain.chainId){
        ignoreChain = true;
      }
    }
  }

  if (!ignoreChain){
    let processToQueue = {
      "chainId": chain.id,
      "uId": chain.uId,
      "priority": chain.priority || 0,
      "chain": chain
    };

    chain.queue_up();

    global.processQueues[chain.queue].push(processToQueue);
    // Order by priority:
    global.processQueues[chain.queue].sort(sortPriority());
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
    "processId": process.id,
    "uId": process.uId,
    "priority": process.priority,
    "process": process,
    "chain": chain,
    "retries": options.retries
  };

  global.processQueues[process.queue].push(processToQueue);
  // Order by priority:
  global.processQueues[process.queue].sort(sortPriority());
}

module.exports.queueProcess = queueProcess;