"use strict";

var iconv = require('iconv-lite');
var fs = require('fs');
var path = require('path');

var Execution = require("../../classes/execution.js");

class iconvExecutor extends Execution {
  constructor(process) {
    super(process);
  }

  exec(process) {
    var _this = this;

    return new Promise(function (resolve, reject) {
      process.loadExecutorConfig()
        .then((configValues) => {

          var _file_input = _this.replaceWith(process.exec.file_input || configValues.file_input, process.values());
          var _file_output = _this.replaceWith(process.exec.file_output || configValues.file_output, process.values());
          var _decode_encoding = _this.replaceWith(process.exec.decode_encoding || configValues.decode_encoding, process.values());
          var _encode_encoding = _this.replaceWith(process.exec.encode_encoding || configValues.encode_encoding, process.values());

          if (_decode_encoding && _encode_encoding) {

            if (iconv.encodingExists(_decode_encoding) && iconv.encodingExists(_encode_encoding)) {

              // CONVERTING FILE
              if (_file_input && _file_output) {
                var fileStream = fs.createReadStream(_file_input);
                var fileStreamOutput = fs.createWriteStream(_file_output);
                var decoderStream = iconv.decodeStream(_decode_encoding);

                fileStream
                  .pipe(decoderStream)
                  .pipe(iconv.encodeStream(_encode_encoding))
                  .pipe(fileStreamOutput);


                fileStream.on('error', function (err) {
                  _this.logger.log('error', 'Error Iconv reading file', _file_input, err);
                  process.execute_err_return = `Error Iconv reading file ${_file_input}: ${err}`;
                  process.execute_return = '';
                  process.error();
                  reject(process);
                });

                decoderStream.on('error', function (err, str) {
                  _this.logger.log('error', `Error Iconv decoding (${_decode_encoding}) file ${_file_input}:`, err);
                  process.execute_err_return = `Error Iconv decoding (${_decode_encoding}) file ${_file_input}: ${err}`;
                  process.execute_return = '';
                  process.error();
                  reject(process);
                });

                decoderStream.on('error', function (err, str) {
                  _this.logger.log('error', `Error Iconv encoding (${_encode_encoding}) file ${_file_input}:`, err);
                  process.execute_err_return = `Error Iconv encoding (${_encode_encoding}) file ${_file_input}: ${err}`;
                  process.execute_return = '';
                  process.error();
                  reject(process, err);
                });

                fileStreamOutput.on('error', function (err) {
                  _this.logger.log('error', 'Error Iconv writing encoded file', _file_output, err);
                  process.execute_err_return = `Error Iconv writing encoded file ${_file_output}: ${err}`;
                  process.execute_return = '';
                  process.error();
                  reject(process);
                });

                fileStreamOutput.on('close', function () {
                  process.execute_err_return = '';
                  process.execute_return = '';
                  process.end();
                  resolve();
                });
              } else {
                _this.logger.log('error', `Error Iconv files not setted: file_input: ${_file_input} / file_output: ${_file_output}`);
                process.execute_err_return = `Error Iconv files not setted: file_input: ${_file_input} / file_output: ${_file_output}`;
                process.execute_return = '';
                process.error();
                reject(process);
              }

            } else {
              _this.logger.log('error', `Error Iconv encodings not supported. decode_encoding: ${_decode_encoding} ${iconv.encodingExists(_decode_encoding) ? 'supported' : 'not supported'} / encode_encoding: ${_encode_encoding} ${iconv.encodingExists(_decode_encoding) ? 'supported' : 'not supported'}`);
              process.execute_err_return = `Error Iconv encodings not supported. decode_encoding: ${_decode_encoding} ${iconv.encodingExists(_decode_encoding) ? 'supported' : 'not supported'} / encode_encoding: ${_encode_encoding} ${iconv.encodingExists(_decode_encoding) ? 'supported' : 'not supported'}`;
              process.execute_return = '';
              process.error();
              reject(process);
            }

          } else {
            _this.logger.log('error', `Error Iconv encoders not setted. decode_encoding: ${_decode_encoding} / encode_encoding: ${_encode_encoding}`);
            process.execute_err_return = `Error Iconv encoders not setted. decode_encoding: ${_decode_encoding} / encode_encoding: ${_encode_encoding}`;
            process.execute_return = '';
            process.error();
            reject(process);
          }

        });
    });

  }
}

module.exports = iconvExecutor;