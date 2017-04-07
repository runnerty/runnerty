# S3 executor for [Runnerty]:

### Configuration sample:
```json
{
  "id":"s3_default",
  "type":"runnerty-executor-s3",
  "apiVersion": "2006-03-01",
  "accessKeyId": "ABC123",
  "secretAccessKey": "ABC123",
  "bucket":"my.s3bucket.com",
  "method":"upload",
  "region": "eu-west-1"
}
```

### Plan sample:
```json
{
  "id":"s3_default",
  "bucket":"backup.test.com",
  "local_file":"/tmp/test.txt",
  "remote_file":"dir_one/:DD-:MM-:YY/test_up.txt"
}
```


[Runnerty]: http://www.runnerty.io