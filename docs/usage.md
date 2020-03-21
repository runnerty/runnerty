# Usage (Application) - Runnerty

## Executions options

```
-v, --version: get runnerty version
-c, --config <path>: set config path. defaults to ${configFilePath}.
-p, --plan <path>: Overwrite path file plan of config file.
-P, --plan <path>: Overwrite path file plan of config file.
-r, --restore: Restore backup plan (experimental).
-password, --password <password>: Master cryptor password.
-e, --encrypt <password_to_encrypt>: Util: Encrypt password (to use crypted_password in config instead of literal password)
-m, --memorylimit <memoryLimitMb>: Set default memory space limit for Runnerty (--max-old-space-size). It is necessary to restart Runnerty.
-f, --force_chain_exec <chainId>: Force chain execution (For development tests).
--end End runnerty on force chain execution (-f) (For development tests).
--input_values <inputValues>: Input values for force chain execution (-f) (For development tests).
--custom_values <customValues>: Custom values for force chain execution (-f) (For development tests).
--config_user <config_user> User for remote (url) config file (Basic Auth User)
--config_password <config_password> Password for remote (url) config file (Basic Auth Password)
-h, --help output usage information
```

### Samples

```bash
runnerty -c /etc/runnerty/config.json -p /user/workdir/other_plan.json -f CHAIN_ONE --custom_values {\"YYYY\":\"1986\"} --end
```

```bash
runnerty -c /etc/runnerty/config.json -p /user/workdir/other_plan.json -f CHAIN_ONE --custom_values '{"YYYY":"1986"}' --end
```

```bash
runnerty -c /etc/runnerty/config.json -p /user/workdir/other_plan.json -f CHAIN_ONE --custom_values '{"YYYY":"1986"}' --input_values '[{"KEY_1":"1-1", "KEY_2":"1-2"},{"KEY_1":"2-1", "KEY_2":"2-2"}]' --end
```
