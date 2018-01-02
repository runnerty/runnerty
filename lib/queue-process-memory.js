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

function queue(chainId, options) {
  // QUEUE MEMORY
  const _options = options || {};

  _options.queue = _options.queue || "zero";
  _options.priority = _options.priority || 0;

  // PROCESSES QUEUES: Create IF NOT EXISTS:
  if (!global.processQueues.hasOwnProperty(_options.queue)) {
    global.processQueues[_options.queue] = [];
  }

  // IF ignore_on_concurrence CHECK IT:
  let ignoreChain = false;
  if (_options.ignore_on_concurrence){
    let queueLength = global.processQueues[_options.queue].length;
    while (queueLength-- && !ignoreChain) {
      if (global.processQueues[_options.queue][queueLength].chainId === chainId){
        ignoreChain = true;
      }
    }
  }

  if (!ignoreChain){
    let processToQueue = {
      "chainId": chainId,
      "options": _options,
      "priority": _options.priority
    };

    global.processQueues[_options.queue].push(processToQueue);
    // Order by priority:
    global.processQueues[_options.queue].sort(sortPriority());
  }
}

module.exports.queue = queue;