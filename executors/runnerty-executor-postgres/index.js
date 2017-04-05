"use strict";

var pg = require('pg'); //PostgreSQL
var csv = require("fast-csv");
//var loadSQLFile = require("../../libs/utils.js").loadSQLFile;
var loadSQLFile = global.libUtils.loadSQLFile;

var Execution = global.ExecutionClass;

class postgresExecutor extends Execution {
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
        var client = new pg.Client({
          user: values.user,
          password: values.password,
          database: values.database,
          host: values.host || values.socketPath,
          port: values.port
        });

        client.connect(function (err) {
          if (err) {
            _this.logger.log('error', `Could not connect to Postgre: ` + err);
            reject(err);
          } else {
            client.query(_query, null, function (err, results) {
              client.end();
              if (err) {
                _this.logger.log('error', `Error query Postgre (${_query}): ` + err);
                reject(`Error query Postgre (${_query}): ` + err);
              } else {
                resolve(results);
              }
            });
          }
        });
      });
    }

    function evaluateResults(results, resolve, reject) {

      if (results.rows && results.rows.length > 0) {
        endOptions.end = 'end';
        endOptions.execute_db_results = JSON.stringify(results.rows);
        endOptions.execute_db_results_object = results.rows;
        csv.writeToString(results.rows, {headers: true}, function (err, data) {
          if (err) {
            _this.logger.log('error', `Generating csv output for execute_db_results_csv for ${_this.processId}(${_this.processUId}): ${err}. Results: ${results}`);
          } else {
            endOptions.execute_db_results_csv = data;
          }
          _this.end(endOptions, resolve, reject);
        });

      } else {

        if (results instanceof Object) {
          endOptions.execute_db_results = '';
          endOptions.execute_db_results_csv = '';
          endOptions.execute_db_results_object = [];
          endOptions.execute_db_fieldCount = results.rowCount;
          endOptions.execute_db_affectedRows = '';
          endOptions.execute_db_changedRows = '';
          endOptions.execute_db_insertId = results.oid;
          endOptions.execute_db_warningCount = '';
          endOptions.execute_db_message = '';
        }
        _this.end(endOptions, resolve, reject);
      }
    }

    return new Promise(function (resolve, reject) {
      _this.getValues()
        .then((res) => {

          if (res.command) {
            executeQuery(res)
              .then((res) => {
                evaluateResults(res, resolve, reject);
              })
              .catch(function (err) {
                var endOptions = {
                  end: 'error',
                  messageLog: `executePostgre executeQuery: ${err}`,
                  execute_err_return: `executePostgre executeQuery: ${err}`
                };
                _this.end(endOptions, resolve, reject);
              });
          } else {
            if (res.command_file) {
              loadSQLFile(res.command_file)
                .then((fileContent) => {
                  res.command = fileContent;
                  executeQuery(res)
                    .then((res) => {
                      evaluateResults(res, resolve, reject);
                    })
                    .catch(function (err) {
                      endOptions.end = 'error';
                      endOptions.messageLog = `executePostgre executeQuery from file: ${err}`;
                      endOptions.execute_err_return = `executePostgre executeQuery from file: ${err}`;
                      _this.end(endOptions, resolve, reject);
                    });
                })
                .catch(function (err) {
                  endOptions.end = 'error';
                  endOptions.messageLog = `executePostgre loadSQLFile: ${err}`;
                  endOptions.execute_err_return = `executePostgre loadSQLFile: ${err}`;
                  _this.end(endOptions, resolve, reject);
                });
            } else {
              endOptions.end = 'error';
              endOptions.messageLog = `executePostgre dont set command or command_file`;
              endOptions.execute_err_return = `executePostgre dont set command or command_file`;
              _this.end(endOptions, resolve, reject);
            }
          }
        })
        .catch((err) => {
          endOptions.end = 'error';
          endOptions.messageLog = `postgresExecutor Error getValues: ${err}`;
          endOptions.execute_err_return = `postgresExecutor Error getValues: ${err}`;
          _this.end(endOptions, resolve, reject);
        });
    });
  }
}

module.exports = postgresExecutor;