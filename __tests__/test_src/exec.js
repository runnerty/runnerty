'use strict';

const spawn = require('child_process').spawn;

function _exec(cmd, args, timeOut, callback) {
  let stdout = '';

  const shell = spawn(cmd, args, { shell: true });

  if (timeOut) {
    setTimeout(() => {
      shell.kill();
      callback(stdout.toString());
    }, timeOut);
  }

  shell.stdout.on('data', chunk => {
    stdout += chunk;
  });

  shell.on('close', (code, signal) => {
    callback(stdout.toString());
  });
}

module.exports = _exec;
