"use strict";
var program         = require('commander');
var fs              = require('fs');
var path            = require('path');
var crypto          = require('crypto');
var logger          = require("./libs/utils.js").logger;

var Plan = require("./classes/plan.js");

var configFilePath = '/etc/runnerty/conf.json';
var config;

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
          new Plan('', chains, config)
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
