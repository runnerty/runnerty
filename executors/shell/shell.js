"use strict";

var spawn = require("child_process").spawn;
var psTree = require('ps-tree');

var Execution = require("../../classes/execution.js");

class shellExecutor extends Execution {
  constructor(process) {
    super(process);
  }

  exec(process) {
    var _this = this;

    var cmd = process.exec.command;

    return new Promise(function (resolve, reject) {
      var stdout = '';
      var stderr = '';

      process.execute_args = process.getArgs();

      process.proc = spawn(cmd, process.execute_args, {shell: true});
      process.command_executed = cmd + ' ' + process.execute_args;

      process.proc.stdout.on('data', function (chunk) {
        stdout += chunk;
      });
      process.proc.stderr.on('data', function (chunk) {
        stderr += chunk;
      });
      process.proc
        .on('error', function () {
          //reject();
        })
        .on('close', function (code, signal) {
          if(signal !== 'SIGKILL'){
            if (code === 0) {
              process.execute_return = stdout;
              process.execute_err_return = stderr;
              process.end();
              resolve(stdout);
            } else {
              _this.logger.log('error', process.id + '(' + process.status + ')' + ' FIN: ' + code + ' - ' + stdout + ' - ' + stderr);

              process.execute_return = stdout;
              process.execute_err_return = stderr;
              process.retries_count = process.retries_count + 1 || 1;
              process.error();

              if (process.retries >= process.retries_count) {

                process.retry();

                setTimeout(function () {
                  process.start(true)
                    .then(function (res) {
                      process.retries_count = 0;
                      resolve(res);
                    })
                    .catch(function (err) {
                      _this.logger.log('error', 'Retrying process:', err);
                      resolve(err);
                    });
                }, process.retry_delay * 1000 || 0);

              } else {
                if (process.end_on_fail) {
                  process.end();
                }
                reject(process, stderr);
              }
            }
          }
        });
    });
  }

  kill(_process) {
    var _this = this;

    function kill(pid, killTree, signal) {
      signal = signal || 'SIGKILL';
      killTree = killTree || true;
      return new Promise(function (resolve, reject) {
        if (killTree && process.platform !== 'win32') {
          psTree(pid, function (err, children) {
            [pid].concat(
              children.map(function (p) {
                return p.PID;
              })
            ).forEach(function (tpid) {
              try {
                process.kill(tpid, signal);
              }
              catch (ex) {
              }
            });

            resolve();
          });
        }
        else {
          try {
            process.kill(pid, signal);
          }
          catch (ex) {
          }
          resolve();
        }
      });
    }

    return new Promise(function (resolve, reject) {
      kill(_process.proc.pid)
        .then((res) => {
          resolve();
        })
        .catch((err) => {
          _this.logger.log('error', `Killing process ${_process.id}:`, err);
          reject();
        });
    });
  }

}

module.exports = shellExecutor;