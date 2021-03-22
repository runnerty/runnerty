'use strict';

const init = require('./init.js').init;
const utils = require('./utils.js');
const logger = require('./logger.js');
const cli = require('./cli.js');
const runnertyio = require('./classes/runnerty-io.js');
const runtime = require('./classes/runtime');
const sleep = require('util').promisify(setTimeout);
const updateNotifier = require('update-notifier');
const pkg = require('../package.json');
updateNotifier({ pkg, updateCheckInterval: 0 }).notify();

const cliCmd = new cli();
const program = cliCmd.program;
var exitRequest = 0;

main();

async function main() {
  try {
    await init(cliCmd.configFilePath, program);
    utils.forceInitChainExecution(program);
  } catch (err) {
    if (process.env.RUNNERTY_DEBUG || process.env.RUNNERTY_TEST) {
      // eslint-disable-next-line no-console
      console.error(err);
    } else {
      logger.log('error', err);
    }
    process.exit();
  }
}

process.on('exit', err => {
  if (!process.env.RUNNERTY_TEST) logger.log('warn', '--> [R]unnerty stopped.', err);
});

//==================================================================

async function getChainsRunning() {
  let chainsRunning = [];
  for (const chain of runtime.plan.chains) {
    if (chain.status === 'running') {
      chainsRunning.push(chain.id);
    }
  }
  return [chainsRunning.length, chainsRunning];
}

async function waitChainsEnds() {
  await sleep(1000);
  const [isChainsRunning, chainsRunning] = await getChainsRunning();
  if (isChainsRunning) await waitChainsEnds();
}

async function preExit() {
  exitRequest += 1;
  try {
    // If request a second exit it´s finish:
    if (exitRequest > 1) process.exit();

    const [isChainsRunning, chainsRunning] = await getChainsRunning();
    if (isChainsRunning) {
      logger.log(
        'warn',
        `There are chains running at this time (${chainsRunning}), the process will be closed when all are finished or you can force close.`
      );
      await waitChainsEnds();
    }
    // if there is a connection with runnerty.io the closing is communicated
    // Wait a maximum of 2 seconds for the api response:
    if (runnertyio && runnertyio.haveAccess) {
      runnertyio.send('dead', undefined).then(_ => {
        process.exit();
      });
      await sleep(2000);
    }
    process.exit();
  } catch (err) {
    logger.log('warn', `--> Failed to report unexpected closure to runnerty.io. ${err}`);
  }
}

process.on('unhandledRejection', err => {
  if (process.env.RUNNERTY_DEBUG || process.env.RUNNERTY_TEST) {
    // eslint-disable-next-line no-console
    console.error(err);
  } else {
    logger.log('error', err);
  }
});

process.on('uncaughtException', err => {
  if (err.code === 'EADDRINUSE') {
    logger.log('error', `Unable to start server: ${err.message}`);
  } else {
    logger.log('error', err.message);
  }
});

process.stdin.resume();

function exitHandler() {
  preExit();
}

process.on('exit', exitHandler.bind());

process.on('SIGINT', exitHandler.bind());
