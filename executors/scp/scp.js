"use strict";

var spawn = require("child_process").spawn;

var Execution = require("../../classes/execution.js");

class scpExecutor extends Execution {
  constructor(process) {
    super(process);
  }

  exec(process) {
    var _this = this;

    return new Promise(function (resolve, reject) {
      _this.getValues(process)
        .then((res) => {
          var scpCommand = `scp ${(res.identityFile)?'-i':''} ${res.identityFile} ${res.localFile} ${res.remoteUser}@${res.remoteHost}:${res.remoteFilePath}`;
          var proc = spawn(scpCommand, [], {shell: true});

          var stderr = '';
          proc.stderr.on('data', function (chunk) {
            stderr += chunk;
          });

          proc
            .on('close', function (code, signal) {
              if (code) {
                _this.logger.log('error', `SCP Error (${scpCommand}): ${signal} / ${stderr}`);
                process.execute_err_return = `SCP Error (${scpCommand}): ${signal} / ${stderr}`;
                process.execute_return = '';
                process.error();
                reject(process);
              } else {
                process.execute_err_return = '';
                process.execute_return = '';
                process.end();
                resolve();
              }
            });
        })
        .catch((err) => {
          _this.logger.log('error', `SCP Error getValues: ${err}`);
          process.execute_err_return = `SCP Error getValues ${err}`;
          process.execute_return = '';
          process.error();
          reject(process);
        });
    });
  }
}

module.exports = scpExecutor;