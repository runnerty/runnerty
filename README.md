
## Installation
```
git clone https://github.com/Coderty/runnerty.git
npm install
```

## Setting up
Por defecto runnerty intentará obtener la configuración del documento '/etc/runnerty/conf.json'.
Es posible modificar el documento mediante el paso del parámetro -c o --config + la ruta del fichero de configuración.

Por defecto runnerty iniciará intentando restaurar el estado anterior mediante la restauración del fichero binBackup, si lo que se pretende es obtener cambios realizados en el plan o reiniciar el proceso descartando el estado anterior runnerty debe de ser ejecutado con el comando -r o --reload.

### Configuration
La configuración general se encuentra en el fichero de configuración, por defecto '/etc/runnerty/conf.json':
Example:
```javascript
{
  "config": {
    "general": { //General Section
      // Backup de la ejecución del proceso
      "binBackup": "/tmp/bin.json", 
      // Fichero del plan de ejecución
      "planFilePath": "/etc/runnerty/plan.json",
      // Intervalo de refresco de binBackup
      "refreshIntervalBinBackup": 2000,
      // Configuración API
      "api": {
        "port": 3456,
        "users": [
          {
            "user": "coderty",
            "password": "runnerty"
          },
          {
            "user": "usr_test",
            "password": "pass_test"
          }
        ],
        "secret": "RUNNERTY_BY_CODERTY",
        "limite_req": "20mb",
        // Atributos excluidos de la salida de la API
        "propertiesExcludesInResponse": [
          "proc",
          "scheduleCancel",
          "scheduleRepeater",
          "file_watchers",
          "depends_files_ready"
        ]
      }
    },
    // Conexiones de BD
    "db_connections": [
      {
        "id": "mysql_default",
        "type": "mysql",
        "user": "myuser",
        "password": "mypass",
        "database": "RUNNERTY",
        "host": "db.runnerty.com",
        "port": "3306"
      },
      {
        "id": "postgres_default",
        "type": "postgres",
        "user": "userpg",
        "password": "passpg",
        "database": "RUNNERTY",
        "host": "localhost",
        "port": "5432"
      },
      {
        "id": "redis_default",
        "type": "redis",
        "password": "passredis",
        "host": "redishost",
        "port": "6379",
        "options": {}
      }
    ],
    // Conexiones de Notificaciones
    "notificators_connections": [
      {
        "id": "slack_default",
        "type": "slack",
        "webhookurl": "https://hooks.slack.com/services/ABCDE123?????",
        "bot_name": "Runnerty-Sentinel",
        "bot_emoji": ":v:",
        "channel": "runnerty-channel"
      },
      {
        "id": "mail_default",
        "type": "mail",
        "disable": false,
        "from": "Runnerty <run@coderty.com>",
        "transport": "smtps://run%40coderty.com:password@smtp.gmail.com/?pool=true",
        "templateDir": "/etc/runnerty/templates",
        "template": "alerts"
      }
    ],
    // Valores globales
    "global_values": [
      {
        "myparams": {
          "host": "coderty.com",
          "port": "5123",
          "myfile": "myfile_:DD:MM:YYYY.txt"
        }
      },
      {
        "myothersparams": {
          "host": "google.com"
        }
      }
    ]
  }
}
```

### Plan
El plan es el objeto contenedor las cadenas que a su vez contienen los procesos.
```
plan > chains > process
```

Las cadenas contenidas en el plan pueden cargarse desde un fichero externo con "chain_path" o bien indicarse directamente como un objeto del array de "chains"
Ejemplo de plan:
```javascript
{
  "chains":[
    {"chain_path":"/var/runnerty/chains/my-chain-one.json"},
    {
      "id":"MY_CHAIN_TWO",
      [...]
    }
  ]
}
```

#### Valores globales
```
YY
YYYY
MM
DD
HH
mm
ss
```

### Chain (Cadena)
Una cadena es una agrupación de procesos con una planificación dada.
Estos procesos pueden tener o no dependencias entre ellos. Es decir, la ejecución de un proceso puede depender de la finalización correcta o erronea de un proceso previo. En caso de que varios procesos no tengan dependecias hará que las ejecuciones de estos se realicen en paralelo.
El inicio de las ejecuciones de las cadenas puede darse por una planificación temporal (patrón CRON) o por un evento reportado por un filewatcher.

Ejemplo:
```javascript
{
  "id":"CHAIN_SAMPLE",
  "name":"MY CHAIN SAMPLE",
  "start_date":"2016-01-01T00:00:00",
  "end_date":"2099-12-01T00:00:00",
  "schedule_interval":"*/1 * * * *",
  "depends_chains":[],
  "events":{"on_start":{}, "on_end":{}, "on_fail":{}, "on_waiting_dependencies":{}},
  "processes":[{
    "id":"PROC_SAMPLE_ONE",
    "name":"THE PROCESS SAMPLE ONE",
    "depends_process":[],
    "exec":"echo",
    "args":["Hello world"],
    "end_chain_on_fail":false,
    "events":{
      "on_start":{
        "notifications":[
          {
            "id":"slack_default",
            "bot_emoji": ":rabbit2:",
            "channel": "mlm",
            "message":"PROCESS *:PROCESS_ID* OF CHAIN :CHAIN_ID IS STARTED"
          }
        ]
      },
      "on_fail":{
        "notifications":[
          {
            "id":"slack_default",
            "bot_emoji": ":see_no_evil:",
            "channel": "mlm",
            "message":"ERROR IN PROCESS *:PROCESS_ID* OF CHAIN :CHAIN_ID - :PROCESS_EXEC_ERR_RETURN / :PROCESS_EXEC_RETURN"
          }
        ]
      },
      "on_end":{},
      "on_waiting_dependencies":{},
    }
    },
    {
      "id":"PROC_2_SAMPLE",
      "name":"PROCESS SAMPLE TWO",
      "depends_process":[{"id":"PROC_SAMPLE_ONE"}],
      "exec":"echo",
      "args":["Sample 2"],
      "events":{
        "on_start":{
          "notifications":[
             {
               "id":"slack_default",
               "bot_emoji": ":rabbit2:",
               "channel": "mlm",
               "message":"PROCESS *:PROCESS_ID* OF CHAIN :CHAIN_ID IS STARTED"
             }
           ]
         },
         "on_fail":{
           "notifications":[
             {
               "id":"slack_default",
               "bot_emoji": ":see_no_evil:",
               "channel": "mlm",
               "message":"ERROR IN PROCESS *:PROCESS_ID* OF CHAIN :CHAIN_ID - :PROCESS_EXEC_ERR_RETURN / :PROCESS_EXEC_RETURN"
             }
           ]
         },
        "on_end":{
          "notifications":[
            {
              "id":"slack_default",
              "bot_emoji": ":v:",
              "channel": "mlm",
              "message":"FIN DEL PROCESO *:PROCESS_ID* DE LA CADENA :CHAIN_ID - :PROCESS_EXEC_RETURN"
            }
          ]
        },
        "on_waiting_dependencies":{}
      }
    }
  ]
}
```

#### Valores globales de una cadena
```
CHAIN_ID 
CHAIN_NAME
CHAIN_STARTED_AT
```
Estos valores pueden utilizarse en cualquier propiedad de "output" y "notifications"

##### Dependencias:
?
##### Eventos:
?

### Process (Proceso)
Una proceso representa una ejecución bien de un comando shell o de una o varias sentencia mysql, postgres o redis.

#### La ejecución de un proceso

Ejecución de **comando shell**:
```json
"exec":"python",
"args":["/var/my-py-script.py","-a myargsample"]
```

```json
"exec":"python",
"args":["/var/my-py-script.py -a myargsample"]
```

```json
"exec":"sh",
"args":["/var/my-sh.sh","-a myargsample"]
```

Ejecución de sentencia **mysql o postgres**:
```json
"exec":{"command":"SELECT * FROM MYTABLE WHERE process_id = :procid", "db_connection_id":"mysql_default"},
"args":{"procid":":PROCESS_ID"}
```
Es posible indicar parámetros en "args" como propiedades del objeto que despues serán reemplazados en la sentencia en la que se debe indicar el nombre junto con ":"

```json
"exec":{"file_name":"/etc/runnerty/query.sql", "db_connection_id":"mysql_default"},
"args":{"procid":":PROCESS_ID"}
```
Tambien podemos especificar un fichero que contenga las sentencias sql indicando "file_name" en lugar de "command".

Ejecución de sentencia **redis**:
```json
"exec":{"command":[["SET",":my_key","TEST_VALUE"],["KEYS","*"],["GET",":clave"]], "db_connection_id":"redis_default"},
"args":{"my_key":"RTEST"}
```

```json
"exec":{"command":["SET",":my_key","OTHER_TEST_VALUE"], "db_connection_id":"redis_default"},
"args":{"my_key":"RTEST"}
```
        
#### Output (Salida)
Objeto o array de objetos que definen la salida personalizada cuando un proceso finaliza o falla.

Parámetros:
```
"file_name": ruta y fichero
"concat": indica si la salida debe concatenarse al fichero actual o por el contrario descartar el contenido previo.
"max_size": indica el tamaño maximo permitida para el fichero, si este se excede se eliminará el contenido más antiguo para no superarlo. Supported units and abbreviations are as follows and are case-insensitive: "b" for bytes, "kb" for kilobytes, "mb" for megabytes, "gb" for gigabytes, "tb" for terabytes. Exmaples: "10gb", "500mb"
"write": array en el que se indican los valores a escribir en el fichero, cada elemento será escrito en una nueva linea. Example: "write":["[*] EXECUTION :DD-:MM-:YY :HH::mm::ss",":PROCESS_EXEC_ERR_RETURN",":PROCESS_EXEC_RETURN"]
```

```json
"output":{"file_name":"/var/logs/runnerty/:CHAIN_ID_:PROCESS_ID_:DD:MM:YY_:HH:mm:ss.log", "write":["* EXECUTION :DD-:MM-:YY :HH::mm::ss",":PROCESS_EXEC_ERR_RETURN",":PROCESS_EXEC_RETURN"], "concat":false, "max_size":"100mb"}
```

```json
"output":[{"file_name":"/etc/runnerty/:CHAIN_ID_:PROCESS_ID_:DD:MM:YY_:HH:mm:ss.log", "write":["* EXECUTION :DD-:MM-:YY :HH::mm::ss",":PROCESS_EXEC_ERR_RETURN",":PROCESS_EXEC_RETURN"], "concat":false, "max_size":"100mb"},
          {"file_name":"/etc/runnerty/:PROCESS_ID.err", "write":[":PROCESS_EXEC_ERR_RETURN"], "concat":true, "max_size":"1gb"}]
```

### OutputShare (Creación de variable globales en tiempo de ejecución)
Creación, en el proceso:
"output_share":{"key":"CLAVE","name":"NOMBRE","value":"VALOR :YYYY"},

Uso:
:CLAVE_NOMBRE_VALUE

#### Dependencias
Todos los procesos pueden tener dependencia de uno o varios procesos. Existen dos tipos de dependencias, por defecto cuando una proceso finaliza sin errores da paso a su/s procesos dependientes pero tambien podemos indicar que se de paso sólo cuando el proceso finalize con errores.

Ejemplos:
Dependecia por defecto, ejecución de un proceso cuando el proceso previo finaliza sin errores:
```json
"depends_process":["PROC_SAMPLE_ONE"]
```

```json
"depends_process":[{"id":"PROC_SAMPLE_ONE"}]
```

Dependencia de varios procesos:
```json
"depends_process":["PROC_SAMPLE_ZERO","PROC_SAMPLE_ONE"]
```

Dependencia de un proceso cuando finalize con errores:
```json
"depends_process":[{"id":"PROC_SAMPLE_ONE","on_fail":true}]
```

Dependencias filewarcher:
Además podemos crear dependencias filewarcher de cualquiera de estos eventos (add, change, unlink o error):
```json
"depends_process":[{"id":"PROC_SAMPLE_ONE"},{"file_name":"test/file.txt","condition":"add"}]
```

```json
"depends_process":[{"file_name":"test/file.txt","condition":"add"}]
```

#### Eventos de la ejecución de un proceso
 - on_start: Cuando se inicia el proceso
 - on_fail: Cuando se produce un error durante la ejecución de un proceso
 - on_end: Cuando finaliza un el proceso
 - on_waiting_dependencies: Cuando intenta ejecutarse pero alguna de sus dependencias lo impiden
 
 En estos eventos podemos especificar una o varias notificaciones que queremos que se produzcan.
 
 Ejemplo:
```javascript
   "events":{
    "on_start":{
      "notifications":[
         {
           "id":"slack_default",
           "message":"PROCESS *:PROCESS_ID* OF CHAIN :CHAIN_ID IS STARTED"
         },
         {
           "id": "mail_default",
           "message": "PROCESS *:PROCESS_ID* OF CHAIN :CHAIN_ID IS STARTED"
         }
      ]
    }
  }
 ```
 
 
#### Valores globales de un proceso
Estos valores pueden tomar valor antes, durante o despues de la ejecución del proceso y pueden ser utilizadas anteponiendo ":" en las propiedades "args", "command", "output" y "notifications".
```
PROCESS_ID
PROCESS_NAME
PROCESS_COMMAND
PROCESS_ARGS
PROCESS_EXEC_ARGS
PROCESS_EXEC_RETURN (Shell command)
PROCESS_EXEC_ERR_RETURN (Shell command, MySQL/Postgres or Redis)
PROCESS_STARTED_AT
PROCESS_ENDED_AT
PROCESS_RETRIES_COUNT
PROCESS_RETRIES
PROCESS_DEPENDS_FILES_READY
PROCESS_FIRST_DEPEND_FILE_READY
PROCESS_LAST_DEPEND_FILE_READY
PROCESS_EXEC_DB_RETURN (MySQL/Postgres or Redis (JSON Array))
PROCESS_EXEC_DB_RETURN_CSV (MySQL/Postgres)
PROCESS_EXEC_DB_FIELDCOUNT  (MySQL/Postgres)
PROCESS_EXEC_DB_AFFECTEDROWS  (MySQL/Postgres)
PROCESS_EXEC_DB_CHANGEDROWS  (MySQL/Postgres)
PROCESS_EXEC_DB_INSERTID  (MySQL/Postgres)
PROCESS_EXEC_DB_WARNINGCOUNT  (MySQL/Postgres)
PROCESS_EXEC_DB_MESSAGE  (MySQL/Postgres)
```


### Iterable Chain (Cadena iterable)
#### Process launcher Iterable chain (Proceso lanzadera de cadenas iterables)