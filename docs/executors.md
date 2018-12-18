# Executors

The executors are plugins for Runnerty which encapsulate functionalities. The processes of a chain use executors to realize different actions. 

There are a bunch of executors for different purposes. Execute sentences in different databases like mysql, postgres, etc. Sending mails, operations with S3 files. You can have a look at the official list of executors [here](plugins.md).

### Configuration

In the config.json file of the project we are going to write the configuration of the different executors that are going to be used in the processes.

```json
{
  "executors": [
    {
      "id": "shell_default",
      "type": "@runnerty-executor-shell"
    },
    {
      "id": "mysql_default",
      "type": "@runnerty/executor-mysql",
      "user": "mysqlusr",
      "password": "mysqlpass",
      "database": "MYDB",
      "host": "myhost.com",
      "port": "3306"
    }
  ]
}
```

This is an example of the configuration of two executors: `@runnerty-executor-shell` and `@runnerty-executor-mysql`. Each executor has it's owns properties, some of them are mandatory, you can have a look at each executor documentation to know how to use them.

### Usage

The destination of an executor is to use it in our plan's processes. We could say that using an executor has two parts: `configuration` and `params`.

 The configuration properties are set in the [config.json](config.md). They are the identifiers fields of the executor. For example, this is the configuration properties for the @runnerty-executor-shell:

```json
{
  "executors": [
    {
      "id": "shell_default",
      "type": "@runnerty-executor-shell"
    }
  ]
}
```

The `id` is the name given for the executor configuration. Note that we could have all the differents configuratios that we want for the same executor. The `type` is the name of the executor. 

In the processes are set the variable properties (params) for the executor. This is an example of the usage of the @runnerty-executor-shell in a process

```json
{
  "id":"PROCESS_ONE",
  "name":"First process of the chain",
  "exec":
    {
      "id":"shell_default",
      "command":"echo",
      "args":["hello world"]
    }
}
```

Runnerty matchs the `id` property from the plan with the config.json one to identify the executor to run. Properties like `command` and `args` are the variable properties that may change in every process.

It is important to know that it is possible to overwrite some configuration properties from the `exec` properties of the processes. For example: if we are using the @runnerty/executor-mysql we may want to change the database that the executor is going to connect.

This is the configuration of the executor. We are connecting to `"MYDB"`
```json
{
  "executors": [
    {
      "id": "mysql_default",
      "type": "@runnerty/executor-mysql",
      "user": "mysqlusr",
      "password": "mysqlpass",
      "database": "MYDB",
      "host": "myhost.com",
      "port": "3306"
    }
  ]
}
```

We can overwrite this information from the `exec` properties of the process:

```json
{
  "id":"PROCESS_ONE",
  "name":"First process of the chain",
  "exec":
    {
      "id":"mysql_default",
      "command":"select 'HELLO'",
      "database": "MYDB2"
    }
}
```
