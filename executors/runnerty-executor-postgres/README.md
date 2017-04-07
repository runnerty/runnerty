# Postgres executor for [Runnerty]:

### Configuration sample:
```json
{
  "id": "postgres_default",
  "type": "runnerty-executor-postgres",
  "user": "postgresusr",
  "password": "postgrespass",
  "host":"myhost.com",
  "database": "MYDB",
  "port": "5439"
}
```

### Plan sample:
```json
{
  "id":"postgres_default",
  "command_file": "/etc/runnerty/sql/test.sql"
}
```

```json
{
  "id":"postgres_default",
  "command": "SELECT now();"
}
```


[Runnerty]: http://www.runnerty.io