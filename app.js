#!/usr/bin/env node
"use strict";
var program = require('commander');
var utils = require("./libs/utils.js");
var logger = utils.logger;
var path = require('path');
var loadGeneralConfig = utils.loadGeneralConfig;
var loadCalendars = utils.loadCalendars;
var loadQueueNotifications = utils.loadQueueNotifications;
var loadMongoHistory = utils.loadMongoHistory;
var loadAPI = utils.loadAPI;
var mongooseCloseConnection = utils.mongooseCloseConnection;

//Global classes:
global.ExecutionClass = require("./classes/execution.js");
global.NotificationClass = require("./classes/notification.js");
global.libUtils = utils;

var FilePlan = require("./classes/filePlan.js");


var configFilePath = path.join(process.cwd(), 'conf.json');
var config;

var restorePlan = false;

// CHECK ARGS APP:
program
  .version('Runnerty ' + require('./package.json').version)
  .option('-c, --config <path>', `set config path. defaults to ${configFilePath}`, function (filePath) {
    configFilePath = filePath;
  })
  .option('-r, --restore', 'restore backup plan (experimental)', function () {
    restorePlan = true;
  })
  .option('-p, --password <password>', 'Password cryptor', function (argCryptoPassword) {
    global.cryptoPassword = argCryptoPassword;
  });

program.parse(process.argv);

logger.log('info', `RUNNERTY RUNNING - TIME...: ${new Date()}`);

//LOAD GENERAL CONFIG:
loadGeneralConfig(configFilePath)
  .then(function (fileConfig) {
    config = fileConfig;
    global.config = config;
    if (!config.general.planFilePath){
      config.general.planFilePath = path.join(path.dirname(configFilePath), 'plan.json');
    }

    var fileLoad;
    if (restorePlan) {
      if (config.general.binBackup){
        fileLoad = config.general.binBackup;
        global.planRestored = true;
        logger.log('warn', `Retoring plan from ${fileLoad}`);
      }else{
        logger.log('error', `Restoring: binBackup is not set in config`);
        fileLoad = config.general.planFilePath;
        logger.log('warn', `Reloading plan from ${fileLoad}`);
      }
    }
    else {
      fileLoad = config.general.planFilePath;
    }

    // MONGODB HISTORY:
    loadMongoHistory();

    // QUEUE NOTIFICATIONS:
    loadQueueNotifications();

    //CALENDARS
    loadCalendars();

    new FilePlan(fileLoad, config)
      .then(function (plan) {
        global.runtimePlan = plan;
        loadAPI();
      })
      .catch(function (err) {
        logger.log('error', 'FilePlan: ', err);
      });

  })
  .catch(function (err) {
    logger.log('error', `Config file ${configFilePath}: `,err);
  });

//==================================================================
//
process.on('uncaughtException', function (err) {
  logger.log('error', err.stack);
});

process.on('exit', function (err) {
  logger.log('warn', '--> [R]unnerty stopped.', err);
});

process.on('SIGINT', function() {
  mongooseCloseConnection();
});