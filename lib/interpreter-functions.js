'use strict';

const moment = require('moment');
const crypto = require('crypto');
const path = require('path');
const url = require('url');

const functions = {
  gv: getvalue,
  getvalue: getvalue,
  gvq: getvaluequoted,
  getvaluequoted: getvaluequoted,
  getvalueescape: getvalueescape,
  gvescape: getvalueescape,
  getvalueunescape: getvalueunescape,
  gvunescape: getvalueunescape,
  if: _if,
  eq: eq,
  ne: ne,
  gt: gt,
  gte: gte,
  lt: lt,
  lte: lte,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  abs: Math.abs,
  round: Math.round,
  ceil: Math.ceil,
  floor: Math.floor,
  log: Math.log,
  exp: Math.exp,
  pow: Math.pow,
  sqrt: Math.sqrt,
  max: Math.max,
  min: Math.min,
  random: random,
  add: add,
  trim: trim,
  ltrim: ltrim,
  rtrim: rtrim,
  substr: substr,
  length: length,
  replace: replace,
  escape: escape,
  unescape: unescape,
  hash: hash,
  encrypt: encrypt,
  decrypt: decrypt,
  subtract: subtract,
  divide: divide,
  multiply: multiply,
  modulus: modulus,
  lpad: lpad,
  rpad: rpad,
  concat: concat,
  concatws: concatws,
  upper: upper,
  lower: lower,
  includes: includes,
  indexof: indexof,
  getdate: getDate,
  lastday: lastDay,
  dateformat: dateFormat,
  charcode: charcode,
  ifnull: ifnull,
  pathparse: pathParse,
  pathnormalize: path.normalize,
  pathjoin: path.join,
  urlparse: urlParse,
  quote: quote,
  stringify: stringify,
  jsonstringify: stringify
};

/**
 * Get Environment variable.
 * Used by GetValue
 * @param s string
 * @returns string
 */
function getENVs(s) {
  let res = '';
  const envName = s.substr(4, s.length);
  if (s.startsWith('ENV_') && process.env[envName]) {
    res = process.env[envName];
  }
  return res;
}

/**
 * GetValue/GV: Returns a value (idvalue) of values
 * Used to obtain values of the dynamic variables
 * @param idvalue
 * @param values
 * @returns {string}
 */
function getvalue(idvalue, quote, values) {
  let res = '';
  if (values[idvalue]) {
    const match = values[idvalue];

    if (match) {
      res = match;
    } else {
      if (idvalue.startsWith('ENV_')) {
        res = getENVs(idvalue);
      }
    }

    if (quote) {
      if (quote === "\\'") {
        quote = "'";
      }
      res = quote + res + quote;
    }
  }
  return res;
}

/**
 * GetValueQuoted/GVQ: Returns a value (idvalue) of values
 * Used to obtain values of the dynamic variables
 * @param idvalue
 * @quote quote (quote string)
 * @param values
 * @returns {string}
 */
function getvaluequoted(idvalue, quote = "'", values) {
  const match = values[idvalue];
  let res = '';

  if (match) {
    res = match;
  } else {
    if (idvalue.startsWith('ENV_')) {
      res = getENVs(idvalue);
    }
  }

  if (quote === "\\'") {
    quote = "'";
  }
  return quote + res + quote;
}

/**
 * Escape
 * @param string
 * @returns {string} escaped string
 */
function escape(string) {
  return ('' + string).replace(/["'\\\n\r\u2028\u2029]/g, _char => {
    switch (_char) {
      case '"':
        return '\\' + _char;
      case "'":
        return '\\' + _char;
      case '\\':
        return '\\' + _char;
      case '\n':
        return '\\n';
      case '\r':
        return '\\r';
      case '\u2028':
        return '\\u2028';
      case '\u2029':
        return '\\u2029';
      default:
        return _char;
    }
  });
}

/**
 * Unescape
 * @param string
 * @returns {string} unescaped string
 */
function unescape(string) {
  return ('' + string).replace(/\\'|\\"|\\n|\\r|\\u2028|\\u2029/g, _escapedChar => {
    switch (_escapedChar) {
      case '\\"':
        return '"';
      case "\\'":
        return "'";
      case '\\n':
        return '\n';
      case '\\r':
        return '\r';
      case '\\u2028':
        return '\u2028';
      case '\\u2029':
        return '\u2029';
      default:
        return _escapedChar;
    }
  });
}

/**
 * GetValueEscape/GVEscape: Returns a escaped value (idvalue) of values
 * Used to obtain values of the dynamic variables
 * @param idvalue
 * @param values
 * @returns {string}
 */
function getvalueescape(idvalue, values) {
  const match = values[idvalue];
  let res = '';

  if (match) {
    res = match;
  } else {
    if (idvalue.startsWith('ENV_')) {
      res = getENVs(idvalue);
    }
  }
  return escape(res);
}

/**
 * GetValueUnescape/GVUnescape: Returns a unescaped value (idvalue) of values
 * Used to obtain values of the dynamic variables
 * @param idvalue
 * @param values
 * @returns {string}
 */
function getvalueunescape(idvalue, values) {
  const match = values[idvalue];
  let res = '';

  if (match) {
    res = match;
  } else {
    if (idvalue.startsWith('ENV_')) {
      res = getENVs(idvalue);
    }
  }
  return unescape(res);
}

/**
 * Trim: Return trim input string
 * @param s {string}
 * @returns {string}
 */
function trim(s) {
  return s.replace(/'/g, '').trim();
}

/**
 * LTrim: Return left trim input string
 * @param s {string}
 * @returns {string}
 */
function ltrim(s) {
  return s.replace(/'/g, '').ltrim();
}

/**
 * RTrim: Return right trim input string
 * @param s {string}
 * @returns {string}
 */
function rtrim(s) {
  return s.replace(/'/g, '').rtrim();
}

/**
 * LPad: Returns a string(s) that is left-padded with a specified string(p) to a certain length(l).
 * @param s {string}
 * @param l length {string}
 * @param p padded string {string}
 * @returns {string}
 */
function lpad(s, l, p) {
  return s.replace(/'/g, '').padStart(l, p.replace(/'/g, ''));
}

/**
 * RPad: Returns a string(s) that is right-padded with a specified string(p) to a certain length(l).
 * @param s {string}
 * @param l length {string}
 * @param p padded string {string}
 * @returns {string}
 */
function rpad(s, l, p) {
  return s.replace(/'/g, '').padEnd(l, p.replace(/'/g, ''));
}

/**
 * Concat: Concatenates two or more expressions together
 * @params N strings or functions
 * @returns {string}
 */
function concat() {
  let strOutput = '';
  for (let i = 0; i < arguments.length; i++) {
    const arg = arguments[i];
    strOutput += arg;
  }
  return strOutput;
}

/**
 * ConcatWS: Concatenates two or more expressions together and adds a separator between them
 * @params separator {string}
 * @params N strings or functions
 * @returns {string}
 */
function concatws() {
  let strOutput = '';
  let separator = '';
  for (let i = 1; i < arguments.length; i++) {
    if (strOutput !== '') separator = arguments[0];
    const arg = arguments[i];
    strOutput += separator + arg;
  }
  return strOutput;
}

/**
 * Upper: Converts a string to upper-case
 * @param s
 * @returns {string}
 */
function upper(s) {
  return s.toUpperCase();
}

/**
 * Lower: Converts a string to lower-case
 * @param s
 * @returns {string}
 */
function lower(s) {
  return s.toLowerCase();
}

/**
 * Includes: Returns true or false depending on whether it finds or not a string in another string
 * @param s - The string that will be searched {string}
 * @param is - The substring to search for in string {string}
 * @returns {boolean}
 */
function includes(s, is) {
  return s.includes(is);
}

/**
 * IndexOf: Returns the position of the first occurrence of a string in another string
 * @param s - The string that will be searched {string}
 * @param is - The substring to search for in string {string}
 * @returns {number}
 */
function indexof(s, is) {
  return s.indexof(is);
}

/**
 * SubStr: Returns a substring from a string (starting at any position).
 * @param s - The string to extract from
 * @param i - The start position
 * @param e - The number of characters to extract. If omitted, the whole string will be returned (from the start position)
 * @returns {string}
 */
function substr(s, i, e) {
  let res = '';
  if (e) res = s.substr(i, e);
  else res = s.substr(i);
  return res;
}

/**
 * Length: Returns the length of the specified string (in bytes).
 * @param s {string}
 */
function length(s) {
  return s.length;
}

/**
 * Replace: Replaces all occurrences of a specified string.
 * @param s -  The string
 * @param sub - The substring to find
 * @param n - The replacement substring
 * @param f - The flags (RegExp)
 */
function replace(s, sub, n, f) {
  let _regexp = sub;
  if (f) {
    _regexp = new RegExp(sub, f);
  }
  return s.replace(_regexp, n);
}

/**
 * CharCode: Returns the number code that represents the specific character.
 * @param s
 * @returns {number}
 */
function charcode(s) {
  return s.charCodeAt(0);
}

/**
 * Subtract
 * @params N {number}
 * @returns {number}
 */
function subtract() {
  let res = 0;
  for (let i = 0; i < arguments.length; i++) {
    if (i === 0) {
      res = arguments[0];
    } else {
      res = res - arguments[i];
    }
  }
  return res;
}

/**
 * Add
 * @params N {number}
 * @returns {number}
 */
function add() {
  let res = 0;
  for (let i = 0; i < arguments.length; i++) {
    const arg = arguments[i];
    res += arg;
  }
  return res;
}

/**
 * Random: Returns a random number.
 * @param round - Decimals number
 * @param min - Min number random
 * @param max - Max number random
 * @returns {float}
 */
function random(round, min, max) {
  let res;
  if (round && typeof round === 'string') round = parseInt(round);
  if (min && typeof min === 'string') min = parseInt(min);
  if (max && typeof max === 'string') max = parseInt(max);

  if (round || round === 0) {
    res = parseFloat(
      (min || min === 0) && (max || max === 0) ? Math.random() * (max + 1 - min) + min : Math.random()
    ).toFixed(round);
  } else {
    res = (min || min === 0) && (max || max === 0) ? Math.random() * (max + 1 - min) + min : Math.random();
  }

  return res;
}

/**
 * Multiply
 * @param x
 * @param y
 * @returns {number}
 */
function multiply(x, y) {
  return x * y;
}

/**
 * Divide
 * @param x
 * @param y
 * @returns {number}
 */
function divide(x, y) {
  return x / y;
}

/**
 * Modulus
 * @param x
 * @param y
 * @returns {number}
 */
function modulus(x, y) {
  return x % y;
}

/**
 * Ifnull: Returns an alternative (r) value if an expression is null and optionally other (e) if not.
 * @param v - The value to test whether is NULL
 * @param a - The value to return if expression is a NULL value
 * @param e - Optional: The value to return if expression is NOT NULL value
 * @returns {string}
 */
function ifnull(v, a, e) {
  let res = e || v;
  if (!v || v === '' || typeof v === 'undefined') {
    res = a;
  }
  return res;
}

/**
 * If
 * @param condition
 * @param ontrue
 * @param onfalse
 * @returns {*}
 * @private
 */
function _if(condition, ontrue, onfalse) {
  return condition === 'true' || condition === true ? ontrue : onfalse;
}

/**
 * Eq
 * @param oper_l
 * @param oper_r
 * @returns {boolean}
 */
function eq(oper_l, oper_r) {
  return oper_l == oper_r;
}

/**
 * ne
 * @param oper_l
 * @param oper_r
 * @returns {boolean}
 */
function ne(oper_l, oper_r) {
  return oper_l != oper_r;
}

/**
 * gt
 * @param oper_l
 * @param oper_r
 * @returns {boolean}
 */
function gt(oper_l, oper_r) {
  return oper_l > oper_r;
}

/**
 * gte
 * @param oper_l
 * @param oper_r
 * @returns {boolean}
 */
function gte(oper_l, oper_r) {
  return oper_l >= oper_r;
}

/**
 * lt
 * @param oper_l
 * @param oper_r
 * @returns {boolean}
 */
function lt(oper_l, oper_r) {
  return oper_l < oper_r;
}

/**
 * lte
 * @param oper_l
 * @param oper_r
 * @returns {boolean}
 */
function lte(oper_l, oper_r) {
  return oper_l <= oper_r;
}

/**
 * GetDate: Returns date as specified by a format mask, language and period.
 * @param format (http://momentjs.com/docs/#/parsing/string-format/)
 * @param lang
 * @param period
 * @param increment
 * @param uppercase
 * @returns {string}
 */
function getDate(format, lang, period, increment = 1, uppercase) {
  if (lang && lang !== '') {
    lang = lang.toLowerCase();
    moment.locale(lang);
  } else {
    moment.locale('en');
  }
  const mom = moment();

  let strDate = '';

  if (period) {
    period = period.toLowerCase();
    strDate = mom.add(increment, period).format(format);
  } else {
    strDate = mom.format(format);
  }

  if (uppercase && uppercase !== 'false') {
    strDate = strDate.toUpperCase();
  }

  return strDate;
}

/**
 * dateFormat: Returns a date as specified by a format mask, language and period.
 * @param format (http://momentjs.com/docs/#/parsing/string-format/)
 * @param lang
 * @param period
 * @param increment
 * @param uppercase
 * @returns {string}
 */
function dateFormat(date, format = 'YYYYMMDD', output_format, lang, period, increment = 1, uppercase) {
  if (lang && lang !== '') {
    lang = lang.toLowerCase();
    moment.locale(lang);
  } else {
    moment.locale('en');
  }

  if (!date) date = moment();
  if (format && !output_format) output_format = format;

  let strDate = '';

  if (period) {
    period = period.toLowerCase();
    strDate = moment(date, format).add(increment, period).format(output_format);
  } else {
    strDate = moment(date, format).format(output_format);
  }

  if (uppercase && uppercase !== 'false') {
    strDate = strDate.toUpperCase();
  }

  return strDate;
}

/**
 * LastDay: Returns last day of a date as specified by a format mask, language and period.
 * @param format (http://momentjs.com/docs/#/parsing/string-format/)
 * @param lang
 * @param period
 * @param increment
 * @param uppercase
 * @returns {string}
 */
function lastDay(date, format = 'YYYYMMDD', output_format, lang, uppercase) {
  if (lang && lang !== '') {
    lang = lang.toLowerCase();
    moment.locale(lang);
  } else {
    moment.locale('en');
  }

  if (!date) date = moment();
  if (format && !output_format) output_format = format;

  let strDate = '';
  strDate = moment(date, format).endOf('month').format(output_format);

  if (uppercase && uppercase !== 'false') {
    strDate = strDate.toUpperCase();
  }

  return strDate;
}

/**
 * PathParser
 * @param _path
 * @param property
 * @returns {string}
 */
function pathParse(_path, property) {
  let res = '';
  if (_path) {
    const pathProperties = path.parse(_path);
    property = property.replace(/['"]+/g, '').toLowerCase().trim();

    if (pathProperties[property]) {
      res = pathProperties[property];
    } else {
      throw new Error(`PathParse (${_path}) wrong property ${property}.`);
    }
  }

  return res;
}

/**
 * URLParser
 * @param _url
 * @param property
 * @returns {string}
 */
function urlParse(_url, property) {
  let res = '';
  if (_url) {
    const urlProperties = url.parse(_url);
    property = property.replace(/['"]+/g, '').toLowerCase().trim();

    if (urlProperties[property]) {
      res = urlProperties[property];
    } else {
      throw new Error(`UrlParser (${_url}) wrong property ${property}.`);
    }
  }
  return res;
}

/**
 * Hash: Return hashed string
 * @param s {string}
 * @param hash (openssl list-message-digest-algorithms) {string}
 * @param digets (hex, base64 or latin1) {string}
 * @returns {string}
 */
function hash(s, hash, digets) {
  digets = digets || 'hex';
  return crypto.createHash(hash).update(s).digest(digets);
}

/**
 * Encrypt
 * @param s
 * @param algorithm (openssl list-cipher-algorithms)
 * @param password
 * @returns String crypted
 */
function encrypt(s, algorithm, password) {
  const IV_LENGTH = 16; // For AES, this is always 16
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(password), iv);
  let crypted = cipher.update(s, 'utf8', 'hex');
  crypted += cipher.final('hex');
  return crypted;
}

/**
 * Decrypt
 * @param s
 * @param algorithm (openssl list-cipher-algorithms)
 * @param password
 * @returns String decrypted
 */
function decrypt(s, algorithm, password) {
  const textParts = s.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(password), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

/**
 * Quote
 * @param s (string)
 * @param quote (quote string)
 * @returns Quoted string
 */
function quote(s, quote = "'") {
  return quote + s + quote;
}

/**
 * JSON Stringify
 * @param obj
 * @returns {string} JSON stringified object
 */
function stringify(obj) {
  if (!obj) {
    throw new Error(`stringifying non value variable -> ${obj}`);
  } else {
    try {
      return JSON.stringify(obj);
    } catch (ex) {
      throw new Error(`Stringify exception: ${ex}`);
    }
  }
}

module.exports = functions;
