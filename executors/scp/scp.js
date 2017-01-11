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
      process.loadExecutorConfig()
        .then((configValues) => {
          // identityFile
          var identityFile = _this.replaceWith(process.exec.identityFile || configValues.identityFile, process.values());
          if (identityFile && identityFile !== '') {
            identityFile = '-i ' + identityFile;
          }
          //localFile
          var localFile = _this.replaceWith(process.exec.localFile, process.values());
          //remoteUser
          var remoteUser = _this.replaceWith(process.exec.remoteUser || configValues.remoteUser, process.values());
          //remoteHost
          var remoteHost = _this.replaceWith(process.exec.remoteHost || configValues.remoteHost, process.values());
          //remoteFilePath
          var remoteFilePath = _this.replaceWith(process.exec.remoteFilePath, process.values());

          var scpCommand = `scp ${identityFile} ${localFile} ${remoteUser}@${remoteHost}:${remoteFilePath}`;
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
        });
    });
  }
}

module.exports = scpExecutor;