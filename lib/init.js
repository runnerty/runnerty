"use strict";

const utils = require("./utils.js");
const isUrl = require("./utils.js").isUrl;
const logger = utils.logger;
const path = require("path");
const loadGeneralConfig = utils.loadGeneralConfig;
const loadRemoteGeneralConfig = utils.loadRemoteGeneralConfig;
const loadCalendars = utils.loadCalendars;
const loadQueueNotifications = utils.loadQueueNotifications;
const loadMongoHistory = utils.loadMongoHistory;
const loadWSAPI = utils.loadWSAPI;
const loadAgent = utils.loadAgent;

const FilePlan = require("./classes/filePlan.js");

function init(configFilePath, restorePlan, filePlanPath, config_user, config_password){
  return new Promise(async (resolve,reject) => {
    //Global classes:
    global.ExecutionClass = require("./classes/execution.js");
    global.NotificationClass = require("./classes/notification.js");
    global.TriggerClass = require("./classes/trigger.js");
    global.libUtils = utils;
    global.processQueues = {"zero":[]};

    let config;

    //LOAD GENERAL CONFIG:
    // Check if config file is an URL:
    if(isUrl(configFilePath)){
      config = await loadRemoteGeneralConfig(configFilePath, config_user, config_password);
    }else{
      config = await loadGeneralConfig(configFilePath);
    }

    logger.log("info", `RUNNERTY v${require("../package.json").version} RUNNING - TIME...: ${new Date()}`);
    global.config = config;

    //LOAD FILE PLAN:
    if (!config.general.planFilePath){
      config.general.planFilePath = configFilePath.replace(path.basename(configFilePath), "plan.json");
    }
    filePlanPath = filePlanPath?filePlanPath:config.general.planFilePath;

    let fileLoad;
    if (restorePlan) {
      if (config.general.binBackup){
        fileLoad = config.general.binBackup;
        global.planRestored = true;
        logger.log("warn", `Restoring plan from ${fileLoad}`);
      }else{
        logger.log("error", "Restoring: binBackup is not set in config");
        fileLoad = filePlanPath;
        logger.log("warn", `Reloading plan from ${fileLoad}`);
      }
    }
    else {
      fileLoad = filePlanPath;
    }

    // MONGODB HISTORY:
    await loadMongoHistory();

    // QUEUE NOTIFICATIONS:
    await loadQueueNotifications();

    //CALENDARS
    await loadCalendars();

    new FilePlan(fileLoad, config_user, config_password)
      .then(async (filePlan) => {
        global.runtimePlan = filePlan;
        filePlan.plan.scheduleChains();
        await loadWSAPI();
        await loadAgent();
        resolve();
      })
      .catch((err) => {
        logger.log("error", err);
        reject(err);
      });
  });
}

module.exports.init = init;