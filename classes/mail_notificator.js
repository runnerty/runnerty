"use strict";

var nodemailer      = require('nodemailer');
var path            = require('path');
var fs              = require('fs');
var replaceWith     = require("../libs/utils.js").replaceWith;
var Notification    = require("./notification.js");

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

  filesReads.push(readFilePromise('html',htmlTemplate));
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

      var html = replaceWith(html_data, mail.params);
      var text = replaceWith(text_data, mail.params);

      var mailOptions = {
        from: mail.from,
        to: mail.to,
        subject: mail.params.subject,
        text: text,
        html: html
      };

      if(mail.disable){
        logger.log('warn','Mail sender is disable.');
        callback();
      }else{
        transport.sendMail(mailOptions,
          function(err, res){
            if(err) {
              logger.log('error','Error sending mail:',err);
              callback(err,null);
            }else{
              callback(null,res);
            }
          });
      }
    })
    .catch(function(e){
      logger.log('error','Error sending mail:',e);
      callback(e,null);
    });
};

class mailNotificator extends Notification{
  constructor(type, id, title, message, recipients, recipients_cc, recipients_cco){
    super('mail', id, title, message, recipients, recipients_cc, recipients_cco);

    return new Promise((resolve) => {
        resolve(this);
  });
  }

  notificate(values){

    return new Promise((resolve) => {

    this.loadConfig()
    .then((configValues) => {
      if (configValues){
        if (!this.from && configValues.from)               this.from        = configValues.from;
        if (!this.transport && configValues.transport)     this.transport   = configValues.transport;
        if (!this.templateDir && configValues.templateDir) this.templateDir = configValues.templateDir;
        if (!this.template && configValues.template)       this.template    = configValues.template;
        if (!this.disable && configValues.disable)         this.disable     = configValues.disable;
      }

      this.params = values;

      for (var   i = 0, len = this.recipients.length; i < len; i++) {
        if (i){
          this.to = this.to + this.recipients[i] + ((i < len-1) ? ', ' : '');
        }
        else{
          this.to = this.recipients[i] + ((i < len-1) ? ', ' : '');
        }
      }

      for (var i = 0, len = this.recipients_cc.length; i < len; i++) {
        if (i){
          this.cc = this.cc + this.recipients_cc[i] + ((i < len-1) ? ', ' : '');
        }
        else{
          this.cc = this.recipients_cc[i] + ((i < len-1) ? ', ' : '');
        }
      }

      for (var i = 0, len = this.recipients_cco.length; i < len; i++) {
        if (i){
          this.bcc = this.bcc + this.recipients_cco[i] + ((i < len-1) ? ', ' : '');
        }
        else{
          this.bcc = this.recipients_cco[i] + ((i < len-1) ? ', ' : '');
        }
      }

      this.params.subject = replaceWith(this.title, values);
      this.params.message = replaceWith(this.message, values);

      sendMail(this, function(err, res){
        if (err){
          logger.log('error','Error sending mail:'+e,this,values);
        }
        resolve(res);
      });

  })
  .catch(function(e){
      logger.log('error','Mail notificate loadConfig '+e)
      resolve();
    });
  });
  }
}

module.exports = mailNotificator;