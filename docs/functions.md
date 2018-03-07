# Functions

Runnerty provides a bunch of different functions that can be used in the whole plan of our chains. They are very useful to operate, transform or generate values or mix it with dependencies, etc... 

## All functions

### Values
| Function                              | Syntax                          | Description                                                                                                                                    |
| :---                                  | :---                            | :---                                                                                                                                           |
| GV                                    | `@GV(VALUE_ID)`                 | Used to get values. Learn more about *values* [here](values.md).                                                                               |
| GETVALUE *(GV ALIAS)*                 | `@GETVALUE(VALUE_ID)`           | Used to get values. Learn more about *values* [here](values.md).                                                                               |
| GETVALUEESCAPE *(GVESCAPE ALIAS)*     | `@GETVALUEESCAPE(VALUE_ID)`     | Used to get values escaped (Replacing no SingleStringCharacters or DoubleStringCharacters ECMA). Learn more about *values* [here](values.md).  |
| GETVALUEUNESCAPE *(GVUNCESCAPE ALIAS)*| `@GETVALUEUNESCAPE(VALUE_ID)`   | Used to get values unescaped (Restoring no SingleStringCharacters or DoubleStringCharacters ECMA). Learn more about *values* [here](values.md).|

### Math
| Function                  | Syntax                                      | Description                                                                                           |
| :---                      | :---                                        | :---                                                                                                  |
| ABS                       | `@ABS(NUMBER)`                              | Returns the absolute value of a number                                                                |
| ACOS                      | `@ACOS(NUMBER)`                             | Returns the arccosine (in radians) of a number                                                        |
| ASIN                      | `@ASIN(NUMBER)`                             | Returns the arcsine (in radians) of a number                                                          |
| ATAN                      | `@ATAN(NUMBER)`                             | Returns the arctangent (in radians) of a number                                                       |
| CEIL                      | `@CEIL(NUMBER)`                             | Returns the smallest integer greater than or equal to a given number                                  |
| COS                       | `@COS(NUMBER)`                              | Returns the cosine of the specified angle, which must be specified in radians                           |
| FLOOR                     | `@FLOOR(NUMBER)`                            | Returns the largest integer less than or equal to a given number                                      |
| LOG                       | `@LOG(NUMBER)`                              | Returns the natural logarithm (base e) of a number                                                    |
| MAX                       | `@MAX(NUMBER, NUMBER [, ...])`              | Returns the largest of numbers                                                                        |
| MIN                       | `@MIN(NUMBER, NUMBER [, ...])`              | Returns the lowest of numbers                                                                         |
| POW                       | `@POW(NUMBER_BASE, NUMBER_EXPONENT)`        | Returns the base to the exponent power, that is, base^exponent                                        |
| RANDOM                    | `@RANDOM(DECIMALS, NUMBER_MIN, NUMBER_MAX)` | Returns random number                                                                                 |
| SIN                       | `@SIN(NUMBER)`                              | Returns the sine of a number                                                                          |
| TAN                       | `@TAN(NUMBER)`                              | Returns the tangent of a number                                                                       |
| EXP                       | `@EXP(NUMBER)`                              | Returns e^x, where x is the argument, and e is Euler's number                                         |
| SQRT                      | `@SQRT(NUMBER)`                             | Returns the square root of a number                                                                   |
| ROUND                     | `@ROUND(NUMBER)`                            | Returns the value of a number rounded to the nearest integer.                                         |
| ADD                       | `@ADD(NUMBER, NUMBER [, ...])`              | Returns the sum of the numbers                                                                        |
| SUBTRACT                  | `@SUBTRACT(NUMBER, NUMBER [, ...])`         | Returns the subtraction of the numbers                                                                |
| DIVIDE                    | `@DIVIDE(NUMBER, NUMBER)`                   | Returns the division of the numbers                                                                   |
| MULTIPLY                  | `@MULTIPLY(NUMBER, NUMBER)`                 | Returns the multiplication of the numbers                                                             |
| MODULUS                   | `@MODULUS(NUMBER, NUMBER)`                  | Returns the modulus of the numbers                                                                    |

### Strings
| Function                          | Syntax                                                               | Description                                                                                   |
| :---                              | :---                                                                 | :---                                                                                          |
| LPAD                              | `@LPAD(STRING)`                                                      | Returns a string that is left-padded with a specified string to a certain length               |
| RPAD                              | `@RPAD(STRING)`                                                      | Returns a string that is right-padded with a specified string to a certain length              |
| CONCAT                            | `@CONCAT(STRING, STRING [, ...])`                                    | Returns concatenates two or more expressions together                                         |
| CONCATWS                          | `@CONCATWS(STRING_SEPARATOR, STRING, STRING [, ...])`                | Returns concatenates two or more expressions together and adds a separator between them       |
| UPPER                             | `@UPPER(STRING)`                                                     | Returns the string to upper-case                                                              |
| LOWER                             | `@LOWER(STRING)`                                                     | Returns the string to lower-case                                                              |
| TRIM                              | `@TRIM(STRING)`                                                      | Returns trim string                                                                           |
| LTRIM                             | `@LTRIM(STRING)`                                                     | Returns left trim string                                                                      |
| RTRIM                             | `@RTRIM(STRING)`                                                     | Returns right trim string                                                                     |
| LENGTH                            | `@LENGTH(STRING)`                                                    | Returns the length of the specified string (in bytes)                                          |
| CHARCODE                          | `@CHARCODE(CHAR)`                                                    | Returns the number code that represents the specific character                                 |
| SUBSTR                            | `@SUBSTR(STRING_TO_EXTRACT, NUMBER_START, NUMBER_CHARACTERS)`        | Returns a substring from a string (starting at any position)                                  |
| REPLACE                           | `@REPLACE(STRING, STRING_TO_FIND, STRING_REPLACEMENT, STRING_FLAGS)` | Replaces all occurrences of a specified string                                                 |
| INCLUDES                          | `@INCLUDES(STRING, STRING_TO_FIND)`                                  | Returns boolean depending on whether it finds or not a string in another string                |
| INDEXOF                           | `@INDEXOF(STRING, STRING_TO_FIND)`                                   | Returns the position of the first occurrence of a string in another string else -1             |
| ESCAPE                            | `@ESCAPE(STRING)`                                                    | Returns escaped string (Replacing no SingleStringCharacters or DoubleStringCharacters ECMA)   |
| UNESCAPE                          | `@UNESCAPE(STRING)`                                                  | Returns unescaped string (Restoring no SingleStringCharacters or DoubleStringCharacters ECMA) |
| JSONSTRINGIFY *(STRINGIFY ALIAS)* | `@UNESCAPE(OBJECT)`                                                  | Returns the JSON stringified object                                                            |

Examples:
```
@LENGTH('RUNNERTY') -> 8
@LOWER(hELLo) -> hello
@CONCAT('TEXT SAMPLE:',' --> ',@RPAD(@LPAD(@TRIM(@UPPER('  test  ')),8,'X'),10,'Z')) -> TEXT SAMPLE: --> XXXXTESTZZ
```

### Crypto
| Function                  | Syntax                                                               | Description                                                                                            |
| :---                      | :---                                                                 | :---                                                                                                   |
| HASH                      | `@HASH(STRING_TO_HASH, STRING_HASH, STRING_DIGEST)`                  | Returns hashed string. HASH: `openssl list-message-digest-algorithms`. DIGEST: `hex, base64 or latin1` |
| ENCRYPT                   | `@ENCRYPT(STRING_TO_ENCRYPT, STRING_ALGORITHM, STRING_PASSWORD)`     | Returns encrypt string. HASH: `openssl list-cipher-algorithms`.                                        |
| DECRYPT                   | `@DECRYPT(STRING_TO_DECRYPT, STRING_ALGORITHM, STRING_PASSWORD)`     | Returns decrypt string. HASH: `openssl list-cipher-algorithms`.                                        |

Examples:
```
@HASH('RUNNERTY','md5','base64') -> wBM7mLwJnIpMlpRBHiLxBw==
@HASH('RUNNERTY','sha256','hex') -> 5e557b12c62c361fac4f480ba30d7afe1bc9b8a1dd1cd26807fb3f1c7ef0b18d
@ENCRYPT('RUNNERTY', 'AES256', 'PASSWORD') -> fd9f555099fbb6f25eff05d6c98693af
@DECRYPT('fd9f555099fbb6f25eff05d6c98693af', 'AES256', 'PASSWORD') -> RUNNERTY
```

### Evaluation
| Function                  | Syntax                                                               | Description                                                                             |
| :---                      | :---                                                                 | :---                                                                                    |
| IF                        | `@IF(BOOLEAN, OUTPUT_ON_TRUE, OUTPUT_ON_FALSE)`                      | Returns a string that is left-padded with a specified string to a certain length         |
| IFNULL                    | `@IFNULL(OPER, OUTPUT_IF_NULL, OUTPUT_IF_NOT_NULL)`                  | Returns an alternative value if an expression is null and optionally other if not       |
| EQ                        | `@EQ(OPER_ONE, OPER_TWO)`                                            | Returns boolean depending on whether it OPER_LEFT == OPER_RIGHT                         |
| NE                        | `@NE(OPER_ONE, OPER_TWO)`                                            | Returns boolean depending on whether it OPER_LEFT != OPER_RIGHT                         |
| GT                        | `@GT(OPER_LEFT, OPER_RIGHT)`                                         | Returns boolean depending on whether it OPER_LEFT > OPER_RIGHT                          |
| GTE                       | `@GTE(OPER_LEFT, OPER_RIGHT)`                                        | Returns boolean depending on whether it OPER_LEFT >= OPER_RIGHT                         |
| LT                        | `@LT(OPER_LEFT, OPER_RIGHT)`                                         | Returns boolean depending on whether it OPER_LEFT < OPER_RIGHT                          |
| LTE                       | `@LTE(OPER_LEFT, OPER_RIGHT)`                                        | Returns boolean depending on whether it OPER_LEFT <= OPER_RIGHT                         |


### Dates
| Function                  | Syntax                                                                                    | Description                                                        |
| :---                      | :---                                                                                      | :---                                                               |
| GETDATE                   | `@GETDATE(STRING_FORMAT, STRIN_LANGUAGE, STRING_PERIOD, NUMBER_INCREMENT, BOOLEAN_UPPER)` | Returns string as specified by a format mask, language and period   |

```
Format: http://momentjs.com/docs/#/parsing/string-format/
Language: Use country Abbreviations ('en','es','cn','fr',...) - http://momentjs.com/docs/#/i18n/
Period: It is posible use a key or shorthand key of a perior: years or y, quarters or Q, months or M, weeks or w, days or d, hours or h, minutes or m, seconds or s, milliseconds or ms
Increment: Number (+/-) to increment a period
Uppercase: Boolean to set if output must be returned upper
```

Examples:
```
@GETDATE('MMMM','es','months',2,true) - Add 2 months to current date and output month name upper: 'ENERO'
@GETDATE('YYYY-MM-DD HH:mm:ss') - Return current date formated like the mask 'YYYY-MM-DD HH:mm:ss': '2018-01-01 23:59:59'
```

### Paths/Urls
| Function                  | Syntax                                         | Description                                                                                   |
| :---                      | :---                                           | :---                                                                                          |
| PATHPARSE                 | `@PATHPARSE(STRING_PATH, STRING_PROPERTIE)`    | Returns a string with specified propertie of path. PROPERTIES: `root, dir, base, ext or name`  |
| PATHNORMALIZE             | `@PATHNORMALIZE(STRING_PATH)`                  | If multiple, sequential path segment separation characters are found (e.g. / on POSIX and either \ or / on Windows), they are replaced by a single instance of the platform specific path segment separator. Trailing separators are preserved |
| PATHJOIN                  | `@PATHJOIN(STRING_PATH, STRING_PATH [, ...]))` | Return joined all given path segments together using the platform specific separator as a delimiter, then normalizes the resulting path.|
| URLPARSE                  | `@URLPARSE(STRING_URL, STRING_PROPERTIE)`      | Returns a string with specified propertie of url. PROPERTIES: `protocol, slashes, auth, host, port, hostname, hash, search, query, pathname, path, href` | 

Examples:
```
@PATHPARSE('/etc/runnerty/plan.json', 'NAME') -> plan
@PATHPARSE('/etc/runnerty/plan.json', 'base') -> plan.json
@PATHNORMALIZE('/foo/bar//baz/asdf/quux/..')  -> /foo/bar/baz/asdf
@PATHJOIN('/etc','runnerty/',plan.json)       -> /etc/runnerty/plan.json 
@URLPARSE('http://user:pass@sub.host.com:8080/p/a/t/h?query=string#hash','hostname') -> sub.host.com
@URLPARSE('http://user:pass@sub.host.com:8080/p/a/t/h?query=string#hash','port')     -> 8080
```

