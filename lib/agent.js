"use strict";

const utils = require("./utils.js");
const agentSubscription = require("./classes/agentSubscription.js");
const logger = utils.logger;
const configAgent = global.config.general.agent;

module.exports = () => {
  if (configAgent.disabled) {
    logger.log("warn", "Agent is disable.");
  } else {

    // IF AGENT ENABLED AND SUBSCRIPTIONS EMPTY: SET ALL QUEUES:
    if (!configAgent.subscriptions || configAgent.subscriptions.length === 0) {
      logger.log("debug", "Agent subscriptions is empty. All the chain queues and zero queue have been automatically included.");
      let chainsLength = global.runtimePlan.plan.chains.length;
      while (chainsLength--) {
        const chain = global.runtimePlan.plan.chains[chainsLength];
        if (chain.queue){
          if(!configAgent.subscriptions) configAgent.subscriptions = [{"queues":["zero"]}];
          if(!configAgent.subscriptions[0] || configAgent.subscriptions[0].queues.length === 0) configAgent.subscriptions = [{"queues":["zero"]}];
          if(configAgent.subscriptions[0].queues.indexOf(chain.queue) === -1) configAgent.subscriptions[0].queues.push(chain.queue);
        }
      }
    }

    let subscriptionsLength = configAgent.subscriptions.length;
    while (subscriptionsLength--) {

      for (const queue of configAgent.subscriptions[subscriptionsLength].queues) {
        let subscriptionData = {};
        subscriptionData = configAgent.subscriptions[subscriptionsLength];
        subscriptionData.queue = queue;
        delete subscriptionData.queues;

        new agentSubscription(subscriptionData);
      }

    }

  }
};