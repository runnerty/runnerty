# API (WS) - Runnerty

## Configuration

### In the config file: general/api (config.json)
```json
{
  "general": {
    "api": {
      "port": 3456,
      "users": [
        {
          "user": "runnerty",
          "password": "password_runnerty"
        },
        {
          "user": "usr_test",
          "password": "pass_test"
        }
      ],
      "secret": "RUNNERTY_SECRET_SAMPLE",
      "limite_req": "20mb"
    }
  }
}
```

## Authentication

Login to get the access token

### POST [/auth/]

+ Body parameters
    + user (string)
    + password (string)


+ Sample (body)
```json
{
  "user": "runnerty",
  "password": "password_runnerty"
}
```

Important! all the API calls (except /auth/) must content the headers:

`Content-Type: application/json`
`Authorization: Bearer [TOKEN_RESULTANTE_DE_AUTH]`

## Get chains
Gets loaded chains
### GET [/chains/]

## Get chain
Gets chain
### GET [/chain/:chainId]

+ URL parameters
    + chainId (Chain ID)

+ Sample (url)
http://sample_host.com/api/chain/CHAIN_SAMPLE

## Force chain execution
Executes the indicated chain if it is not runnning yet
### POST [/chain/forceStart/:chainId]

+ URL parameters
    + chainId (Chain ID)

+ Sample (url)
http://sample_host.com/api/chain/forceStart/CHAIN_SAMPLE

+ Body parameters
    + customValues (object)
        + GLOBAL_VALUE_KEY:VALUE_KEY (Global variable and custom value)

+ Sample (body)
```json
{
  "customValues": {
    "YYYY":"1986",
    "MY_CONF_VALUE":"NEW_VALUE"
  }
}
```

## Get a chain processes
Gets the processes of a chain
### GET [/processes/:chainId]

+ URL parameters
    + chainId (ID de la cadena)

+ Sample (url)
http://sample_host.com/api/processes/CHAIN_SAMPLE

## Get process of a chain
Gets a process of a chain
### GET [/process/:chainId/:processId]

+ URL parameters
    + chainId (Chain ID)
    + processId (process ID)

+ Sample (url)
http://sample_host.com/api/process/CHAIN_SAMPLE/PROCESS_ONE

## Kill a chain's process
Kills a process of a chain
### POST [/process/kill]

+ Sample (url)
http://sample_host.com/api/process/kill

+ Body parameters
    + chainId (chain ID)
    + processId (process ID)
    
+ Sample (body)
```json
{
  "chainId":"CHAIN_ONE",
  "processId":"PROCESS_ONE"
}
```