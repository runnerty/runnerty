"use strict";

var express = require('express');
var bodyParser = require('body-parser');
var router = express.Router();
var morgan = require('morgan');
var jwt = require('jsonwebtoken');
var expressJwt = require('express-jwt');
var app = express();
var express = require('express');
var app = express();
var server = require('http').Server(app);
var helmet = require('helmet');
var utils = require("../libs/utils.js");
var logger = utils.logger;
var crypto = require('crypto');
var config = global.config.general;
const port = config.api.port;
/*
 var lusca           = require('lusca');
 */

//============================================
var globalPlanChains = global.runtimePlan.plan;

module.exports = function () {
  //==============================================
  // SERVER
  server.listen(port, function (err, res) {
    //TODO CATCH ERRORS:
    logger.log('info', 'Listening on port [' + port + ']');
  });

  app.use(function (req, res, next) {
    res.header("Content-Type", 'application/json');
    next();
  });

  function excluder(key, value) {
    if (config.api.propertiesExcludesInResponse.indexOf(key) !== -1) {
      return undefined;
    }
    return value;
  }

  function serializer(replacer) {
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
      return replacer === null ? value : replacer(key, value);
    };
  }

  app.set('json replacer', excluder);


  app.use(bodyParser.urlencoded({extended: true}));
  app.use(bodyParser.json({limit: config.api.limite_req}));

  //==============================================
  // SECURITY
  app.use(helmet());
  app.disable('x-powered-by');
  /*
   app.use(lusca({
   csp: {},
   xframe: 'SAMEORIGIN',
   hsts: {maxAge: 31536000, includeSubDomains: true, preload: true},
   xssProtection: true
   }));
   */
  /*
   app.use(function(req, res, next) {
   if (config.CSRF_EXCLUDE.indexOf(req.path) === -1) {
   lusca.csrf({angular:true})(req, res, next);
   } else {
   next();
   }
   });
   */

  //JSON Vulnerability Protection (Angular):
  /*
   app.use(function (req, res, next){

   var actualSend = res.send;
   res.send = function (data) {

   var excludeJSONProtect = false;
   for (var i = 0; i < config.global.excludeJSONProtectURLs.length; i++) {
   if (req.originalUrl.indexOf(config.global.excludeJSONProtectURLs[i]) !== -1)
   {
   excludeJSONProtect = true;
   }
   };

   if (typeof data === "object" && !excludeJSONProtect) {
   var strData = ")]}',\n" + JSON.stringify(data);
   res.set('Content-Type', 'text/json');
   actualSend.call (res, strData);
   } else {
   actualSend.call (res, data);
   }
   };
   next();
   });
   */
  /*
   app.use(function (req, res, next) {

   // Website you wish to allow to connect
   res.setHeader('Access-Control-Allow-Origin', 'https://localhost:3030');

   // Request methods you wish to allow
   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

   // Request headers you wish to allow
   res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

   // Set to true if you need the website to include cookies in the requests sent
   // to the API (e.g. in case you use sessions)
   res.setHeader('Access-Control-Allow-Credentials', true);

   // Pass to next layer of middleware
   next();
   });
   */
  //==================================================================
  // API

  app.use(morgan('dev'));

  app.use(bodyParser.json());

  app.use(expressJwt({
    secret: config.api.secret,
    getToken: function fromHeaderOrQuerystring(req) {
      if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
        return req.headers.authorization.split(' ')[1];
      } else if (req.query && req.query.token) {
        return req.query.token;
      }
      return null;
    }
  }).unless({
    path: ['/auth']
  }));

  app.use(function (err, req, res, next) {
    if (err.name === 'UnauthorizedError') {
      res.status(401).send('Unauthorized');
    }
  });

  app.use('/', router);

  router.post('/auth', function (req, res) {

    var user = req.body.user;
    var password = req.body.password;

    if (!user) {
      res.json({success: false, message: 'Authentication failed. User not found.'});
    } else if (user) {

      function checkAcces(up) {
        return (up.user === user && up.password === password);
      }

      if (config.api.users.findIndex(checkAcces) !== -1) {

        var token = jwt.sign(user, config.api.secret, {
          // expiresIn: "10h" // 8 hours
        });

        res.json({
          success: true,
          message: 'Run your token!',
          token: token
        });

      } else {
        res.json({success: false, message: 'Authentication failed.'});
      }
    }
  });

  // GET ALL CHAINS
  router.get('/chains', function (req, res) {

    let objectToResult = ['depends_chains', 'args', 'events', 'output', 'chain_values', 'schedule_interval', 'scheduleCancel', 'scheduleRepeater', 'parentUId', 'exec', 'depends_process', 'retries', 'retry_delay', 'end_on_fail', 'end_chain_on_fail'];

    function excluderGetChain(key, value) {
      return value;
      if (objectToResult.indexOf(key) !== -1) {
        return undefined;
      }
      return value;
    }

    res.send(JSON.stringify(globalPlanChains.chains, serializer(excluderGetChain)));
  });

  // GET A CHAIN
  router.get('/chain/:chainId', function (req, res) {
    var chainId = req.params.chainId;
    var chain = globalPlanChains.getChainById(chainId);

    let objectToResult = ['depends_chains', 'args', 'events', 'output', 'chain_values', 'schedule_interval', 'scheduleCancel', 'scheduleRepeater', 'parentUId', 'exec', 'depends_process', 'retries', 'retry_delay', 'end_on_fail', 'end_chain_on_fail'];

    function excluderGetChain(key, value) {
      if (objectToResult.indexOf(key) !== -1) {
        return undefined;
      }
      return value;
    }

    if (chain) {
      res.send(JSON.stringify(chain, serializer(excluderGetChain)));
    } else {
      res.status(404).send(`Chain "${chainId}" not found`);
    }
  });

  // GET A CHAIN
  router.post('/chain/forceStart/:chainId', function (req, res) {
    var chainId = req.params.chainId;
    var chain = globalPlanChains.getChainById(chainId);

    if (chain) {
      var inputIterableValues;

      var customValues = {};
      if (req.body.hasOwnProperty('customValues')) {

        try {
          customValues = JSON.parse(req.body.customValues);
        } catch (err) {
          var newErr = new Error('Problem reading JSON file');
          newErr.stack += '\nCaused by: ' + err.stack;
          throw newErr;
        }
      }

      if (chain.iterable) {

        crypto.randomBytes(16, function (err, buffer) {
          var vProcUId = chainId + '_VP_' + buffer.toString('hex');

          if (req.body.hasOwnProperty('inputIterableValues')) {
            inputIterableValues = req.body.inputIterableValues;
          }

          var dummy_process = {};
          dummy_process.uId = vProcUId;
          dummy_process.childs_chains = [];
          globalPlanChains.scheduleChain(chain, dummy_process, true, inputIterableValues, customValues);
          res.json(`Chain iterable: "${chain.id}" starting.`);

        });

      } else {
        globalPlanChains.scheduleChain(chain, undefined, true, undefined, customValues);
        res.json(`Chain ${chain.id}/${chain.uId} starting.`);
      }
    } else {
      res.status(404).send(`Chain "${chainId}" not found`);
    }

  });

  //GET ALL PROCESSES OF CHAIN INDICATED IN PARAMETER chainId
  router.get('/processes/:chainId', function (req, res) {
    var chainId = req.params.chainId;
    var chain = globalPlanChains.getChainById(chainId);

    if (chain) {
      res.json(chain.processes);
    } else {
      res.status(404).send(`Chain "${chainId}" not found`);
    }

  });


  // KILL A NO ITERABLE CHAIN INDICATE: chainId
  router.post('/chain/stop/:chainId', function (req, res) {
    var chainId = req.params.chainId;

    logger.log('info', `Kill chain "${chainId}" by ${req.user}`);

    var chain = globalPlanChains.getChainById(chainId);

    if (chain) {
      chain.stop();
      res.json();
    } else {
      res.status(404).send(`Chain "${chainId}" not found`);
    }

  });


  //GET A PROCESS OF CHAIN INDICATED IN PARAMETER chainId AND processId
  router.get('/process/:chainId/:processId', function (req, res) {
    var chainId = req.params.chainId;
    var processId = req.params.processId;
    var chain = globalPlanChains.getChainById(chainId);

    if (chain) {
      var process = chain.getProcessById(processId);
      if (process) {
        res.json(process);
      } else {
        res.status(404).send(`Process "${processId}" not found in chain "${chainId}"`);
      }
    } else {
      res.status(404).send(`Chain "${chainId}" not found`);
    }

  });

  // RETRY A PROCESS OF A CHAIN INDICATE: chainId, processId AND once (TRUE FOR ONCE RETRY FALSE FOR CONFIGURED RETRIES)
  router.post('/process/retry', function (req, res) {

    var chainId = req.body.chainId;
    var processId = req.body.processId;
    var once = req.body.once || false;

    logger.log('info', `Retrying process "${processId}" of chain "${chainId}" by ${req.user}`);

    var chain = globalPlanChains.getChainById(chainId);

    if (chain) {
      var process = chain.getProcessById(processId);
      if (process) {
        if (process.isErrored()) {
          res.json();
          process.start(true, once)
            .then(function (res) {
            })
            .catch(function (e) {
              logger.log('error', 'Retrying process:' + e)
            })
        } else {
          res.status(423).send(`Process "${processId}" of chain "${chainId}" is not in errored status`);
        }
      } else {
        res.status(404).send(`Process "${processId}" not found in chain "${chainId}"`);
      }
    } else {
      res.status(404).send(`Chain "${chainId}" not found`);
    }

  });

  // SET END A PROCESS OF A CHAIN INDICATE: chainId, processId
  router.post('/process/end', function (req, res) {
    var chainId = req.body.chainId;
    var processId = req.body.processId;
    var continueChain = req.body.continueChain || false;

    logger.log('info', `Set end process "${processId}" of chain "${chainId}" by ${req.user}`);

    var chain = globalPlanChains.getChainById(chainId);

    if (chain) {
      var process = chain.getProcessById(processId);
      if (process) {
        if (!process.isEnded() && !process.isRunning()) {
          res.json();

          process.execute_return = '';
          process.execute_err_return = '';
          process.end();

          if (continueChain) {
            chain.startProcesses()
              .then(function (res) {
              })
              .catch(function (e) {
                logger.log('error', `Error in startProcesses next to set end process "${processId}" of chain "${chainId}"  by ${req.user}:` + e);
              })
          }
        } else {
          res.status(423).send(`Is not posible set process "${processId}" of chain "${chainId}" to end because is ${process.status}`);
        }
      } else {
        res.status(404).send(`Process "${processId}" not found in chain "${chainId}"`);
      }
    } else {
      res.status(404).send(`Chain "${chainId}" not found`);
    }

  });

  // KILL A PROCESS OF A CHAIN INDICATE: chainId, processId
  router.post('/process/kill', function (req, res) {
    var chainId = req.body.chainId;
    var processId = req.body.processId;

    logger.log('info', `Kill process "${processId}" of chain "${chainId}" by ${req.user}`);

    var chain = globalPlanChains.getChainById(chainId);

    if (chain) {
      var process = chain.getProcessById(processId);
      if (process) {
        if (process.isRunning()) {
          res.json();

          process.proc.kill('SIGINT');
          process.stop();

        } else {
          res.status(423).send(`Is not posible kill process "${processId}" of chain "${chainId}" to end because is ${process.status}`);
        }
      } else {
        res.status(404).send(`Process "${processId}" not found in chain "${chainId}"`);
      }
    } else {
      res.status(404).send(`Chain "${chainId}" not found`);
    }

  });

  // LOAD/REALOAD CHAIN
  router.post('/chain/load', function (req, res) {

    var chainId = req.body.chainId;
    var planFile = req.body.planFile || config.planFilePath;

    globalPlanChains.loadFileContent(planFile)
      .then((fileRes) => {
        globalPlanChains.getChains(fileRes)
          .then((fileChains) => {

            var newChain = fileChains.find(function byId(chain) {
              return chain.id === chainId;
            });

            if (newChain) {
              globalPlanChains.loadChain(newChain)
                .then(function (newChainObj) {
                  res.json();
                  globalPlanChains.loadChainToPlan(newChainObj);
                  // Force refresh binBackup
                  globalPlanChains.refreshBinBackup();
                })
                .catch(function (err) {
                  res.status(500).send(`Error loading "${chainId}":` + err);
                  logger.log('error', 'FilePlan new Plan: ' + err);
                });
            } else {
              res.status(404).send(`Chain "${chainId}" not found in file`);
            }
          })
          .catch(function (err) {
            res.status(500).send(`Error loading file chain "${chainId}":` + err);
            logger.log('error', 'FilePlan loadFileContent getChains: ' + err);
          });
      })
      .catch(function (e) {
        res.status(500).send(`Error loading "${chainId}" (loading file):` + err);
        logger.log('error', 'File Plan, constructor:' + e)
      });
  });

  // REMOVE CHAIN
  router.post('/chain/remove', function (req, res) {
    var chainId = req.body.chainId;
    var chain = globalPlanChains.getChainById(chainId);
    if (chain) {
      if (!chain.isEnded() && !chain.isRunning()) {
        res.json();
        globalPlanChains.chains.splice(globalPlanChains.getIndexChainById(chainId), 1);
      } else {
        res.status(423).send(`Is not posible remove chain "${chainId}" because is ${chain.status}`);
      }
    } else {
      res.status(404).send(`Chain "${chainId}" not found`);
    }
  });

};
