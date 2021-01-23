'use strict';

const boxen = require('boxen');
const chalk = require('chalk');

const pkg = require('../package.json');

// Check NODE version:
const semver = require('semver');

const runnertyVersion = pkg.version;
const engineRequired = pkg.engines.node;
const localNodeVersion = process.versions.node;
const errorTitle = chalk.hex('#f14c4c').bold(`Incompatible Node version`);
const errorMsg = chalk.hex('#fee84a')(
  `Runnerty ${runnertyVersion}\n requires a Node version ${engineRequired} (current ${localNodeVersion})`
);

const msgErrorFormated = boxen(`${errorTitle}\n\n${errorMsg}`, {
  padding: 1,
  margin: 1,
  align: 'center',
  borderStyle: 'double',
  borderColor: '#50bf5a',
  backgroundColor: '#192241'
});

if (!semver.satisfies(localNodeVersion, engineRequired)) {
  // eslint-disable-next-line no-console
  console.log(msgErrorFormated);
  process.exit();
}
