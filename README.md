## How?

Plan `plan.json`:

* [depends_process], array with strings or objects like this {"id":"PREVIOUS_PROCESS_ID"}, {"id":"PREVIOUS_PROCESS_ID","on_fail":true} if only run on fail previous process or {"file_name":"test/file.txt","condition":"add"} if depends of files events (add, change, unlink or error)
* [Execution values], you can use execution values in command args, notification messages and titles.
Values:
CHAIN_ID
CHAIN_NAME
CHAIN_STARTED_AT
PROCESS_ID
PROCESS_NAME
PROCESS_COMMAND
PROCESS_ARGS
PROCESS_EXECURTE_ARGS
PROCESS_EXECUTE_RETURN
PROCESS_EXECUTE_ERR_RETURN
PROCESS_STARTED_AT
PROCESS_ENDED_AT
PROCESS_RETRIES_COUNT
PROCESS_RETRIES
PROCESS_DEPENDS_FILES_READY
PROCESS_FIRST_DEPEND_FILE_READY
PROCESS_LAST_DEPEND_FILE_READY
PROCESS_EXEC_MYSQL_RESULTS (JSON Array)
PROCESS_EXEC_MYSQL_RESULTS_CSV
PROCESS_EXEC_MYSQL_FIELDCOUNT
PROCESS_EXEC_MYSQL_AFFECTEDROWS
PROCESS_EXEC_MYSQL_CHANGEDROWS
PROCESS_EXEC_MYSQL_INSERTID
PROCESS_EXEC_MYSQL_WARNINGCOUNT
PROCESS_EXEC_MYSQL_MESSAGE
DD
MM
YY
YYYY
HH
mm
ss


Example:
```json

"processes":[{
  "id":"SAMPLE_PROCESS",
  "name":"Sample process",
  "depends_process":[],
  "command":"echo",
  "args":[":YYYY:MM:DD"],
  "retries":0,
  "retry_delay":0,
  "events":{
    "on_start":{
      "notifications":[
        {
          "type":"slack",
          "id":"slack_default",
          "bot_emoji": ":rabbit2:",
          "channel": "runnerty",
          "message":"INIT *:PROCESS_ID* OF CHAIN :CHAIN_ID - FILE :PROCESS_LAST_DEPEND_FILE_READY"
        }
      ]
    }
  }
 }]
```

* [chain_path], External chain files, set object {"chain_path":"chain_file.json"} instead of chain object for load chain object from external file.


Processes:
* [exec], Set command or mysql query to run. Its possible set a string and it will expect a command shell or set a object like this {"command":"echo", "type":"command"} or for mysql query {"command":"INSERT INTO mydb.mytable VALUES ('X')", "type":"mysql", "db_connection_id":"mysql_default"}.
Examples:
"exec":{"command":"SELECT * FROM mydb.mytable WHERE process = :myProcessId AND chain = :myChainName", "type":"mysql", "db_connection_id":"mysql_default"},
"args":{"myProcessId":":PROCESS_ID", "myChainName":":CHAIN_NAME"},

* ["output"], Object to set custom output when process end or fail. Example: "output":{"file_name":"/etc/runnerty/:CHAIN_ID_:PROCESS_ID_:DD:MM:YY_:HH:mm:ss.log", "write":["* EXECUTION :DD-:MM-:YY :HH::mm::ss",":PROCESS_EXECUTE_ERR_RETURN",":PROCESS_EXECUTE_RETURN"], "concat":false, "max_size":"1mb"},
"concat", true indicate that output have to append to actual content of file and false that content overwrite content.
"max_size", set max size of file and content will be truncated from the beginning. Supported units and abbreviations are as follows and are case-insensitive: "b" for bytes, "kb" for kilobytes, "mb" for megabytes, "gb" for gigabytes, "tb" for terabytes. Exmaples: "10gb", "500mb"
"write", array for set a serie of values to write in file. Any element will be writen in a new line. Example: "write":["[*] EXECUTION :DD-:MM-:YY :HH::mm::ss",":PROCESS_EXECUTE_ERR_RETURN",":PROCESS_EXECUTE_RETURN"]