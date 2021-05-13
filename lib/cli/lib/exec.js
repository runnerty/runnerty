'use strict';

const { spawn } = require('child_process');

function execute(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { shell: true });
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    child.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject();
      }
    });
    child.on('error', err => {
      reject(err);
    });
  });
}

module.exports = execute;
