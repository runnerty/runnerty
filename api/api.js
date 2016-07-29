"use strict";

var express         = require('express');
var bodyParser      = require('body-parser');
var router 	        = express.Router();
var morgan          = require('morgan');
var passport        = require('passport');
var jwt             = require('jsonwebtoken');
var expressJwt      = require('express-jwt');

//============================================

module.exports = function (app, config) {
  app.use(morgan('dev'));

  app.use(bodyParser.json());

  app.use(expressJwt({
    secret: config.ws.SECRET(),
    getToken: function fromHeaderOrQuerystring (req) {
      if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
        return req.headers.authorization.split(' ')[1];
      } else if (req.query && req.query.token) {
        return req.query.token;
      }
      return null;
    }
  }).unless({
    path: ['/api-ws/v1.0/authsyssoc']
  }));

  app.use(function (err, req, res, next) {
    if (err.name === 'UnauthorizedError') {
      res.status(401).send('Unauthorized');
    }
  });

  router.post('/auth', function(req, res) {

    var user 	   = req.body.user;
    var password = req.body.password;

    if (!user) {
      res.json({ success: false, message: 'Authentication failed. User not found.' });
    } else if (user) {

      if(user === 'coderty' && password === 'runnerty'){

        var token = jwt.sign(user, config.ws.SECRET(), {
          expiresIn: 14400 // 4 hours
        });

        res.json({
          success: true,
          message: 'Enjoy your token!',
          token: token
        });

      }else{
        res.json({ success: false, message: 'Authentication failed.' });
      }
    }

  });

  app.use('/api-runnerty/v1.0', router);

};