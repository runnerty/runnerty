# Runnerty ChangeLog

<a name="2.0.3"></a>
# [2.0.3] (07/03/2018)

### Features
* **interpreter:** string function `quote` to quote given string. [docs](./docs/functions.md) #101
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