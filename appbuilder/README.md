# App Builder — Salesforce Entity Bridge

Adobe I/O **App Builder** project **SfEntityBridge** (`Salesforce Entity Bridge`) · org `31876` · workspace **Production**.

> Note: the earlier `374SalmonBooby` Console project is type **default** (`runtime_enabled: false`) and cannot host actions. Use **SfEntityBridge** instead.

| | |
| --- | --- |
| Runtime | `https://31876-sfentitybridge.adobeioruntime.net` |
| Static / web | `https://31876-sfentitybridge.adobeio-static.net` |
| Namespace | `31876-sfentitybridge` |

## Actions

| Action | URL |
| ------ | --- |
| `entities` | `…/salesforce-entity-bridge/entities` |
| `describe` | `…/salesforce-entity-bridge/describe` |
| `submit` | `…/salesforce-entity-bridge/submit` |
| `oauth-callback` | `…/salesforce-entity-bridge/oauth-callback` |

Plugin **Settings → App Builder base URL**:

```
https://31876-sfentitybridge.adobeioruntime.net/api/v1/web/salesforce-entity-bridge
```

Salesforce Connected App **Callback URL**:

```
https://31876-sfentitybridge.adobeio-static.net/api/v1/web/salesforce-entity-bridge/oauth-callback
```

## Setup

```sh
aio app use SfEntityBridge-Production.json   # or: aio console workspace download && aio app use …
# ensure .env has SALESFORCE_* and AIO_runtime_*
npm i
aio app deploy
```

Do not commit `.env`, `.aio`, or `*-Production.json` / Console download JSON.
