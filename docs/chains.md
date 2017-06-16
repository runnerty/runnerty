# Chain

A chain is a set of processes with it’s own properties like scheduling, events, dependencies, outputs, etc.

This is an example of a basic chain with one process:

```json
{
  "chains":[
    {
      "id":"EXAMPLE_CHAIN",
      "name":"Name of the sample chain",
      "schedule_interval":"* * * * *",
      "depends_chains":[],
      "processes":[
        {
          "id":"PROCESS_ONE",
          "name":"Firt process of the chains",
          "exec":{
            "id":"shell default",
            "command":"echo 'Hello world'",
          },
          "end_chain_on_fail":true,
        }
      ]
    }
  ]
}
```


### Identification

A chain has two identification fields:

Id, identifies the chain. with this identifier Runnerty will provide a global value (:CHAIN_ID) that can be used in the whole chain. To know more about global variables have a look at: [link]
```json
{
  ...
  "id":"EXAMPLE_CHAIN",
  ...
}
```

name, it's a description of the chain. Runnerty will also provide the global value :CHAIN_NAME

```json
{
  "id":"EXAMPLE_CHAIN",
  "name":"Name of the sample chain",
  ...
}
```


### scheduling

There are diferent ways to schedule a chain. It is possible to schedule a chains with a cron expression.

This scheduling will execute the chain at every minute:

```json
{
  "id":"EXAMPLE_CHAIN",
  "name":"Name of the sample chain",
  "schedule_interval":"*/1 * * * *",
  ...
}
```

There is also the possibility to schedule a chain using a calendars. The calendars path is indicated in the conf.json file:

```json
{
  "general": {
    "calendarsPath": "/calendars/"
  }
}
```

Calendars dir:
```
|-- calendars
    |-- weekends.ics
    |-- laboral_days.ics
```

In the chain can be indicated a calendar when the chains is going to be enable and when is going to be disable:

```json
{
  "id":"EXAMPLE_CHAIN",
  "name":"Name of the sample chain",
  "calendars": 
    {
      "enable":"laboral_days",
      "disable":"weekends"
    }
}
```

### custom values
It is possible to define and overwrite global values at chain level setting a custom_values attribute:
```json
{
  "id":"EXAMPLE_CHAIN",
  "name":"Name of the sample chain",
  "custom_values": 
    {
      "YYYY":"1986",
      "MY_LOCAL_CHAIN_VALUE":"ABC"
    }
}
```

### dependencies

It is possible to define dependencies with other chains or with processes of other chains. This means than a chain with dependencies will never execute after their dependencies are resolve. For example:

```json
{
  ...
  "depends_chains":["CHAIN_ONE"],
  ...
}
```

The chain of the example will no execute after the chain with the id CHAIN_ONE is finish. It is also possible to configure a dependence of a chain's process or more:

```json
{
  ...
  "depends_chains":{"chain_id":"CHAIN_ONE","process_id":"PROCESS_ONE"},
  ...
}
```

In addition, Runnerty can have a dependencie from a file(filewatcher), with this acctions:

add: when a file is added.
change: when a file is changed.
unlink: when a file is deleted.
error: when ther is an error in the file treatment.

```json
{
  ...
  "depends_chains":[{"file_name":"/path/myfile.txt", "condition":"add"}],
  ...
}
```

### events

With the events property Runnerty can access to the differnts states of the chain: "on_start", "on_fail", "on_retry" and "on_end".

In this events we can notify anything using a notificator. (know mor about notificators [link].

This is an example o the events of a chain using the Telegam notificator:

```json
{
  ...
  "events": {
    "on_start": {
      "notifications": [
        {
          "id": "telegram_default",
          "message": "THE CHAIN :CHAIN_ID HAS STARTED"
        }
      ]
    },
    "on_fail": {
      "notifications": [
        {
          "id": "telegram_default",
          "message": "THE CHAIN :CHAIN_ID HAS FAILED"
        }
      ]
    },
    "on_end": {
      "notifications": [
        {
          "id": "telegram_default",
          "message": "THE CHAIN :CHAIN_ID HAS FINISHED"
        }
      ]
    }
  }
  ...
}
```
Note that in the example it is used the global value :CHAIN_ID, this value will have the id of the chain. Know more about global values here [link]


### processes

In the processes property can be defined all ther processes thar are going to be part of the chain. Know more about processes [link]


```json
{
  ...
  "processes":[
    {
      "id":"PROCESS_ONE",
      "name":"First process of the chain",
      "exec":
        {
          "id":"shell default",
          "command":"echo 'Hello world'",
        }
    }
  ]
  ...
}
```

### iteable chains

An iterale chain is a chain that is going to be executed for each objects of the array returned by a process. For example, if we have a process which returns and objects array we can execute an iterable chain for each object of the array.

In this example we are going to send a email to al the users of the USERS table.

we have the chain get-users-email.json with a process which selects all the users's email:


```json
{
  "id": "GET-USERS-EMAIL",
  "name":"It gets all the user's names to send a email",
  "schedule_interval":"1 */1 * * *",
  "processes":
  [
    {
      "id":"GET-USER-EMAIL",
      "name":"it gets all the users email from the database",
      "exec":
        { "id":"mysql_default",
          "command": "SELECT email, name FROM USERS"
        },
      "output_iterable":"PROCESS_EXEC_DB_RETURN"
    }
  ]
}
```

We assign the array returned for the select with the PROCESS_EXEC_DB_RETURN value to the property "output_iterable". Now we are going to define the iterable chain "send-mail-to-user"


```json
{
  "id":"SEND-MAIL-TO-USERS",
  "name":"it sends an email to the users returned",
  "depends_chains":{"chain_id":"GET-USERS-EMAIL","process_id":"GET-USER-EMAIL"},
  "iterable":"parallel",
  "input":[{"email":"email"}, {"name":"name"}],
  "processes":[
    {
      "id":"SEND-MAIL",
      "name":"sends the email to the user",
      "exec":
        { 
          "id":"mail_default",  
          "to": [":email"],
          "message": "Hello :name", 
          "title": "Message set by Runnerty"
        },
      "end_chain_on_fail":true,
    }
  ]
}
```
Here we can see some properties that the chain needs to iterate. First of all we have the dependecies. An iterable chain must depends of the process from the "mother chain" from wich iterates.

```json
{
  ...
  "depends_chains":
    {
      "chain_id":"GET-USERS-EMAIL","process_id":"GET-USER-EMAIL"
    }
  ...
}
```

With the property iterable we can choose if we want to iterate in serie or parallel.

```json
{
  ...
  "depends_chains":
    {
      "chain_id":"GET-USERS-EMAIL","process_id":"GET-USER-EMAIL"
    },
  "iterable":"parallel"
  ...
}
```

in the input property we can assign the properties of each object returned by de mother's process array.

```json
{
  ...
  "depends_chains":
    {
      "chain_id":"GET-USERS-EMAIL","process_id":"GET-USER-EMAIL"
    },
  "iterable":"parallel",
  "input":[{"email":"email"}, {"name":"name"}],
  ...
}
```

now we use these values everywhere in our iterable chain:

```json
{
  "processes":
  [
    {
      "id":"SEND-MAIL",
      "name":"sends the email to the user",
      "exec":
        { "id":"mail_default",  
          "to": [":email"],
          "message": "Hello :name", 
          "title": "Message set by Runnerty"
        },
      "end_chain_on_fail":true,
    }
  ]
}
```
In the example :email has the user´s email and :name has the user's name



