"use strict";

const spawn = require("child_process").spawn;

function _exec(cmd, args, timeOut, callback) {
  let shell = {};
  let stdout = "";

  shell = spawn(cmd, args, {shell: true});

  shell.stdout.on("data", function (chunk) {
    stdout += chunk;
  });

  shell.on("close", function (code, signal) {
    callback(stdout.toString());
  });

  setTimeout(() => {
    callback(stdout.toString());
  }, timeOut);
}

module.exports = _exec;