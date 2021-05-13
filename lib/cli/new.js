'use strict';
/* eslint-disable no-console */

const fs = require('fs-extra');
const fsp = require('fs').promises;
const path = require('path');
const colors = require('colors');
const execute = require('./lib/exec');
const version = require('../../package.json').version;

async function newProject(project, options) {
  project = project || 'runnerty_sample_project';
  const scaffoldProject = './base';
  const sample_dir_path = path.join(__dirname, scaffoldProject);
  const destination_path = path.join(process.cwd(), project);

  try {
    await fs.copy(sample_dir_path, destination_path);
    try {
      await fsp.rename(path.join(destination_path, 'gitignore'), path.join(destination_path, '.gitignore'));
    } catch (err) {}
    const destinationPackage = path.join(destination_path, 'package.json');
    const content = JSON.parse(fs.readFileSync(destinationPackage, 'utf8'));
    content.name = project;
    // Runnerty version:
    if (version && content.dependencies.runnerty) {
      content.dependencies.runnerty = version;
    }
    await fs.writeFile(destinationPackage, JSON.stringify(content));
    console.log(colors.bold(`${colors.bgGreen('√')} Formatting package.json with Prettier.`));
    await execute(`npx prettier --write ${destinationPackage}`, null);

    console.log(colors.bold('Please wait, running npm install...'));
    await execute(`npm install --prefix ${destination_path} ${destination_path}`, null);
    console.log(colors.bold(`${colors.bgGreen('√')} npm installation finish.`));

    // Git
    if (!options.skip_git) {
      try {
        console.log(colors.bold('Initializing git project...'));
        await execute(`git --work-tree=${destination_path} --git-dir=${destination_path}/.git init`);
        await execute(`git --work-tree=${destination_path} --git-dir=${destination_path}/.git add --all`);
        await execute(
          `git --work-tree=${destination_path} --git-dir=${destination_path}/.git commit --author="Runnerty <hello@runnerty.io>" -m "first commit"`
        );
      } catch (err) {
        throw new Error('Error initializing git project');
      }
    }

    console.log(
      colors.bold(
        `${colors.green('✔')} Sample project ${colors.green(project)} has been created in ${colors.green(
          destination_path
        )}\n`
      )
    );
  } catch (err) {
    console.error(colors.bold(`${colors.red('✖')}`, err.message || 'Error cloning repo.'));
  }
}
module.exports = newProject;
