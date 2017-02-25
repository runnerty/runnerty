"use strict";

var spawn = require("child_process").spawn;
var psTree = require('ps-tree');

var Execution = require("../../classes/execution.js");

class shellExecutor extends Execution {
  constructor(process) {
    super(process);
  }

  exec() {
    var _this = this;
    var endOptions = {end: 'end'};

    return new Promise(async function (resolve, reject) {

      var stdout = '';
      var stderr = '';
      var shell = {};
      var [args, execValues] = await Promise.all([_this.getArgs(), _this.getValues()]);

      var cmd = execValues.command;
      shell.execute_args = args;
      shell.proc = spawn(cmd, shell.execute_args, {shell: true});
      shell.command_executed = cmd + ' ' + shell.execute_args;
      endOptions.command_executed = shell.command_executed;

      shell.proc.stdout.on('data', function (chunk) {
        stdout += chunk;
      });
      shell.proc.stderr.on('data', function (chunk) {
        stderr += chunk;
      });
      shell.proc
        .on('error', function () {
          //reject();
        })
        .on('close', function (code, signal) {
          if (signal !== 'SIGKILL') {
            if (code === 0) {
              endOptions.end = 'end';
              endOptions.execute_return = stdout;
              endOptions.execute_err_return = stderr;
              endOptions.execute_arg = shell.execute_arg;
              _this.end(endOptions, resolve, reject);
            } else {
              endOptions.end = 'error';
              endOptions.messageLog = ' FIN: ' + code + ' - ' + stdout + ' - ' + stderr;
              endOptions.execute_err_return = stderr;
              endOptions.execute_arg = shell.execute_arg;
              endOptions.execute_return = stdout;
              endOptions.retries_count = endOptions.retries_count + 1 || 1;
              _this.end(endOptions, resolve, reject);
              /*
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
               */
            }
          }
        });
    });
  };

  kill(_process) {
    var _this = this;

    function kill(pid, killTree, signal) {
      signal = signal || 'SIGKILL';
      killTree = killTree || true;
      return new Promise(function (resolve, reject) {
        if (killTree && _process.platform !== 'win32') {
          psTree(pid, function (err, children) {
            [pid].concat(
              children.map(function (p) {
                return p.PID;
              })
            ).forEach(function (tpid) {
              try {
                _process.kill(tpid, signal);
              }
              catch (ex) {
              }
            });

            resolve();
          });
        }
        else {
          try {
            _process.kill(pid, signal);
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