'use strict';

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const router = express.Router();
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const expressJwt = require('express-jwt');
const app = express();
const http = require('http');
const https = require('https');
const helmet = require('helmet');
const fs = require('fs');
const logger = require('../lib/logger.js');
const config = global.config.general;
const queueProcess = require('../lib/queue-process-memory.js');

const apiPlan = global.runtimePlan.plan;

module.exports = () => {
  // = SERVER =======================================
  let server;
  let port;

  switch (true) {
    case !!config.api.ssl && !!config.api.key && !!config.api.cert && config.api.port:
      const privateKey = fs.readFileSync(config.api.key, 'utf8');
      const certificate = fs.readFileSync(config.api.cert, 'utf8');
      server = https.createServer(
        {
          key: privateKey,
          cert: certificate
        },
        app
      );
      port = config.api.port;

      logger.info('Starting [HTTPS] private API on port ' + port);
      break;
    case !!config.api.unix_socket:
      server = http.createServer(app);
      port = config.api.unix_socket;
      logger.info('Starting [UNIX SOCKET] private API on ' + port);
      break;
    case !!config.api.port:
      server = http.createServer(app);
      port = config.api.port;
      logger.info('Starting [HTTP] private API on port ' + port);
      break;
    default:
      server = null;
  }

  if (server) {
    server.listen(port, err => {
      if (err) {
        logger.error('Cannot start the server');
        logger.error(err);
      } else {
        logger.info('Listening...');
      }
    });
  } else {
    logger.error('Not private API server provided');
  }
  // ================================================

  app.use((req, res, next) => {
    res.header('Content-Type', 'application/json');
    next();
  });

  function serializer() {
    const stack = [];
    const keys = [];

    return (key, value) => {
      if (stack.length > 0) {
        const thisPos = stack.indexOf(this);
        ~thisPos ? stack.splice(thisPos + 1) : stack.push(this);
        ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key);
        if (~stack.indexOf(value)) {
          if (stack[0] === value) {
            value = '[Circular ~]';
          }
          value = '[Circular ~.' + keys.slice(0, stack.indexOf(value)).join('.') + ']';
        }
      } else {
        stack.push(value);
      }
      return value;
    };
  }

  app.use(
    bodyParser.urlencoded({
      extended: true
    })
  );
  app.use(
    bodyParser.json({
      limit: config.api.limite_req
    })
  );
  // ================================================

  // = SECURITY =====================================
  app.use(helmet());
  app.disable('x-powered-by');
  // = CORS =========================================
  app.use(cors(config.api.cors));
  // ================================================

  // = API ==========================================
  if (config.api.log_display_level) {
    app.use(morgan(config.api.log_display_level));
  }

  app.use(bodyParser.json());

  app.use(
    expressJwt({
      secret: config.api.secret,
      getToken: req => {
        // Gets token from authorization or url query
        if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
          return req.headers.authorization.split(' ')[1];
        } else if (req.query && req.query.token) {
          return req.query.token;
        }
        return null;
      }
    }).unless({
      path: ['/auth']
    })
  );

  app.use((err, req, res, next) => {
    if (err.name === 'UnauthorizedError') {
      res.status(401).send({
        message: 'Unauthorized'
      });
    } else {
      next();
    }
  });

  app.use('/', router);

  /**
   * [POST] Auth. Generates JWT token.
   *
   * Body input:
   * - user (string)
   * - password (string)
   *
   * Output: object
   */
  router.post('/auth', (req, res) => {
    const user = req.body.user;
    const password = req.body.password;

    function checkAcces(up) {
      return up.user === user && up.password === password;
    }

    if (!user) {
      res.json({
        success: false,
        message: 'Authentication failed. User not found.'
      });
    } else if (user) {
      if (config.api.users.findIndex(checkAcces) !== -1) {
        const token = jwt.sign(user, config.api.secret);

        res.json({
          success: true,
          message: 'Run your token!',
          token: token
        });
      } else {
        res.json({
          success: false,
          message: 'Authentication failed.'
        });
      }
    }
  });

  /**
   * [GET] health. Check runnerty instance health
   *
   * Output: object
   */
  router.get('/health', (req, res) => {
    res.status(200).send('Your runnerty instance is ok!');
  });

  /**
   * [GET] Get al the chains in the current plan.
   *
   * Output: chains (JSON)
   */
  router.get('/chains', (req, res) => {
    const output = apiPlan.getAllChains(config.api.chainsFieldsResponse);
    res.send(JSON.stringify(output, serializer()));
  });

  /**
   * [GET] Get all chain on specified status.
   *
   * Params input:
   * - status (string)
   *
   * Output:
   * - chains array (JSON)
   */
  router.get('/chains/status/:status', (req, res) => {
    const status = req.params.status;

    if (status) {
      const output = apiPlan.getChainsByStatus(status, config.api.chainsFieldsResponse);
      res.send(JSON.stringify(output, serializer()));
    } else {
      res.status(500).send('Param status not found');
    }
  });

  /**
   * [GET] Get chain for specified chainId
   *
   * Params input:
   * - chainId (string)
   *
   * Output: chain (JSON)
   */
  router.get('/chain/:chainId/:uniqueId', (req, res) => {
    const chainId = req.params.chainId;
    const uniqueId = req.params.uniqueId || req.params.chainId + '_main';
    const chain = apiPlan.getChainById(chainId, uniqueId, config.api.chainsFieldsResponse);

    if (chain) {
      res.send(JSON.stringify(chain, serializer()));
    } else {
      res.status(404).send(`Chain "${chainId}" not found`);
    }
  });

  /**
   * [POST] Force start a chain.
   *
   * Params input:
   * - chainId (string)
   *
   * Body input:
   * - input (objects array) input for an iterable chain
   * - custom_values (JSON) custom values to replace in chain processes
   */
  router.post('/chain/forceStart/:chainId', (req, res) => {
    const chainId = req.params.chainId;
    let custom_values_str = '';
    let input_str = '';
    try {
      custom_values_str = JSON.stringify(req.body.custom_values);
    } catch (err) {}

    try {
      input_str = JSON.stringify(req.body.input);
    } catch (err) {}

    logger.info(`API - CHAIN START FORCED: chainId:${chainId}, custom_values:${custom_values_str}, input:${input_str}`);
    const chain = apiPlan.getChainById(chainId);

    if (chain) {
      queueProcess.queueChain(chain, req.body.input, req.body.custom_values);
      res.send();
    } else {
      res.status(404).send('Chain not found');
      logger.error('forceStart error', 'Chain not found');
    }
  });

  /**
   * [GET] Get all processes from a specified chain by chainId.
   *
   * Params input:
   * - chainId (string)
   *
   * Output: processes (objects array)
   */
  router.get('/processes/:chainId/:uniqueId', (req, res) => {
    const chainId = req.params.chainId;
    const uniqueId = req.params.uniqueId || req.params.chainId + '_main';
    const chain = apiPlan.getChainById(chainId, uniqueId, config.api.chainsFieldsResponse);

    if (chain) {
      res.json(chain.processes || {});
    } else {
      res.status(404).send(`Chain "${chainId}" not found`);
    }
  });

  /**
   * [POST] Kills a non-iterable chain specified by chainId
   *
   * Params input:
   * - chainId (string)
   */
  router.post('/chain/stop/:chainId/:uniqueId', (req, res) => {
    const chainId = req.params.chainId;
    const uniqueId = req.params.uniqueId || req.params.chainId + '_main';

    try {
      apiPlan.stopChain(chainId, uniqueId);
      logger.info(`Chain "${chainId}" killed by ${req.user}`);
      res.json('');
    } catch (err) {
      res.status(404).send(err);
      logger.error('loadChainToPlan scheduleChain', err);
    }
  });

  /**
   * [GET] Gets a process specified by chainId and processId
   *
   * Params input:
   * - chainId (string)
   * - processId (string)
   *
   * Output: process (object)
   */
  router.get('/process/:chainId/:uniqueId/:processId', (req, res) => {
    const chainId = req.params.chainId;
    const uniqueId = req.params.uniqueId || req.params.chainId + '_main';
    const processId = req.params.processId;

    const chain = apiPlan.getChainById(chainId, uniqueId, config.api.chainsFieldsResponse);

    if (chain) {
      const process = chain.getProcessById(processId, config.api.processFieldsResponse);
      if (process) {
        res.json(process);
      } else {
        res.status(404).send(`Process "${processId}" not found in chain "${chainId}"`);
      }
    } else {
      res.status(404).send(`Chain "${chainId}" not found`);
    }
  });

  /**
   * Process retry. Tries to resume process stopped due to execution failure.
   * Body input:
   * - chainId (string) chain identificator
   * - processId (string) process identificator
   * - once (boolean - default false) true for retry execution just once,
   *   false for preconfigured retries
   */
  router.post('/process/retry', (req, res) => {
    const chainId = req.body.chainId;
    const uniqueId = req.body.uniqueId || req.params.chainId + '_main';
    const processId = req.body.processId;
    const once = req.body.once || false;

    logger.info(`Retrying process "${processId}" from chain "${chainId}" by ${req.user}`);

    const chain = apiPlan.getChainById(chainId, uniqueId);

    if (chain) {
      const process = chain.getProcessById(processId);
      if (process) {
        if (process.isErrored()) {
          res.json('');
          process
            .start(true, once)
            .then({})
            .catch(err => {
              logger.error('Retrying process:' + err);
            });
        } else {
          res.status(423).send(`Process "${processId}" from chain "${chainId}" is not in errored status`);
        }
      } else {
        res.status(404).send(`Process "${processId}" not found in chain "${chainId}"`);
      }
    } else {
      res.status(404).send(`Chain "${chainId}" not found`);
    }
  });

  /**
   * End process. Tries to set chain's process to end.
   * Body input:
   * - chainId (string) chain identificator
   * - processId (string) process identificator
   * - continueChain (boolean - default false) true to continue chain's
   *   execution processes, false to stop chain execution.
   */
  router.post('/process/end', (req, res) => {
    const chainId = req.body.chainId;
    const uniqueId = req.body.uniqueId || req.params.chainId + '_main';
    const processId = req.body.processId;
    const continueChain = req.body.continueChain || false;

    logger.info(`Setting process "${processId}" to end, from chain "${chainId}" by ${req.user}`);

    const chain = apiPlan.getChainById(chainId, uniqueId);

    if (chain) {
      const process = chain.getProcessById(processId);
      if (process) {
        if (!process.isEnded() && !process.isRunning()) {
          res.json();

          process.execute_return = '';
          process.execute_err_return = '';
          process.end().then(() => {});

          if (continueChain) {
            chain
              .startProcesses()
              .then({})
              .catch(err => {
                logger.error(
                  `Error in startProcesses next to set end process "${processId}" from chain "${chainId}" by ${req.user}:` +
                    err
                );
              });
          }
        } else {
          res
            .status(423)
            .send(
              `It's not possible to set process "${processId}" from chain "${chainId}" to end because it's ${process.status}`
            );
        }
      } else {
        res.status(404).send(`Process "${processId}" not found in chain "${chainId}"`);
      }
    } else {
      res.status(404).send(`Chain "${chainId}" not found`);
    }
  });

  /**
   * Process kill. Tries to kill a chain's process.
   * Body input:
   * - chainId (string) chain identificator
   * - processId (string) process identificator
   */
  router.post('/process/kill', (req, res) => {
    const chainId = req.body.chainId;
    const uniqueId = req.body.uniqueId || req.params.chainId + '_main';
    const processId = req.body.processId;

    logger.info(`Killing process "${processId}" from chain "${chainId}" by ${req.user}`);

    const chain = apiPlan.getChainById(chainId, uniqueId);

    if (chain) {
      const process = chain.getProcessById(processId);
      if (process) {
        if (process.isRunning()) {
          res.send();
          process.stop(req.user + ' REQUEST KILL PROCESS ' + processId + ' FROM CHAIN ' + chainId);
        } else {
          res
            .status(423)
            .send(
              `Is not posible kill process "${processId}" from chain "${chainId}" to end because is ${process.status}`
            );
        }
      } else {
        res.status(404).send(`Process "${processId}" not found in chain "${chainId}"`);
      }
    } else {
      res.status(404).send(`Chain "${chainId}" not found`);
    }
  });
};
