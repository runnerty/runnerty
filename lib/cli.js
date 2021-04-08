'use strict';

const commander = require('commander');
const program = new commander.Command();
const utils = require('./utils.js');
const path = require('path');
const version = require('../package.json').version;
class Cli {
  constructor() {
    this.configFilePath = path.join(process.cwd(), 'config.json');
    process.title = require('../package.json').name;
    this.setOptions();
    this.runCli();
  }

  get program() {
    return program.opts();
  }

  async runCli() {
    /* eslint-disable no-console */

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
      .option(
        '-m, --memorylimit <memory_limit_Mb>',
        'Set default memory space limit for Runnerty (--max-old-space-size). It is necessary to restart Runnerty.'
      )
      .option(
        '-f, --force_chain_exec <chain_id>',
        'Force chain execution (For development tests). It is possible to set a list of comma separated items'
      )
      .option(
        '-fp, --force_process <proccess_id>',
        'Force process execution. You must also indicate the chain_id. For development tests).'
      )
      .option(
        '-fd, --force_chain_dependents',
        'It should be indicated in case you want the chains that depend on the forced chains to be executed (For development tests).'
      )
      .option(
        '-fpd, --force_process_dependents',
        'It should be indicated in case you want the processes that depend on the forced processes to be executed (For development tests).'
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
