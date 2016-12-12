"use strict";

var pg                = require('pg'); //PostgreSQL
var logger            = require("../libs/utils.js").logger;
var csv               = require("fast-csv");
var loadSQLFile       = require("../libs/utils.js").loadSQLFile;
var replaceWith       = require("../libs/utils.js").replaceWith;

module.exports.exec = function executePostgre(process){

  function queryFormat(query, values) {
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

  function executeQuerys(process, configValues){
    console.log('executeQuerys - process.exec.command:',process.exec.command);
    return new Promise(function(resolve, reject){
      var command              = replaceWith(process.exec.command, process.values());
      console.log('executeQuerys - [2]');
      var _finalQuery          = queryFormat(command, process.execute_arg);
      console.log('executeQuerys - [3]');
      process.command_executed = _finalQuery;
      console.log('executeQuerys - [4]');
      var statements           = _finalQuery.split(/;\s*$/m);

      console.log('executeQuerys - statements:',statements);

      function execSerie(statements) {
        var sequence = Promise.resolve();
        var i = 0;
        statements.forEach(function(query) {
          sequence = sequence.then(function() {
            return executeQuery(query, configValues)
              .then(function(results) {

                console.log('executeQuerys - fin ejecución de query:',query);

                if(results.hasOwnProperty('rows') && results.rows.length > 0){

                  process.execute_db_results        = JSON.stringify(results.rows);
                  process.execute_db_results_object = results.rows;

                  csv.writeToString(results.rows, {headers: true}, function(err, data){
                    if(err){
                      logger.log('error',`Generating csv output for execute_db_results_csv. id: ${process.id}: ${err}. Results: ${results}`);
                    }else{
                      process.execute_db_results_csv = data;
                    }
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
                }
                i = i+1;
              })
              .catch(function(e){
                i = i+1;
                logger.log('error','chain startProcesses execSerie  startProcesses waitEndChilds. Error '+e);
              });
          });
        });
        return sequence;
      }

      execSerie(statements)
        .then(function() {
          console.log('executeQuerys - fin de todas las querys');
          resolve();
        })
        .catch(function(e){
          logger.log('error','chain startProcesses execSerie waitEndChilds. Error '+e);
          resolve();
        });


    });
  }

  function executeQuery(query, configValues){
    return new Promise(function(resolve, reject) {

      process.execute_arg = process.args;

      var client = new pg.Client({
        user     : configValues.user,
        password : configValues.password,
        database : configValues.database,
        host     : configValues.host || configValues.socketPath,
        port     : configValues.port
      });

      client.connect(function(err) {
        if(err) {
          logger.log('error',`Could not connect to Postgre: `+err);
          reject(err);
        }else{
          client.query(query, null, function(err, results){
            if(err){
              logger.log('error',`Error query Postgre (${query}): `+err);

              reject(`Error query Postgre (${query}): `+err);
            }else{
              resolve(results);
            }
            client.end();
          })
        }
      });
    });
  };


/*
  function executeQuery(process, configValues){
    return new Promise(function(resolve, reject) {

      process.execute_arg = process.args;

      var client = new pg.Client({
        user     : configValues.user,
        password : configValues.password,
        database : configValues.database,
        host     : configValues.host || configValues.socketPath,
        port     : configValues.port
      });

      client.connect(function(err) {
        if(err) {
          logger.log('error',`Could not connect to Postgre: `+err);
          reject(err);
        }else{
          var command = replaceWith(process.exec.command, process.values());
          var _finalQuery = queryFormat(command, process.execute_arg);
          process.command_executed = _finalQuery;

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
*/
  return new Promise(function(resolve, reject) {

    if(process.exec.db_connection_id){
      process.loadDbConfig()
        .then((configValues) => {
          if(!process.exec.command){
            if(!process.exec.file_name){
              logger.log('error',`executePostgre dont have command or file_name`);
              process.execute_err_return = `executePostgre dont have command or file_name`;
              process.execute_return = '';
              process.error();
              process.write_output();
              reject(process, `executePostgre dont have command or file_name`);
            }else{
              loadSQLFile(process.exec.file_name)
                .then((fileContent) => {
                  process.exec.command = fileContent;
                  executeQuerys(process, configValues)
                    .then((res) => {
                      process.execute_return = '';
                      process.execute_err_return = '';
                      process.end();
                      process.write_output();
                      resolve();
                    })
                    .catch(function(err){
                      logger.log('error',`executePostgre executeQuery from file: ${err}`);
                      process.execute_err_return = `executePostgre executeQuery from file: ${err}`;
                      process.execute_return = '';
                      process.error();
                      process.write_output();
                      reject(process, err);
                     });
                })
                .catch(function(err){
                    logger.log('error',`executePostgre loadSQLFile: ${err}`);
                    process.execute_err_return = `executePostgre loadSQLFile: ${err}`;
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
                logger.log('error',`executePostgre executeQuery: ${err}`);
                process.execute_err_return = `executePostgre executeQuery: ${err}`;
                process.execute_return = '';
                process.error();
                process.write_output();
                reject(process, err);
              });
          }
        })
       .catch(function(err){
           logger.log('error',`executePostgre loadDbConfig: ${err}`);
           process.execute_err_return = `executePostgre loadDbConfig: ${err}`;
           process.execute_return = '';
           process.error();
           process.write_output();
           reject(process, err);
         });
    }else{
      logger.log('error',`executePostgre: db_connection_id not set for ${process.id}`);
      process.execute_err_return = `executePostgre: db_connection_id not set for ${process.id}`;
      process.execute_return = '';
      process.error();
      process.write_output();
      reject(process, `executePostgre: db_connection_id not set for ${process.id}`);
    }
  });

}