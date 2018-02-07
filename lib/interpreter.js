"use strict";

const functions = require("./interpreter-functions.js");

const functFlag = "@";

function interpret(input, values, options) {
  return new Promise(async (resolve, reject) => {
    try {
      const tokens = lex(input);
      const parseTree = parse(tokens);
      let output = evaluate(parseTree, values);
      // Before send output: Check if a new function has appeared to be resolved:
      const funcNames = Object.keys(functions);
      let funcNamesLength = funcNames.length;
      while(funcNamesLength--){
        if(output.toLowerCase().includes(`${functFlag}${funcNames[funcNamesLength]}(`)){
          funcNamesLength = 0;
          output = await interpret(output, values, options);
        }
      }
      resolve(output);
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = interpret;

/**
 * Lexer
 * @param input (String)
 * @returns {Object} (Tokens)
 */
function lex(input) {
  const isOperator = function (c) {
    return /[(),]/.test(c);
  };
  const isDigit = function (c) {
    return /[0-9]/.test(c);
  };
  const isString = function (c) {
    return /('(?:[^'\\]|(?:\\\\)|(?:\\\\)*\\.{1})*')/gm.test(c);
  };
  const isWhiteSpace = function (c) {
    return /\s/.test(c);
  };
  const isIdentifier = function (c) {
    return typeof c === "string" && !isOperator(c) && !isWhiteSpace(c) && !isString(c);
  };
  const isFunction = function (c) {
    return typeof c === "string" && c.startsWith(functFlag) && functions[c.toLowerCase().substring(1)];
  };

  let tokens = [];
  let c;
  let i = 0;
  const advance = function () {
    return c = input[++i];
  };
  const addToken = function (type, value) {
    tokens.push({
      type: type,
      value: value
    });
  };
  while (i < input.length) {
    c = input[i];

    if (isWhiteSpace(c)) {
      addToken("string", c);
      advance();
    }
    else if (isOperator(c)) {
      addToken(c);
      advance();
    }
    else if (isDigit(c)) {
      let num = c;
      while (isDigit(advance())) num += c;
      if (c === ".") {
        do num += c; while (isDigit(advance()));
      }
      num = parseFloat(num);
      if (!isFinite(num)) throw "Number is too large or too small for a 64-bit double.";
      addToken("number", num);
    }
    else if (c.startsWith("'")) {
      let str = "";
      do {
        str += c;
        advance();
      }
      while (str.startsWith("'") && !isString(str) && (typeof c !== "undefined"));

      addToken("string", str);
    }
    else if (isIdentifier(c)) {
      let idn = c;
      while (isIdentifier(advance()) && c !== functFlag) idn += c;
      if (isFunction(idn)) {
        addToken("identifier", idn);
      } else {
        addToken("string", idn);
      }
    }
    else throw "Unrecognized token.";
  }
  addToken("(end)");
  return tokens;
}

/**
 * Parser
 * @param tokens (lexer)
 * @returns {Array}
 */
function parse(tokens) {
  let i = 0;
  let symbols = {};
  const symbol = function (id, nud, lbp, led) {
    let sym = symbols[id] || {};
    symbols[id] = {
      lbp: sym.lbp || lbp,
      nud: sym.nud || nud,
      led: sym.led || led
    };
  };

  const interpretToken = function (token) {
    let sym = Object.create(symbols[token.type]);
    sym.type = token.type;
    sym.value = token.value;
    return sym;
  };

  const token = function () {
    return interpretToken(tokens[i]);
  };

  const advance = function () {
    i++;
    return token();
  };

  const isOperator = function (c) {
    return /[(),]/.test(c);
  };

  const expression = function (rbp) {

    let left;
    let t = token();
    const initType = t.type;
    advance();
    if (!isOperator(initType)) {
      if (!t.nud) throw "Unexpected token: " + t.type;
      left = t.nud(t);
      while (rbp < token().lbp) {
        t = token();
        advance();
        if (!t.led) throw "Unexpected token: " + t.type;
        left = t.led(left);
      }

      return left;
    } else {
      return {type: "string", value: initType};
    }
  };

  symbol(",");
  symbol(")");
  symbol("(end)");

  symbol("number", function (number) {
    return number;
  });
  symbol("string", function (string) {
    return string;
  });
  symbol("identifier", function (name) {
    if (token().type === "(") {
      let args = [];
      if (tokens[i + 1].type === ")") advance();
      else {
        do {
          //Ignore whitespaces (start param):
          do {
            advance();
          } while(token().value === " ");

          args.push(expression(2));

          //Ignore whitespace (end param):
          while(token().value === " "){
            advance();
          }


        } while (token().type === ",");
        if (token().type !== ")") throw "Expected closing parenthesis ')': "+token().value;
      }
      advance();
      return {
        type: "call",
        args: args,
        name: name.value.toLowerCase()
      };
    }
    return name;
  });

  symbol("(", function () {
    let value = expression(2);
    if (token().type !== ")") throw "Expected closing parenthesis ')'";
    advance();
    return value;
  });

  let parseTree = [];
  while (token().type !== "(end)") {
    parseTree.push(expression(0));
  }
  return parseTree;
}


/**
 * Evaluator
 * @param parseTree
 * @param values
 * @returns {string}
 */
function evaluate(parseTree, values) {

  const variables = {
    pi: Math.PI,
    e: Math.E
  };

  let args = {};

  let parseNode = (node) => {

    if (node.type === "number") return node.value;
    if (node.type === "string") return node.value;
    else if (node.type === "identifier") {
      const value = args.hasOwnProperty(node.value) ? args[node.value] : variables[node.value];
      if (typeof value === "undefined") throw node.value + " is undefined";
      return value;
    }
    else if (node.type === "assign") {
      variables[node.name] = parseNode(node.value);
    }
    else if (node.type === "call") {
      for (let i = 0; i < node.args.length; i++) {
        node.args[i] = parseNode(node.args[i]);
        if(typeof node.args[i] === "string"){
          node.args[i] = node.args[i].replace(/^'(.*)'$/, "$1");
        }
      }

      // GETVALUE / GETVALUEESCAPE / GETVALUEUNESCAPE:
      let _name = node.name.toLowerCase().substring(1);
      if(["gv","getvalue","gvescape","getvalueescape","gvunescape","getvalueunescape"].indexOf(_name) !== -1){
        node.args[1] = values;
      }

      return functions[node.name.toLowerCase().substring(1)].apply(null, node.args);
    }
    else if (node.type === "function") {

      functions[node.name.toLowerCase().substring(1)] = function () {
        for (let i = 0; i < node.args.length; i++) {
          args[node.args[i].value] = arguments[i];
        }
        let ret = parseNode(node.value);
        args = {};
        return ret;
      };
    }
  };

  let output = "";
  for (let i = 0; i < parseTree.length; i++) {
    let value = parseNode(parseTree[i]);
    if (typeof value !== "undefined") output += value;
  }
  return output;
}