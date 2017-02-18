"use strict";

var nodemailer = require('nodemailer');
var ejs = require('ejs');

var path = require('path');
var fs = require('fs');

var Execution = require("../../classes/execution.js");

class mailExecutor extends Execution {
  constructor(process) {
    super(process);
  }

  exec(process) {
    var _this = this;

    function sendMail(mail, callback) {

      function readFilePromise(type, file) {
        return new Promise(function (resolve, reject) {
          fs.readFile(file, function (err, data) {
            var res = {};
            if (err) {
              res[type] = err;
              reject(res);
            } else {
              res[type] = data;
              resolve(res);
            }
          });
        });
      }
      var transport = nodemailer.createTransport(mail.transport);
      var filesReads = [];

      var templateDir = path.resolve(mail.templateDir, mail.template);
      var htmlTemplate = path.resolve(templateDir, 'html.html');
      var txtTemplate = path.resolve(templateDir, 'text.txt');


      if(mail.attachments && mail.attachments.length > 0){
        var attachments = [];
        var attachmentsLength = mail.attachments.length;

        while (attachmentsLength--) {
          var keys = Object.keys(mail.attachments[attachmentsLength]);
          var keysLength = keys.length;
          var attAux = {};
          if (keysLength > 0) {
            while (keysLength--) {
              attAux[keys[keysLength]] = _this.replaceWith(mail.attachments[attachmentsLength][keys[keysLength]], mail.params);
            }
            attachments.push(attAux);
          }
        }
      }

      filesReads.push(readFilePromise('html', htmlTemplate));
      filesReads.push(readFilePromise('text', txtTemplate));

      Promise.all(filesReads)
        .then(function (res) {

          var html_data;
          var text_data;

          if (res[0].hasOwnProperty('html')) {
            html_data = res[0].html.toString();
            text_data = res[1].text.toString();
          } else {
            html_data = res[1].html.toString();
            text_data = res[0].text.toString();
          }

          var processValues = process.values();
          var html = _this.replaceWith(html_data, mail.params);
          html = _this.replaceWith(html, processValues);
          var text = _this.replaceWith(text_data, mail.params);
          text = _this.replaceWith(text, processValues);

          if(mail.ejsRender){
            html = ejs.render(html);
            text = ejs.render(text);
          }

          var mailOptions = {
            from: mail.from,
            to: mail.to,
            subject: mail.params.subject,
            text: text,
            html: html,
            attachments: attachments
          };

          if (mail.disable) {
            _this.logger.log('warn', 'Mail sender is disable.');
            callback();
          } else {
            transport.sendMail(mailOptions,
              function (err, res) {
                if (err) {
                  _this.logger.log('error', 'Error sending mail:', err);
                  callback(err, null);
                } else {
                  callback(null, res);
                }
              });
          }
        })
        .catch(function (e) {
          _this.logger.log('error', 'Error sending mail:', e);
          callback(e, null);
        });
    }

    return new Promise(function (resolve, reject) {
      _this.getValues(process)
        .then((res) => {
          var mail = res;
          mail.params = {};

            if(res.to){

              for (var i = 0, len = res.to.length; i < len; i++) {
                if (i) {
                  mail.to = mail.to + res.to[i] + ((i < len - 1) ? ', ' : '');
                }
                else {
                  mail.to = res.to[i] + ((i < len - 1) ? ', ' : '');
                }
              }

              if (res.cc) {
                for (var i = 0, len = res.cc.length; i < len; i++) {
                  if (i) {
                    mail.cc = mail.cc + res.cc[i] + ((i < len - 1) ? ', ' : '');
                  }
                  else {
                    mail.cc = res.cc[i] + ((i < len - 1) ? ', ' : '');
                  }
                }
              }

              if (res.bcc) {
                for (var i = 0, len = res.bcc.length; i < len; i++) {
                  if (i) {
                    mail.bcc = mail.bcc + res.bcc[i] + ((i < len - 1) ? ', ' : '');
                  }
                  else {
                    mail.bcc = res.bcc[i] + ((i < len - 1) ? ', ' : '');
                  }
                }
              }

              var procesValues = process.values();
              mail.params.subject = _this.replaceWith(res.title, procesValues);
              mail.params.message = _this.replaceWith(res.message, procesValues);

              mail.params.args    = process.args || {};

              sendMail(mail, function (err, res) {
                if (err) {
                  _this.logger.log('error', `Error Mail sendMail ${err}`);
                  process.execute_err_return = err;
                  process.execute_return = '';
                  process.error();
                  reject(process);
                }else{
                  process.execute_err_return = '';
                  process.execute_return = '';
                  process.end();
                  resolve();
                }
              });

          } else {
            _this.logger.log('error', `Error Mail recipient not setted.`);
            process.execute_err_return = `Error Mail recipient not setted.`;
            process.execute_return = '';
            process.error();
            reject(process);
          }
        })
        .catch((err) => {
          _this.logger.log('error', `mailExecutor Error getValues: ${err}`);
          process.execute_err_return = `mailExecutor Error getValues ${err}`;
          process.execute_return = '';
          process.error();
          reject(process);
        });
    });
  }
}

module.exports = mailExecutor;