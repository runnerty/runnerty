'use strict';
/* eslint-disable no-console */

const CronParser = require('./lib/crontab-parser.js');
const crontabMigration = require('./lib/crontab-migration.js');
const colors = require('colors');
const execute = require('./lib/exec');
const fs = require('fs-extra');
const path = require('path');

const schemas = {
  config: {
    schema: 'https://raw.githubusercontent.com/runnerty/schemas/master/schemas/3.2/config.json'
  },
  plan_chains_link: {
    schema: 'https://raw.githubusercontent.com/runnerty/schemas/master/schemas/3.2/plan-chains-link.json'
  },
  chains: {
    schema: 'https://raw.githubusercontent.com/runnerty/schemas/master/schemas/3.2/chain.json'
  }
};

async function cloneBaseProject(project) {
  project = project || 'runnerty_migration_project';
  const sample_dir_path = path.join(__dirname, './base-migration/');
  const detination_path = path.join(process.cwd(), project);

  try {
    await fs.copy(sample_dir_path, detination_path);
  } catch (err) {
    console.error(colors.bold(`${colors.red('✖')} Error `, err));
  }
}

async function migrateCrontab(project, crontabPath) {
  const projectPath = path.join(process.cwd(), project || 'runnerty_migration_project');
  let crontabContent;
  if (!crontabPath) {
    try {
      crontabContent = await execute('crontab -l');
    } catch (err) {
      console.error(
        colors.bold(`${colors.red('✖')} crontab is not found. Please set crontab_path and retry: `, err.message)
      );
    }
  } else {
    try {
      crontabContent = fs.readFileSync(crontabPath, 'UTF-8');
    } catch (err) {
      console.error(colors.bold(`${colors.red('✖')} Crontab file not found: ${crontabPath}.`));
    }
  }

  if (crontabContent) {
    await cloneBaseProject(project);

    const cronParser = new CronParser(crontabContent);
    new crontabMigration(cronParser, schemas, projectPath);
    console.log(
      colors.bold(
        `${colors.green('✔')} The project ${colors.green(project)} has been migrated in ${colors.green(projectPath)}\n`
      )
    );
  }
}

module.exports = migrateCrontab;
