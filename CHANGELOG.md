# Runnerty ChangeLog

<a name="3.2.0"></a>

# [3.2.0](21/03/2021)

### Features

- **common:** the possibility of executing a chain from the indicated process is enabled
- **common:** new default configuration for all chains and processes (config.json/defaults)
- **common:** Graceful shutdown, wait for the end of the chains that are running
### Bug Fixes

- **common:** in some cases a process with complex dependencies that should not be executed could cause the chain to never finish
### Tests

<a name="3.1.0"></a>

# [3.1.0](27/02/2021)

### Features

- **common:** new chain value exposed CHAIN_QUEUE
- **telemetry:** new chain properties to disable "remoteControl" and sync of "events" and "chain"
- **telemetry:** new meta chain properties to set extra_id
- **dependencies:** minor dependency updates
- **common:** code cleaning and refactoring

### Bug Fixes

- **common:** chain never ends when a process dependent on another that triggers the execution of an iterable chain (with errors) is ignored
- **common:** in complex circumstances a chain with failed processes might not finish
- **common:** minor problems with the use of queues
- **telemetry:** send ended_at on process error

### Tests

- **common:** chains dependences test
- **common:** process dependent on iterable failed ignored with end of chain

<a name="3.0.2"></a>

# [3.0.2](8/02/2021)

### Bug Fixes

- **telemetry:** error blocking plan synchronization in runnerty.io when starting connection

<a name="3.0.1"></a>

# [3.0.1](5/02/2021)

### Features

- **telemetry:** sending of chain namespace and meta
- **telemetry:** If runnerty.io connection is enabled, by default it will wait for a connection before running to avoid loss of events, a timeout can also be established. Configurable from config.json/runnerty.io/ waitForConnection and connectionTimeout
- **dependencies:** minor dependency updates

<a name="3.0.0"></a>

# [3.0.0](31/01/2021)

### Features

- **common:** improvements in the behavior of dependencies between chains
- **common:** the definition of Runnerty modules is externalized to a package [module-core](https://www.npmjs.com/package/@runnerty/module-core)
- **common:** output_fiter: new process property that allows filtering of output_data and extra_output (JSON)
- **common:** output_order: new process property that allows sort of output_data and extra_output (JSON)
- **common:** improvements in reading and parsing calendars (ics)
- **common:** loading calendars by url (ics)
- **common:** code cleaning and refactoring
- **common:** new metadata fields for chains
- **cli:** when we force the execution of a chain only this one will be executed and its dependents, the triggers of the chains will be ignored.
- **cli:** error message is displayed when we indicate a non-existent chainId when forcing an execution
- **cli:** new namespace functionality that allows/disallows to indicate the namespace of the chains to be loaded or ignored
- **interpreter:** Added new UUID functions
- **interpreter:** Added new HTML ESCAPE/UNESCAPE functions
- **telemetry:** sending of plan in case of reconnection
- **dependencies:** minor dependency updates

### Breaking Changes

#### Chain dependencies

- When **depends_chains/chain_id** is defined in a determined chain, the dependent chain will be executed as soon as the depended one finishes.
- When **depends_chains/chain_id+process_id** is defined in a determined chain, that dependent chain will be executed as soon as the defined process finishes. The depended chain will wait until the dependent chain finishes. This behaviour is similar to how **iterable chains** works on Runnerty v2.
- On the other hand, **Iterable chains** definition is not altered at all. Iterable chains in Runnerty v2 are fully compatible with Runnerty v3.

#### Forced chain execution (CLI)

- When we **force the execution** of a chain that chain is inmediately executed. Triggers will be ignored; if that chain have any dependent chain, they will not be executed.
- New parameter **-fd** (force dependents) when we **force execution**. When we force the execution of a chain with arg **-fd** it will also force the execution of its dependent chains.
- Error message is displayed when we indicate a non-existent chainId while forcing an execution.

## Modules

- Runnerty v3.x is not compatible with versions of modules lower than v3.x

<a name="2.9.0"></a>

# [2.9.0](24/12/2020)

### Features

- **common:** the option of iterating over an array of strings is enabled, indicating in "input" the name of the variable instead of the mapping object

<a name="2.8.3"></a>

# [2.8.3](22/12/2020)

### Features

- **dependencies:** minor dependency updates

<a name="2.8.2"></a>

# [2.8.2](12/11/2020)

### Bug Fixes

- **common:** windows incompatibility fix related to node_modules access

<a name="2.8.1"></a>

# [2.8.1](10/11/2020)

### Features

- **dependencies:** minor dependency updates

### Bug Fixes

- **telemetry:** sending of plan in case of reconnection

### Tests

- **common:** schemas update

<a name="2.8.0"></a>

# [2.8.0](21/10/2020)

### Features

- **telemetry:** sending the plan to runnerty.io is enabled
- **dependencies:** minor dependency updates
- **servers:** request limiter available
- **common:** code cleaning and refactoring

### Bug Fixes

- **common:** an error in the writing of the output log can cause the closing of the application

<a name="2.7.1"></a>

# [2.7.1](04/09/2020)

### Features

- **common:** code cleaning and refactoring
- **dependencies:** minor dependency updates

### Bug Fixes

- **common:** inclusion of childs_chains_status in process cleaning function

<a name="2.7.0"></a>

# [2.7.0](28/07/2020)

### Features

- **telemetry:** bidirectional communication with runnerty.io via websockets
- **telemetry:** ready to be able to run and kill chains remotely from runnerty.io
- **servers:** basic auth and apikey authentication available
- **common:** replacement of global by runtime class
- **common:** maximum size limitation of objects for the interpreter
- **common:** code cleaning and refactoring
- **dependencies:** minor dependency updates

### Bug Fixes

- **common:** incorrect notification of failed chain before the end of all processes when running in parallel

<a name="2.6.6"></a>

# [2.6.6](03/06/2020)

### Bug Fixes

- **api:** minor fixes

<a name="2.6.5"></a>

# [2.6.5](01/06/2020)

### Features

- **common:** code cleaning and refactoring
- **dependencies:** minor dependency updates

### Bug Fixes

- **common:** fix write output issue

<a name="2.6.4"></a>

# [2.6.4](25/05/2020)

### Features

- **common:** code cleaning and refactoring
- **dependencies:** minor dependency updates

### Bug Fixes

- **common:** error when trying to load a plan with links chain_path
- **common:** minor fixes

### Tests

- **common:** new plan links chain_path

<a name="2.6.3"></a>

# [2.6.3](17/05/2020)

### Features

- **common:** minor fixes

<a name="2.6.2"></a>

# [2.6.2](16/05/2020)

### Features

- **common:** code cleaning and refactoring
- **common:** minor fixes
- **dependencies:** minor dependency updates

<a name="2.6.1"></a>

# [2.6.1](11/05/2020)

### Bug Fixes

- **common:** fix typo bug

<a name="2.6.0"></a>

# [2.6.0](08/05/2020)

### Features

- **common:** code cleaning and refactoring
- **common:** modified default behavior, when a process fails the chain fails
- **common:** new default properties for processes [docs](./docs/chains.md)
- **common:** improvements in handling chains retries [docs](./docs/chains.md)
- **dependencies:** minor dependency updates
- **dependencies:** replaced request by axios module
- **interpreter:** new date interpreter functions (`DATEFORMAT` and `LASTDAY`) [docs](./docs/functions.md)

### Bug Fixes

- **common:** end of chain ignoring `retry` in progress
- **common:** minor fixes

### Tests

- **common:** new retry test
- **common:** new customsvalues and inputvalues test

<a name="2.5.1"></a>

# [2.5.1](3/12/2019)

### Features

- **dependencies:** minor dependency updates

### Bug Fixes

- **common:** avoid abortion in uncaughtException

<a name="2.5.0"></a>

# [2.5.0](16/10/2019)

### Features

- **common:** error reporting improvement
- **common:** add --end parameter
- **telemetry:** runnerty.io communication debug
- **telemetry:** add execution version on access communication
- **telemetry:** historicize iter-serie process executionId
- **dependencies:** minor dependency updates
- **dependencies:** ajv 6 JSON Schema draft-07 compatibility

### Tests

- **common:** update tests to match changes and generate new

### Bug Fixes

- **common:** wrong notification order
- **common:** incorrect log messages visualization
- **common:** complex prod depen. could cause double exec
- **telemetry:** async pre-death communication resolved

<a name="2.4.0"></a>

# [2.4.0](23/09/2019)

### Features

- **telemetry:** beta telemetry service runnerty.io!
- **common:** standard Node.js module resolution paths
- **common:** it is possible to indicate the plan object in config.json
- **common:** capture of errors uncaught in executors
- **dependencies:** minor dependency updates

### Tests

- **common:** new general tests

### Bug Fixes

- **common:** correction of errors related to the end of iterable strings in case of process error
- **interpreter:** path&urlParse avoid excep. without value

<a name="2.3.0"></a>

# [2.3.0](04/07/2019)

### Features

- **servers:** the use of servers is allowed directly without creating a custom trigger
- **servers:** more information about servers is included [docs](./docs/triggers.md)
- **dependencies** minor dependency updates

<a name="2.2.0"></a>

# [2.2.0-rc1](29/05/2019)

### Features

- **cors:** API cors config is enabled [docs](./docs/api.md)
- **telemetry** alpha telemetry service runnerty.io
- **dependencies** update

### Bug Fixes

- **queues:** there may be overlapping chains where no queue indicates

### Tests

- **common:** fix general tests
- **common:** fix general tests

<a name="2.1.3"></a>

# [2.1.3](04/01/2019)

### Tests

- **common:** more general tests added to the project

### Bug Fixes

- **triggers:** trim function remove line terminator characters

<a name="2.1.2"></a>

# [2.1.2](18/12/2018)

### Bug Fixes

- **common:** errors in the execution of an iterable processes can cause looped

<a name="2.1.1"></a>

# [2.1.1](18/07/2018)

### Bug Fixes

- **common:** CPU 100% usage trying interpret functions of the config

<a name="2.1.0"></a>

# [2.1.0](17/07/2018)

### Features

- **triggers:** servers support. [docs](./docs/triggers.md)
- **interpreter:** string function `GVQ/GETVALUEQUOTED` and `GV` allows quote param. [docs](./docs/functions.md)
- **common:** input/custom_values with more than one object level are converted to key/value. [docs](./docs/usage.md)
- **common:** add config crypto to set password crypto algorithm
- **common:** support Node.js 10.x

### Bug Fixes

- **common:** typo
- **common:** replaceWithSmart (recursiveObjectInterpreter) ignore global_values when objParams is empty
- **common:** ws api custom_value wrong variable setting
- **common:** the functions of the config file are not interpreted
- **common:** output_share: overwriting config.global_values instead of config_raw
- **common:** ws customs_values overwrite default customs_values
- **common:** dynamic recalculate global_values to allow the use dates (@GETDATE)
- **cli:** input_values param ignored in command line force execution mode
- **interpreter:** stringifying errors as empty strings
- **interpreter:** error uncatched
- **interpreter:** logger removed from interpreter-functions throw errors
- **triggers:** compatibility in triggers with input_values that are not array
- **triggers:** triggers send chain information to the interpreter
- **triggers:** triggers send chain information to the interpreter
- **tests:** paths of the config test modules modified for global node_modules support

<a name="2.0.3"></a>

# [2.0.3](07/03/2018)

### Features

- **interpreter:** string function `quote` to quote given string. [docs](./docs/functions.md)
- **interpreter:** string function `stringify` to JSON stringify given object. [docs](./docs/functions.md)

### Bug Fixes

- **interpreter:** resolution of GetValue functions as values [docs](./docs/functions.md)

<a name="2.0.2"></a>

# [2.0.2](01/03/2018)

### Bug Fixes

- **interpreter:** remove float casting [docs](./docs/functions.md)

<a name="2.0.1"></a>

# [2.0.1](27/02/2018)

### Bug Fixes

- **triggers:** inaccessible trigger output [docs](./docs/triggers.md)

<a name="2.0.0"></a>

# [2.0.0](09/02/2018)

### Features

- **triggers:** triggers plugins to fire a chain execution. [docs](./docs/triggers.md)
- **interpreter:** functions that can used in the plan. [docs](./docs/functions.md)
- **queues:** add queues to avoid parallel executions and to establish priorities. [docs](./docs/queues.md)
- **cli:** add force execution and remote plan/config. [docs](./docs/usage.md)

### Tests

- **common:** add general tests to the project

### Bug Fixes

- **common:** several bug fixes
