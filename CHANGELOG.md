# Runnerty ChangeLog

<a name="2.1.3"></a>
# [2.1.3] (04/01/2019)

### Tests
* **common:** more general tests added to the project

### Bug Fixes
* **triggers:** trim function remove line terminator characters

<a name="2.1.2"></a>
# [2.1.2] (18/12/2018)

### Bug Fixes
* **common:** errors in the execution of an iterable processes can cause looped

<a name="2.1.1"></a>
# [2.1.1] (18/07/2018)

### Bug Fixes
* **common:** CPU 100% usage trying interpret functions of the config

<a name="2.1.0"></a>
# [2.1.0] (17/07/2018)

### Features
* **triggers:** servers support. [docs](./docs/triggers.md)
* **interpreter:** string function `GVQ/GETVALUEQUOTED` and `GV` allows quote param. [docs](./docs/functions.md)
* **common:** input/custom_values with more than one object level are converted to key/value. [docs](./docs/usage.md)
* **common:** add config crypto to set password crypto algorithm
* **common:** support Node.js 10.x 

### Bug Fixes
* **common:** typo
* **common:** replaceWithSmart ignore global_values when objParams is empty
* **common:** ws api custom_value wrong variable setting
* **common:** the functions of the config file are not interpreted
* **common:** output_share: overwriting config.global_values instead of config_raw
* **common:** ws customs_values overwrite default customs_values
* **common:** dynamic recalculate global_values to allow the use dates (@GETDATE)
* **cli:** input_values param ignored in command line force execution mode
* **interpreter:** stringifying errors as empty strings
* **interpreter:** error uncatched
* **interpreter:** logger removed from interpreter-functions throw errors
* **triggers:** compatibility in triggers with input_values that are not array
* **triggers:** triggers send chain information to the interpreter
* **triggers:** triggers send chain information to the interpreter
* **tests:** paths of the config test modules modified for global node_modules support

<a name="2.0.3"></a>
# [2.0.3] (07/03/2018)

### Features
* **interpreter:** string function `quote` to quote given string. [docs](./docs/functions.md)
* **interpreter:** string function `stringify` to JSON stringify given object. [docs](./docs/functions.md)

### Bug Fixes
* **interpreter:** resolution of GetValue functions as values [docs](./docs/functions.md)

<a name="2.0.2"></a>
# [2.0.2] (01/03/2018)

### Bug Fixes
* **interpreter:** remove float casting [docs](./docs/functions.md)

<a name="2.0.1"></a>
# [2.0.1] (27/02/2018)

### Bug Fixes
* **triggers:** inaccessible trigger output [docs](./docs/triggers.md)


<a name="2.0.0"></a>
# [2.0.0] (09/02/2018)

### Features

* **triggers:** triggers plugins to fire a chain execution. [docs](./docs/triggers.md)
* **interpreter:** functions that can used in the plan. [docs](./docs/functions.md)
* **queues:** add queues to avoid parallel executions and to establish priorities. [docs](./docs/queues.md)
* **cli:** add force execution and remote plan/config. [docs](./docs/usage.md)

### Tests

* **common:** add general tests to the project

### Bug Fixes

* **common:** several bug fixes
