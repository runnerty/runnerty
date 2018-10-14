# Configuration

### config.json

The general configuration and params of the workflows is set in the config.json file. Runnerty will try to get the config.json file in the actual path.

With the -c param it is possible to indicate a different path. 

```
runnerty -c /path/config.json
```

In the config.json file is set the configuration of the different triggers, executors, notifiers and global values (params, paths, files, etc.) which are going to be used on the processes: 

```json
{
  "triggers": [
    {
      "id":"schedule_default",
      "type":"@runnerty-trigger-schedule"
    },
    {
      "id":"filewatcher_default",
      "type":"@runnerty-trigger-file-watcher"
    }
  ],
  "executors": [
    {
      "id": "shell_default",
      "type": "@runnerty/executor-shell"
    }
  ],
  "notifiers": [
    {
      "id": "telegram_default",
      "type": "@runnerty/notifier-telegram",
      "token": "MyTokenId",
      "chat_id": "MyChatId"
    }
  ]
}
```

### Triggers
The triggers are plugins which provoked the execution of a chain.

The most common case is the schedule trigger which allows us to execute a chain with a periodicity like CRON. 

Another example is the file watcher trigger. This trigger let us to execute a chain based on the events defined over a directory or file.
Have a look at: [triggers](triggers.md)

### Servers
Servers allow us to abstract ourselves of the endpoints implementation in a trigger development. Runnerty will set the servers indicated in the config file. It will take care about the routing and will serve one property for the triggers (on_request). In this property it will receive the requests of the endpoint. Moreover it allows customization of the response, also the status code and the possibility so send an object.

Have a look at: [triggers](triggers.md)


### Executors
The executors are plugins which enclose functionalities. This plugins allows Runnerty execute processes, data bases operations, use external services, etc. This is a list of the official available [here](plugins.md)

In the config.json file are defined all the executors that are going to be used in the whole plan.

This is an example of the configuration of two executors (shell and mysql): 

```json
{
  "executors": [
    {
      "id": "shell_default",
      "type": "@runnerty/executor-shell"
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

### Notifiers

The Notifiers are plugins which allows Runnerty to notificate events that happend in the chain and processes to different services and channels. This is a list of the official available [Plugins]

In the config.json file are defined all the notifiers that are going to be used in the whole plan.

This is an example of the configuration of two notifiers (mail and telegram):

```json
{
  "notifiers": [
    {
      "id": "telegram_default",
      "type": "@runnerty/notifier-telegram",
      "token": "MyTokenId",
      "chat_id": "MyChatId"
    },
    {
      "id": "mail_default",
      "type": "@runnerty/notifier-mail",
      "disable": false,
      "from": "Runnerty Notifier <my@sender.com>",
      "transport": "smtp://my%mailsender.com:pass@smtp.host.com/?pool=true",
      "bcc":["mycc@mail.com"],
      "templateDir": "/etc/runnerty/templates",
      "template": "alerts",
      "ejsRender": true
    }
  ]
}
```

### Global values

It is possible to define values that can be used in the chains an process (paths, files, data, …):

```json
{
    "executors": [
      {"...":"..."}
    ],
    "notifiers": [
      {"...":"..."}
    ],
    "global_values": [
      {
        "my_files": {
          "file_one":"/path/MYFILE_ONE.csv",
          "file_one":"/path/MYFILE_TWO.csv"
      	},
        "my_values":{
          "value_one":"VALUE_ONE",
          "value_two":"VALUE_TWO"
        }
      }
    ]
  }
```

These values can be used in the whole plan (chains and proccess) referencing them. Runnerty has also some default values. Have a look at: [link]


### Cripted passwords
Runnerty offers the possibility to encrypt passwords so it is not necessary to put passwords on the config.json file.

```
runnerty -p master_cryptor_password -e password_to_encrypt
```

Note that master_cryptor_password is the personal password needed to decrypt the passwords.

This will return the crypted password. Now, in the config.json you can use the crypted paswords with the property crypted_password (Runnerty will decrypt the crypted password in memory and send it to the executors):

```json
{
  "executors": [
    {
      "id": "mysql_default",
      "type": "@runnerty/executor-mysql",
      "user": "mysqlusr",
      "crypted_password": "ABDEFE1234..",
      "database": "MYDB",
      "host": "myhost.com",
      "port": "3306"
    }
  ]
}
```

