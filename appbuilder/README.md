# App Builder — Salesforce Entity Bridge

Adobe I/O Runtime web actions that:

| Action | Purpose |
| ------ | ------- |
| `entities` | List createable Salesforce sObjects (authoring plugin) |
| `describe` | Describe fields for one entity (authoring plugin) |
| `submit` | Create a Salesforce record from a published `sf-form` |

## Setup

1. Install the [Adobe I/O CLI](https://developer.adobe.com/app-builder/docs/getting_started/installation/) and log in to your App Builder project / workspace.
2. From this folder:

   ```sh
   cp .env.example .env
   # edit .env with Connected App values (replace XX placeholders)
   npm i
   aio app deploy
   ```

3. Copy the deployed package base URL (ending in `/salesforce-entity-bridge`) into the Experience Workspace plugin **Settings → App Builder base URL**.

Example action URLs after deploy:

```
https://<namespace>.adobeioruntime.net/api/v1/web/<package>/salesforce-entity-bridge/entities
https://<namespace>.adobeioruntime.net/api/v1/web/<package>/salesforce-entity-bridge/describe
https://<namespace>.adobeioruntime.net/api/v1/web/<package>/salesforce-entity-bridge/submit
```

## `.env` keys

| Variable | Notes |
| -------- | ----- |
| `SALESFORCE_CONSUMER_KEY` | Connected App consumer key |
| `SALESFORCE_CONSUMER_SECRET` | Connected App consumer secret |
| `SALESFORCE_REFRESH_TOKEN` | OAuth refresh token |
| `SALESFORCE_AUTHORIZATION_URL` | Usually `https://login.salesforce.com/services/oauth2/authorize` |
| `SALESFORCE_TOKEN_URL` | `https://{instance}/services/oauth2/token` |
| `SALESFORCE_CALLBACK_URL` | Connected App callback (App Builder OAuth helper) |
| `SALESFORCE_OAUTH_STATE` | OAuth `state` value used when obtaining the refresh token |
| `SALESFORCE_INSTANCE_URL` | `https://{org}.my.salesforce.com` |
| `SALESFORCE_API_VERSION` | e.g. `v59.0` |
| `SALESFORCE_OBJECT_NAME` | Preferred default sObject (shown first in entity list) |
| `SALESFORCE_OAUTH_SCOPE` | Space-separated scopes |

Keep the same values in the da.live org `secrets` sheet (plugin Settings). Do not commit `.env` or put client secret / refresh token into page content or git.
