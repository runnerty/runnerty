"use strict";

const spawn = require("child_process").spawn;

function _exec(cmd, args, timeOut, callback) {
  let shell = {};
  let stdout = "";

  shell = spawn(cmd, args, {shell: true});

  shell.stdout.on("data", (chunk) => {
    stdout += chunk;
  });

  shell.on("close", (code, signal) =>{
    callback(stdout.toString());
  });

  if(timeOut){
    setTimeout(() => {
      callback(stdout.toString());
    }, timeOut);    
  }

}

module.exports = _exec;