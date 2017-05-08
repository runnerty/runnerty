"use strict";

var fs = require("fs");
var crypto = require("crypto");
var logger = require("../utils.js").logger;
var planSchema = require("../schemas/plan.json");
var chainSchema = require("../schemas/chain.json");
var processSchema = require("../schemas/process.json");
var Ajv = require("ajv");
var ajv = new Ajv({allErrors: true});

var Plan = require("./plan.js");

function serializer() {
  var stack = [];
  var keys = [];

  return function (key, value) {
    if (stack.length > 0) {
      var thisPos = stack.indexOf(this);
      ~thisPos ? stack.splice(thisPos + 1) : stack.push(this);
      ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key);
      if (~stack.indexOf(value)) {
        if (stack[0] === value) {
          value = "[Circular ~]";
        }
        value = "[Circular ~." + keys.slice(0, stack.indexOf(value)).join(".") + "]";
      }
    }
    else {
      stack.push(value);
    }
    return value;
  };
}

ajv.addFormat("cron", /^(((([\*]{1}){1})|((\*\/){0,1}(([0-9]{1}){1}|(([1-5]{1}){1}([0-9]{1}){1}){1}))) ((([\*]{1}){1})|((\*\/){0,1}(([0-9]{1}){1}|(([1]{1}){1}([0-9]{1}){1}){1}|([2]{1}){1}([0-3]{1}){1}))) ((([\*]{1}){1})|((\*\/){0,1}(([1-9]{1}){1}|(([1-2]{1}){1}([0-9]{1}){1}){1}|([3]{1}){1}([0-1]{1}){1}))) ((([\*]{1}){1})|((\*\/){0,1}(([1-9]{1}){1}|(([1-2]{1}){1}([0-9]{1}){1}){1}|([3]{1}){1}([0-1]{1}){1}))|(jan|feb|mar|apr|may|jun|jul|aug|sep|okt|nov|dec)) ((([\*]{1}){1})|((\*\/){0,1}(([0-7]{1}){1}))|(sun|mon|tue|wed|thu|fri|sat)))$/);
ajv.addSchema(planSchema, "planSchema");
ajv.addSchema(processSchema, "processSchema");
ajv.addSchema(chainSchema, "chainSchema");

class FilePlan {
  constructor(filePath) {
    this.filePath = filePath;
    this.fileContent = "";
    this.lastHashPlan = "";
    this.plan = {};

    return new Promise((resolve, reject) => {
      var _this = this;
      _this.loadFileContent(filePath, "planSchema")
        .then((res) => {
          _this.fileContent = res;
          _this.getChains(res)
            .then((chains) => {
              new Plan("", chains)
                .then(function (plan) {
                  _this.plan = plan;
                  if(global.planRestored){
                    _this.startAutoRefreshBinBackup();
                  }
                  resolve(_this);
                })
                .catch(function (err) {
                  reject(err);
                });
            })
            .catch(function (err) {
              reject(err);
            });
        })
        .catch(function (err) {
          reject(err);
        });
    });

  }

  loadFileContent(filePath, schema) {
    return new Promise((resolve, reject) => {
      fs.stat(filePath, function (err, res) {
        if (err) {
          reject(`File ${filePath} not exists: ${err}`);
        } else {
          try {
            fs.readFile(filePath, "utf8", function (err, res) {
              if (err) {
                reject(`File loadFileContent (${filePath}) readFile: ${err}`);
              } else {
                var fileParsed;
                try {
                  fileParsed = JSON.parse(res);
                } catch (err) {
                  reject(`Invalid file (${filePath}), incorrect JSON: ${err}`);
                }

                var valid = false;
                try{
                  valid = ajv.validate(schema, fileParsed);
                  if(valid){
                    resolve(fileParsed);
                  }else{
                    reject(ajv.errors);
                  }
                }catch(err){
                  reject(err);
                }
              }
            });
          } catch (err) {
            reject(err);
          }
        }
      });
    });
  }

  getChains(json) {
    var _this = this;

    return new Promise((resolve, reject) => {
      if (json.hasOwnProperty("chains")) {
        if (json.chains instanceof Array) {

          var loadChains = [];

          function getAllChains(chain) {
            loadChains.push(_this.getChain(chain));
          }

          json.chains.map(getAllChains);

          Promise.all(loadChains)
            .then(function (res) {
              resolve(res);
            })
            .catch(function (err) {
              reject(err);
            });

        } else {
          reject("Invalid PlanFile, chain is not an array.");
        }
      } else {
        reject("Invalid PlanFile, chain property not found.");
      }

    });
  };

  getChain(chain) {
    var _this = this;
    return new Promise(function (resolve, reject) {

      if (chain.hasOwnProperty("chain_path")) {
        _this.loadFileContent(chain.chain_path, "chainSchema")
          .then((res) => {
            _this.getChain(res)
              .then((res) => {
                resolve(res);
              })
              .catch(function (err) {
                reject(err);
              });
          })
          .catch(function (err) {
            reject(err);
          });
      } else {
        if (_this.chainIsValid(chain, false)) {
          resolve(chain);
        } else {
          reject(`Chain ${chain.id} is not valid.`);
        }
      }

    });
  }

  chainIsValid(chain, silent) {

    var valid = false;
    try{
      valid = ajv.validate("chainSchema", chain);
      if (!valid) {
        if (!silent) {
          logger.log("error", `Invalid chain, id ${chain.id} for schema chainSchema:`, ajv.errors);
        }
        return false;
      } else {
        return true;
      }
    }catch(err){
      if (!silent) {
        logger.log("error", `Invalid chain, id ${chain.id} for schema chainSchema:`, err);
      }
      return false;
    }
  };

  refreshBinBackup() {
    var _this = this;
    var plan = _this.plan;

    var objStr = {};

    try {
      objStr = JSON.stringify(plan);
    } catch (err) {
      try {
        objStr = JSON.stringify(plan, serializer());
      } catch (err) {
        logger.log("error", err);
        throw err;
      }
    }

    var hashPlan = crypto.createHash("sha256").update(objStr).digest("hex");

    if (_this.lastHashPlan !== hashPlan) {
      _this.lastHashPlan = hashPlan;
      logger.log("debug", "> REFRESING hashPlan:", hashPlan);
      fs.writeFileSync(global.config.general.binBackup, objStr, null);
    }
  }

  startAutoRefreshBinBackup() {
    var _this = this;
    setTimeout(function () {
      _this.refreshBinBackup();
    }, global.config.general.refreshIntervalBinBackup);
  }
}

module.exports = FilePlan;