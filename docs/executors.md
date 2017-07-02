# executors

The executors are plugins for Runnerty which encapsulate functionalities. The processes of a chain use executors to realize different actions. 

There are a bunch of executors for different purposes. For execute sentences in different databases like mysql, postgres, etc. For sending mails, operations with S3 files. Yo can have a look at the list of the official executors.

### configuration

in the conf.json file of the project we are going to write the configuration of the different executors that are going to be used in the processes.

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

This is an example of the configuration of two executors: ```@runnerty/executor-shell``` and ```@runnerty/executor-mysql```. Each executor has it's owns properties, some of them are mandatory, you can have a look at each executor documentation to know how to use them.

### usage

The destination of an executor is to use it in our plan's processes. It's is important to know


[executors]: https://github.com/Coderty/runnerty/blob/master/docs/executors.md