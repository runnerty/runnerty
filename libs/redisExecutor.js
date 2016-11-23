"use strict";

var redis             = require('redis');
var logger            = require("../libs/utils.js").logger;
var replaceWith       = require("../libs/utils.js").replaceWith;

module.exports.exec =  function executeRedis(process) {

  function commandFormat(query, values) {
    if (!values) return query.replace(/(\:\/)/ig,':');
    else {
      //FIRST TURN
      var _query = query.replace(/\:(\w+)/ig, function (txt, key) {
        return values && key && values.hasOwnProperty(key)
          ? replaceWith(values[key],process.values())
          : null;
      }.bind(this)).replace(/(\:\/)/ig,':');

      //SECOND TURN
      _query = _query.replace(/\:(\w+)/ig,
        function (txt, key) {
          return values && key && values.hasOwnProperty(key)
            ? replaceWith(values[key], process.values())
            : null;
        }.bind(this));
    }
    return _query;
  };

  function commandsFormat(commandsArr, args) {
    var commands = [];

    if((commandsArr[0]) instanceof Array){
      commands = commandsArr;
    }else{
      commands.push(commandsArr);
    }

    var commandsLength = commands.length;
    var result = [];

    for(var x = 0; x < commandsLength; x++){
      var cmd = commands[x];
      var cmdLength = cmd.length;
      var cmdFormat = [];

      for(var i = 0; i < cmdLength; i++){
        var cmdItem = cmd[i];
        var cmdItemFormat = commandFormat(cmdItem, args);
        cmdFormat.push(cmdItemFormat);
      }
      result.push(cmdFormat);
    }

    return result;
  };

  function executeCommand(process, configValues) {
    return new Promise(function (resolve, reject) {

      process.execute_arg = process.args;

      var redisClient = redis.createClient(configValues.port, configValues.host, configValues.options), multi;
      redisClient.auth(configValues.password);

      redisClient.on("error", function (err) {
        logger.log('error', `Could not connect to Redis: ` + err);
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
                logger.log('error', `Error query Redis (${commands}): ` + err);
                reject(`Error query Redis (${commands}): ` + err);
              } else {
                process.execute_db_results      = replies;
                process.execute_db_results_csv  = '';
                process.execute_db_fieldCount   = '';
                process.execute_db_affectedRows = '';
                process.execute_db_changedRows  = '';
                process.execute_db_insertId     = '';
                process.execute_db_warningCount = '';
                process.execute_db_message      = '';
                resolve();
              }
            })
        } catch(e) {
          logger.log('error', `Error query Redis, check commands: ` + commands + e);
          reject(`Error query Redis, check commands: ` + commands + e);
        }
      });

    });
  };

  return new Promise(function(resolve, reject) {

    if(process.exec.db_connection_id){
      process.loadDbConfig()
        .then((configValues) => {
        if(process.exec.command){

        executeCommand(process, configValues)
          .then((res) => {
          process.execute_return = '';
        process.execute_err_return = '';
        process.end();
        process.write_output();
        resolve();
      })
      .catch(function(err){
          logger.log('error',`executeRedis executeCommand: ${err}`);
          process.execute_err_return = `executeRedis executeCommand: ${err}`;
          process.execute_return = '';
          process.error();
          process.write_output();
          reject(process, err);
        });

      }else{
        logger.log('error',`executeRedis: command not set for ${process.id}`);
        process.execute_err_return = `executeRedis: command not set for ${process.id}`;
        process.execute_return = '';
        process.error();
        process.write_output();
        reject(process, `executeRedis: command not set for ${process.id}`);
      }
    })
    .catch(function(err){
        logger.log('error',`executeRedis loadDbConfig: ${err}`);
        process.execute_err_return = `executeRedis loadDbConfig: ${err}`;
        process.execute_return = '';
        process.error();
        process.write_output();
        reject(process, err);
      });
    }else{
      logger.log('error',`executeRedis: db_connection_id not set for ${process.id}`);
      process.execute_err_return = `executeRedis: db_connection_id not set for ${process.id}`;
      process.execute_return = '';
      process.error();
      process.write_output();
      reject(process, `executeRedis: db_connection_id not set for ${process.id}`);
    }
  });
};