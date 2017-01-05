"use strict";

var redis = require('redis');

var Execution = require("../../classes/execution.js");

class redisExecutor extends Execution {
  constructor(process) {
    super(process);
  }

  exec(process) {
    var _this = this;

    function customQueryFormat(query, values) {
      if (!values) {
        return query.replace(/(\:\/)/ig, ':');
      }
      else {
        //FIRST TURN
        var _query = query.replace(/\:(\w+)/ig, function (txt, key) {
          return values && key && values.hasOwnProperty(key)
            ? _this.replaceWith(values[key], process.values())
            : null;
        }.bind(this)).replace(/(\:\/)/ig, ':');

        //SECOND TURN
        _query = _query.replace(/\:(\w+)/ig,
          function (txt, key) {
            return values && key && values.hasOwnProperty(key)
              ? _this.replaceWith(values[key], process.values())
              : null;
          }.bind(this));

        return _query;
      }
    }

    function commandsFormat(commandsArr, args) {
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
          var cmdItemFormat = customQueryFormat(cmdItem, args);
          cmdFormat.push(cmdItemFormat);
        }
        result.push(cmdFormat);
      }

      return result;
    }

    function executeCommand(process, configValues) {
      return new Promise(function (resolve, reject) {

        process.execute_arg = process.getArgs();

        var redisClient = redis.createClient(configValues.port || "6379", configValues.host, configValues.options), multi;
        redisClient.auth(configValues.password);

        redisClient.on("error", function (err) {
          _this.logger.log('error', `Could not connect to Redis: ` + err);
          reject(`Could not connect to Redis: ` + err);
        });

        redisClient.on("ready", function () {
          var commands = commandsFormat(process.exec.command, process.execute_arg);
          process.command_executed = commands;

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
    }

    return new Promise(function (resolve, reject) {

      if (process.exec.id) {
        process.loadExecutorConfig()
          .then((configValues) => {
            if (process.exec.command) {

              executeCommand(process, configValues)
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
              _this.logger.log('error', `executeRedis: command not set for ${process.id}`);
              process.execute_err_return = `executeRedis: command not set for ${process.id}`;
              process.execute_return = '';
              process.error();
              reject(process);
            }
          })
          .catch(function (err) {
            _this.logger.log('error', `executeRedis loadExecutorConfig: ${err}`);
            process.execute_err_return = `executeRedis loadExecutorConfig: ${err}`;
            process.execute_return = '';
            process.error();
            reject(process);
          });
      } else {
        _this.logger.log('error', `executeRedis: exec id not set for ${process.id}`);
        process.execute_err_return = `executeRedis: exec id not set for ${process.id}`;
        process.execute_return = '';
        process.error();
        reject(process);
      }
    });
  }
}

module.exports = redisExecutor;