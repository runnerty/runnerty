# Triggers

The execution of chains happens by a trigger (npm module) that could be developed and coupled to Runnerty.

### Configuration

In the config.json file of the project we are going to write the configuration of the different triggers that are going to be used in the chain.

```json
{
  "triggers": [
    {
      "id": "schedule_default",
      "start_date": "2017-04-01T00:00:00.00Z",
      "end_date": "2099-11-01T00:00:00.00Z",
      "schedule_interval": "*/1 * * * *"
    },
    {
      "id": "filewatcher_default",
      "file_name": "/etc/runnerty/myfile.txt",
      "condition": "add"
    }
  ]
}
```

This is an example of the configuration of two triggers: `@runnerty/trigger-schedule` and `@runnerty/triggers-file-watcher`. Each trigger has it's owns properties, some of them are mandatory, you can have a look at each triggers documentation to know how to use them.

### Usage

The destination of an trigger is to use it in our chains. We could say that using a trigger has two parts: `configuration` and `params`.

The configuration properties are set in the [config.json](config.md). They are the identifiers fields of the trigger. For example, this is the configuration properties for the @runnerty/trigger-schedule:

```json
{
  "triggers": [
    {
      "id": "schedule_default",
      "type": "@runnerty-trigger-schedule"
    }
  ]
}
```

The `id` is the name given for the trigger configuration. Note that we could have all the differents configuratios that we want for the same executor. The `type` is the name of the trigger module.

In the processes are set the variable properties (params) for the executor. This is an example of the usage of the @runnerty/trigger-schedule in a process

```json
{
  "id": "CHAIN_ONE",
  "name": "Chain one sample",
  "triggers": [
    {
      "id": "schedule_default",
      "start_date": "2017-06-18T00:00:00.00Z",
      "end_date": "2099-06-18T00:00:00.00Z",
      "schedule_interval": "*/1 * * * *"
    }
  ],
  "...": "..."
}
```

Runnerty matchs the `id` property from the plan with the [config.json](config.md) one to identify the executor to run. Properties like `schedule_interval`, `start_date` and `end_date` are the variable properties that may change in every chain.

It is important to know that it is possible to overwrite some configuration properties from the `triggers` properties of the chain. For example: if we are using the @runnerty/trigger-schedule we may want to change the database that the trigger is going to connect.

This is the configuration of the trigger. We are planing the execution of chain when file `myfile.txt` is added to the folder `/etc/runnerty/`
[config.json](config.md):

```json
{
  "triggers": [
    {
      "id": "filewatcher_default",
      "file_name": "/etc/runnerty/myfile.txt",
      "condition": "add"
    }
  ]
}
```

We can overwrite this information from the `triggers` properties of the chain:
[plan.json (object chains)](chains.md)

```json
{
  "id": "CHAIN_ONE",
  "name": "Chain one sample",
  "triggers": [
    {
      "id": "filewatcher_default",
      "file_name": "/etc/runnerty/otherfile.txt"
    }
  ]
}
```

Overwrite file_name by `/etc/runnerty/otherfile.txt`.

### Calendars

There is also the possibility to trigger a chain using a calendars. The calendars path can be indicated in the [config.json](config.md) file:

```json
{
  "general": {
    "calendarsPath": "/calendars/"
  }
}
```

Calendars dir:

```
runnerty
  |-- calendars
    |-- weekends.ics
    |-- laboral_days.ics
```

Calendars can be used for both, enabling or disabling execution dates through the **enable** and **disable** properties, so it can be specified, for example, to only execute a chain on laboral days, excluding weekends, like in the sample below:

```json
{
  "id": "EXAMPLE_CHAIN",
  "name": "Name of the sample chain",
  "calendars": {
    "enable": "laboral_days",
    "disable": "weekends"
  }
}
```

### Servers

Servers allow us to forget about the endpoints implementation in the triggers development. Runnerty will pull up the web servers indicted in the config file and will also manage the routing. It will make available the trigger's property "on_request". This will receive the requests to it's endpoint. Additionally, It allows us to customize the response either sending the status code and the response object.

#### Configuration

```json
{
  "general": {
    "servers": [
      {
        "id": "my_srv_sample",
        "port": 8080,
        "endpoint": "/my_endpoint"
      }
    ]
  },
  "triggers": [
    {
      "id": "server_default",
      "type": "@runnerty-trigger-server"
    }
  ]
}
```
#### You can use two different authentication strategies, basic auth or API Key.
Basic Auth (standard):
```json
{
  "general": {
    "servers": [
      {
        "id": "my_srv_sample",
        "port": 8080,
        "endpoint": "/my_endpoint",
        "users":[
            {"user":"user_one", "password":"pass_one"},
            {"user":"user_two", "password":"pass_two"}
          ]
      }
    ]
  }
}
```
API Key. You can send your API-Key in the endpoint call using the `api_key` query parameter or the `x-api-key` header.
```json
{
  "general": {
    "servers": [
      {
        "id": "my_srv_sample",
        "port": 8080,
        "endpoint": "/my_endpoint",
        "apikey": "_API_KEY_SAMPLE_"
      }
    ]
  }
}
```
          

#### Plan

```json
{
  "id": "...",
  "name": "...",
  "triggers": [
    {
      "id": "server_default",
      "server": {
        "id": "my_srv_sample",
        "path": "/test",
        "method": "post"
      }
    }
  ]
}
```

#### Usage

Both the values that arrive by "query" and those that arrive in "body" will be available in the chain (via customValues).
So if for example we make a "post" like this:

```
curl -X POST -H "Content-Type: application/json" -d '{"MY_VALUE_ONE":"ONE","MY_VALUE_TWO":"2"}' http://localhost:8080/my_endpoint/test
```
We can make use of the values through the "get values" function:

```
 @GV(MY_VALUE_ONE) / @GV(MY_VALUE_TWO) / @GV(my_query_value)
```

Examples of `api-key` authentication:

```
curl -X POST -H "Content-Type: application/json" -H "x-api-key: _API_KEY_SAMPLE_" http://localhost:8080/my_endpoint/test
```

```
curl -X POST -H 'Content-Type: application/json' 'localhost:8080/my_endpoint/test?api_key=_API_KEY_SAMPLE_'
```


