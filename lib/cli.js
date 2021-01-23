'use strict';

const program = require('commander');
const utils = require('./utils.js');
const path = require('path');
const encrypt = utils.encrypt;
const version = require('../package.json').version;
const runtime = require('./classes/runtime');

class Cli {
  constructor() {
    this.configFilePath = path.join(process.cwd(), 'config.json');
    process.title = require('../package.json').name;
    this.setOptions();
    this.runCli();
  }

  get program() {
    return program;
  }

  async runCli() {
    /* eslint-disable no-console */
    if (program.password) {
      runtime.cryptoPassword = program.password;
    }

    if (program.memorylimit) {
      try {
        const memorylimitSetted = await utils.setMemoryLimit(program.memorylimit);
        console.log(`New memory limit ${memorylimitSetted} successfully setted.`);
        process.exit();
      } catch (err) {
        console.error(err);
        process.exit();
      }
    }

    if (program.encrypt) {
      if (!program.password) {
        console.log('warn', 'Please set --password and --encrypt for encrypt yor password.');
      } else {
        console.log('Your cryped password is: ', encrypt(program.encrypt, program.password));
      }
      process.exit();
    }
    /* eslint-enable no-console */
  }

  setOptions() {
    // CHECK ARGS APP:
    program
      .version('Runnerty ' + version, '-v, --version')
      .option('-c, --config <path>', `set config path. defaults to ${this.configFilePath}`, filePath => {
        this.configFilePath = filePath;
      })
      .option('-p, --plan <plan_path>', 'Overwrite path file plan of config file.')
      .option('-P, --plan <plan_path>', 'Overwrite path file plan of config file.')
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
        'Force chain execution (For development tests). It is possible to set a list of comma separated items'
      )
      .option(
        '-fd, --forceDependents',
        'It should be indicated in case you want the chains that depend on the forces to be executed (For development tests).'
      )
      .option('--end', 'End runnerty on force chain execution (-f) (For development tests).')
      .option(
        '--input_values <inputValues>',
        'Input values for force chain execution (-f) (For development tests): --input_values \'[{"iter1V1":"A","iter1V2":"B"},{"iter21":"1",...]\''
      )
      .option(
        '--custom_values <customValues>',
        'Custom values for force chain execution (-f) (For development tests): --custom_values \'{"customValue_1":"v1",...}\''
      )
      .option('--config_user <config_user>', 'User for remote (url) config file (Basic Auth User)')
      .option('--config_password <config_password>', 'Password for remote (url) config file (Basic Auth Password)')
      .option(
        '-n, --namespace <namespace>',
        'Enable the chains of the indicated namespace. It is possible to set a list of comma separated items'
      )
      .option(
        '-en, --exclude_namespace <namespace>',
        'Disable the chains of the indicated namespace. It is possible to set a list of comma separated items'
      );

    program.parse(process.argv);
  }
}

module.exports = Cli;
