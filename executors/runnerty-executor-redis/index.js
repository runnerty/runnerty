"use strict";

var redis = require('redis');

var Execution = require("../../classes/execution.js");

class redisExecutor extends Execution {
  constructor(process) {
    super(process);
  }

  exec() {
    var _this = this;
    var endOptions = {end: 'end'};

    function commandsFormat(commandsArr) {
      var commands = [];

      if ((commandsArr[0]) instanceof Array) {
        commands = commandsArr;
      } else {
        commands.push(commandsArr);
      }

      var commandsLength = commands.length;
      var result = [];

      for (var x = 0; x < commandsLength; x++) {
        var cmd = commands[x];
        var cmdLength = cmd.length;
        var cmdFormat = [];

        for (var i = 0; i < cmdLength; i++) {
          var cmdItem = cmd[i];
          var cmdItemFormat = cmdItem;
          cmdFormat.push(cmdItemFormat);
        }
        result.push(cmdFormat);
      }

      return result;
    }

    function executeCommand(configValues) {
      return new Promise(async function (resolve, reject) {

        var options = {
          useArgsValues: true,
          useProcessValues: true,
          useGlobalValues: true,
          altValueReplace: 'null'
        };

        var _query = await _this.paramsReplace(values.command, options);
        var redisClient = redis.createClient(configValues.port || "6379", configValues.host, configValues.options), multi;
        if(configValues.password && configValues.password !== ''){
          redisClient.auth(configValues.password);
        }

        redisClient.on("error", function (err) {
          _this.logger.log('error', `Could not connect to Redis: ` + err);
          reject(`Could not connect to Redis: ` + err);
        });

        redisClient.on("ready", function () {
          var commands = _query;
          endOptions.command_executed = commandsFormat(commands);

          try {
            redisClient
              .batch(commands)
              .exec(function (err, replies) {
                redisClient.quit();
                if (err) {
                  _this.logger.log('error', `Error query Redis (${commands}): ` + err);
                  reject(`Error query Redis (${commands}): ` + err);
                } else {
                  resolve(replies);
                }
              });
          } catch (err) {
            _this.logger.log('error', `Error query Redis, check commands: ` + commands, err);
            reject(`Error query Redis, check commands: ` + commands, err);
          }
        });
      });
    }

    return new Promise(function (resolve, reject) {
      _this.getValues()
        .then((res) => {
          if (res.command) {
            executeCommand(res)
              .then((res) => {
                endOptions.end = 'end';
                endOptions.execute_db_results = res;
                _this.end(endOptions, resolve, reject);
              })
              .catch(function (err) {
                endOptions.end = 'error';
                endOptions.messageLog = `executeRedis executeCommand: ${err}`;
                endOptions.execute_err_return = `executeRedis executeCommand: ${err}`;
                _this.end(endOptions, resolve, reject);
              });
          } else {
            endOptions.end = 'error';
            endOptions.messageLog = `executeRedis: command not set and command_file nor supported yet for ${_this.processId}(${_this.processUId}.`;
            endOptions.execute_err_return = `executeRedis: command not set and command_file nor supported yet for ${_this.processId}(${_this.processUId}.`;
            _this.end(endOptions, resolve, reject);
          }
        })
        .catch((err) => {
          endOptions.end = 'error';
          endOptions.messageLog = `redisExecutor Error getValues: ${err}`;
          endOptions.execute_err_return = `redisExecutor Error getValues: ${err}`;
          _this.end(endOptions, resolve, reject);
        });
    });
  }
}

module.exports = redisExecutor;