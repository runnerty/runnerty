"use strict";

var mysql             = require("mysql");
var logger            = require("../libs/utils.js").logger;
var csv               = require("fast-csv");
var loadSQLFile       = require("../libs/utils.js").loadSQLFile;
var replaceWith       = require("../libs/utils.js").replaceWith;

module.exports.exec = function exec(process){

  function executeQuery(process, configValues){

    return new Promise(function(resolve, reject) {

      process.execute_arg = process.args

      var connection = mysql.createConnection({
        host: configValues.host,
        user: configValues.user,
        password: configValues.password,
        database: configValues.database,
        socketPath: configValues.socketPath,
        port: configValues.port,
        ssl: configValues.ssl,
        queryFormat: function (query, values) {
          if (!values){
            var queryResult = query.replace(/(\:\/)/g, ':');
            process.command_executed = queryResult;
            return queryResult;
          }
          else {
            var _query = query.replace(/\:(\w+)/g, function (txt, key) {
              return values && key && values.hasOwnProperty(key)
                ? replaceWith(values[key], process.values())
                : null;
            }.bind(this));
          }
          process.command_executed = _query;
          return _query;
        }
      });

      connection.connect(function (err) {
        if (err) {
          logger.log('error', 'Error connecting Mysql: ' + err)
          process.execute_return = '';
          process.execute_err_return = 'Error connecting Mysql: ' + err;
          process.retries_count = process.retries_count +1 || 1;
          reject(err);
        } else {
          var command = replaceWith(process.exec.command, process.values());
          connection.query(command, process.execute_arg, function (err, results) {
            if (err) {
              logger.log('error', `executeMysql query ${command}: ${err}`);
              process.execute_err_return = `executeMysql query ${command}: ${err}`;
              reject(err);
            } else {

              if (results instanceof Array) {

                process.execute_db_results = JSON.stringify(results);
                process.execute_db_results_object = results;
                csv.writeToString(results, {headers: true}, function (err, data) {
                  if (err) {
                    logger.log('error', `Generating csv output for execute_db_results_csv. id: ${process.id}: ${err}. Results: ${results}`);
                  } else {
                    process.execute_db_results_csv = data;
                  }
                  resolve();
                });

              } else {

                if (results instanceof Object) {
                  process.execute_db_results = '';
                  process.execute_db_results_object = [];
                  process.execute_db_results_csv = '';
                  process.execute_db_fieldCount = results.fieldCount;
                  process.execute_db_affectedRows = results.affectedRows;
                  process.execute_db_changedRows = results.changedRows;
                  process.execute_db_insertId = results.insertId;
                  process.execute_db_warningCount = results.warningCount;
                  process.execute_db_message = results.message;
                }
                resolve();
              }
            }
          });
          connection.end();
        }
      });
    });
  }

  return new Promise(function(resolve, reject) {

    if(process.exec.db_connection_id){
      process.loadDbConfig()
        .then((configValues) => {
        if(!process.exec.command){
        if(!process.exec.file_name){
          logger.log('error',`executeMysql dont have command or file_name`);
          process.execute_err_return = `executeMysql dont have command or file_name`;
          process.execute_return = '';
          process.error();
          process.write_output();
          reject(`executeMysql dont have command or file_name`);
        }else{
          loadSQLFile(process.exec.file_name)
            .then((fileContent) => {
              process.exec.command = fileContent;
              executeQuery(process, configValues)
                .then((res) => {
                  process.execute_return = '';
                  process.execute_err_return = '';
                  process.end();
                  process.write_output();
                  resolve();
                })
            .catch(function(err){
                logger.log('error',`executeMysql executeQuery from file: ${err}`);
                process.execute_err_return = `executeMysql executeQuery from file: ${err}`;
                process.execute_return = '';
                process.error();
                process.write_output();
                reject(process, err);
              });
        })
        .catch(function(err){
            logger.log('error',`executeMysql loadSQLFile: ${err}`);
            process.execute_err_return = `executeMysql loadSQLFile: ${err}`;
            process.execute_return = '';
            process.error();
            process.write_output();
            reject(process, err);
          });
        }
      }else{
        executeQuery(process, configValues)
          .then((res) => {
            process.execute_return = '';
            process.execute_err_return = '';
            process.end();
            process.write_output();
            resolve();
          })
          .catch(function(err){
            logger.log('error',`executeMysql executeQuery: ${err}`);
            process.execute_err_return = `executeMysql executeQuery: ${err}`;
            process.execute_return = '';
            process.error();
            process.write_output();
            reject(process, err);
          });
      }
    })
    .catch(function(err){
        logger.log('error',`executeMysql loadDbConfig: ${err}`);
        process.execute_err_return = `executeMysql loadDbConfig: ${err}`;
        process.execute_return = '';
        process.error();
        process.write_output();
        reject(process, err);
      });

    }else{
      logger.log('error',`db_connection_id not set for ${process.id}`);
      process.execute_err_return = `db_connection_id not set for ${process.id}`;
      process.execute_return = '';
      process.error();
      process.write_output();
      reject(process);
    }
  });
};