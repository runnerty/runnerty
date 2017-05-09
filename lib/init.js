"use strict";

var utils = require("./utils.js");
var logger = utils.logger;
var path = require("path");
var loadGeneralConfig = utils.loadGeneralConfig;
var loadCalendars = utils.loadCalendars;
var loadQueueNotifications = utils.loadQueueNotifications;
var loadMongoHistory = utils.loadMongoHistory;
var loadAPI = utils.loadAPI;

//Global classes:
global.ExecutionClass = require("./classes/execution.js");
global.NotificationClass = require("./classes/notification.js");
global.libUtils = utils;

var FilePlan = require("./classes/filePlan.js");

function init(configFilePath, restorePlan){

  //Global classes:
  global.ExecutionClass = require("./classes/execution.js");
  global.NotificationClass = require("./classes/notification.js");
  global.libUtils = utils;


  var config;
  //LOAD GENERAL CONFIG:
  loadGeneralConfig(configFilePath)
    .then(async function (fileConfig) {
      logger.log("info", `RUNNERTY RUNNING - TIME...: ${new Date()}`);
      config = fileConfig;
      global.config = config;
      if (!config.general.planFilePath){
        config.general.planFilePath = path.join(path.dirname(configFilePath), "plan.json");
      }

      var fileLoad;
      if (restorePlan) {
        if (config.general.binBackup){
          fileLoad = config.general.binBackup;
          global.planRestored = true;
          logger.log("warn", `Retoring plan from ${fileLoad}`);
        }else{
          logger.log("error", "Restoring: binBackup is not set in config");
          fileLoad = config.general.planFilePath;
          logger.log("warn", `Reloading plan from ${fileLoad}`);
        }
      }
      else {
        fileLoad = config.general.planFilePath;
      }

      // MONGODB HISTORY:
      await loadMongoHistory();

      // QUEUE NOTIFICATIONS:
      await loadQueueNotifications();

      //CALENDARS
      await loadCalendars();

      new FilePlan(fileLoad, config)
        .then(function (filePlan) {
          global.runtimePlan = filePlan;
          filePlan.plan.scheduleChains();
          loadAPI();
        })
        .catch(function (err) {
          logger.log("error", err);
        });

    })
    .catch(function (err) {
      logger.log("error", err);
    });
}

module.exports.init = init;