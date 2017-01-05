"use strict";

var mysql = require("mysql");
var csv = require("fast-csv");
var loadSQLFile = require("../../libs/utils.js").loadSQLFile;

var Execution = require("../../classes/execution.js");

class mysqlExecutor extends Execution {
  constructor(process) {
    super(process);
  }

  exec(process) {
    var _this = this;

    function customQueryFormat(query, values) {
      if (!values) {
        var queryResult = query.replace(/(:\/)/ig, ':');
        process.command_executed = queryResult;
        return queryResult;
      }
      else {
        //FIRST TURN
        var _query = query.replace(/:(\w+)/ig,
          function (txt, key) {
            return values && key && values.hasOwnProperty(key)
              ? _this.replaceWith(values[key], process.values())
              : null;
          }.bind(this));

        //SECOND TURN
        _query = _query.replace(/:(\w+)/ig,
          function (txt, key) {
            return values && key && values.hasOwnProperty(key)
              ? _this.replaceWith(values[key], process.values())
              : null;
          }.bind(this));
        process.command_executed = _query;
        return _query;
      }
    }

    function executeQuery(process, configValues) {

      return new Promise(function (resolve, reject) {

        process.execute_arg = process.getArgs();

        var connection = mysql.createConnection({
          host: configValues.host,
          user: configValues.user,
          password: configValues.password,
          database: configValues.database,
          socketPath: configValues.socketPath,
          port: configValues.port || "3306",
          ssl: configValues.ssl,
          multipleStatements: true,
          queryFormat: customQueryFormat
        });

        connection.connect(function (err) {
          if (err) {
            _this.logger.log('error', 'Error connecting Mysql: ' + err);
            process.execute_return = '';
            process.execute_err_return = 'Error connecting Mysql: ' + err;
            process.retries_count = process.retries_count + 1 || 1;
            reject(err);
          } else {
            var command = _this.replaceWith(process.exec.command, process.values());
            connection.query(command, process.execute_arg, function (err, results) {
              if (err) {
                _this.logger.log('error', `executeMysql query ${command}: ${err}`);
                process.execute_err_return = `executeMysql query ${command}: ${err}`;
                reject(err);
              } else {

                if (results instanceof Array) {
                  process.execute_db_results = JSON.stringify(results);
                  process.execute_db_results_object = results;
                  csv.writeToString(results, {headers: true}, function (err, data) {
                    if (err) {
                      _this.logger.log('error', `Generating csv output for execute_db_results_csv. id: ${process.id}: ${err}. Results: ${results}`);
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

    return new Promise(function (resolve, reject) {

      if (process.exec.id) {
        process.loadExecutorConfig()
          .then((configValues) => {
            if (!process.exec.command) {
              if (!process.exec.command_file) {
                _this.logger.log('error', `executeMysql dont have command or command_file`);
                process.execute_err_return = `executeMysql dont have command or command_file`;
                process.execute_return = '';
                process.error();
                reject(process);
              } else {
                loadSQLFile(process.exec.command_file)
                  .then((fileContent) => {
                    process.exec.command = fileContent;
                    executeQuery(process, configValues)
                      .then((res) => {
                        process.execute_return = '';
                        process.execute_err_return = '';
                        process.end();
                        resolve();
                      })
                      .catch(function (err) {
                        _this.logger.log('error', `executeMysql executeQuery from file: ${err}`);
                        process.execute_err_return = `executeMysql executeQuery from file: ${err}`;
                        process.execute_return = '';
                        process.error();
                        reject(process);
                      });
                  })
                  .catch(function (err) {
                    _this.logger.log('error', `executeMysql loadSQLFile: ${err}`);
                    process.execute_err_return = `executeMysql loadSQLFile: ${err}`;
                    process.execute_return = '';
                    process.error();
                    reject(process);
                  });
              }
            } else {
              executeQuery(process, configValues)
                .then(() => {
                  process.execute_return = '';
                  process.execute_err_return = '';
                  process.end();
                  resolve();
                })
                .catch(function (err) {
                  _this.logger.log('error', `executeMysql executeQuery: ${err}`);
                  process.execute_err_return = `executeMysql executeQuery: ${err}`;
                  process.execute_return = '';
                  process.error();
                  reject(process);
                });
            }
          })
          .catch(function (err) {
            _this.logger.log('error', `executeMysql loadExecutorConfig: ${err}`);
            process.execute_err_return = `executeMysql loadExecutorConfig: ${err}`;
            process.execute_return = '';
            process.error();
            reject(process);
          });

      } else {
        _this.logger.log('error', `executeMysql: exec id not set for ${process.id}`);
        process.execute_err_return = `executeMysql: exec id not set for ${process.id}`;
        process.execute_return = '';
        process.error();
        reject(process);
      }
    });
  }
}

module.exports = mysqlExecutor;