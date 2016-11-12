"use strict";
var program           = require('commander');
var logger            = require("./libs/utils.js").logger;
var loadGeneralConfig = require("./libs/utils.js").loadGeneralConfig;

var FilePlan   = require("./classes/file_plan.js");

var configFilePath = '/etc/runnerty/conf.json';
var config;

//var runtimePlan;
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
    global.config = config;

    var fileLoad;
    if(reloadPlan){
      fileLoad = config.general.planFilePath;
      logger.log('warn',`Reloading plan from ${fileLoad}`);
    }
    else{
      fileLoad = config.general.binBackup;
    }

    new FilePlan(fileLoad, config)
      .then(function(plan){
        global.runtimePlan = plan;
        require('./api/api.js')(config.general, logger, global.runtimePlan);

/* BORRAR
        var txt = 'hola :ARG_UNO http://www.pepe.com';
        console.log('i:',txt);
        var replaceWith       = require("./libs/utils.js").replaceWith;
        var pvals= {"GV_UNO":"uunnoo"};

        function queryFormat(query, values) {
          if (!values) return query.replace(/(\:\/)/g,':');
          else {
            var _query = query.replace(/\:(\w+)/g, function (txt, key) {
              console.log('values[key]:',values[key]);

              return (values && key && values.hasOwnProperty(key))
                ? replaceWith(values[key],pvals)
                : null;
            }.bind(this));
          }
          return _query;
        }

        console.log('r:',queryFormat(txt,{"ARG_UNO":":GV_UNO"}));

       // console.log(txt.replace(/\:(\w+)/g,'XXX'));

*/
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