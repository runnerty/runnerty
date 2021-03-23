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
const runnertyio = require('./classes/runnerty-io.js');
const FilePlan = require('./classes/file-plan.js');
const runtime = require('./classes/runtime');
const version = require('../package.json').version;

async function init(configFilePath, program) {
  try {
    let config;

    let filePlanPath = program.plan;
    const config_user = program.config_user;
    const config_password = program.config_password;
    let namespace = [];
    let exclude_namespace = [];

    if (program.namespace) {
      namespace = program.namespace.split(',');
    }

    if (program.exclude_namespace) {
      exclude_namespace = program.exclude_namespace.split(',');
    }

    //LOAD GENERAL CONFIG:
    // Check if config file is an URL:
    if (isUrl(configFilePath)) {
      config = await loadRemoteGeneralConfig(configFilePath, config_user, config_password);
    } else {
      config = await loadGeneralConfig(configFilePath);
    }
    runtime.config = config;

    let namespaceMsg = '';
    if (namespace.length) {
      namespaceMsg = `${namespaceMsg} - NAMESPACE: ${namespace}`;
    }

    if (exclude_namespace.length) {
      namespaceMsg = `${namespaceMsg} - EXCLUDED NAMESPACE: ${exclude_namespace}`;
    }

    logger.log('info', `RUNNERTY v${version} RUNNING - TIME...: ${new Date()}${namespaceMsg}`);

    //LOAD FILE PLAN:
    if (!config.general.planFilePath) {
      config.general.planFilePath = configFilePath.replace(path.basename(configFilePath), 'plan.json');
    }
    filePlanPath = filePlanPath ? filePlanPath : config.general.planFilePath;

    // QUEUE NOTIFICATIONS:
    await loadQueueNotifications();

    //CALENDARS
    await loadCalendars(configFilePath);

    //SERVERS
    await loadServers();

    // PLAN
    const filePlan = new FilePlan(filePlanPath, config.general.plan, config_user, config_password);
    const filePlanInit = await filePlan.init(namespace, exclude_namespace);
    runtime.planePlanChains = filePlanInit.planeFileChains;

    // RUNNERTY.IO CONNECTION:
    if (
      config.general['runnerty.io'].hasOwnProperty('apikey') &&
      config.general['runnerty.io']['apikey'] !== '' &&
      !config.general['runnerty.io'].disable
    ) {
      await runnertyio.init(config.general['runnerty.io']);
    }

    // INIT PLAN
    filePlanInit.plan = await filePlanInit.plan.init();
    runtime.plan = filePlanInit.plan;

    // SCHEDULE PLAN
    runtime.plan.scheduleChains();
    await loadWSAPI();
    require('./queues.js').init();
  } catch (err) {
    throw err;
  }
}

module.exports.init = init;
