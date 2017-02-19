"use strict";

var redis = require('redis');

var Execution = require("../../classes/execution.js");

class redisExecutor extends Execution {
  constructor(process) {
    super(process);
  }

  exec(process) {
    var _this = this;

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

    function executeCommand(process, configValues) {
      return new Promise(function (resolve, reject) {

        process.getArgs()
          .then((res) => {
            process.execute_arg = res;

            var options = {
              altValueReplace: 'null'
            };

            var repValues = Object.assign(process.values(), process.execute_arg);

            _this.replaceWithSmart(process.exec.command, repValues, options)
              .then((res) => {
                var _query = res;
                var redisClient = redis.createClient(configValues.port || "6379", configValues.host, configValues.options), multi;
                redisClient.auth(configValues.password);

                redisClient.on("error", function (err) {
                  _this.logger.log('error', `Could not connect to Redis: ` + err);
                  reject(`Could not connect to Redis: ` + err);
                });

                redisClient.on("ready", function () {
                  var commands = _query;
                  process.command_executed = commandsFormat(commands);

                  try {
                    redisClient
                      .batch(commands)
                      .exec(function (err, replies) {
                        if (err) {
                          _this.logger.log('error', `Error query Redis (${commands}): ` + err);
                          reject(`Error query Redis (${commands}): ` + err);
                        } else {
                          process.execute_db_results = replies;
                          process.execute_db_results_csv = '';
                          process.execute_db_fieldCount = '';
                          process.execute_db_affectedRows = '';
                          process.execute_db_changedRows = '';
                          process.execute_db_insertId = '';
                          process.execute_db_warningCount = '';
                          process.execute_db_message = '';
                          resolve();
                        }
                      });
                  } catch (err) {
                    _this.logger.log('error', `Error query Redis, check commands: ` + commands, err);
                    reject(`Error query Redis, check commands: ` + commands, err);
                  }
                });
              });
          });
      });
    }

    return new Promise(function (resolve, reject) {
      _this.getValues(process)
        .then((res) => {
          if (res.command) {

            executeCommand(process, res)
              .then(() => {
                process.execute_return = '';
                process.execute_err_return = '';
                process.end();
                resolve();
              })
              .catch(function (err) {
                _this.logger.log('error', `executeRedis executeCommand: ${err}`);
                process.execute_err_return = `executeRedis executeCommand: ${err}`;
                process.execute_return = '';
                process.error();
                reject(process);
              });
          } else {
            _this.logger.log('error', `executeRedis: command not set and command_file nor supported yet for ${process.id}`);
            process.execute_err_return = `executeRedis: command not set and command_file nor supported yet for ${process.id}`;
            process.execute_return = '';
            process.error();
            reject(process);
          }
        })
        .catch((err) => {
          _this.logger.log('error', `redisExecutor Error getValues: ${err}`);
          process.execute_err_return = `redisExecutor Error getValues ${err}`;
          process.execute_return = '';
          process.error();
          reject(process);
        });
    });

  }
}

module.exports = redisExecutor;