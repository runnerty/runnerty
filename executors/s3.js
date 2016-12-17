"use strict";

var logger = require("../libs/utils.js").logger;
var AWS    = require('aws-sdk');
var fs     = require('fs');
var path   = require('path');

module.exports.exec = function executeS3(process){

  return new Promise(function(resolve, reject) {
    process.loadExecutorConfig()
      .then((configValues) => {

        process.execute_args = process.getArgs();

        var s3 = new AWS.S3(configValues);
        var method = process.execute_args.method || configValues.method;

        if(method === 'upload'){

          var bucket = process.execute_args.bucket || configValues.bucket;

          // call S3 to retrieve upload file to specified bucket
          var uploadParams = {Bucket: bucket, Key: '', Body: ''};
          var file = process.execute_args.file;
          var file_name = process.execute_args.file_name || path.basename(file);

          var fileStream = fs.createReadStream(file);
          fileStream.on('error', function(err) {
            logger.log('error','S3 upload reading file Error', file, err);
          });

          uploadParams.Body = fileStream;
          uploadParams.Key  = file_name;

          s3.upload(uploadParams, function (err, data) {
            if(err) {
              logger.log('error',`S3 upload file Error: ${err}`);
              process.execute_err_return = `S3 upload file error: ${err}`;
              process.execute_return = '';
              process.error();
              reject(err);
            } if (data) {
              process.execute_err_return = '';
              process.execute_return = JSON.stringify(data);
              process.end();
              resolve();
            }
          });
        }else {
           logger.log('error',`S3 method not accepted: ${process.execute_args.method}`);
           process.execute_err_return = `S3 method not accepted: ${process.execute_args.method}`;
           process.execute_return = '';
           process.error();
           reject(err);
        }
  });
 });

};