'use strict';

const commander = require('commander');
const program = new commander.Command();
const utils = require('./utils.js');
const path = require('path');
const newProject = require('./cli/new.js');
const addModule = require('./cli/add.js');
const migrateCrontab = require('./cli/migrate-crontab.js');
const colors = require('colors');
const version = require('../package.json').version;
class Cli {
  constructor() {
    this.configFilePath = path.join(process.cwd(), 'config.json');
    this.options = {};
    this.mustContinue = true;
    process.title = require('../package.json').name;
  }

  async init() {
    this.runCli();
    await this.setOptions();
  }

  get program() {
    return this.options;
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

  async setOptions() {
    program.version(colors.bold(`${colors.green(version)}`), '-v, --version');
    program.version(colors.bold(`${colors.green(version)}`)); // -V
    // CHECK ARGS APP:
    program
      .command('run', { isDefault: true })
      .action((_, _options) => {
        this.options = _options.opts();
      })
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

    // init project:
    program
      .command('new [project]')
      .alias('n')
      .description('create the project')
      .option('-sg, --skip_git', `do not initialize a git repository`)
      .action(async (project, options) => {
        await newProject(project, options);
        this.mustContinue = false;
      })
      .on('--help', () => {
        /* eslint-disable no-console */
        console.log('');
        console.log('Examples:');
        console.log('  $runnerty init my_runnerty_project');
        console.log('  $runnerty init my_runnerty_project -sg');
        /* eslint-enable no-console */
      });

    // add module:
    program
      .command('add <module>')
      .alias('i')
      .description('add runnerty module')
      // config path:
      .option('-c, --config <path>', `set config.json path to add module.`)
      .option('-p, --package <path>', `set package.json path to add module.`, filePath => {
        this.packageFilePath = filePath;
      })
      // without scaffold:
      .option('-ws, --without_scaffold', `do not include scaffolding in add module.`)
      .action(async (module, options) => {
        await addModule(module, options);
        this.mustContinue = false;
      })
      .on('--help', () => {
        /* eslint-disable no-console */
        console.log('');
        console.log('Examples:');
        console.log('  $runnerty add @runnerty/executor-shell');
        console.log('  $runnerty add own_excutor');
        /* eslint-enable no-console */
      });

    // migrate-cron:
    program
      .command('migrate-cron [project] [crontab_path]')
      .alias('mc')
      .description('migrate crontab to new runnerty project')
      .action((project, crontab_path) => {
        migrateCrontab(project, crontab_path);
      })
      .on('--help', () => {
        /* eslint-disable no-console */
        console.log('');
        console.log('Examples:');
        console.log('');
        console.log('  $runnerty migrate-cron my_runnerty_migrated_project');
        console.log('  $runnerty mc my_runnerty_migrated_project /usr/lib/cron/tabs/my_user');
        /* eslint-enable no-console */
      });

    await program.parseAsync(process.argv);
  }
}

module.exports = Cli;
