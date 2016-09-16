"use strict";

var schedule = require('node-schedule');
var chokidar = require('chokidar');
var logger   = require("../libs/utils.js").logger;
var Chain    = require("./chain.js");


class Plan{
  constructor(version, chains, config){
    this.version = version;
    this.config = config;
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
          chain.iterable,
          chain.input,
          chain.start_date,
          chain.end_date,
          chain.schedule_interval,
          chain.depends_chains,
          chain.depends_chains_alt,
          chain.events,
          chain.processes,
          chain.status,
          chain.started_at,
          chain.ended_at,
          this.config)
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

    if ((!chain.end_date || (chain.hasOwnProperty('end_date') && new Date(chain.end_date) > new Date())) && (chain.isStoped()))
    {
      if(chain.hasOwnProperty('start_date') || (chain.hasOwnProperty('iterable') || chain.iterable)){

        logger.log('debug', `PLANIFICADA CADENA ${chain.id} EN ${(new Date(chain.start_date))}`);

        if ((new Date(chain.start_date)) <= (new Date()) || (chain.hasOwnProperty('iterable') || chain.iterable)){

          logger.log('debug', `start_date: ${(new Date(chain.start_date)) } / now: ${(new Date())}`);


          logger.log('debug', `INTENTANDO INICIAR CADENA ${chain.id} EN ${(new Date(chain.start_date))}`);

          if(_this.hasDependenciesBlocking(chain)){
            chain.waiting_dependencies();
            logger.log('warn', `Ejecutar cadena ${chain.id} -> on_waiting_dependencies`);
          }else{

            if(chain.hasOwnProperty('iterable') && chain.iterable){

              var execsChains = [];

              var inputIterable = JSON.parse(_this.getValuesInputIterable(chain));
              if(inputIterable.length){

                inputIterable.reduce((previous, current, index, array) => {
                  return previous                                    // initiates the promise chain
                    .then(()=>{return chain.start(array[index])
                                      .then(function() {
                                         chain.stop();
                                         //_this.planificateChains()
                                      })
                                      .catch(function(e){
                                        logger.log('error','Error '+e)
                                      });
                               })      //adds .then() promise for each item
              }, Promise.resolve())

              }



              /*
              if(inputIterable.length){
                inputIterable.map(function(iter){
                  execsChains.push(
                    chain.start(iter)
                      .then(function() {
                        _this.planificateChains()
                      })
                      .catch(function(e){logger.log('error','Error '+e)})
                  )
                });

                Promise.all(execsChains)
                  .then(function (res) {
                    console.log('fin de las ejecuciones');
                    //resolve(res);
                  })
                  .catch(function(e){
                    logger.log('error', 'getChains error: ', e);
                    //reject();
                  });
              }
              */

            }else{
              chain.start()
                .then(function() {
                  _this.planificateChains()
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
                  _this.planificateChains()
                })
                .catch(function(e){logger.log('error','Error '+e)});
            }
          }.bind(null,chain));
        }

        // Remove Chain from pool
        if(chain.end_date){

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