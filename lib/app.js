'use strict';

const init = require('./init.js').init;
const utils = require('./utils.js');
const logger = require('./logger.js');
const cli = require('./cli.js');
const exitHook = require('async-exit-hook');

const cliCmd = new cli();
const program = cliCmd.program;

init(
  cliCmd.configFilePath,
  cliCmd.restorePlan,
  program.plan,
  program.config_user,
  program.config_password
).then(() => {
  utils.forceInitChainExecution(program);
})
  .catch(err => {
    console.error(err);
    process.exit();
  });

process.on('exit', err => {
  if (!process.env.RUNNERTY_TEST)
    logger.log('warn', '--> [R]unnerty stopped.', err);
});


//==================================================================

async function preExit() {
  // if there is a connection with runnerty.io the closing is communicated
  // Wait a maximum of 2 seconds for the api response:
  try {
    if (global.runnertyio && global.runnertyio.haveAccess) {
      await global.runnertyio.send('dead', undefined, 2000);
    }
  } catch (err) {
    logger.log(
      'warn',
      `--> Failed to report unexpected closure to runnerty.io. ${err}`
    );
  }
}

process.on('uncaughtException', err => {
  if (err.code === 'EADDRINUSE') {
    logger.log('error', `Unable to start server: ${err.message}`);
  } else {
    logger.log('error', err.message);
  }
});

exitHook.unhandledRejectionHandler(err => {
  console.log(err);
  logger.log('error', err);
});

exitHook(callback => {
  preExit().then(_ => {
    callback();
  });
});
