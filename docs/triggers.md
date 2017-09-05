# Triggers

The execution of chains happens by a trigger (module npm) that could be developed and coupled to Runnerty. 

### Configuration

In the config.json file of the project we are going to write the configuration of the different triggers that are going to be used in the chain.

```json
{
  "triggers":[
    {
      "id":"schedule_default",
      "start_date":"2017-04-01T00:00:00.00Z",
      "end_date":"2099-11-01T00:00:00.00Z",
      "schedule_interval":"*/1 * * * *"
    },
    {
      "id":"filewatcher_default",
      "file_name": "/etc/runnerty/myfile.txt",
      "condition": "add"
    }
  ]
}
```
This is an example of the configuration of two triggers: `@runnerty/trigger-schedule` and `@runnerty/triggers-file-watcher`. Each trigger has it's owns properties, some of them are mandatory, you can have a look at each triggers documentation to know how to use them.

### Usage

The destination of an trigger is to use it in our chains's. We could say that using an executor has two parts: `configuration` and `params`.

 The configuration properties are set in the [config.json](config.md). They are the identifiers fields of the trigger. For example, this is the configuration properties for the @runnerty/trigger-schedule:

```json
{
  "triggers": [
   {
     "id":"schedule_default",
     "type":"@runnerty-trigger-schedule"
   }
 ]
}
```

The `id` is the name given for the trigger configuration. Note that we could have all the differents configuratios that we want for the same executor. The `type` is the name of the trigger module. 

In the processes are set the variable properties (params) for the executor. This is an example of the usage of the @runnerty/trigger-schedule in a process

```json
{
  "id":"CHAIN_ONE",
  "name":"Chain one sample",
  "triggers":[
    {
     "id":"schedule_default",
     "start_date":"2017-06-18T00:00:00.00Z",
     "end_date":"2099-06-18T00:00:00.00Z",
     "schedule_interval":"*/1 * * * *"
    }
  ],
  "...":"..."
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
      "id":"filewatcher_default",
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
  "id":"CHAIN_ONE",
  "name":"Chain one sample",
  "triggers":[
    {
     "id":"filewatcher_default",
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
  "calendars": 
    {
      "enable": "laboral_days",
      "disable": "weekends"
    }
}
```