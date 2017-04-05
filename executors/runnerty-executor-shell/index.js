"use strict";

var spawn = require("child_process").spawn;
var psTree = require('ps-tree');
var Execution = global.ExecutionClass;

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

      var execValues = await _this.getValues();

      var cmd = execValues.command;
      shell.execute_args = [];
      shell.execute_args_line = '';

      if (execValues.args instanceof Array){
        shell.execute_args = execValues.args;
        for (var i = 0; i < execValues.args.length; i++) {
          shell.execute_args_line = (shell.execute_args_line?shell.execute_args_line + ' ':'') + execValues.args[i];
        }
      }

      shell.proc = spawn(cmd, shell.execute_args, {shell: true});
      shell.command_executed = cmd + ' ' + shell.execute_args_line;
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
              _this.end(endOptions, resolve, reject);
            } else {
              endOptions.end = 'error';
              endOptions.messageLog = ' FIN: ' + code + ' - ' + stdout + ' - ' + stderr;
              endOptions.execute_err_return = stderr;
              endOptions.execute_return = stdout;
              endOptions.retries_count = endOptions.retries_count + 1 || 1;
              _this.end(endOptions, resolve, reject);
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