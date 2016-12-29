"use strict";

var nodemailer      = require('nodemailer');
var path            = require('path');
var fs              = require('fs');
var Notification    = require("../../classes/notification.js");

function sendMail(mail, callback){

  function readFilePromise(type, file){
    return new Promise(function(resolve, reject) {
      fs.readFile(file, function(err, data){
        var res = {};
        if(err){
          res[type] = err;
          reject(res);
        }else{
          res[type] = data;
          resolve(res);
        }
      });
    });
  }

  var transport = nodemailer.createTransport(mail.transport);
  var filesReads = [];

  var templateDir  = path.resolve(mail.templateDir, mail.template);
  var htmlTemplate = path.resolve(templateDir, 'html.html');
  var txtTemplate	 = path.resolve(templateDir, 'text.txt');

  var attachments  = [];
  var attachmentsLength = mail.attachments.length;

  while(attachmentsLength--){
    var keys = Object.keys(mail.attachments[attachmentsLength]);
    var keysLength = keys.length;
    var attAux = {};
    if (keysLength > 0) {
      while (keysLength--) {
        attAux[keys[keysLength]] = mail.replaceWith(mail.attachments[attachmentsLength][keys[keysLength]], mail.params);
      }
      attachments.push(attAux);
    }
  }

  filesReads.push(readFilePromise('html', htmlTemplate));
  filesReads.push(readFilePromise('text', txtTemplate));

  Promise.all(filesReads)
    .then(function (res) {

      var html_data;
      var text_data;

      if(res[0].hasOwnProperty('html')){
        html_data = res[0].html.toString();
        text_data = res[1].text.toString();
      }else{
        html_data = res[1].html.toString();
        text_data = res[0].text.toString();
      }

      var html = mail.replaceWith(html_data, mail.params);
      var text = mail.replaceWith(text_data, mail.params);

      var mailOptions = {
        from: mail.from,
        to: mail.to,
        subject: mail.params.subject,
        text: text,
        html: html,
        attachments: attachments
      };

      if(mail.disable){
        mail.logger.log('warn','Mail sender is disable.');
        callback();
      }else{
        transport.sendMail(mailOptions,
          function(err, res){
            if(err) {
              mail.logger.log('error','Error sending mail:',err);
              callback(err,null);
            }else{
              callback(null,res);
            }
          });
      }
    })
    .catch(function(e){
      mail.logger.log('error','Error sending mail:',e);
      callback(e,null);
    });
};

class mailNotificator extends Notification{
  constructor(notification){
    super(notification)
}

  notificate(values){

    var _this = this;

    if (_this.config){
      if (!_this.from        && _this.config.from)        _this.from        = _this.config.from;
      if (!_this.transport   && _this.config.transport)   _this.transport   = _this.config.transport;
      if (!_this.templateDir && _this.config.templateDir) _this.templateDir = _this.config.templateDir;
      if (!_this.template    && _this.config.template)    _this.template    = _this.config.template;
      if (!_this.disable     && _this.config.disable)     _this.disable     = _this.config.disable;
    }

    _this.params = values;

    for (var   i = 0, len = _this.recipients.length; i < len; i++) {
      if (i){
        _this.to = _this.to + _this.recipients[i] + ((i < len-1) ? ', ' : '');
      }
      else{
        _this.to = _this.recipients[i] + ((i < len-1) ? ', ' : '');
      }
    }

    if(_this.recipients_cc){
      for (var i = 0, len = _this.recipients_cc.length; i < len; i++) {
        if (i){
          _this.cc = _this.cc + _this.recipients_cc[i] + ((i < len-1) ? ', ' : '');
        }
        else{
          _this.cc = _this.recipients_cc[i] + ((i < len-1) ? ', ' : '');
        }
      }
    }

    if(_this.recipients_cco){
      for (var i = 0, len = _this.recipients_cco.length; i < len; i++) {
        if (i){
          _this.bcc = _this.bcc + _this.recipients_cco[i] + ((i < len-1) ? ', ' : '');
        }
        else{
          _this.bcc = _this.recipients_cco[i] + ((i < len-1) ? ', ' : '');
        }
      }
    }

    _this.params.subject = _this.replaceWith(_this.title, values);
    _this.params.message = _this.replaceWith(_this.message, values);

    sendMail(_this, function(err, res){
      if (err){
        _this.logger.log('error','Error sending mail:',err);
      }
    });
  }
}

module.exports = mailNotificator;