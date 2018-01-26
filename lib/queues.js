"use strict";

const queueSubscription = require("./classes/queueSubscription.js");
const utils = require("./utils.js");
const logger = utils.logger;

let queues = ["zero"];
global.processQueues = [];

module.exports = () => {

  let chainsLength = global.runtimePlan.plan.chains.length;
  while (chainsLength--) {
    const chain = global.runtimePlan.plan.chains[chainsLength];
    if (chain.queue){
      if(queues.indexOf(chain.queue) === -1) queues.push(chain.queue);
    }

    let processLength = chain.processes.length;
    while (processLength--) {
      const process = chain.processes[processLength];
      if (process.queue && process.queue !== "") {

        if(chain.queue === process.queue){
          logger.log("warn", `Error, declaration of blocking queues. Chain (${chain.id}) and child process (${process.id}) with the same queue (${process.queue}): Process queue ignored.`);
          delete process.queue;
        }

        if (queues.indexOf(process.queue) === -1) queues.push(process.queue);
      }
    }
  }

  for (const queue of queues) {
    let subscriptionData = {};
    subscriptionData.queue = queue;
    new queueSubscription(subscriptionData);
  }
};