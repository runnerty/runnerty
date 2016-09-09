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

