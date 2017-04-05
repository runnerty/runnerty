"use strict";

var mysql = require("mysql");
var csv = require("fast-csv");
//var loadSQLFile = require("../../libs/utils.js").loadSQLFile;
var loadSQLFile = global.libUtils.loadSQLFile;

var Execution = global.ExecutionClass;

class mysqlExecutor extends Execution {
  constructor(process) {
    super(process);
  }

  exec() {
    var _this = this;
    var endOptions = {end: 'end'};

    function executeQuery(values) {

      return new Promise(async function (resolve, reject) {
        var options = {
          useArgsValues: true,
          useProcessValues: true,
          useGlobalValues: true,
          altValueReplace: 'null'
        };

        var _query = await _this.paramsReplace(values.command, options);
        endOptions.command_executed = _query;

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
            reject(new Error(`Error connecting Mysql: ${err}`));
          } else {
            connection.query(_query, null, function (err, results) {
              connection.end();
              if (err) {
                throw new Error(`executeMysql query ${_query}: ${err}`);
              } else {
                resolve(results);
              }
            });
          }
        });

      });
    }

    function evaluateResults(results, resolve, reject) {
      if (results instanceof Array) {

        csv.writeToString(results, {headers: true}, function (err, data) {
          if (err) {
            _this.logger.log('error', `Generating csv output for execute_db_results_csv: ${err}. Results: ${results}`);
          }
          endOptions.execute_db_results = JSON.stringify(results);
          endOptions.execute_db_results_object = results;
          endOptions.execute_db_results_csv = data;
          _this.end(endOptions, resolve, reject);
        });

      } else {

        if (results instanceof Object) {
          endOptions.execute_db_results = '';
          endOptions.execute_db_results_object = [];
          endOptions.execute_db_results_csv = '';
          endOptions.execute_db_fieldCount = results.fieldCount;
          endOptions.execute_db_affectedRows = results.affectedRows;
          endOptions.execute_db_changedRows = results.changedRows;
          endOptions.execute_db_insertId = results.insertId;
          endOptions.execute_db_warningCount = results.warningCount;
          endOptions.execute_db_message = results.message;
        }
        _this.end(endOptions, resolve, reject);
      }

    }

    return new Promise(function (resolve, reject) {
      _this.getValues()
        .then((res) => {
          if (res.command) {
            executeQuery(res)
              .then((results) => {
                evaluateResults(results, resolve, reject);
              })
              .catch(function (err) {
                endOptions.end = 'error';
                endOptions.messageLog = `executeMysql executeQuery: ${err}`;
                endOptions.execute_err_return = `executeMysql executeQuery: ${err}`;
                _this.end(endOptions, resolve, reject);
              });
          } else {
            if (res.command_file) {
              loadSQLFile(res.command_file)
                .then((fileContent) => {
                  res.command = fileContent;
                  executeQuery(res)
                    .then((results) => {
                      evaluateResults(results, resolve, reject);
                    })
                    .catch(function (err) {
                      endOptions.end = 'error';
                      endOptions.messageLog = `executeMysql executeQuery from file: ${err}`;
                      endOptions.execute_err_return = `executeMysql executeQuery from file: ${err}`;
                      _this.end(endOptions, resolve, reject);
                    });
                })
                .catch(function (err) {
                  endOptions.end = 'error';
                  endOptions.messageLog = `executeMysql loadSQLFile: ${err}`;
                  endOptions.execute_err_return = `executeMysql loadSQLFile: ${err}`;
                  _this.end(endOptions, resolve, reject);
                });
            } else {
              endOptions.end = 'error';
              endOptions.messageLog = `executeMysql dont have command or command_file`;
              endOptions.execute_err_return = `executeMysql dont have command or command_file`;
              _this.end(endOptions, resolve, reject);
            }
          }
        })
        .catch((err) => {
          endOptions.end = 'error';
          endOptions.messageLog = `mysqlExecutor Error getValues: ${err}`;
          endOptions.execute_err_return = `mysqlExecutor Error getValues: ${err}`;
          _this.end(endOptions, resolve, reject);
        });
    });
  }
}

module.exports = mysqlExecutor;