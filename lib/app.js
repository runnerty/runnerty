'use strict';

const program = require('commander');
const init = require('./init.js').init;
const utils = require('./utils.js');
const logger = require('./logger.js');
const path = require('path');
const encrypt = utils.encrypt;
const exitHook = require('async-exit-hook');

let configFilePath = path.join(process.cwd(), 'config.json');
let restorePlan = false;

process.title = require('../package.json').name;
global.version = require('../package.json').version;

// ASYNC INIT:
(async () => {
  // CHECK ARGS APP:
  program
    .version('Runnerty ' + global.version, '-v, --version')
    .option(
      '-c, --config <path>',
      `set config path. defaults to ${configFilePath}`,
      filePath => {
        configFilePath = filePath;
      }
    )
    .option(
      '-p, --plan <plan_path>',
      'Overwrite path file plan of config file.'
    )
    .option(
      '-P, --plan <plan_path>',
      'Overwrite path file plan of config file.'
    )
    .option('-r, --restore', 'restore backup plan (experimental)', () => {
      restorePlan = true;
    })
    .option('--password <password>', 'Master cryptor password')
    .option(
      '-e, --encrypt <password_to_encrypt>',
      'Util: Encrypt password (to use crypted_password in config instead of literal password)'
    )
    .option(
      '-m, --memorylimit <memory_limit_Mb>',
      'Set default memory space limit for Runnerty (--max-old-space-size). It is necessary to restart Runnerty.'
    )
    .option(
      '-f, --force_chain_exec <chainId>',
      'Force chain execution (For development tests).'
    )
    .option(
      '--end',
      'End runnerty on force chain execution (-f) (For development tests).'
    )
    .option(
      '--input_values <inputValues>',
      'Input values for force chain execution (-f) (For development tests).'
    )
    .option(
      '--custom_values <customValues>',
      'Custom values for force chain execution (-f) (For development tests).'
    )
    .option(
      '--config_user <config_user>',
      'User for remote (url) config file (Basic Auth User)'
    )
    .option(
      '--config_password <config_password>',
      'Password for remote (url) config file (Basic Auth Password)'
    );

  program.parse(process.argv);
  if (program.password) {
    global.cryptoPassword = program.password;
  }

  /* eslint-disable no-console */

  if (program.memorylimit) {
    await utils
      .setMemoryLimit(program.memorylimit)
      .then(memorylimitSetted => {
        console.log(
          `New memory limit ${memorylimitSetted} successfully setted.`
        );
        process.exit();
      })
      .catch(err => {
        console.error(err);
        process.exit();
      });
  }

  // INIT:
  init(
    configFilePath,
    restorePlan,
    program.plan,
    program.config_user,
    program.config_password
  )
    .then(() => {
      if (program.encrypt) {
        if (!program.password) {
          console.log(
            'warn',
            'Please set --password and --encrypt for encrypt yor password.'
          );
        } else {
          console.log(
            'Your cryped password is: ',
            encrypt(program.encrypt, program.password)
          );
        }
        process.exit();
      }

      utils.forceInitChainExecution(program);
    })
    .catch(err => {
      console.error(err);
      process.exit();
    });

  /* eslint-enable no-console */

  process.on('exit', async err => {
    if (!process.env.RUNNERTY_TEST)
      logger.log('warn', '--> [R]unnerty stopped.', err);
  });
})();

//==================================================================
//

async function preExit() {
  // if there is a connection with runnerty.io the closing is communicated
  // Wait a maximum of 2 seconds for the api response:
  try {
    if (global.runnertyio && global.runnertyio.haveAccess) {
      await global.runnertyio.send('dead', undefined, 2000).catch(err => {
        logger.log(
          'warn',
          `--> Failed to report unexpected closure to runnerty.io. ${err}`
        );
      });
    }
  } catch (err) {
    logger.log(
      'warn',
      `--> Failed to report unexpected closure to runnerty.io. ${err}`
    );
  }
}

exitHook.uncaughtExceptionHandler(err => {
  logger.log('error', err);
});

// You can hook unhandled rejections with unhandledRejectionHandler()
exitHook.unhandledRejectionHandler(err => {
  logger.log('error', err);
});

exitHook(callback => {
  preExit().then(_ => {
    callback();
  });
});
