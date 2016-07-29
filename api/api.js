"use strict";

var express         = require('express');
var bodyParser      = require('body-parser');
var router 	        = express.Router();
var morgan          = require('morgan');
var passport        = require('passport');
var jwt             = require('jsonwebtoken');
var expressJwt      = require('express-jwt');
var app             = express();
var express         = require('express');
var app             = express();
var server          = require('http').Server(app);
var helmet          = require('helmet');
/*
 var lusca           = require('lusca');
*/

//============================================

module.exports = function (config, logger, plan) {

    //==================================================================
    // Cookies
    /*
    app.use(cookieParser());
    app.use(session({
      name: config.COOKIE.NAME,
      secret: config.COOKIE.SECRET,
      store: sessionStore,
      saveUninitialized: true, // don't create session until something stored,
      resave: true, // don't save session if unmodified
      proxy: true,
      cookie: {
        path: '/',
        httpOnly: true,
        secure: config.global.SESSION_SECURE_TOKEN,
        maxAge: config.COOKIE.MAXAGEMIN * 60 * 1000
      }
    }));
    */

    //==============================================
    // SERVER

    server.listen(config.api.port, function(err, res){
      //TODO CATCH ERRORS:
      logger.log('info','Listening on port '+config.api.port);
    });


    app.use(bodyParser.urlencoded({extended: true}));
    app.use(bodyParser.json({limit: config.api.limite_req}));

    //==============================================
    // SECURITY
    app.use(helmet());
    app.disable( 'x-powered-by' );
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
      getToken: function fromHeaderOrQuerystring (req) {
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

    router.post('/auth', function(req, res) {

      var user 	   = req.body.user;
      var password = req.body.password;
      console.log('user:',user,'password:',password,req.body);

      if (!user) {
        res.json({ success: false, message: 'Authentication failed. User not found.' });
      } else if (user) {
        console.log('user:',user,'password:',password);
        if(user === 'coderty' && password === 'runnerty'){

          var token = jwt.sign(user, config.api.secret, {
           // expiresIn: "10h" // 8 hours
          });

          res.json({
            success: true,
            message: 'Run your token!',
            token: token
          });

        }else{
          res.json({ success: false, message: 'Authentication failed.' });
        }
      }

    });

    router.get('/chains', function (req, res) {
      res.json(plan.plan.chains);
    });

};