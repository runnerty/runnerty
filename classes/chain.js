"use strict";

var schedule = require('node-schedule');
var anymatch = require('anymatch');
var logger   = require("../libs/utils.js").logger;

var Process  = require("./process.js");
var Event    = require("./event.js");

class Chain {
  constructor(id, name, iterable, input, start_date, end_date, schedule_interval, depends_chains, depends_chains_alt, events, events_iterations, processes, status, started_at, ended_at, config) {
    this.id = id;
    this.name = name;
    this.iterable = iterable;
    this.input = input;
    this.start_date = start_date;
    this.end_date = end_date;
    this.schedule_interval = schedule_interval;
    this.depends_chains = depends_chains;
    this.depends_chains_alt = depends_chains_alt;
    this.events;
    this.events_iterations = events_iterations;
    this.config = config;

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
            .catch(function(err){
                logger.log('error',`Chain ${_this.id} loadEvents: `+err);
                resolve();
              });
            })
        .catch(function(err){
            logger.log('error',`Chain ${_this.id} loadProcesses: `+err);
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
          process.output_iterable,
          _this.config,
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
          if(event.hasOwnProperty('notifications')){
            processEventsPromises.push(new Event(keys[keysLength],
              event.process,
              event.notifications,
              _this.config
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

    var chain_values = {
      "CHAIN_ID":_this.id,
      "CHAIN_NAME":_this.name,
      "CHAIN_STARTED_AT":_this.started_at
    }

    var values = Object.assign(chain_values, _this.execute_input);

    return values;
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
  start(inputIteration){
    var chain = this;

    if (inputIteration){

      var inputLength = chain.input.length;
      chain.execute_input = {};

      while(inputLength--){
        var key = Object.keys(chain.input[inputLength])[0];
        var value = chain.input[inputLength][key];
        chain.execute_input[key] = inputIteration[value];
      }
    }

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
                        //chain.end();
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
              if (inputIteration) chain.end();
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
      _this.execute_input = {};
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

            _this.processes.forEach(function (process) {
              process.execute_input =  _this.execute_input;

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
                            logger.log('error','Error in startProcess:'+e);
                            resolve();
                          })
                      })
                      .catch(function(proc, e){
                        logger.log('error','Error in process.start: '+e);

                        if (proc.end_chain_on_fail){

                          _this.end();

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
            })

            /*
            var chainProcessesLength = _this.processes.length;

            while(chainProcessesLength--) {
              var process = _this.processes[chainProcessesLength];

              process.execute_input =  _this.execute_input;

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
            */
          }else{
            if (chainStatus === 'end'){
              _this.end();
              resolve();
            }else{
              if (chainStatus === 'error'){
                _this.error();
                resolve();
              }
            }
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

module.exports = Chain;