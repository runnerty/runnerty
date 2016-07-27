"use strict";
var config 			    = require('./config/config.js');
var winston         = require('winston');
var schedule        = require('node-schedule');
var async           = require('async');
var spawn           = require('child_process').spawn;
var fs 				      = require('fs');
var path            = require('path');
var crypto          = require('crypto');
var nodemailer      = require('nodemailer');

// UTILS

function renderTemplate(text, objParams){
  var keys = Object.keys(objParams);
  var keysLength = keys.length;
  while (keysLength--) {
    text = text.replace(new RegExp('\\:' + keys[keysLength], 'gi'), objParams[keys[keysLength]]);
  }
  return text;
}

function sendMail(mail, callback){

  var transport = nodemailer.createTransport(mail.transport);

  console.log(mail);

  var templateDir  = path.resolve(mail.templateDir, mail.template);
  var htmlTemplate = path.resolve(templateDir, 'html.html');
  var txtTemplate	 = path.resolve(templateDir, 'text.txt');

  try{
    fs.readFile(htmlTemplate, function(err, data) {
      if(err){
        logger.log('error','Error reading template html: '+htmlTemplate+' - ',err);
        callback(err,null);
      }else{
        var html = renderTemplate(data.toString(), mail.params);

        fs.readFile(txtTemplate, function(err, data) {
          if(err){
            logger.log('error','Error reading template txt: '+txtTemplate+' - ',err);
            callback(err,null);
          }else{
            var text = renderTemplate(data.toString(), mail.params);

            var mailOptions = {
              from: mail.from,
              to: mail.to,
              subject: mail.params.subject,
              text: text,
              html: html
            };

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
        });
      }
    });
  }
  catch(e){
    logger.log('error','Send mail:'+e)
  }

};

// LOGGER  ---------------------------------------------------------------------
var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({colorize: 'all', level: 'info'}),
   // new (winston.transports.File)({name: 'info-file', filename: 'filelog-info.log', level: 'info'}),
   // new (winston.transports.File)({name: 'error-file',filename: 'filelog-error.log',level: 'error'}),
  ]
});
logger.level = 'debug';

// CLASSES ---------------------------------------------------------------------

class Notification {
  constructor(type, title, message, recipients, recipients_cc, recipients_cco) {
    this.type = type;
    this.title = title;
    this.message = message;
    this.recipients = recipients;
    this.recipients_cc = recipients_cc;
    this.recipients_cco = recipients_cco;
  }

  notificate(){
    logger.log('warn','Este método debería de haber sido reescrito en la clase child');
  }
}

class mailNotificator extends Notification{
  constructor(type, title, message, recipients, recipients_cc, recipients_cco){
    super('mail', title, message, recipients, recipients_cc, recipients_cco);
    return new Promise((resolve) => {
      resolve(this);
    });
  }

  notificate(values){
    var mailOptions = config.mailOptions;
    mailOptions.template = mailOptions.template || config.mailOptions.default_template;

    for (var i = 0, len = this.recipients.length; i < len; i++) {
      if (i){
        mailOptions.to = mailOptions.to + this.recipients[i] + ((i < len-1) ? ', ' : '');
      }
      else{
        mailOptions.to = this.recipients[i] + ((i < len-1) ? ', ' : '');
      }
    }

    for (var i = 0, len = this.recipients_cc.length; i < len; i++) {
      if (i){
        mailOptions.cc = mailOptions.cc + this.recipients_cc[i] + ((i < len-1) ? ', ' : '');
      }
      else{
        mailOptions.cc = this.recipients_cc[i] + ((i < len-1) ? ', ' : '');
      }
    }

    for (var i = 0, len = this.recipients_cco.length; i < len; i++) {
      if (i){
        mailOptions.bcc = mailOptions.bcc + this.recipients_cco[i] + ((i < len-1) ? ', ' : '');
      }
      else{
        mailOptions.bcc = this.recipients_cco[i] + ((i < len-1) ? ', ' : '');
      }
    }
    mailOptions.params = values;
    mailOptions.params.subject = renderTemplate(this.title, values);
    mailOptions.params.message = renderTemplate(this.message, values);

    sendMail(mailOptions, function(err, res){});
  }
}

class slackNotificator extends Notification{
  constructor(type, title, message, recipients, recipients_cc, recipients_cco){
    super('slack', title, message, recipients, recipients_cc, recipients_cco);
    return new Promise((resolve) => {
      resolve(this);
    });
  }

  notificate(values){
    //TODO: IMPLEMENTAR AQUI ENVIO VIA SLACK
    logger.log('info','ENVIARIA SLACK', values);
  }
}

class Event {
  constructor(name, process, notifications){
    return new Promise((resolve) => {
      this.loadEventsObjects(name, process, notifications)
        .then((events) => {
          resolve(events);
        })
        .catch(function(e){logger.log('error',e)});
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
                                                               notification.title,
                                                               notification.message,
                                                               notification.recipients,
                                                               notification.recipients_cc,
                                                               notification.recipients_cco
                                                               ));
                break;
              case 'slack':
                notificationsPromises.push(new slackNotificator(notification.type,
                                                                notification.title,
                                                                notification.message,
                                                                notification.recipients,
                                                                notification.recipients_cc,
                                                                notification.recipients_cco
                                                                ));
                break;
            }
          }

          Promise.all(notificationsPromises)
            .then(function (dataArr) {
              objEvent[name]['notifications'] = dataArr;
              resolve(objEvent);
            })
            .catch(function(e){console.error(e)});

        } else {
          resolve(objEvent);
        }
      } else {
        logger.log('error','Notifications, is not array', name, process, notifications);
        resolve(objEvent);
      }
      //promisesProcessNotification.push(new Process(process.id, process.name, process.depends_process, process.depends_process_alt, process.command, process.args, process.retries, process.retry_delay, process.limited_time_end, process.events));
    });
  }
}

class Process {
  constructor(id, name, depends_process, depends_process_alt, command, args, retries, retry_delay, limited_time_end, events, status, execute_return, execute_err_return, started_at, ended_at, chain_values){
    this.id = id;
    this.name = name;
    this.depends_process = depends_process;
    this.depends_process_alt = depends_process_alt;
    this.command = command;
    this.args = args;
    this.retries = retries;
    this.retry_delay = retry_delay;
    this.limited_time_end = limited_time_end;
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
        .catch(function(e){console.error(e)});
    });

  }

  values(){
    var _this = this;

    return {
      "CHAIN_ID":_this.chain_values.id,
      "CHAIN_NAME":_this.chain_values.name,
      "CHAIN_STARTED_AT":_this.chain_values.started_at,
      "PROCESS_ID":_this.id,
      "PROCESS_NAME":_this.name,
      "PROCESS_COMMAND":_this.command,
      "PROCESS_ARGS":_this.args,
      "PROCESS_EXECUTE_RETURN":_this.execute_return,
      "PROCESS_EXECUTE_ERR_RETURN":_this.execute_err_return,
      "PROCESS_STARTED_AT":_this.started_at,
      "PROCESS_ENDED_AT":_this.ended_at
    };
  }

  loadEvents(events){
    return new Promise((resolve) => {
      var processEventsPromises = [];

      if (events instanceof Object) {
        var keys = Object.keys(events);
        var keysLength = keys.length;
        if (keys instanceof Array) {
          if (keysLength > 0) {
            while (keysLength--) {
              var event = events[keys[keysLength]];
              if(event.hasOwnProperty('process') || event.hasOwnProperty('notifications')){
                processEventsPromises.push(new Event(keys[keysLength],
                                                     event.process,
                                                     event.notifications
                                                     ));
              }else{
                logger.log('warn','Events without procces and notifications');
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
              .catch(function(e){console.error(e)});
          }
        }
      }else{
        logger.log('error','Process, events is not object', err);
        resolve();
      }
    });
  }

  stop(){
    this.status = 'stop';
  }

  end(){
    var _this = this;
    _this.status = 'end';
    _this.ended_at = new Date();

    if(_this.events.hasOwnProperty('on_end')){
      if(_this.events.on_end.hasOwnProperty('notifications')){
        if(_this.events.on_end.notifications instanceof Array){

          var notificationsLength = _this.events.on_end.notifications.length;
          while(notificationsLength--){
            _this.events.on_end.notifications[notificationsLength].notificate(_this.values());
          }

        }
      }
    }
  }

  running(){
    this.status = 'running';
  }

  error(){
    this.status = 'error';
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

  start(){
    var _this = this;
    _this.started_at = new Date();

    logger.log('info','SE EJECUTA START DE '+this.id);

    return new Promise(function(resolve, reject) {
      var stdout = '';
      var stderr = '';
      var cp = spawn(_this.command, _this.args);
      cp.stdout.on('data', function(chunk) {
        stdout += chunk;
      });
      cp.stderr.on('data', function(chunk) {
        stderr += chunk;
      });
      cp.on('error', reject)
        .on('close', function(code) {
          logger.log('info',_this.id+'FIN: ------------> '+code+' - '+stdout+' - '+stderr);
          if (code === 0) {
            _this.end();
            _this.exec_return = stdout;
            _this.exec_err_return = stderr;
            resolve(stdout);
          } else {
            logger.log('error',_this.id+'FIN: '+code+' - '+stdout+' - '+stderr);
            _this.error();
            _this.exec_return = stdout;
            _this.exec_err_return = stderr;
            reject(stderr);
          }
        });
    });
  }

}

class Chain {
  constructor(id, name, start_date, end_date, schedule_interval, prevent_overlap, depends_chains, depends_chains_alt, events, processes, status, started_at, ended_at) {
    this.id = id;
    this.name = name;
    this.start_date = start_date;
    this.end_date = end_date;
    this.schedule_interval = schedule_interval;
    this.prevent_overlap = prevent_overlap;
    this.depends_chains = depends_chains;
    this.depends_chains_alt = depends_chains_alt;
    this.events = events;
    this.status = status || "stop";
    this.started_at = started_at;
    this.ended_at = ended_at;
    this.processes;

    return new Promise((resolve) => {
      this.loadProcesses(processes)
        .then((processes) => {
          this.processes = processes;
          resolve(this);
        })
        .catch(function(e){
          console.error(e);
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

            chainProcessPromises.push(new Process(process.id,
                                                  process.name,
                                                  process.depends_process,
                                                  process.depends_process_alt,
                                                  process.command,
                                                  process.args,
                                                  process.retries,
                                                  process.retry_delay,
                                                  process.limited_time_end,
                                                  process.events,
                                                  process.status,
                                                  process.execute_return,
                                                  process.execute_err_return,
                                                  process.started_at,
                                                  process.ended_at,
                                                  _this.values()));
          }

          Promise.all(chainProcessPromises)
            .then(function(dataArr) {
              resolve(dataArr);
            })
            .catch(function(e){
              console.error(e)
              resolve();
            });

        }else{
          resolve();
        }
      }else{
        logger.log('error','Chain, processes is not array', err);
        resolve();
      }
    });
  }

  values(){
    var _this = this;

    return {
      "id":_this.id,
      "name":_this.name,
      "started_at":_this.started_at
    };
  }

  stop(){
    this.status = 'stop';
  }

  end(){
    this.status = 'end';
    this.ended_at = new Date();
  }

  running(){
    this.status = 'running';
  }

  error(){
    this.status = 'error';
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

  //Start Chain
  start(){
    var chain = this;
    chain.started_at = new Date();

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

  setChainToInitState(){
    return new Promise((resolve) => {
      //Warning
      if (this.isRunning()){
        logger.log('warn',`This chain ${this.id} is running yet and is being initialized`)
      }
      // Set All Process to stopped
      this.running();
      var processesLength = this.processes.length;
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

    return new Promise(function(resolve, reject) {

      _this.refreshChainStatus()
        .then(function(chainStatus){

          logger.log('info',_this.id+' - chainStatus:'+chainStatus);

          // If Chains si running:
          if (chainStatus === 'running'){
            var chainProcessesLength = _this.processes.length;

            while(chainProcessesLength--) {
              var process = _this.processes[chainProcessesLength];

              if (process.isStoped()){
                logger.log('debug', `PLANIFICADO PROCESO ${process.id}`);
                if(_this.hasProcessDependecies(process).length > 0){
                  logger.log('warn', `Ejecutar PROCESO ${process.id} -> on_waiting_dependencies: `,_this.hasProcessDependecies(process));
                }else{
                  logger.log('info', `Ejecutar YA ${process.id} -> start`);

                  process.start()
                    .then(function(){
                      logger.log('info','[!!!] RE EJECUCIÓN DE STARTPROCCESES:');

                      _this.startProcesses()
                        .then(function(res){
                          resolve();
                        })
                        .catch(function(e){
                          resolve();
                          logger.log('error','Error in startProcesses:'+e);
                        })
                    })
                    .catch(function(e){
                      resolve();
                      logger.log('error','Error in process.start:'+e);
                    })
                }
              }
            }
          }else{
            resolve();
          }
        })
        .catch(function(e){
          resolve();
          logger.log('error','Error en refreshChainStatus: '+e);
        })
    });

  }

  hasProcessDependecies(process){

    var hasDependencies = false;
    var processesDependencies = [];

    if(process.hasOwnProperty('depends_process') && process.depends_process.length > 0){
      var depends_process = process.depends_process;
      var planProcess = this.processes;

      var planProcessLength = this.processes.length;
      var dependsprocessLength = depends_process.length;

      while(planProcessLength--){
        var auxDependsprocessLength = dependsprocessLength;

        while(auxDependsprocessLength--){
          switch (typeof depends_process[auxDependsprocessLength]) {
            case 'string':
              if(depends_process[auxDependsprocessLength] === planProcess[planProcessLength].id){
                if(!planProcess[planProcessLength].isEnded()){
                  processesDependencies.push(planProcess[planProcessLength]);
                  hasDependencies = true;
                }
              }

              break;
            case 'object':
              if(depends_process[auxDependsprocessLength].id === planProcess[planProcessLength].id){
                if(planProcess[planProcessLength].isEnded() || (depends_process[auxDependsprocessLength].ignore_fail && planProcess[planProcessLength].isErrored())){
                }else{
                  processesDependencies.push(planProcess[planProcessLength]);
                  hasDependencies = true;
                }
              }
              break;
          }
        }
      }
      return processesDependencies;
    }else{
      return processesDependencies;
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
        .catch(function(e){console.error(e)});
    });
  }

  loadChains(chains){
    return new Promise((resolve) => {
      if (chains instanceof Array) {
        var chainLength = chains.length;
        if (chainLength > 0) {
          var planChainsPromesas = [];

          while(chainLength--){
            var chain = chains[chainLength];

            planChainsPromesas.push(new Chain(chain.id,
                                              chain.name,
                                              chain.start_date,
                                              chain.end_date,
                                              chain.schedule_interval,
                                              chain.prevent_overlap,
                                              chain.depends_chains,
                                              chain.depends_chains_alt,
                                              chain.events,
                                              chain.processes,
                                              chain.status,
                                              chain.started_at,
                                              chain.ended_at));
          }

          Promise.all(planChainsPromesas)
            .then(function(dataArr) {
              resolve(dataArr);
            })
            .catch(function(e){logger.log('error','Loading chains:'+e)});

        }else{
          logger.log('error','Plan have not Chains');
        }
      }else{
        logger.log('error','Chain, processes is not array', err);
        resolve();
      }
    });
  }

  planificateChains(){
    var _this = this;
    var planChainsLength = this.chains.length;

    while(planChainsLength--) {

      var chain = this.chains[planChainsLength];

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
                //TODO: chain.event('on_waiting_dependencies');
                logger.log('warn', `Ejecutar cadena ${chain.id} -> on_waiting_dependencies`);
              }else{
                logger.log('info', `**************** Ejecutar YA esta cadena ${chain.id} -> start`);
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
                  //TODO: chain.event('on_waiting_dependencies');
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
    }
  };


  dependenciesBlocking(chain){

    var hasDependencies = false;
    var chainsDependencies = [];

    if(chain.hasOwnProperty('depends_chains') && chain.depends_chains.length > 0){
      var depends_chains = chain.depends_chains;
      var planChains = this.chains;

      var planChainsLength = this.chains.length;
      var dependsChainsLength = depends_chains.length;

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
      this.loadFileContent(filePath)
        .then(() => {
          this.plan.planificateChains();
          this.refreshBinBackup();
          resolve(this);
        })
        .catch(function(e){console.error(e)});
    });
  }

  loadFileContent(filePath){
    var _this = this;
    return new Promise((resolve) => {
      fs.stat(filePath, function(err, res){
        if(err){
          logger.log('error','Plan file ',filePath, err);
        }else{
          try {
            fs.readFile(filePath, 'utf8', function(err, res){
              _this.fileContent = JSON.parse(res);
              _this.getChains()
                  .then((chains) => {
                    new Plan('', chains)
                      .then(function(plan){
                        _this.plan = plan;
                        resolve();
                      })
                    .catch(function(err){console.error(err);})
                  })
                  .catch(function(e){console.error(e)});
            });
          } catch (e) {
            throw new Error('Invalid PlanFile, incorrect JSON format: '+e.message,e);
          }
        }
      });
    });
  }

  getChains(){
    return new Promise((resolve) => {

      if(this.fileContent.hasOwnProperty('chains')){
        if(this.fileContent.chains instanceof Array){
          resolve(this.validateChains());
        }else{
          throw new Error('Invalid PlanFile, chain is not an array.');
        }
      }else{
        throw new Error('Invalid PlanFile, chain property not found.');
      }

    });
  };

  validateChains(){
    var correctChains = [];
    var chainsLength = this.fileContent.chains.length;

    for (var i = 0; i < chainsLength; ++i) {
      var chain = this.fileContent.chains[i];
      if(chain.hasOwnProperty('id')){
        correctChains.push(chain);
      }
    }

    return correctChains;
  }

  refreshBinBackup(){
    var _this = this;
    var plan = _this.plan;

    setTimeout(function(){

      var objStr = JSON.stringify(plan);
      var hashPlan = crypto.createHash('sha256').update(objStr).digest("hex");

      if(_this.lastHashPlan !== hashPlan){
        _this.lastHashPlan = hashPlan;
        logger.log('info','> REFRESH hashPlan:',hashPlan);
        fs.writeFileSync('./bin.json', objStr, null);
      }

      _this.refreshBinBackup();

    }, config.refreshIntervalBinBackup);
}

};

// CLASES ----- END ------




logger.log('info',`RUNNERTY RUNNING - TIME...: ${new Date()}`);

var runtimePlan;
var fileLoad = config.binBackup;

// CHECK ARGS APP:
process.argv.forEach(function (val, index, array) {
  if (index === 2 && val === 'reload'){
    fileLoad = config.planFilePath;
    logger.log('warn',`Reloading plan from ${fileLoad}`);
  }
});


new FilePlan(fileLoad)
  .then(function(plan){

    runtimePlan = plan;
    //console.log('>',JSON.stringify(objStr, null, 2));

    //console.log('>',JSON.stringify(planFileObject.plan.chains[0], null, 2));
    //runtimePlan.plan.planificateChains();
    //runtimePlan.refreshBinBackup();

  })
  .catch(function(e){console.error(e)});


//==================================================================
//
process.on('uncaughtException', function (err) {
  console.error(err.stack);
});

process.on('exit', function (err) {
  console.log('--> [N]oderty parado.', err);
});

