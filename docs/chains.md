# Chain

A chain is a set of processes with its own properties like scheduling, notifications, dependencies, outputs, etc.

This is an example of a basic chain with one process:

```json
{
  "chains":[
    {
      "id": "EXAMPLE_CHAIN",
      "name": "Name of the sample chain",
      "schedule_interval": "* * * * *",
      "depends_chains": [],
      "processes": [
        {
          "id": "PROCESS_ONE",
          "name": "Firt process of the chains",
          "exec": {
            "id": "shell_default",
            "command": "echo 'Hello world'"
          },
          "end_chain_on_fail": true
        }
      ]
    }
  ]
}
```


### Identification

A chain has two identification fields:

**id**, identifies the chain. with this identifier Runnerty will provide a global value (*:CHAIN_ID*) that can be used in the whole chain. To know more about global values have a look [here](config.md)

```json
{
  "id": "EXAMPLE_CHAIN"
}
```

**name**, it is a description of the chain. Runnerty will also provide the global value *:CHAIN_NAME*

```json
{
  "id": "EXAMPLE_CHAIN",
  "name": "Name of the sample chain"
}
```



### Scheduling

There are different ways to schedule a chain. It is possible to schedule chains with a cron expression.

This scheduling will execute the chain at every minute:

```json
{
  "id": "EXAMPLE_CHAIN",
  "name": "Name of the sample chain",
  "schedule_interval": "*/1 * * * *"
}
```

There is also the possibility to schedule a chain using a calendars. The calendars path can be indicated in the *config.json* file:

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

### Custom values

It is possible to define and overwrite global values at chain level, setting a **custom_values** attribute:
```json
{
  "id": "EXAMPLE_CHAIN",
  "name": "Name of the sample chain",
  "custom_values": 
    {
      "YYYY": "1986",
      "MY_LOCAL_CHAIN_VALUE": "ABC"
    }
}
```

### Dependencies

It is possible to define dependencies with other chains or other chains processes. This means than a chain with dependencies will never execute before their dependencies are resolved.

You can define these dependency restrictions through the **depends_chains** property, like in the sample below:

```json
{
  "depends_chains": ["CHAIN_ONE"]
}
```

The chain of the example will not be executed until the chain with *id* *CHAIN_ONE* is finished. It is also possible to configure a set up dependencies to one chain's process or more:

```json
{
  "depends_chains": {
    "chain_id": "CHAIN_ONE",
    "process_id": "PROCESS_ONE"
  }
}
```

In addition, it is possible to set up file system path dependencies in Runnerty with the help of auto-magically configured filewatchers. Them are defined with the **condition** property and can be fired through the following actions:

- *add*: when a file is added.
- *change*: when a file is changed.
- *unlink*: when a file is deleted.
- *error*: when there is an error in the file treatment.

Usage example below:

```json
{
  "depends_chains": [
    {
      "file_name": "/path/myfile.txt",
      "condition": "add"
    }
  ]
}
```

### Notifications

With the **notifications** property, Runnerty can be set up to emit notifications during the chain status flow, fired up by the following callbacks:
- *on_start*
- *on_fail*
- *on_end*

In these notifications we could notify anything using **notificators**.

The following example shows how to set up notifications for the different states of the chain through *Telegram Notificator*, publishing messages to a previously defined Telegram's chatroom:

```json
{
  "notifications": {
    "on_start": [
      {
        "id": "telegram_default",
        "message": "THE CHAIN :CHAIN_ID HAS STARTED"
      }
    ],
    "on_fail": [
      {
        "id": "telegram_default",
        "message": "THE CHAIN :CHAIN_ID HAS FAILED"
      }
    ],
    "on_end": [
      {
        "id": "telegram_default",
        "message": "THE CHAIN :CHAIN_ID HAS FINISHED"
      }
    ]
  }
}
```
>Note the usage of the *global value :CHAIN_ID* on the previous example. This value will be replaced with the chain's *id*. Know more about global values [here](config.md)


(List of avaliable officialy notificators coming out soon).

Learn more about notificators and how to configure them [here](notificators.md).


### Processes

In the **processes** array property can be defined all the processes that are going to be part of the chain.

Learn more about *processes* and how to configure them [here](process.md).


```json
{
  "processes": [
    {
      "id": "PROCESS_ONE",
      "name": "First process of the chain",
      "exec": {
        "id": "shell_default",
        "command": "echo 'Hello world'"
      }
    }
  ]
}
```

### Iterable chains

An **iterale chain** is a chain that is going to be executed for each object in the array previously returned by another process.

For example, if we have a process which returns *one objects array* we can execute an iterable chain for each object in the array.

In the following example we are going to send an email to every user of the USERS table.

First, we have the chain get-users-email.json with a process which selects all the users's email:


```json
{
  "id": "GET-USERS-EMAIL",
  "name": "It gets all the user's names to send an email",
  "schedule_interval": "1 */1 * * *",
  "processes": [
    {
      "id": "GET-USER-EMAIL",
      "name": "it gets all the users email from the database",
      "exec": {
        "id": "mysql_default",
        "command": "SELECT email, name FROM USERS"
      },
      "output_iterable": "PROCESS_EXEC_DATA_OUTPUT"
    }
  ]
}
```

Then, we assign the returned resultset by the MySQL SELECT query as an object array with the **PROCESS_EXEC_DATA_OUTPUT** value, as part of the property **output_iterable**. This way we are announcing this process will return an iterable output.

Now we are going to define the iterable chain *"send-mail-to-user"*

```json
{
  "id": "SEND-MAIL-TO-USERS",
  "name": "it sends an email to the users returned",
  "depends_chains": {
    "chain_id": "GET-USERS-EMAIL",
    "process_id": "GET-USER-EMAIL"
  },
  "iterable": "parallel",
  "input": [
    {
      "email": "email"
    },
    {
      "name": "name"
    }
  ],
  "processes": [
    {
      "id": "SEND-MAIL",
      "name": "sends the email to the user",
      "exec": {
        "id": "mail_default",
        "to": [
          ":email"
        ],
        "message": "Hello :name",
        "title": "Message set by Runnerty"
      },
      "end_chain_on_fail": true
    }
  ]
}
```

Here we can see some properties that the chain needs to iterate. First of all we have the dependencies on the **depends_chains** property. An iterable chain **must depends** on the process from the *"mother chain"* whom it iterates:

```json
{
  "depends_chains": {
    "chain_id": "GET-USERS-EMAIL",
    "process_id": "GET-USER-EMAIL"
  }
}
```

With the **iterable** property we can choose if we want to iterate over in series or parallel:

```json
{
  "depends_chains": {
    "chain_id": "GET-USERS-EMAIL",
    "process_id": "GET-USER-EMAIL"
  },
  "iterable": "parallel"
}
```

With the **input** property we can assign the properties of each object returned by de mother's process array.

```json
{
  "depends_chains": {
    "chain_id": "GET-USERS-EMAIL",
    "process_id": "GET-USER-EMAIL"
  },
  "iterable": "parallel",
  "input": [
    {
      "email": "email"
    },
    {
      "name": "name"
    }
  ],
}
```

Now, we can use these values anywhere in our iterable chain:

```json
{
  "processes": [
    {
      "id": "SEND-MAIL",
      "name": "sends the email to the user",
      "exec": {
        "id": "mail_default",
        "to": [
          ":email"
        ],
        "message": "Hello :name",
        "title": "Message send by Runnerty"
      },
      "end_chain_on_fail": true
    }
  ]
}
```
In the example :email will be replaced with the user's email and :name will be replaced with the user's name.

