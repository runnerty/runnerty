"use strict";

var pg                = require('pg'); //PostgreSQL
var csv               = require("fast-csv");
var logger            = require("../../libs/utils.js").logger;
var loadSQLFile       = require("../../libs/utils.js").loadSQLFile;
var replaceWith       = require("../../libs/utils.js").replaceWith;

module.exports.exec = function executePostgre(process){

  function customQueryFormat(query, values) {
    if (!values) return query.replace(/(\:\/)/ig,':');
    else {
      //FIRST TURN
      var _query = query.replace(/\:(\w+)/ig, function (txt, key) {
        return values && key && values.hasOwnProperty(key)
          ? replaceWith(values[key],process.values())
          : null;
      }.bind(this));

      //SECOND TURN
      _query = _query.replace(/\:(\w+)/ig,
        function (txt, key) {
          return values && key && values.hasOwnProperty(key)
            ? replaceWith(values[key], process.values())
            : null;
        }.bind(this));

    }
    return _query;
  }

  function executeQuery(process, configValues){
    return new Promise(function(resolve, reject) {

      process.execute_arg = process.getArgs();

      var client = new pg.Client({
        user     : configValues.user,
        password : configValues.password,
        database : configValues.database,
        host     : configValues.host || configValues.socketPath,
        port     : configValues.port || "5432"
      });

      client.connect(function(err) {
        if(err) {
          logger.log('error',`Could not connect to Postgre: `+err);
          reject(err);
        }else{
          var command = replaceWith(process.exec.command, process.values());
          var finalQuery = customQueryFormat(command, process.execute_arg);
          process.command_executed = finalQuery;

          client.query(finalQuery, null, function(err, results){
            if(err){
              logger.log('error',`Error query Postgre (${finalQuery}): `+err);

              reject(`Error query Postgre (${finalQuery}): `+err);
            }else{
              if(results.hasOwnProperty('rows') && results.rows.length > 0){

                process.execute_db_results = JSON.stringify(results.rows);
                process.execute_db_results_object = results.rows;
                csv.writeToString(results.rows, {headers: true}, function(err, data){
                  if(err){
                    logger.log('error',`Generating csv output for execute_db_results_csv. id: ${process.id}: ${err}. Results: ${results}`);
                  }else{
                    process.execute_db_results_csv = data;
                  }

                  resolve();
                });

              }else{

                if(results instanceof Object){
                  process.execute_db_results      = '';
                  process.execute_db_results_csv  = '';
                  process.execute_db_results_object = [];
                  process.execute_db_fieldCount   = results.rowCount;
                  process.execute_db_affectedRows = '';
                  process.execute_db_changedRows  = '';
                  process.execute_db_insertId     = results.oid;
                  process.execute_db_warningCount = '';
                  process.execute_db_message      = '';
                }

                resolve();
              }
            }
            client.end();
          })
        }
      });
    });
  }

  return new Promise(function(resolve, reject) {
    if(process.exec.id){
      process.loadExecutorConfig()
        .then((configValues) => {
          if(!process.exec.command){
            if(!process.exec.command_file){
              logger.log('error',`executePostgre dont have command or command_file`);
              process.execute_err_return = `executePostgre dont have command or command_file`;
              process.execute_return = '';
              process.error();
              reject(process);
            }else{
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
                    .catch(function(err){
                        logger.log('error',`executePostgre executeQuery from file: ${err}`);
                        process.execute_err_return = `executePostgre executeQuery from file: ${err}`;
                        process.execute_return = '';
                        process.error();
                        reject(process);
                      });
                })
                .catch(function(err){
                    logger.log('error',`executePostgre loadSQLFile: ${err}`);
                    process.execute_err_return = `executePostgre loadSQLFile: ${err}`;
                    process.execute_return = '';
                    process.error();
                    reject(process);
                  });
            }
          }else{
            executeQuery(process, configValues)
              .then((res) => {
                process.execute_return = '';
                process.execute_err_return = '';
                process.end();
                resolve();
              })
             .catch(function(err){
               logger.log('error',`executePostgre executeQuery: ${err}`);
               process.execute_err_return = `executePostgre executeQuery: ${err}`;
               process.execute_return = '';
               process.error();
               reject(process);
              });
          }
        })
        .catch(function(err){
          logger.log('error',`executePostgre loadExecutorConfig: ${err}`);
          process.execute_err_return = `executePostgre loadExecutorConfig: ${err}`;
          process.execute_return = '';
          process.error();
          reject(process);
        });
    }else{
      logger.log('error',`executePostgre: exec id not set for ${process.id}`);
      process.execute_err_return = `executePostgre: exec id not set for ${process.id}`;
      process.execute_return = '';
      process.error();
      reject(process);
    }
  });

}