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

function init(configFilePath, restorePlan, filePlanPath, config_user, config_password) {
  return new Promise(async (resolve, reject) => {
    //Global classes:
    global.ExecutionClass = require('./classes/execution.js');
    global.NotificationClass = require('./classes/notification.js');
    global.TriggerClass = require('./classes/trigger.js');
    global.libUtils = utils;

    let config;

    //LOAD GENERAL CONFIG:
    // Check if config file is an URL:
    try {
      if (isUrl(configFilePath)) {
        config = await loadRemoteGeneralConfig(configFilePath, config_user, config_password);
      } else {
        config = await loadGeneralConfig(configFilePath);
      }
    } catch (err) {
      reject(err);
    }

    logger.log('info', `RUNNERTY v${version} RUNNING - TIME...: ${new Date()}`);
    global.config = config;

    //LOAD FILE PLAN:
    if (!config.general.planFilePath) {
      config.general.planFilePath = configFilePath.replace(path.basename(configFilePath), 'plan.json');
    }
    filePlanPath = filePlanPath ? filePlanPath : config.general.planFilePath;

    let fileLoad;
    if (restorePlan) {
      if (config.general.binBackup) {
        fileLoad = config.general.binBackup;
        global.planRestored = true;
        logger.log('warn', `Restoring plan from ${fileLoad}`);
      } else {
        logger.log('error', 'Restoring: binBackup is not set in config');
        fileLoad = filePlanPath;
        logger.log('warn', `Reloading plan from ${fileLoad}`);
      }
    } else {
      fileLoad = filePlanPath;
    }

    try {
      // RUNNERTY.IO CONNECTION:
      if (
        config.general['runnerty.io'].hasOwnProperty('apikey') &&
        config.general['runnerty.io']['apikey'] !== '' &&
        !config.general['runnerty.io'].disable
      ) {
        runnertyio.init(config.general['runnerty.io']);
        await runnertyio.checkAccess();
      }

      // QUEUE NOTIFICATIONS:
      await loadQueueNotifications();

      //CALENDARS
      await loadCalendars();

      //SERVERS
      global.servers = {};
      await loadServers();
    } catch (err) {
      reject(err);
    }

    // PLAN
    try {
      const filePlan = new FilePlan(fileLoad, config.general.plan, config_user, config_password);
      global.runtimePlan = await filePlan.init();
      global.runtimePlan.plan.scheduleChains();
      await loadWSAPI();
      require('./queues.js').init();
      resolve();
    } catch (err) {
      logger.log('error', `Error in reading the plan file. ${err || ''}`);
      reject(err);
    }
  });
}

module.exports.init = init;
