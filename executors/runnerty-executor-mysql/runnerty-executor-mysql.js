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

    function executeQuery(process, values) {

      return new Promise(function (resolve, reject) {

        process.getArgs()
          .then((res) => {
            process.execute_arg = res;

            var options = {
              altValueReplace: 'null'
            };

            var repValues = Object.assign(process.values(), process.execute_arg);

            _this.replaceWithNew(values.command, repValues, options)
              .then((res) => {
                var _query = res;

                var connection = mysql.createConnection({
                  host: values.host,
                  socketPath: values.socketPath,
                  port: values.port,
                  ssl: values.ssl,
                  user: values.user,
                  password: values.password,
                  database: values.database,
                  multipleStatements: values.multipleStatements || true,
                  charset: values.charset,
                  timezone: values.timezone,
                  insecureAuth: values.insecureAuth,
                  debug: values.debug
                });

                connection.connect(function (err) {
                  if (err) {
                    _this.logger.log('error', 'Error connecting Mysql: ' + err);
                    process.execute_return = '';
                    process.execute_err_return = 'Error connecting Mysql: ' + err;
                    process.retries_count = process.retries_count + 1 || 1;
                    reject(err);
                  } else {
                    connection.query(_query, null, function (err, results) {
                      if (err) {
                        _this.logger.log('error', `executeMysql query ${_query}: ${err}`);
                        process.execute_err_return = `executeMysql query ${_query}: ${err}`;
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
          });
      });
    }


    return new Promise(function (resolve, reject) {
      _this.getValues(process)
        .then((res) => {
          if (!res.command) {
            if (!res.command_file) {
              _this.logger.log('error', `executeMysql dont have command or command_file`);
              process.execute_err_return = `executeMysql dont have command or command_file`;
              process.execute_return = '';
              process.error();
              reject(process);
            } else {
              loadSQLFile(res.command_file)
                .then((fileContent) => {
                  process.exec.command = fileContent;
                  res.command = fileContent;
                  executeQuery(process, res)
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
            executeQuery(process, res)
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
        .catch((err) => {
          _this.logger.log('error', `mysqlExecutor Error getValues: ${err}`);
          process.execute_err_return = `mysqlExecutor Error getValues ${err}`;
          process.execute_return = '';
          process.error();
          reject(process);
        });
    });
  }
}

module.exports = mysqlExecutor;