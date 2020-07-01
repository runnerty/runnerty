'use strict';

const utils = require('./utils.js');
const isUrl = utils.isUrl;
const logger = require('./logger.js');
const path = require('path');
const loadGeneralConfig = utils.loadGeneralConfig;
const loadRemoteGeneralConfig = utils.loadRemoteGeneralConfig;
const loadCalendars = utils.loadCalendars;
const loadQueueNotifications = utils.loadQueueNotifications;
const loadWSAPI = utils.loadWSAPI;
const loadServers = utils.loadServers;
const runnertyio = require('./classes/runnertyio.js');
const FilePlan = require('./classes/filePlan.js');
const version = require('../package.json').version;

async function init(configFilePath, filePlanPath, config_user, config_password) {
  try {
    //Global classes:
    global.ExecutionClass = require('./classes/execution.js');
    global.NotificationClass = require('./classes/notification.js');
    global.TriggerClass = require('./classes/trigger.js');
    global.libUtils = utils;

    let config;

    //LOAD GENERAL CONFIG:
    // Check if config file is an URL:
    if (isUrl(configFilePath)) {
      config = await loadRemoteGeneralConfig(configFilePath, config_user, config_password);
    } else {
      config = await loadGeneralConfig(configFilePath);
    }

    logger.log('info', `RUNNERTY v${version} RUNNING - TIME...: ${new Date()}`);
    global.config = config;

    //LOAD FILE PLAN:
    if (!config.general.planFilePath) {
      config.general.planFilePath = configFilePath.replace(path.basename(configFilePath), 'plan.json');
    }
    filePlanPath = filePlanPath ? filePlanPath : config.general.planFilePath;

    // RUNNERTY.IO CONNECTION:
    if (
      config.general['runnerty.io'].hasOwnProperty('apikey') &&
      config.general['runnerty.io']['apikey'] !== '' &&
      !config.general['runnerty.io'].disable
    ) {
      runnertyio.init(config.general['runnerty.io']);
    }

    // QUEUE NOTIFICATIONS:
    await loadQueueNotifications();

    //CALENDARS
    await loadCalendars();

    //SERVERS
    global.servers = {};
    await loadServers();

    // PLAN

    const filePlan = new FilePlan(filePlanPath, config.general.plan, config_user, config_password);
    global.runtimePlan = await filePlan.init();
    global.runtimePlan.plan.scheduleChains();
    await loadWSAPI();
    require('./queues.js').init();
  } catch (err) {
    logger.log('error', `Error in runnerty init. ${err || ''}`);
    throw err;
  }
}

module.exports.init = init;
