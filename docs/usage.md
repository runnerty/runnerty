# Usage (Application) - Runnerty

## Executions options
```
-V, --version: get runnerty version
-c, --config <path>: set config path. defaults to ${configFilePath}.
-P, --plan <path>: Overwrite path file plan of config file.
-p, --password <password>: Master cryptor password.
-e, --encrypt <password_to_encrypt>: Util: Encrypt password (to use crypted_password in config instead of literal password)
-m, --memorylimit <memoryLimitMb>: Set default memory space limit for Runnerty (--max-old-space-size). It is necessary to restart Runnerty.
-f, --force_chain_exec <chainId>: Force chain execution (For development tests).
--input_values <inputValues>: Input values for force chain execution (-f) (For development tests).
--custom_values <customValues>: Custom values for force chain execution (-f) (For development tests).
-r, --restore: Restore backup plan (experimental).
```
### Samples
```bash
runnerty -c /etc/runnerty/config.json -P /user/workdir/other_plan.json -f CHAIN_ONE --custom_values {\"YYYY\":\"1986\"}
```