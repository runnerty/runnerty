"use strict";

var fs            = require('fs');
var crypto        = require('crypto');
var logger        = require("../libs/utils.js").logger;
var planSchema    = require('../schemas/plan.json');
var chainSchema   = require('../schemas/chain.json');
var processSchema = require('../schemas/process.json');
var Ajv           = require('ajv');
var ajv           = new Ajv({allErrors: true});

var Plan          = require("./plan.js");

ajv.addFormat('cron', /^(((([\*]{1}){1})|((\*\/){0,1}(([0-9]{1}){1}|(([1-5]{1}){1}([0-9]{1}){1}){1}))) ((([\*]{1}){1})|((\*\/){0,1}(([0-9]{1}){1}|(([1]{1}){1}([0-9]{1}){1}){1}|([2]{1}){1}([0-3]{1}){1}))) ((([\*]{1}){1})|((\*\/){0,1}(([1-9]{1}){1}|(([1-2]{1}){1}([0-9]{1}){1}){1}|([3]{1}){1}([0-1]{1}){1}))) ((([\*]{1}){1})|((\*\/){0,1}(([1-9]{1}){1}|(([1-2]{1}){1}([0-9]{1}){1}){1}|([3]{1}){1}([0-1]{1}){1}))|(jan|feb|mar|apr|may|jun|jul|aug|sep|okt|nov|dec)) ((([\*]{1}){1})|((\*\/){0,1}(([0-7]{1}){1}))|(sun|mon|tue|wed|thu|fri|sat)))$/);
ajv.addSchema(planSchema, 'planSchema');
ajv.addSchema(processSchema,'processSchema');
ajv.addSchema(chainSchema,'chainSchema');

class FilePlan {
  constructor(filePath){
    this.filePath = filePath;
    this.fileContent;
    this.lastHashPlan;
    this.plan;

    return new Promise((resolve) => {
      var _this = this;
      this.loadFileContent(filePath,'planSchema')
        .then((res) => {
        _this.fileContent = res;
        _this.getChains(res)
          .then((chains) => {
          new Plan('', chains)
            .then(function(plan){
              _this.plan = plan;
              _this.plan.scheduleChains();
              _this.startAutoRefreshBinBackup();
              resolve(_this);
            })
           .catch(function(err){
             logger.log('error','FilePlan new Plan getChains: '+err);
             return new Error(`FilePlan new Plan getChains:`+err);
           })
      })
    .catch(function(err){
        logger.log('error','FilePlan loadFileContent getChains: '+err);
        return new Error(`FilePlan new Plan:`+err);
      });
  })
  .catch(function(e){
      logger.log('error','File Plan, constructor:'+e)
      resolve(this);
    });
  });

  }

  loadFileContent(filePath, schema){
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

                var fileParsed;
                try {
                  fileParsed = JSON.parse(res);
                } catch(err) {
                  var newErr = new Error(`Invalid file (${filePath}), incorrect JSON`);
                  newErr.stack += '\nCaused by: '+err.stack;
                  throw newErr;
                }

                var valid = ajv.validate(schema, fileParsed);

                if (!valid) {
                  logger.log('error',`Invalid file (${filePath}) for schema ${schema}:`,ajv.errors);
                  throw new Error(`Invalid file (${filePath}) for schema ${schema}:`,ajv.errors);
                  resolve();
                }else{
                  resolve(fileParsed);
                }

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
            return new Error(`getChains error: `+e);
          });

      }else{
        return new Error('Invalid PlanFile, chain is not an array.');
        resolve();
      }
    }else{
      return new Error('Invalid PlanFile, chain property not found.');
      resolve();
    }

  });
  };

  getChain(chain){
    var _this = this;
    return new Promise(function(resolve, reject) {

        if (chain.hasOwnProperty('chain_path')) {
          _this.loadFileContent(chain.chain_path,'chainSchema')
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
          if (_this.chainIsValid(chain, false)) {
            resolve(chain);
          } else {
            reject();
          }
        }

    });
  }

  chainIsValid(chain, silent){

    var valid = ajv.validate('chainSchema', chain);

    if (!valid) {
      if(!silent) logger.log('error',`Invalid chain, id ${chain.id} for schema chainSchema:`,ajv.errors);
      return false;
    }else{
      return true;
    }
  };

  refreshBinBackup(){
    var _this = this;
    var plan = _this.plan;

    var objStr = {};//JSON.stringify(plan);

    try {
      objStr = JSON.stringify(plan);
    } catch (e) {
      if (e.message.indexOf('circular') !== -1) {
        logger.log('warn',e);
        logger.log('warn','Retrying stringify plan.');
        try {
          objStr = JSON.stringify(plan);
        } catch (e) {
          if (e.message.indexOf('circular') !== -1) {
            logger.log('error',e);
            logger.log('error',plan);
            throw e;
          }
        }
      }else{
        throw e;
      }
    }

    var hashPlan = crypto.createHash('sha256').update(objStr).digest("hex");

    if(_this.lastHashPlan !== hashPlan){
      _this.lastHashPlan = hashPlan;
      logger.log('debug','> REFRESING hashPlan:',hashPlan);
      fs.writeFileSync(global.config.general.binBackup, objStr, null);
    }
  }

  startAutoRefreshBinBackup(){
    var _this = this;
    setTimeout(function(){
      _this.refreshBinBackup();
    }, global.config.general.refreshIntervalBinBackup);
  }

};

module.exports = FilePlan;