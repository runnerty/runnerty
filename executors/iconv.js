"use strict";

var logger = require("../libs/utils.js").logger;
var iconv  = require('iconv-lite');
var fs     = require('fs');
var path   = require('path');

module.exports.exec = function(process){

  return new Promise(function(resolve, reject) {
    process.loadExecutorConfig()
      .then((configValues) => {

      process.execute_args = process.getArgs();

      var _file_input  = process.execute_args.file_input  || configValues.file_input;
      var _file_output = process.execute_args.file_output || configValues.file_output;
      var _decode_encoding = process.execute_args.decode_encoding || configValues.decode_encoding;
      var _encode_encoding = process.execute_args.encode_encoding || configValues.encode_encoding;

      if(_decode_encoding && _encode_encoding){

        if(iconv.encodingExists(_decode_encoding) && iconv.encodingExists(_encode_encoding)){

          // CONVERTING FILE
          if(_file_input && _file_output){
            var fileStream = fs.createReadStream(_file_input);
            var fileStreamOutput = fs.createWriteStream(_file_output);
            var decoderStream = iconv.decodeStream(_decode_encoding);


            fileStream
              .pipe(decoderStream)
              .pipe(iconv.encodeStream(_encode_encoding))
              .pipe(fileStreamOutput);


            fileStream.on('error', function(err) {
              logger.log('error','Error Iconv reading file', _file_input, err);
              process.execute_err_return = `Error Iconv reading file ${_file_input}: ${err}`;
              process.execute_return = '';
              process.error();
              reject(err);
            });

            decoderStream.on('error', function(err, str) {
              logger.log('error',`Error Iconv decoding (${_decode_encoding}) file ${_file_input}:`, err);
              process.execute_err_return = `Error Iconv decoding (${_decode_encoding}) file ${_file_input}: ${err}`;
              process.execute_return = '';
              process.error();
              reject(err);
            });

            decoderStream.on('error', function(err, str) {
              logger.log('error',`Error Iconv encoding (${_encode_encoding}) file ${_file_input}:`, err);
              process.execute_err_return = `Error Iconv encoding (${_encode_encoding}) file ${_file_input}: ${err}`;
              process.execute_return = '';
              process.error();
              reject(err);
            });

            fileStreamOutput.on('error', function(err) {
              logger.log('error','Error Iconv writing encoded file', _file_output, err);
              process.execute_err_return = `Error Iconv writing encoded file ${_file_output}: ${err}`;
              process.execute_return = '';
              process.error();
              reject(err);
            });

            fileStreamOutput.on('close', function(err) {
              process.execute_err_return = '';
              process.execute_return = '';
              process.end();
              resolve();
            });
          }else{
            logger.log('error',`Error Iconv files not setted: file_input: ${_file_input} / file_output: ${_file_output}`);
            process.execute_err_return = `Error Iconv files not setted: file_input: ${_file_input} / file_output: ${_file_output}`;
            process.execute_return = '';
            process.error();
            reject();
          }

        }else{
          logger.log('error',`Error Iconv encodings not supported. decode_encoding: ${_decode_encoding} ${iconv.encodingExists(_decode_encoding)? 'supported':'not supported'} / encode_encoding: ${_encode_encoding} ${iconv.encodingExists(_decode_encoding)? 'supported':'not supported'}`);
          process.execute_err_return = `Error Iconv encodings not supported. decode_encoding: ${_decode_encoding} ${iconv.encodingExists(_decode_encoding)? 'supported':'not supported'} / encode_encoding: ${_encode_encoding} ${iconv.encodingExists(_decode_encoding)? 'supported':'not supported'}`;
          process.execute_return = '';
          process.error();
          reject();
        }

      }else{
        logger.log('error',`Error Iconv encoders not setted. decode_encoding: ${_decode_encoding} / encode_encoding: ${_encode_encoding}`);
        process.execute_err_return = `Error Iconv encoders not setted. decode_encoding: ${_decode_encoding} / encode_encoding: ${_encode_encoding}`;
        process.execute_return = '';
        process.error();
        reject();
      }

  });
  });

};