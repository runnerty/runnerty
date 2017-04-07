# MySql executor for [Runnerty]:

### Configuration sample:
```json
{
  "id": "mysql_default",
  "type": "runnerty-executor-mysql",
  "user": "mysqlusr",
  "password": "mysqlpass",
  "database": "MYDB",
  "host": "myhost.com",
  "port": "3306"
}
```

### Plan sample:
```json
{
  "id":"mysql_default",
  "command_file": "/etc/runnerty/sql/test.sql"
}
```

```json
{
  "id":"mysql_default",
  "command": "SELECT NOW()"
}
```


[Runnerty]: http://www.runnerty.io