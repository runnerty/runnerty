"use strict";

const utils = require("./utils.js");
const logger = utils.logger;
const path = require("path");
const loadGeneralConfig = utils.loadGeneralConfig;
const loadCalendars = utils.loadCalendars;
const loadQueueNotifications = utils.loadQueueNotifications;
const loadMongoHistory = utils.loadMongoHistory;
const loadWSAPI = utils.loadWSAPI;

const FilePlan = require("./classes/filePlan.js");

function init(configFilePath, restorePlan, filePlanPath){
  return new Promise((resolve,reject) => {
    //Global classes:
    global.ExecutionClass = require("./classes/execution.js");
    global.NotificationClass = require("./classes/notification.js");
    global.TriggerClass = require("./classes/trigger.js");
    global.libUtils = utils;

    let config;
    //LOAD GENERAL CONFIG:
    loadGeneralConfig(configFilePath)
      .then(async (fileConfig) => {
        logger.log("info", `RUNNERTY v${require("../package.json").version} RUNNING - TIME...: ${new Date()}`);
        config = fileConfig;
        global.config = config;
        if (!config.general.planFilePath){
          config.general.planFilePath = path.join(path.dirname(configFilePath), "plan.json");
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

        new FilePlan(fileLoad, config)
          .then(async (filePlan) => {
            global.runtimePlan = filePlan;
            filePlan.plan.scheduleChains();
            await loadWSAPI();
            resolve();
          })
          .catch((err) => {
            logger.log("error", err);
            reject(err);
          });
      })
      .catch((err) => {
        logger.log("error", err);
        reject(err);
      });
  });
}

module.exports.init = init;