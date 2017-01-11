"use strict";

var AWS = require('aws-sdk');
var fs = require('fs');
var path = require('path');

var Execution = require("../../classes/execution.js");

class s3Executor extends Execution {
  constructor(process) {
    super(process);
  }

  exec(process) {
    var _this = this;

    return new Promise(function (resolve, reject) {
      _this.getValues(process)
        .then((res) => {

          var awsS3Config = {
            apiVersion: res.apiVersion,
            accessKeyId: res.accessKeyId,
            secretAccessKey: res.secretAccessKey,
            bucket: res.bucket,
            method: res.method,
            region: res.region
          };

          var s3 = new AWS.S3(awsS3Config);

          if (res.method === 'upload') {

            // call S3 to retrieve upload file to specified bucket
            var uploadParams = {Bucket: res.bucket, Key: '', Body: ''};
            var file_name = res.file_name || path.basename(res.file);

            var fileStream = fs.createReadStream(res.file);
            fileStream.on('error', function (err) {
              _this.logger.log('error', 'S3 upload reading file Error', res.file, err);
            });

            uploadParams.Body = fileStream;
            uploadParams.Key = file_name;

            s3.upload(uploadParams, function (err, data) {
              if (err) {
                _this.logger.log('error', `S3 upload file Error: ${err}`);
                process.execute_err_return = `S3 upload file error: ${err}`;
                process.execute_return = '';
                process.error();
                reject(process);
              }
              if (data) {
                process.execute_err_return = '';
                process.execute_return = JSON.stringify(data);
                process.end();
                resolve();
              }
            });
          } else {
            _this.logger.log('error', `S3 method not accepted: ${method}`);
            process.execute_err_return = `S3 method not accepted: ${method}`;
            process.execute_return = '';
            process.error();
            reject(process);
          }
        })
        .catch((err) => {
          _this.logger.log('error', `S3 Error getValues: ${err}`);
          process.execute_err_return = `S3 Error getValues ${err}`;
          process.execute_return = '';
          process.error();
          reject(process);
        });
    });
  }
}

module.exports = s3Executor;