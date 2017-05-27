# API (WS) - Runnerty
## Autenticación
Login para obtener token de acceso
### POST [/auth/]

+ Body parameters
    + user (string)
      Usuario
    + password (string)
      Contraseña


+ Sample (body)
```json
{
  "user": "runnerty",
  "password": "password_runnerty"
}
```

Es importante tener en cuenta que en todas las llamadas a la API (excepto /auth/) deben contener las cabeceras:

`Content-Type: application/json`
`Authorization: Bearer [TOKEN_RESULTANTE_DE_AUTH]`

## Consultar cadenas
Consultar cadenas cargadas
### GET [/chains/]

## Consultar cadena
Consultar una cadena
### GET [/chain/:chainId]

+ URL parameters
    + chainId (ID de la cadena)

+ Sample (url)
http://sample_host.com/api/chain/CHAIN_SAMPLE

## Forzar ejecución de una cadena
Se ejecutará la cadena indicada siempre que no esté corrienda ya.
### POST [/chain/forceStart/:chainId]

+ URL parameters
    + chainId (ID de la cadena)

+ Sample (url)
http://sample_host.com/api/chain/forceStart/CHAIN_SAMPLE

+ Body parameters
    + customValues (object)
        + GLOBAL_VALUE_KEY:VALUE_KEY (Variable global y valor personalizado)

+ Sample (body)
```json
{
  "customValues": {
    "YYYY":"1986",
    "MY_CONF_VALUE":"NEW_VALUE"
  }
}
```

## Consultar procesos de una cadena
Consultar procesos de una cadena
### GET [/processes/:chainId]

+ URL parameters
    + chainId (ID de la cadena)

+ Sample (url)
http://sample_host.com/api/processes/CHAIN_SAMPLE

## Consultar proceso de una cadena
Consultar proceso de una cadena
### GET [/process/:chainId/:processId]

+ URL parameters
    + chainId (ID de la cadena)
    + processId (ID del proceso)

+ Sample (url)
http://sample_host.com/api/process/CHAIN_SAMPLE/PROCESS_ONE

## Matar proceso de una cadena
Matar un proceso de una cadena
### POST [/process/kill]

+ Sample (url)
http://sample_host.com/api/process/kill

+ Body parameters
    + chainId (ID de la cadena)
    + processId (ID del proceso)
    
+ Sample (body)
```json
{
  "chainId":"CHAIN_ONE",
  "processId":"PROCESS_ONE"
}
```