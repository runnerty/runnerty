# configuration

### conf.json

The general configuraton and params of the workflows is in the conf.json file. Runnerty will try to get the conf.json file in the actual path.

With the -c param it is possible to indicate a different path. 

```
runnerty -c /path/conf.json
```

In the conf.json file is set the configuration of the different executors, notificators and global values (params, paths, files, etc.) which are going to be used on the processes: 

```json
{
  "executors": [
    {
      "id": "shell_default",
      "type": "runnerty-executor-shell"
    }
  ],
  "notificators": [
    {
      "id": "telegram_default",
      "type": "telegram",
      "token": "MyTokenId",
      "chat_id": "MyChatId"
    }
  ]
}
```

### Executors

The executors are plugins which enclose functionalities. This plugins allows Runnerty execute processes, data bases operations, use external services, etc. This is a list of the official available [Plugins]

In the conf.json file are defined all the executors that are going to be used in the whole plan.

This is an example of the configutarion of two executors (shell and mysql): 

```json
{
  "executors": [
    {
      "id": "shell_default",
      "type": "runnerty-executor-shell"
    },
    {
      "id": "mysql_default",
      "type": "runnerty-executor-mysql",
      "user": "mysqlusr",
      "password": "mysqlpass",
      "database": "MYDB",
      "host": "myhost.com",
      "port": "3306"
    }
  ]
}
```

### Notificators

The Notificators are plugins which allows Runnerty to comunicate events from the chain and processes to different services and channels. This is a list of the official available [Plugins]

In the conf.json file are defined all the notificators that are going to be used in the whole plan.

This is an example of the configutarion of two notificators (mail and telegram):

```json
{
  "notificators": [
    {
      "id": "telegram_default",
      "type": "telegram",
      "token": "MyTokenId",
      "chat_id": "MyChatId"
    },
    {
      "id": "mail_default",
      "type": "runnerty-notificator-mail",
      "disable": false,
      "from": "Runnerty Notificator <my@sender.com>",
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
      ...
    ],
    "notificators": [
      ...
    ],
    "global_values": [
      {
        "my_files": {
          "file_one":"/path/MYFILE_ONE.csv",
          "file_one":"/path/MYFILE_TWO.csv"
      	},
        "my_values":{
          "value_one":"VALUE_ONE",
          "value_one":"VALUE_TWO",
        }
      }
    ]
  }
```

These values can be used in the whole plan (chains and proccess) referencing them. Runnerty has also some default values. Have a look at: [link]


### Cripted passwords

Runnerty offers the possibility to encrypt passwords so it is not necessary to put real passwords on the conf.json file.

```
runnerty -e password_to_encrypt
```

This will return the crypted password. 

[Plugins]: https://github.com/Coderty/runnerty/blob/master/docs/plugins.md
