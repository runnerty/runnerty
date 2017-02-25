"use strict";

var spawn = require("child_process").spawn;

var Execution = require("../../classes/execution.js");

class scpExecutor extends Execution {
  constructor(process) {
    super(process);
  }

  exec() {
    var _this = this;
    var endOptions = {end: 'end'};

    return new Promise(function (resolve, reject) {
      _this.getValues()
        .then((res) => {
          var scpCommand = `scp ${(res.identityFile) ? '-i' : ''} ${res.identityFile} ${res.localFile} ${res.remoteUser}@${res.remoteHost}:${res.remoteFilePath}`;
          endOptions.command_executed = scpCommand;
          var proc = spawn(scpCommand, [], {shell: true});

          var stderr = '';
          proc.stderr.on('data', function (chunk) {
            stderr += chunk;
          });

          proc
            .on('close', function (code, signal) {
              if (code) {
                endOptions.end = 'error';
                endOptions.messageLog = `SCP Error (${scpCommand}): ${signal} / ${stderr}`;
                endOptions.execute_err_return = `SCP Error (${scpCommand}): ${signal} / ${stderr}`;
                _this.end(endOptions, resolve, reject);
              } else {
                endOptions.end = 'end';
                _this.end(endOptions, resolve, reject);
              }
            });
        })
        .catch((err) => {
          endOptions.end = 'error';
          endOptions.messageLog = `SCP Error getValues: ${err}`;
          endOptions.execute_err_return = `SCP Error getValues: ${err}`;
          _this.end(endOptions, resolve, reject);
        });
    });
  }
}

module.exports = scpExecutor;