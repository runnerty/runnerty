"use strict";
var program         = require('commander');
var winston         = require('winston');
var schedule        = require('node-schedule');
var spawn           = require('child_process').spawn;
var fs              = require('fs');
var chokidar        = require('chokidar');
var path            = require('path');
var crypto          = require('crypto');
var nodemailer      = require('nodemailer');
var Slack           = require('slack-node');
var anymatch        = require('anymatch');
var bytes           = require('bytes');
var mysql           = require('mysql');
var csv             = require("fast-csv");


var configFilePath = '/etc/runnerty/conf.json';
var config;

// UTILS
function replaceWith(text, objParams){

  function pad(pad, str, padLeft) {
    if(!padLeft) padLeft = true;
    if (typeof str === 'undefined')
      return pad;
    if (padLeft) {
      return (pad + str).slice(-pad.length);
    } else {
      return (str + pad).substring(0, pad.length);
    }
  }

  var currentTime = new Date();
  objParams.DD   = pad('00',currentTime.getDate());
  objParams.MM   = pad('00',currentTime.getMonth() + 1);
  objParams.YY   = pad('00',currentTime.getFullYear().toString().substr(2,2));
  objParams.YYYY = pad('00',currentTime.getFullYear());
  objParams.HH   = pad('00',currentTime.getHours());
  objParams.mm   = pad('00',currentTime.getMinutes());
  objParams.ss   = pad('00',currentTime.getSeconds());

  var keys = Object.keys(objParams);

  function orderByLength(a, b) {
    if (a.length > b.length) {
      return 1;
    }
    if (a.length < b.length) {
      return -1;
    }
    return 0;
  }

  keys.sort(orderByLength);
  var keysLength = keys.length;

  while (keysLength--) {
    text = text.replace(new RegExp('\\:' + keys[keysLength], 'g'), objParams[keys[keysLength]] || '');
  }
  return text;
}

function readFilePromise(type, file){
  return new Promise(function(resolve, reject) {
    fs.readFile(file, function(err, data){
      var res = {};
      if(err){
        res[type] = err;
        reject(res);
      }else{
        res[type] = data;
        resolve(res);
      }
    });
  });
}

function sendMail(mail, callback){

  var transport = nodemailer.createTransport(mail.transport);
  var filesReads = [];

  var templateDir  = path.resolve(mail.templateDir, mail.template);
  var htmlTemplate = path.resolve(templateDir, 'html.html');
  var txtTemplate	 = path.resolve(templateDir, 'text.txt');

  filesReads.push(readFilePromise('html',htmlTemplate));
  filesReads.push(readFilePromise('text', txtTemplate));

  Promise.all(filesReads)
    .then(function (res) {

      var html_data;
      var text_data;

      if(res[0].hasOwnProperty('html')){
        html_data = res[0].html.toString();
        text_data = res[1].text.toString();
      }else{
        html_data = res[1].html.toString();
        text_data = res[0].text.toString();
      }

      var html = replaceWith(html_data, mail.params);
      var text = replaceWith(text_data, mail.params);

      var mailOptions = {
        from: mail.from,
        to: mail.to,
        subject: mail.params.subject,
        text: text,
        html: html
      };

      if(mail.disable){
        logger.log('warn','Mail sender is disable.');
        callback();
      }else{
        transport.sendMail(mailOptions,
          function(err, res){
            if(err) {
              logger.log('error','Error sending mail:',err);
              callback(err,null);
            }else{
              callback(null,res);
            }
          });
      }
    })
    .catch(function(e){
      logger.log('error','Error sending mail:',e);
      callback(e,null);
    });
};


function loadGeneralConfig(){
  return new Promise((resolve) => {
    var filePath = configFilePath;

    fs.stat(filePath, function(err, res){
      if(err){
        logger.log('error',`Load General conf file ${filePath} not exists.`, err);
        throw new Error(`Load General conf file ${filePath} not found.`);
        resolve();
      }else {
        try {
          fs.readFile(filePath, 'utf8', function (err, res) {
            if (err) {
              logger.log('error', 'Load General conf loadConfig readFile: ' + err);
              resolve();
            } else {
              var objConf = JSON.parse(res).config;

              //TODO: INCLUIR TODOS LOS PARAMTEROS OBLIGATORIOS DE CONFIG EN ESTA VALIDACIÓN:
              if (objConf.hasOwnProperty('general')) {
                resolve(objConf);
              } else {
                throw new Error('Invalid Config file, general not found.', objConf);
                resolve();
              }

            }
          });
        } catch (e) {
          throw new Error('Invalid Config file, incorrect JSON format: ' + e.message, e);
          resolve();
        }
      }
    });
  });
};

function loadConfigSection(section, id_config){
  return new Promise(function(resolve, reject) {

    if (config.hasOwnProperty(section)) {
      var sectionLength = config[section].length;
      var cnf = undefined;
      while (sectionLength--) {
        if (config[section][sectionLength].id === id_config) {
          cnf = config[section][sectionLength];
        }
      }

    if (cnf){
      resolve(cnf);
    }else{
      throw new Error(`Config for ${id_config} not found in section ${section}`);
      reject();
    }

  }else{
    throw new Error(`Section ${section} not found in config file.`, config);
    reject();
  }
});
};


// LOGGER  ---------------------------------------------------------------------
var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({colorize: 'all', level: 'debug'}),
   // new (winston.transports.File)({name: 'info-file', filename: 'filelog-info.log', level: 'info'}),
   // new (winston.transports.File)({name: 'error-file',filename: 'filelog-error.log',level: 'error'}),
  ]
});

// CLASSES ---------------------------------------------------------------------

class Notification {
  constructor(type, id, title, message, recipients, recipients_cc, recipients_cco) {
    this.type = type;
    this.id = id;
    this.title = title;
    this.message = message;
    this.recipients = recipients;
    this.recipients_cc = recipients_cc;
    this.recipients_cco = recipients_cco;
  }

  notificate(){
    logger.log('warn','This method must be rewrite in child class');
  }

  loadConfig(){
    var _this = this;
    return loadConfigSection('notificators_connections', _this.id);
  }


}

class mailNotificator extends Notification{
  constructor(type, id, title, message, recipients, recipients_cc, recipients_cco){
    super('mail', id, title, message, recipients, recipients_cc, recipients_cco);

    return new Promise((resolve) => {
      resolve(this);
    });
  }

notificate(values){

  return new Promise((resolve) => {

        this.loadConfig()
        .then((configValues) => {
          if (configValues){
            if (!this.from && configValues.from)               this.from        = configValues.from;
            if (!this.transport && configValues.transport)     this.transport   = configValues.transport;
            if (!this.templateDir && configValues.templateDir) this.templateDir = configValues.templateDir;
            if (!this.template && configValues.template)       this.template    = configValues.template;
            if (!this.disable && configValues.disable)         this.disable     = configValues.disable;
          }

          this.params = values;

          for (var i = 0, len = this.recipients.length; i < len; i++) {
            if (i){
              this.to = this.to + this.recipients[i] + ((i < len-1) ? ', ' : '');
            }
            else{
              this.to = this.recipients[i] + ((i < len-1) ? ', ' : '');
            }
          }

          for (var i = 0, len = this.recipients_cc.length; i < len; i++) {
            if (i){
              this.cc = this.cc + this.recipients_cc[i] + ((i < len-1) ? ', ' : '');
            }
            else{
              this.cc = this.recipients_cc[i] + ((i < len-1) ? ', ' : '');
            }
          }

          for (var i = 0, len = this.recipients_cco.length; i < len; i++) {
            if (i){
              this.bcc = this.bcc + this.recipients_cco[i] + ((i < len-1) ? ', ' : '');
            }
            else{
              this.bcc = this.recipients_cco[i] + ((i < len-1) ? ', ' : '');
            }
          }

          this.params.subject = replaceWith(this.title, values);
          this.params.message = replaceWith(this.message, values);

          sendMail(this, function(err, res){
            if (err){
              logger.log('error','Error sending mail:'+e,this,values);
            }
            resolve(res);
          });

        })
        .catch(function(e){
            logger.log('error','Mail notificate loadConfig '+e)
            resolve();
          });
        });
  }
}

class slackNotificator extends Notification{
  constructor(type, id, token, bot_name, bot_emoji, message, channel, recipients){
    super('slack', id, null, message, recipients, null, null);

    this.token = token;
    this.bot_name = bot_name;
    this.bot_emoji = bot_emoji;
    this.channel = channel;

    return new Promise((resolve) => {
      resolve(this);
    });
  }

  notificate(values){
    return new Promise((resolve) => {

        this.loadConfig()
        .then((configValues) => {
            if (configValues){
              if (!this.token && configValues.token)         this.token     = configValues.token;
              if (!this.bot_name && configValues.bot_name)   this.bot_name  = configValues.bot_name;
              if (!this.bot_emoji && configValues.bot_emoji) this.bot_emoji = configValues.bot_emoji;
              if (!this.channel && configValues.channel)     this.channel   = configValues.channel;
            }

            var slack = new Slack(this.token);
            var msg = replaceWith(this.message, values);

            slack.api('chat.postMessage', {
              text: msg,
              channel: this.channel,
              username: this.bot_name,
              icon_emoji: this.bot_emoji,
            },function(err, response){
              if(err){
                logger.log('error','Slack notification: '+err);
                logger.log('error','Slack notification: '+msg);
              }
            });
            resolve();
         })
        .catch(function(e){
            logger.log('error','Slack notificate loadConfig '+e)
            resolve();
          });
      });
  }
}

class Event {
  constructor(name, process, notifications){
    return new Promise((resolve) => {
      this.loadEventsObjects(name, process, notifications)
        .then((events) => {
          resolve(events);
        })
        .catch(function(e){
           logger.log('error','Event constructor '+e);
           resolve();
         });
    });
  }

  loadEventsObjects(name, process, notifications) {
    return new Promise((resolve) => {
      var objEvent = {};
      objEvent[name] = {};

      //TODO: event/proccess

      var notificationsPromises = [];

      if (notifications instanceof Array) {
        var notificationsLength = notifications.length;
        if (notificationsLength > 0) {

          while (notificationsLength--) {
            var notification = notifications[notificationsLength];
            switch (notification.type) {
              case 'mail':
                notificationsPromises.push(new mailNotificator(notification.type,
                                                               notification.id,
                                                               notification.title,
                                                               notification.message,
                                                               notification.recipients,
                                                               notification.recipients_cc,
                                                               notification.recipients_cco
                                                               ));
                break;
              case 'slack':
                notificationsPromises.push(new slackNotificator(notification.type,
                                                                notification.id,
                                                                notification.token,
                                                                notification.bot_name,
                                                                notification.bot_emoji,
                                                                notification.message,
                                                                notification.channel,
                                                                notification.recipients
                                                                ));
                break;
            }
          }

          Promise.all(notificationsPromises)
            .then(function (res) {
              objEvent[name]['notifications'] = res;
              resolve(objEvent);
            })
            .catch(function(e){
              logger.log('error','Event loadEventsObjects: '+e);
              resolve(objEvent);
            });

        } else {
          logger.log('error','Event loadEventsObjects: '+e);
          resolve(objEvent);
        }
      } else {
        logger.log('error','Notifications, is not array', name, process, notifications);
        resolve(objEvent);
      }
    });
  }
}

class Process {
  constructor(id, name, depends_process, depends_process_alt, exec, args, retries, retry_delay, limited_time_end, end_on_fail, end_chain_on_fail, events, status, execute_return, execute_err_return, started_at, ended_at, output, chain_values){
    this.id = id;
    this.name = name;
    this.depends_process = depends_process;
    this.depends_process_alt = depends_process_alt;
    this.exec = exec;
    this.args = args;
    this.retries = retries;
    this.retry_delay = retry_delay;
    this.limited_time_end = limited_time_end;
    this.end_on_fail = end_on_fail || false;
    this.end_chain_on_fail = end_chain_on_fail || false;
    this.output = output;

    //Runtime attributes:
    this.status = status || "stop";
    this.execute_return = execute_return;
    this.execute_err_return = execute_err_return;
    this.started_at = started_at;
    this.ended_at = ended_at;
    this.events;

    this.chain_values = chain_values;

    return new Promise((resolve) => {
      this.loadEvents(events)
        .then((events) => {
          this.events = events;
          resolve(this);
          })
        .catch(function(e){
          logger.log('error','Process constructor loadEvents:'+e);
          resolve(this);
        });
    });

  }

  values(){
    var _this = this;
    return {
      "CHAIN_ID":_this.chain_values.CHAIN_ID,
      "CHAIN_NAME":_this.chain_values.CHAIN_NAME,
      "CHAIN_STARTED_AT":_this.chain_values.CHAIN_STARTED_AT,
      "PROCESS_ID":_this.id,
      "PROCESS_NAME":_this.name,
      "PROCESS_EXEC":_this.exec,
      "PROCESS_ARGS":_this.args,
      "PROCESS_EXECURTE_ARGS":_this.execute_args,
      "PROCESS_EXECUTE_RETURN":_this.execute_return,
      "PROCESS_EXECUTE_ERR_RETURN":_this.execute_err_return,
      "PROCESS_STARTED_AT":_this.started_at,
      "PROCESS_ENDED_AT":_this.ended_at,
      "PROCESS_RETRIES_COUNT": _this.retries_count,
      "PROCESS_RETRIES": _this.retries,
      "PROCESS_DEPENDS_FILES_READY": _this.depends_files_ready,
      "PROCESS_FIRST_DEPEND_FILE_READY": (_this.depends_files_ready && _this.depends_files_ready.length > 0) ? _this.depends_files_ready[0] : [],
      "PROCESS_LAST_DEPEND_FILE_READY": (_this.depends_files_ready && _this.depends_files_ready.length > 0) ? _this.depends_files_ready[_this.depends_files_ready.length - 1] : [],
      "PROCESS_EXEC_MYSQL_RESULTS":_this.execute_mysql_results,
      "PROCESS_EXEC_MYSQL_RESULTS_CSV":_this.execute_mysql_results_csv,
      "PROCESS_EXEC_MYSQL_FIELDCOUNT":_this.execute_mysql_fieldCount,
      "PROCESS_EXEC_MYSQL_AFFECTEDROWS":_this.execute_mysql_affectedRows,
      "PROCESS_EXEC_MYSQL_CHANGEDROWS":_this.execute_mysql_changedRows,
      "PROCESS_EXEC_MYSQL_INSERTID":_this.execute_mysql_insertId,
      "PROCESS_EXEC_MYSQL_WARNINGCOUNT":_this.execute_mysql_warningCount,
      "PROCESS_EXEC_MYSQL_MESSAGE":_this.execute_mysql_message
  };
  }

  loadEvents(events){
    return new Promise((resolve) => {
      var processEventsPromises = [];

      if (events instanceof Object) {
        var keys = Object.keys(events);
        var keysLength = keys.length;
        if (keys  instanceof Array) {
          if (keysLength > 0) {
            while (keysLength--) {
              var event = events[keys[keysLength]];
              if(event.hasOwnProperty('notifications')){
                processEventsPromises.push(new Event(keys[keysLength],
                                                     event.process,
                                                     event.notifications
                                                     ));
              }else{
                logger.log('debug','Process Events without notifications');
              }
            }

            Promise.all(processEventsPromises)
              .then(function (eventsArr) {
                var events = {};
                var eventsArrLength = eventsArr.length;
                while (eventsArrLength--) {
                  var e = eventsArr[eventsArrLength];
                  var key = Object.keys(e);
                  events[key[0]] = e[key[0]];
                }
                resolve(events);
              })
              .catch(function(e){
                logger.log('error','Process loadEvents: '+e);
                resolve();
              });
          }
        }
      }else{
        logger.log('error','Process, events is not object', err);
        resolve();
      }
    });
  }

  loadDbConfig(){
    var _this = this;
    return loadConfigSection('db_connections', _this.exec.db_connection_id);
  }

  notificate(event){
    var _this = this;

    if(_this.hasOwnProperty('events') && _this.events !== undefined){
      if(_this.events.hasOwnProperty(event)){
        if(_this.events[event].hasOwnProperty('notifications')){
          if(_this.events[event].notifications instanceof Array){

            var notificationsLength = _this.events[event].notifications.length;
            while(notificationsLength--){
              _this.events[event].notifications[notificationsLength].notificate(_this.values())
                .then(function(res){
                  logger.log('debug','Notification process sended: '+res)
                })
                .catch(function(e){
                  logger.log('error',`Notificating ${event} process ${_this.id}:`+e)
                })
            }
          }
        }
      }
    }
  }

  isStoped(){
    return (this.status === 'stop');
  }

  isEnded(){
    return (this.status === 'end');
  }

  isRunning(){
    return (this.status === 'running');
  }

  isErrored(){
    return (this.status === 'error');
  }

  stop(){
    var _this = this;
    _this.status = 'stop';
    _this.ended_at = new Date();
  }

  end(noRunned){

    noRunned = noRunned || false; // If process has not been executed but we need set to end

    var _this = this;
    _this.status = 'end';
    _this.ended_at = new Date();

    //Clear depends_files_ready for re-check:
    _this.depends_files_ready = [];

    if(!noRunned){
      _this.notificate('on_end');
    }
  }

  error(){
    var _this = this;
    _this.status = 'error';
    _this.notificate('on_fail');
  }

  start(isRetry, forceOnceInRetry){
    var _this = this;
    _this.status = 'running';
    _this.started_at = new Date();

    if(!isRetry || isRetry === undefined){
      _this.notificate('on_start');
    }

    // forceOnceInRetry: this indicates that only try once in retry
    if(!forceOnceInRetry || forceOnceInRetry === undefined){
      forceOnceInRetry = false;
    }

    if(typeof _this.exec === 'string'){
      return _this.executeCommand(_this.exec);
    }else {
      switch (_this.exec.type) {
        case 'command':
          return _this.executeCommand(_this.exec.command);
          break;
        case 'mysql':
          return _this.executeMysql();
          break;
        default:
          logger.log('error', `Exec type is not valid ${_this.exec.type} for ${_this.id}`);
          break;
      }
    }
  }

  executeCommand(cmd){
    var _this = this;
    return new Promise(function(resolve, reject) {
      var stdout = '';
      var stderr = '';

      function repArg(arg){
        return replaceWith(arg, _this.values());
      }
      _this.execute_args = _this.args.map(repArg);

      _this.proc = spawn(cmd, _this.execute_args);

      _this.proc.stdout.on('data', function(chunk) {
        stdout += chunk;
      });
      _this.proc.stderr.on('data', function(chunk) {
        stderr += chunk;
      });
      _this.proc
        .on('error', function(){
          //reject();
        })
        .on('close', function(code) {
          if (code === 0) {
            _this.execute_return = stdout;
            _this.execute_err_return = stderr;
            _this.end();
            _this.write_output();
            resolve(stdout);
          } else {
            logger.log('error',_this.id+' FIN: '+code+' - '+stdout+' - '+stderr);

            _this.execute_return = stdout;
            _this.execute_err_return = stderr;
            _this.retries_count = _this.retries_count +1 || 1;
            _this.error();
            _this.write_output();

            if(_this.retries >= _this.retries_count && !forceOnceInRetry){

              _this.retry();

              setTimeout(function(){
                _this.start(true)
                  .then(function(res) {
                    _this.retries_count = 0;
                    resolve(res);
                  })
                  .catch(function(e){
                    logger.log('error','Retrying process:'+e)
                    resolve(e);
                  });
              }, _this.retry_delay * 1000 || 0);

            }else{
              if (_this.end_on_fail){
                _this.end();
                _this.write_output();
              }
              reject(_this, stderr);
            }
          }
        });
    });
  }

  executeMysql(){
    var _this = this;

    return new Promise(function(resolve, reject) {

      if(_this.exec.db_connection_id){
        _this.loadDbConfig()
          .then((configValues) => {

            _this.execute_arg = _this.args

            var connection = mysql.createConnection({
              host       : configValues.host,
              user       : configValues.user,
              password   : configValues.password,
              database   : configValues.database,
              socketPath : configValues.socketPath,
              ssl        : configValues.ssl,
              queryFormat:
                function (query, values) {
                  if (!values) return query.replace(/(\:\/)/g,':');
                  else {
                    var _query = query.replace(/\:(\w+)/g, function (txt, key) {
                    return values && key && values.hasOwnProperty(key)
                      ? this.escape(replaceWith(values[key],_this.values()))
                      : null;
                    }.bind(this)).replace(/(\:\/)/g,':');
                  }
                  return _query;
                }
            });

            connection.connect(function(err) {
              if (err) {
                logger.log('error','Error connecting Mysql: '+err)
                reject(err);
              }else{

                connection.query(_this.exec.command, _this.execute_arg, function(err, results) {
                  if (err){
                    logger.log('error',`executeMysql query ${_this.exec.command}: ${err}`);
                    _this.execute_err_return = err;
                    _this.execute_return = '';
                    _this.error();
                    _this.write_output();
                    reject(err);
                  }else{

                    if(results instanceof Array){

                      _this.execute_mysql_results = JSON.stringify(results);
                      csv.writeToString(results, {headers: true}, function(err, data){
                        if(err){
                          logger.log('error',`Generating csv output for execute_mysql_results_csv. id: ${_this.id}: ${err}. Results: ${results}`);
                        }else{
                          _this.execute_mysql_results_csv = data;
                        }
                        _this.execute_return = '';
                        _this.execute_err_return = '';
                        _this.end();
                        _this.write_output();
                        resolve();
                      });

                    }else{

                      if(results instanceof Object){
                        _this.execute_mysql_results      = '';
                        _this.execute_mysql_results_csv  = '';
                        _this.execute_mysql_fieldCount   = results.fieldCount;
                        _this.execute_mysql_affectedRows = results.affectedRows;
                        _this.execute_mysql_changedRows  = results.changedRows;
                        _this.execute_mysql_insertId     = results.insertId;
                        _this.execute_mysql_warningCount = results.warningCount;
                        _this.execute_mysql_message      = results.message;
                      }

                      _this.execute_return = '';
                      _this.execute_err_return = '';
                      _this.end();
                      _this.write_output();
                      resolve();

                    }
                  }
                });
                connection.end();
              }
            });
          })
          .catch(function(err){
            logger.log('error',`executeMysql loadDbConfig: ${err}`);
            _this.execute_err_return = `executeMysql loadDbConfig: ${err}`;
            _this.execute_return = '';
            _this.error();
            _this.write_output();
            reject(err);
          });

      }else{
        logger.log('error',`db_connection_id not set for ${_this.id}`);
        _this.execute_err_return = `db_connection_id not set for ${_this.id}`;
        _this.execute_return = '';
        _this.error();
        _this.write_output();
        reject();
      }
    });
  }

  retry(){
    var _this = this;
    _this.notificate('on_retry');
  }

  waiting_dependencies(){
    var _this = this;
    _this.notificate('on_waiting_dependencies');
  }

  write_output(){
    var _this = this;

    function repArg(arg){
      return replaceWith(arg, _this.values());
    }

    function writeFile(filePath, mode, os){
      fs.open(filePath, mode, (err, fd) => {
        fs.write(fd, os, null, 'utf8', function(){
          fs.close(fd, function(err){
            if(err){
              logger.log('error',`Closing file ${filePath} in writeFile in ${_this.id}: `,err);
            }
          });
        });
      });
    }

    function generateOutput(output){

      if(output && output.file_name && output.write.length > 0){

        var filePath = replaceWith(output.file_name, _this.values());
        var output_stream = output.write.map(repArg).filter(Boolean).join("\n");

        if(output.maxsize) {
          var maxSizeBytes = bytes(output.maxsize);
          var output_stream_length = output_stream.length;

          if(output_stream_length > maxSizeBytes){
            output_stream = output_stream.slice(output_stream_length - maxSizeBytes,output_stream_length);
            output_stream_length = maxSizeBytes;
            logger.log('debug',`output_stream truncated output_stream_length (${output_stream_length}) > maxSizeBytes (${maxSizeBytes})`);
          }
        }

        if(output.concat){
          if(output.maxsize){
            fs.stat(filePath, function(error, stats) {

              var fileSizeInBytes = 0;
              if(!error){
                fileSizeInBytes = stats.size;
              }
              //SI LA SUMA DEL TAMAÑO DEL FICHERO Y EL OUTPUT A ESCRIBIR DEL PROCESO SUPERAN EL MAXIMO PERMITIDO
              var totalSizeToWrite = fileSizeInBytes + output_stream_length;

              if(totalSizeToWrite > maxSizeBytes){
                //SE OBTIENE LA PARTE DEL FICHERO QUE JUNTO CON EL OUTPUT SUMAN EL TOTAL PERMITIDO PARA ESCRIBIRLO (SUSTIUYENDO EL FICHERO)
                var positionFileRead   =  (totalSizeToWrite) - maxSizeBytes;
                var lengthFileRead =  (fileSizeInBytes) - positionFileRead;

                fs.open(filePath, 'r', function(error, fd) {
                  if(lengthFileRead > 0){
                    var buffer = new Buffer(lengthFileRead);

                    fs.read(fd, buffer, 0, buffer.length, positionFileRead, function(error, bytesRead, buffer) {
                      var data = buffer.toString("utf8", 0, buffer.length);
                      data = data.concat("\n",output_stream);
                      fs.close(fd, function(err){
                        if(err){
                          logger.log('error',`Closing file ${filePath} in ${_this.id}: `,err);
                        }
                        writeFile(filePath, 'w', data);
                      });
                    });
                  }else{
                    //SI NO SE VA A ESCRIBIR NADA DEL FICHERO ACTUAL
                    writeFile(filePath, 'w', output_stream);
                  }
                });
              }else{
                writeFile(filePath, 'a+', output_stream);
              }
            });
          }else{
            writeFile(filePath, 'a+', output_stream);
          }

        }else{
          writeFile(filePath, 'w+', output_stream);
        }
      }
    }

    if(_this.output instanceof Array){
      var outputCountItems = _this.output.length;

      while(outputCountItems--){
        generateOutput(_this.output[outputCountItems]);
      }
    }else{
      generateOutput(_this.output);
    }

  }
}

class Chain {
  constructor(id, name, start_date, end_date, schedule_interval, depends_chains, depends_chains_alt, events, processes, status, started_at, ended_at) {
    this.id = id;
    this.name = name;
    this.start_date = start_date;
    this.end_date = end_date;
    this.schedule_interval = schedule_interval;
    this.depends_chains = depends_chains;
    this.depends_chains_alt = depends_chains_alt;
    this.events;
    this.status = status || "stop";
    this.started_at = started_at;
    this.ended_at = ended_at;
    this.processes;

    return new Promise((resolve) => {
      var _this = this;

      _this.loadProcesses(processes)
        .then((processes) => {
        _this.processes = processes;

        _this.loadEvents(events)
            .then((events) => {
              _this.events = events;
              resolve(_this);
            })
            .catch(function(e){
                logger.log('error',`Chain ${_this.id} loadEvents: `+e);
                resolve();
              });
        })
        .catch(function(e){
          logger.log('error',`Chain ${_this.id} loadProcesses: `+e);
          resolve();
        });
    });
  }

  // Executed in construction:
  loadProcesses(processes){
    var _this = this;
    return new Promise((resolve) => {
      var chainProcessPromises = [];
      var processesLength = processes.length;
      if (processes instanceof Array) {
        if (processesLength > 0) {

          while(processesLength--){
            var process = processes[processesLength];
            chainProcessPromises.push(_this.loadProcess(process));
          }

          Promise.all(chainProcessPromises)
            .then(function(processes) {
              var processesLength = processes.length;
              while(processesLength--){
                _this.loadProcessFileDependencies(processes[processesLength]);
              }
              resolve(processes);
            })
            .catch(function(e){
              logger.log('error',`Chain ${_this.id} loadProcesses:`+e)
              resolve();
            });

        }else{
          resolve();
        }
      }else{
        logger.log('error',`Chain ${_this.id} processes is not array`);
        resolve();
      }
    });
  }

  loadProcess(process){
    var _this = this;
    return new Promise((resolve) => {
        new Process(process.id,
                    process.name,
                    process.depends_process,
                    process.depends_process_alt,
                    process.exec,
                    process.args,
                    process.retries,
                    process.retry_delay,
                    process.limited_time_end,
                    process.end_on_fail,
                    process.end_chain_on_fail,
                    process.events,
                    process.status,
                    process.execute_return,
                    process.execute_err_return,
                    process.started_at,
                    process.ended_at,
                    process.output,
                    _this.values())
                    .then(function(res) {
                      resolve(res);
                    })
                    .catch(function(e){
                      logger.log('error','Loading process:'+e);
                      resolve();
                    });
      });
  }

  loadEvents(events){
    var _this = this;
    return new Promise((resolve) => {
    var processEventsPromises = [];

    if (events instanceof Object) {
      var keys = Object.keys(events);
      var keysLength = keys.length;
        if (keysLength > 0) {
          while (keysLength--) {
            var event = events[keys[keysLength]];
            if(event.hasOwnProperty('process') || event.hasOwnProperty('notifications')){
              processEventsPromises.push(new Event(keys[keysLength],
                event.process,
                event.notifications
              ));
            }else{
              logger.log('debug',`Chain ${_this.id} Events without procces and notifications`);
            }
          }

          Promise.all(processEventsPromises)
            .then(function (eventsArr) {
              var events = {};
              var eventsArrLength = eventsArr.length;
              while (eventsArrLength--) {
                var e = eventsArr[eventsArrLength];
                var key = Object.keys(e);
                events[key[0]] = e[key[0]];
              }
              resolve(events);
            })
            .catch(function(e){
              logger.log('error',`Chain ${_this.id} events: `+e);
              resolve();
            });

        }else{
          logger.log('warn',`Chain ${_this.id} events is empty`);
          resolve();
        }
    }else{
      logger.log('warn',`Chain ${_this.id} events is not object`);
      resolve();
    }
  });
  }

  loadProcessFileDependencies(process){
      var _this = this;

      var depends_process = process.depends_process;
      var dependsProcessLength = depends_process.length;

      if (dependsProcessLength > 0) {
        while (dependsProcessLength--) {
          var dependence = depends_process[dependsProcessLength];

          if(dependence instanceof Object){
            if(dependence.hasOwnProperty('file_name') && dependence.hasOwnProperty('condition')){

              //TODO: VALIDATE CONDITIONS VALUES

              var watcher = chokidar.watch(dependence.file_name, { ignored: /[\/\\](\.|\~)/,
                persistent: true,
                usePolling: true,
                awaitWriteFinish: {
                  stabilityThreshold: 2000,
                  pollInterval: 150
                }
              });

              watcher.on(dependence.condition, function(pathfile) {
                if(process.depends_files_ready){
                  process.depends_files_ready.push(pathfile);
                }else{
                  process.depends_files_ready = [pathfile];
                }

                // If chain is running try execute processes:
                if(_this.isRunning()){
                  _this.startProcesses();
                }
              })

              if(process.file_watchers){
                process.file_watchers.push(watcher);
              }else{
                process.file_watchers = [watcher];
              }

            }
          }
        }
      }
  }

  getProcessById(processId){
    var _this = this;

    function byId(process){
      return process.id === processId;
    }

    return _this.processes.find(byId);
  }

  values(){
    var _this = this;
    return {
      "CHAIN_ID":_this.id,
      "CHAIN_NAME":_this.name,
      "CHAIN_STARTED_AT":_this.started_at
    };
  }

  notificate(event){
    var _this = this;
    if(_this.hasOwnProperty('events') && _this.events !== undefined){
      if(_this.events.hasOwnProperty(event)){
        if(_this.events[event].hasOwnProperty('notifications')){
          if(_this.events[event].notifications instanceof Array){
            var notificationsLength = _this.events[event].notifications.length;
            while(notificationsLength--){
              _this.events[event].notifications[notificationsLength].notificate(_this.values())
                .then(function(res){
                  logger.log('debug','Notification chain sended: '+res)
                })
                .catch(function(e){
                  logger.log('error','Notification chain sended: '+e)
                });
            }
          }
        }
      }
    }
  }

  isStoped(){
    return (this.status === 'stop');
  }

  isEnded(){
    return (this.status === 'end');
  }

  isRunning(){
    return (this.status === 'running');
  }

  isErrored(){
    return (this.status === 'error');
  }

  stop(){
    this.status = 'stop';
  }

  end(){
    this.ended_at = new Date();
    this.status = 'end';
    this.notificate('on_end');
  }

  running(){
    this.started_at = new Date();
    this.notificate('on_start');
  }

  error(){
    this.status = 'error';
    this.notificate('on_fail');
  }

  //Start Chain
  start(){
    var chain = this;

    return new Promise((resolve) => {

      if(chain.hasOwnProperty('processes')){
        if(chain.processes instanceof Array && chain.processes.length > 0){
          // Initialize Chain
          if(chain.schedule_interval){

            chain.scheduleRepeater = schedule.scheduleJob(chain.schedule_interval, function(chain){

              if((new Date(chain.end_date)) < (new Date())){
                chain.scheduleRepeater.cancel();
              }

              if(chain.isStoped() || chain.isEnded()){
                chain.setChainToInitState()
                  .then(function(){
                    chain.startProcesses()
                      .then(function(res){
                        resolve();
                      })
                      .catch(function(e){
                        logger.log('error','Error in startProcesses:'+e);
                        resolve();
                      });
                  })
                  .catch(function(e){
                    logger.log('error','Error setChainToInitState: '+e);
                    resolve();
                  })
              }else{
                logger.log('warn',`Trying start processes of ${chain.id} but this is running`);
              }
            }.bind(null,chain))

          }else{
            chain.startProcesses()
              .then(function(res){
                resolve();
              })
              .catch(function(e){
                logger.log('error','Error in startProcesses:'+e);
                resolve();
              });
          }
        }else{
          logger.log('error',`Chain ${chain.id} dont have processes`);
          throw new Error(`Chain ${chain.id} dont have processes`);
          resolve();
        }
      }else{
        logger.log('error',`Invalid chain ${chain.id}, processes property not found.`);
        throw new Error(`Invalid chain ${chain.id}, processes property not found.`);
        resolve();
      }
      });
  }

  waiting_dependencies(){
    var _this = this;
    _this.notificate('on_waiting_dependencies');
  }

  setChainToInitState(){
    var _this = this;

    if(_this.isRunning() || _this.isErrored()){
      _this.end();
    }

    return new Promise((resolve) => {
      // Clear depends_files_ready
      // TODO: REVISAR ESTO - PROBLEMAS SI EXISTEN FICHEROS Y NO SE VUELVE A METER EN depends_files_ready
      _this.depends_files_ready = [];
      //Warning
      if (this.isRunning()){
        logger.log('warn',`This chain ${_this.id} is running yet and is being initialized`)
      }
      // Set All Process to stopped
      var processesLength = _this.processes.length;
      while(processesLength--) {
        this.processes[processesLength].stop();
      }
      resolve();
    });
  }

  refreshChainStatus(){
    return new Promise((resolve) => {

      var processesLength = this.processes.length;
      var statusChain = 'end';

      var processesError   = 0;
      var processesEnd     = 0;
      var processesRunning = 0;
      var processesStop    = 0;

      while(processesLength--) {
        switch (this.processes[processesLength].status)
        {
         case 'stop'   : processesStop += 1;    break;
         case 'end'    : processesEnd += 1;     break;
         case 'running': processesRunning += 1; break;
         case 'error'  : processesError += 1;   break;
        }
      }
      //Set Chain Status
      if (processesRunning > 0 || processesStop > 0){
        statusChain = 'running';
      }else{
        if (processesError > 0){
          statusChain = 'error';
        }else{
          statusChain = 'end';
        }
      }

      this.status = statusChain;
      resolve(statusChain);
    });
  }

  startProcesses(){

    var _this = this;

    var runningBeforeRefresh = _this.isRunning();

    return new Promise(function(resolve, reject) {
      _this.refreshChainStatus()
        .then(function(chainStatus){

          if(chainStatus === 'running' && !runningBeforeRefresh){
            _this.running();
          }

          // If Chains is running:
          if (chainStatus === 'running'){
            var chainProcessesLength = _this.processes.length;

            while(chainProcessesLength--) {
              var process = _this.processes[chainProcessesLength];

              if (process.isStoped()){
                logger.log('debug', `PLANIFICADO PROCESO ${process.id}`);

                var processMustDo = _this.checkProcessActionToDo(process);

                switch(processMustDo){
                  case 'run':

                    logger.log('debug', `Ejecutar YA ${process.id} -> start`);

                    process.start()
                      .then(function(){
                        _this.startProcesses()
                          .then(function(res){
                            resolve();
                          })
                          .catch(function(e){
                            logger.log('error','Error in startProcesses:'+e);
                            resolve();
                          })
                      })
                      .catch(function(proc, e){
                        logger.log('error','Error in process.start: '+e);

                        if (proc.end_chain_on_fail){

                          _this.setChainToInitState()
                            .then(function(){
                              logger.log('debug','setChainToInitState end_chain_on_fail');
                              resolve();
                            })
                            .catch(function(e){
                              logger.log('error','Error setChainToInitState on end_chain_on_fail: '+e);
                              resolve();
                            });

                        }else{

                          // Aun cuando hay error puede que haya procesos que tengan que ejecutarse:
                          _this.startProcesses()
                            .then(function(res){
                              resolve();
                            })
                            .catch(function(e){
                              logger.log('error','Error in startProcesses (prev errored):'+e);
                              resolve();
                            })
                        }
                      })

                    break;
                  case 'wait':

                    logger.log('debug', `Ejecutar PROCESO ${process.id} -> on_waiting_dependencies `);
                    process.waiting_dependencies();

                    break;
                  case 'end':
                    logger.log('debug', `No se ejecuta el PROCESO ${process.id} -> solo on_fail `);
                    process.end(true);

                    _this.startProcesses()
                      .then(function(res){
                        resolve();
                      })
                      .catch(function(e){
                        logger.log('error','Error in startProcesses (end errored):'+e);
                        resolve();
                      })

                    break;
                }

              }
            }
          }else{
            resolve();
          }
        })
        .catch(function(e){
          logger.log('error','Error en refreshChainStatus: '+e);
          resolve();
        })
    });
  }


  checkProcessActionToDo(process){

    var _this = this;
    var action = 'run';

    if(process.hasOwnProperty('depends_process') && process.depends_process.length > 0){
      var depends_process = process.depends_process;
      var planProcess = this.processes;

      var dependsprocessLength = depends_process.length;

      //File dependences:
      // Check process dependencies
      while(dependsprocessLength--) {
        if (typeof depends_process[dependsprocessLength]) {
          if(depends_process[dependsprocessLength].hasOwnProperty('file_name')){
            // If any depends files is ready
            if(process.depends_files_ready){

              // Check if all process depends files is ready
              var depends_files_ready_length = process.depends_files_ready.length;
              var dependenceFound = false;

              while(depends_files_ready_length--){
                // Using anumatch to check regular expression glob:
                if (anymatch([depends_process[dependsprocessLength].file_name], process.depends_files_ready[depends_files_ready_length])){
                  dependenceFound = true;
                }
              }

              if (!dependenceFound){
                action = 'wait';
              }

            }else{
              action = 'wait';
            }
          }
        }
      }

      //Process dependences:
      var planProcessLength = _this.processes.length;
      dependsprocessLength = depends_process.length;

      while(planProcessLength--){
        var auxDependsprocessLength = dependsprocessLength;

        while(auxDependsprocessLength--){
          switch (typeof depends_process[auxDependsprocessLength]) {
            case 'string':

              if(depends_process[auxDependsprocessLength] === planProcess[planProcessLength].id){
                if(!planProcess[planProcessLength].isEnded()){
                  action = 'wait';
                }else{
                  if(planProcess[planProcessLength].isErrored()){
                    action = 'wait';
                  }else{
                    action = 'run';
                  }
                }
              }

              break;
            case 'object':
              if(!depends_process[auxDependsprocessLength].hasOwnProperty('file_name')){

                if(depends_process[auxDependsprocessLength].id === planProcess[planProcessLength].id){

                  if(!planProcess[planProcessLength].isEnded() && !planProcess[planProcessLength].isErrored()){
                    action = 'wait';
                  }else{
                    var on_fail = false;
                    if(depends_process[auxDependsprocessLength].hasOwnProperty('on_fail')){
                      on_fail = depends_process[auxDependsprocessLength].on_fail;
                    }

                    if(planProcess[planProcessLength].isErrored()){
                      if(on_fail){
                        action = 'run';
                      }else{
                        action = 'wait';
                      }
                    }else{
                      if(on_fail){
                        action = 'end';
                      }else{
                        action = 'run';
                      }
                    }
                  }
                }
              }
              break;
          }
        }
      }
      return action;
    }else{
      return action;
    }
  }

}

class Plan{
  constructor(version, chains){
    this.version = version;
    this.chains;
    return new Promise((resolve) => {
      this.loadChains(chains)
        .then((chains) => {
          this.chains = chains;
          resolve(this);
        })
        .catch(function(e){
          logger.log('error','Plan constructor:'+e);
          resolve(this);
      });
    });
  }

  loadChains(chains){
    var _this = this;
    return new Promise((resolve) => {
      if (chains instanceof Array) {
        var chainLength = chains.length;
        if (chainLength > 0) {
          var planChainsPromises = [];

          while(chainLength--){
            var chain = chains[chainLength];

            planChainsPromises.push(_this.loadChain(chain));
          }

          Promise.all(planChainsPromises)
            .then(function(chains) {

              var chainsLength = chains.length;
              while(chainsLength--){
                _this.loadChainFileDependencies(chains[chainsLength]);
              }
              resolve(chains);
            })
            .catch(function(e){
              logger.log('error','Loading chains:'+e);
              resolve();
            });

        }else{
          logger.log('error','Plan have not Chains');
          resolve();
        }
      }else{
        logger.log('error','Chain, processes is not array');
        resolve();
      }
    });
  }

  loadChain(chain){
    return new Promise((resolve) => {

      new Chain(chain.id,
                chain.name,
                chain.start_date,
                chain.end_date,
                chain.schedule_interval,
                chain.depends_chains,
                chain.depends_chains_alt,
                chain.events,
                chain.processes,
                chain.status,
                chain.started_at,
                chain.ended_at)
          .then(function(res) {
            resolve(res);
          })
          .catch(function(e){
            logger.log('error','Loading chain:'+e);
            resolve();
          });
    });
  }

  loadChainFileDependencies(chain){
    var _this = this;

    var depends_chain = chain.depends_chains;
    var dependsChainLength = depends_chain.length;

    if (dependsChainLength > 0) {
      while (dependsChainLength--) {
        var dependence = depends_chain[dependsChainLength];

        if(dependence instanceof Object){
          if(dependence.hasOwnProperty('file_name') && dependence.hasOwnProperty('condition')){

            //TODO: VALIDATE CONDITIONS VALUES

            var watcher = chokidar.watch(dependence.file_name, { ignored: /[\/\\](\.|\~)/,
              persistent: true,
              usePolling: true,
              awaitWriteFinish: {
                stabilityThreshold: 2000,
                pollInterval: 150
              }
            });

            watcher.on(dependence.condition, function(pathfile) {
              if(chain.depends_files_ready){
                chain.depends_files_ready.push(pathfile);
              }else{
                chain.depends_files_ready = [pathfile];
              }

              if(!chain.isRunning() && !chain.isErrored()){
               _this.planificateChain(chain);
              }

            })

            if(process.file_watchers){
              process.file_watchers.push(watcher);
            }else{
              process.file_watchers = [watcher];
            }

          }
        }
      }
    }
  }

  planificateChains(){
    var _this = this;
    var planChainsLength = this.chains.length;
    while(planChainsLength--) {
      var chain = this.chains[planChainsLength];
      _this.planificateChain(chain);
    }
  };

  planificateChain(chain){
    var _this = this;
    // Cuando llega una cadena con running pero sin scheduleRepeater la cadena debe volver a empezar
    // Espero que se den por ejecutados los procesos con estado "end" y así continue la ejecución por donde debe:
    if(chain.schedule_interval !== undefined && chain.scheduleRepeater === undefined){
      chain.stop();
    };

    if ((!chain.hasOwnProperty('end_date') || (chain.hasOwnProperty('end_date') && new Date(chain.end_date) > new Date())) && (chain.isStoped()))
    {
      if(chain.hasOwnProperty('start_date')){

        logger.log('debug', `PLANIFICADA CADENA ${chain.id} EN ${(new Date(chain.start_date))}`);

        if ((new Date(chain.start_date)) <= (new Date())){

          logger.log('debug', `start_date: ${(new Date(chain.start_date)) } / now: ${(new Date())}`);


          logger.log('debug', `INTENTANDO INICIAR CADENA ${chain.id} EN ${(new Date(chain.start_date))}`);

          if(_this.hasDependenciesBlocking(chain)){
            chain.waiting_dependencies();
            logger.log('warn', `Ejecutar cadena ${chain.id} -> on_waiting_dependencies`);
          }else{
            chain.start()
              .then(function() {
                _this.planificateChains()
              })
              .catch(function(e){logger.log('error','Error '+e)});
          }
        }else{
          // Will execute in start_date set
          chain.schedule = schedule.scheduleJob(new Date(chain.start_date), function(chain){
            if(_this.hasDependenciesBlocking(chain)){
              chain.waiting_dependencies();
              logger.log('debug', `Ejecutar a FUTURO ${chain.id} -> on_waiting_dependencies`);
            }else{
              logger.log('debug', `Ejecutar a FUTURO ${chain.id} -> start`);
              chain.start()
                .then(function() {
                  _this.planificateChains()
                })
                .catch(function(e){logger.log('error','Error '+e)});
            }
          }.bind(null,chain));
        }

        // Remove Chain from pool
        if(chain.hasOwnProperty('end_date')){

          logger.log('debug',`PLANIFICADA CANCELACION DE CADENA ${chain.id} EN ${(new Date(chain.end_date))}`);

          chain.scheduleCancel = schedule.scheduleJob(new Date(chain.end_date), function(chain){

            logger.log('debug',`CANCELANDO CADENA ${chain.id}`);

            chain.schedule.cancel();

          }.bind(null,chain));
        }

      }else{
        logger.log('error',`Invalid PlanFile, chain ${chain.id} don´t have start_date.`);
        throw new Error(`Invalid PlanFile, chain ${chain.id} don´t have start_date.`);
      }
    }else{
      logger.log('warn',`CHAIN ${chain.id} IGNORED: END_DATE ${chain.end_date} < CURRENT DATE: `,new Date(),'-  chain.status:'+chain.status,'- chain.schedule_interval:',chain.schedule_interval,'- chain.scheduleRepeater:',(chain.scheduleRepeater===undefined));
    }
  };

  getChainById(chainId){
    var _this = this;

    function byId(chain){
      return chain.id === chainId;
    }

    return _this.chains.find(byId);
  }

  getIndexChainById(chainId){
    var _this = this;

    function byId(chain){
      return chain.id === chainId;
    }

    return _this.chains.findIndex(byId);
  }

  // Load a Chain. If exists replace and If not exists add the chain:
  loadChainToPlan(newChain){

    var _this = this;
    var chainId = newChain.id;
    var indexChain = _this.getIndexChainById(chainId);

    if(indexChain > -1){
      _this.chains[indexChain] = newChain;
    }else{
      _this.chains.push(newChain);
    }
    // Planificate load/reload chain
    _this.planificateChain(_this.getChainById(chainId));
  }

  dependenciesBlocking(chain){

    var hasDependencies = false;
    var chainsDependencies = [];

    if(chain.hasOwnProperty('depends_chains') && chain.depends_chains.length > 0){
      var depends_chains = chain.depends_chains;
      var planChains = this.chains;

      var planChainsLength = this.chains.length;
      var dependsChainsLength = depends_chains.length;

      //File dependences:
      while(dependsChainsLength--) {
        if (typeof depends_chains[dependsChainsLength]) {
          if(depends_chains[dependsChainsLength].hasOwnProperty('file_name')){
            if(chain.depends_files_ready){

              if(chain.depends_files_ready.indexOf(depends_chains[dependsChainsLength].file_name) > -1){
              }else{
                chainsDependencies.push(depends_chains[dependsChainsLength]);
                hasDependencies = true;
              }
            }else{
              chainsDependencies.push(depends_chains);
              hasDependencies = true;
            }
          }
        }
      }

      //Chains dependences:
      dependsChainsLength = depends_chains.length;

      while(planChainsLength--){
        var auxDependsChainsLength = dependsChainsLength;

        while(auxDependsChainsLength--){
          switch (typeof depends_chains[auxDependsChainsLength]) {
            case 'string':
              if(depends_chains[auxDependsChainsLength] === planChains[planChainsLength].id){
                if(!planChains[planChainsLength].isEnded()){
                  chainsDependencies.push(planChains[planChainsLength]);
                  hasDependencies = true;
                }
              }
              break;
            case 'object':
              if(depends_chains[auxDependsChainsLength].id === planChains[planChainsLength].id){
                if(planChains[planChainsLength].isEnded() || (depends_chains[auxDependsChainsLength].ignore_fail && planChains[planChainsLength].isErrored())){
                }else{
                  chainsDependencies.push(planChains[planChainsLength]);
                  hasDependencies = true;
                }
              }
              break;
          }
        }
      }
      return chainsDependencies;
    }else{
      return chainsDependencies;
    }
  }

  hasDependenciesBlocking(chain){
    return (this.dependenciesBlocking(chain).length > 0);
  }

};


class FilePlan {
  constructor(filePath){
    this.filePath = filePath;
    this.fileContent;
    this.lastHashPlan;
    this.plan;

    return new Promise((resolve) => {
      var _this = this;
      this.loadFileContent(filePath)
        .then((res) => {
        _this.fileContent = res;
        _this.getChains(res)
          .then((chains) => {
          new Plan('', chains)
            .then(function(plan){
              _this.plan = plan;
              _this.plan.planificateChains();
              _this.startAutoRefreshBinBackup();
              resolve(_this);
            })
            .catch(function(err){
              logger.log('error','FilePlan new Plan: '+err);
              resolve();
            })
        })
        .catch(function(err){
            logger.log('error','FilePlan loadFileContent getChains: '+err);
            resolve();
          });
        })
        .catch(function(e){
          logger.log('error','File Plan, constructor:'+e)
          resolve(this);
        });
    });
  }

  loadFileContent(filePath){
    var _this = this;
    return new Promise((resolve) => {
      fs.stat(filePath, function(err, res){
        if(err){
          logger.log('error',`File ${filePath} not exists.`, err);
          throw new Error(`File ${filePath} not found.`);
          resolve();
        }else{
          try {
            fs.readFile(filePath, 'utf8', function(err, res){
              if(err){
                logger.log('error',`File loadFileContent (${filePath}) readFile: `+err);
                resolve();
              }else{
                resolve(JSON.parse(res));
              }
            });
          } catch(e) {
            throw new Error(`Invalid file (${filePath}), incorrect JSON format: `+e.message,e);
            resolve();
          }
        }
      });
    });
  }

  getChains(json){
    var _this = this;

    return new Promise((resolve) => {

      if(json.hasOwnProperty('chains')){
        if(json.chains instanceof Array){

          var loadChains = [];

          function getAllChains(chain){
            loadChains.push(_this.getChain(chain));
          }

          json.chains.map(getAllChains);

          Promise.all(loadChains)
            .then(function (res) {
              resolve(res);
            })
            .catch(function(e){
              logger.log('error', 'getChains error: ', e);
              reject();
            });

        }else{
          throw new Error('Invalid PlanFile, chain is not an array.');
          resolve();
        }
      }else{
        throw new Error('Invalid PlanFile, chain property not found.');
        resolve();
      }

    });
  };

  getChain(chain){
    var _this = this;
    return new Promise(function(resolve, reject) {

      if (_this.chainIsValid(chain)) {
        resolve(chain);
      } else {
        if (chain.hasOwnProperty('chain_path')) {

          _this.loadFileContent(chain.chain_path)
            .then((res) => {
              _this.getChain(res)
                  .then((res) => {
                    resolve(res);
                  })
                  .catch(function(err){
                    logger.log('error', 'External chain error: ', err, chain);
                    reject();
                  })
            })
            .catch(function(err){
              logger.log('error', 'External chain file error: ', err, chain);
              reject();
            });

        } else {
          logger.log('error', 'Chain ignored, id, name or start_date is not set: ', chain);
          reject();
        }
      }
    });
}

  chainIsValid(chain){

    if(chain.hasOwnProperty('id') && chain.hasOwnProperty('name') && chain.hasOwnProperty('start_date')){
      return true;
    }else{
      return false;
    }

  };

  refreshBinBackup(){
    var _this = this;
    var plan = _this.plan;

      var objStr = JSON.stringify(plan);
      var hashPlan = crypto.createHash('sha256').update(objStr).digest("hex");

      if(_this.lastHashPlan !== hashPlan){
        _this.lastHashPlan = hashPlan;
        logger.log('debug','> REFRESING hashPlan:',hashPlan);
        fs.writeFileSync(config.general.binBackup, objStr, null);
      }
  }

  startAutoRefreshBinBackup(){
    var _this = this;
    setTimeout(function(){
      _this.refreshBinBackup();
    }, config.general.refreshIntervalBinBackup);
  }

};

// CLASES ----- END ------
var runtimePlan;
var reloadPlan = false;

// CHECK ARGS APP:
program
  .version('0.0.1')
  .option('-c, --config <path>', `set config path. defaults to ${configFilePath}`,function(filePath){
    configFilePath = filePath;
  })
  .option('-r, --reload', 'reload plan', function(){
    reloadPlan = true;
  })

program.parse(process.argv);

logger.log('info',`RUNNERTY RUNNING - TIME...: ${new Date()}`);

//LOAD GENERAL CONFIG:
loadGeneralConfig(configFilePath)
  .then(function(fileConfig){
    config = fileConfig;

    var fileLoad;
    if(reloadPlan){
      fileLoad = config.general.planFilePath;
      logger.log('warn',`Reloading plan from ${fileLoad}`);
    }
    else{
      fileLoad = config.general.binBackup;
    }

    new FilePlan(fileLoad)
      .then(function(plan){
        runtimePlan = plan;
        require('./api/api.js')(config.general, logger, runtimePlan);
      })
      .catch(function(e){
        logger.log('error','FilePlan: '+e);
      });

  })
  .catch(function(e){
    logger.log('error',`Config file ${configFilePath}: `+e);
  });


//==================================================================
//
process.on('uncaughtException', function (err) {
  logger.log('error',err.stack);
});

process.on('exit', function (err) {
  logger.log('warn','--> [R]unnerty stoped.', err);
});


// TODO -->
// LOGS EN S3
// CONFIGURACIONES GENERALES DE: BD, SLACK, MAIL, S3 (ya ejemplos en plan.json)
// EJECUCIÓN DE SENTENCIAS SIMPLES SQL A BDS (MYSQL Y POSTGRES?)
