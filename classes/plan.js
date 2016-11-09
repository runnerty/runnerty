"use strict";

var schedule   = require('node-schedule');
var chokidar   = require('chokidar');
var logger     = require("../libs/utils.js").logger;
var Chain      = require("./chain.js");

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

          if(chain.disable){
            logger.log('warn',`Chain ${chain.id} ignored: is setted to disable.`);
          }else{
            planChainsPromises.push(_this.loadChain(chain));
          }

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

  loadChain(chain, isIteration){

    return new Promise((resolve) => {
        new Chain(chain.id,
          chain.name,
          chain.iterable,
          chain.input,
          chain.start_date,
          chain.end_date,
          chain.schedule_interval,
          chain.depends_chains,
          chain.depends_chains_alt,
          (isIteration)?chain.events_iterations:chain.events,
          chain.events_iterations,
          chain.processes,
          chain.status,
          chain.started_at,
          chain.ended_at)
          .then(function(res) {
            // console.log(res);
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
                _this.scheduleChain(chain);
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

  scheduleChains(){
    var _this = this;

    _this.chains.forEach(function (chain) {
      // IGNORE ITERABLE CHAINS. SCHEDULED IN PROCESS.END EVENT
      if(!chain.iterable) _this.scheduleChain(chain);
    });

  };

  scheduleChain(chain, executeInmediate, outputIterable){
    var _this = this;
    // Cuando llega una cadena con running pero sin scheduleRepeater la cadena debe volver a empezar
    // Espero que se den por ejecutados los procesos con estado "end" y así continue la ejecución por donde debe:
    if(chain.schedule_interval !== undefined && chain.scheduleRepeater === undefined){
      chain.stop();
    };

    if ((!chain.end_date || (chain.hasOwnProperty('end_date') && new Date(chain.end_date) > new Date())) && (chain.isStoped()))
    {
      if(chain.hasOwnProperty('start_date') || (chain.hasOwnProperty('iterable') || chain.iterable)){

        logger.log('debug', `SCHEDULED CHAIN ${chain.id} EN ${(new Date(chain.start_date))}`);

        if ((new Date(chain.start_date)) <= (new Date()) || (chain.hasOwnProperty('iterable') || chain.iterable)){

          logger.log('debug', `start_date: ${(new Date(chain.start_date)) } / now: ${(new Date())}`);

          //.log('- - - - - - - - - - - - - - - - - - - - - - - - ',chain.id,' - - - - - - - - - - - - - - - - - - - - - - - -');
          //console.log('- chain.id:',chain.id);
          //console.log('- chain.status:',chain.status);
          //console.log('- chain.end_date:',chain.end_date);
          //console.log('- chain.!chain.end_date:',!chain.end_date);
          //console.log('- chain.hasOwnProperty(end_date):',chain.hasOwnProperty('end_date'));


          logger.log('debug', `TRYING START CHAIN ${chain.id} IN ${(new Date(chain.start_date))}`);

          if(!executeInmediate && _this.hasDependenciesBlocking(chain)){
            chain.waiting_dependencies();
            logger.log('warn', `Ejecutar cadena ${chain.id} -> on_waiting_dependencies`);
          }else{

            //console.log('SIN BLOQUEOS PARA LA EJECUCION! ',chain.id);
            if(chain.hasOwnProperty('iterable') && chain.iterable && chain.iterable !== ''){
              var valuesInputIterable;
              if(!outputIterable){
                valuesInputIterable = _this.getValuesInputIterable(chain);
              }else{
                valuesInputIterable = outputIterable;
              }

              if (valuesInputIterable){
                var inputIterable;
                var inputIterableLength;

                try {
                  inputIterable = JSON.parse(valuesInputIterable);
                  inputIterableLength = inputIterable.length;
                } catch(err) {
                  var newErr = new Error(`Invalid input (${valuesInputIterable}), incorrect JSON`);
                  newErr.stack += '\nCaused by: '+err.stack;
                  logger.log('error',`Invalid input (${valuesInputIterable}), incorrect JSON`+'\nCaused by: '+err.stack);
                  throw newErr;
                }
              }

              if(inputIterableLength){
                var execMode = chain.iterable;

                if (execMode === 'parallel'){

                  //console.log('EMPIEZA EJECUCION EN PARALELO! ',chain.id);

                  var newChains = [];

                  function createChainSerie(inputIterable) {
                    var sequence = Promise.resolve();
                    inputIterable.forEach(function(item) {
                      sequence = sequence.then(function() {
                        return _this.loadChain(chain, true)
                          .then(function(res) {
                            newChains.push(res);
                          })
                          .catch(function(e){
                            logger.log('error','Error '+e)
                          });
                      });
                    });
                    return sequence;
                  }

                  chain.running();

                  createChainSerie(inputIterable)
                    .then(function() {
                      var chainsToExec = [];
                      var chainsToExecLength = newChains.length;
                      while(chainsToExecLength--){
                        chainsToExec.push(newChains[chainsToExecLength].start(inputIterable[chainsToExecLength]));
                      }

                      Promise.all(chainsToExec)
                        .then(function (res) {
                          //console.log('FINALIZA EJECUCION EN PARALELO! ',chain.id);
                          chain.end();
                          chain.setChainToInitState();
                        })
                        .catch(function(e){
                          //console.log('ERROR EN EJECUCION EN PARALELO! ',chain.id);
                          logger.log('error', 'getChains error: ', e);
                          chain.error();
                          chain.setChainToInitState();
                        });

                    });
                }else{
                  //SERIE:
                  chain.running();

                  var newChains = [];

                  function createChainSerie(inputIterable) {
                    var sequence = Promise.resolve();
                    inputIterable.forEach(function(item) {
                      sequence = sequence.then(function() {
                        return _this.loadChain(chain, true)
                          .then(function(res) {
                            newChains.push(res);
                          })
                          .catch(function(e){
                            logger.log('error','Error '+e)
                          });
                      });
                    });
                    return sequence;
                  }

                  function execSerie(chains) {
                    var sequence = Promise.resolve();
                    var i = 0;
                    chains.forEach(function(chain) {
                      sequence = sequence.then(function() {

                        //console.log('>>>>>>>>>>>> XXXXXX SE EJECUTA CHAIN ',chain.id);

                        return chain.start(inputIterable[i])
                          .then(function(res) {
                            i = i+1;
                          })
                          .catch(function(e){
                            i = i+1;
                            logger.log('error','Error '+e)
                          });
                      });
                    });
                    return sequence;
                  }

                  createChainSerie(inputIterable)
                    .then(function() {
                      execSerie(newChains)
                        .then(function() {
                          chain.setChainToInitState();
                          chain.end();
                        });
                    });
                }
              }else{
                logger.log('error','Error input not found for iterable process');
                chain.error();
                chain.setChainToInitState();
              }

            }else{
              //console.log('>>>>>>>>>>>> SE EJECUTA CHAIN ',chain.id);
              chain.start()
                .then(function() {
                  _this.scheduleChains()
                })
                .catch(function(e){logger.log('error','Error '+e)});
            }
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
                  _this.scheduleChains()
                })
                .catch(function(e){logger.log('error','Error '+e)});
            }
          }.bind(null,chain));
        }

        // Remove Chain from pool
        if(chain.end_date){

          logger.log('debug',`SCHEDULED CHAIN CANCELATION ${chain.id} IN ${(new Date(chain.end_date))}`);

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
    // Schedule load/reload chain
    _this.scheduleChain(_this.getChainById(chainId));
  }

  dependenciesBlocking(chain){

    //var hasDependencies = false;
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
                //hasDependencies = true;
              }
            }else{
              chainsDependencies.push(depends_chains);
              //hasDependencies = true;
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
                  //hasDependencies = true;
                }
              }
              break;
            case 'object':
              if(depends_chains[auxDependsChainsLength].chain_id === planChains[planChainsLength].id){

                if(planChains[planChainsLength].isEnded() || (depends_chains[auxDependsChainsLength].ignore_fail && planChains[planChainsLength].isErrored() && !depends_chains[auxDependsChainsLength].hasOwnProperty('process_id'))){
                }else{
                  if(depends_chains[auxDependsChainsLength].hasOwnProperty('process_id')){
                    var planProccessLength = planChains[planChainsLength].processes.length;

                    //EN LA VALIDACION DE DEPENDENCIES_CHAIN comprobar que tanto el chain ID como el proccess_id existen
                    while(planProccessLength--){
                      if(planChains[planChainsLength].processes[planProccessLength].id === depends_chains[auxDependsChainsLength].process_id){
                        if(planChains[planChainsLength].processes[planProccessLength].isEnded()){
                        }else{
                          //console.log('NO SE EJECUTA PORQUE EL PROCESO ',planChains[planChainsLength].processes[planProccessLength].id,' ESTA A ',planChains[planChainsLength].processes[planProccessLength].status);
                          chainsDependencies.push(planChains[planChainsLength]);
                        }
                      }
                    }
                  }else{
                    chainsDependencies.push(planChains[planChainsLength]);
                    //hasDependencies = true;
                  }
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


  getValuesInputIterable(chain){

    var input = [];

    if(chain.hasOwnProperty('depends_chains') && chain.depends_chains.length > 0){
      var depends_chains = chain.depends_chains;
      var planChains = this.chains;

      var planChainsLength = this.chains.length;
      var dependsChainsLength = depends_chains.length;

      //Chains dependences:

      while(planChainsLength--){
        var auxDependsChainsLength = dependsChainsLength;
        while(auxDependsChainsLength--){
          if(typeof depends_chains[auxDependsChainsLength] === 'object'){
            if(depends_chains[auxDependsChainsLength].chain_id === planChains[planChainsLength].id){
              if (depends_chains[auxDependsChainsLength].hasOwnProperty('process_id')){
                var planProccessLength = planChains[planChainsLength].processes.length;
                while(planProccessLength--){
                  if(planChains[planChainsLength].processes[planProccessLength].id === depends_chains[auxDependsChainsLength].process_id){
                    var dep_process = planChains[planChainsLength].processes[planProccessLength];
                    var dep_process_values = dep_process.values();
                    input = dep_process_values[dep_process.output_iterable];
                  }
                }
              }
            }
          }
        }
      }
      return input;
    }else{
      return input;
    }
  }

};

module.exports = Plan;