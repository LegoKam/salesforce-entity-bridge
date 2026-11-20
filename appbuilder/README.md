# App Builder — Salesforce Entity Bridge

Adobe I/O project **SalesforceEntityBridge** (`374SalmonBooby`) · org `31876` · workspace **Production**.

| | |
| --- | --- |
| Runtime | `https://31876-374salmonbooby.adobeioruntime.net` |
| Static / web | `https://31876-374salmonbooby.adobeio-static.net` |
| Project file | `374SalmonBooby-31876-Production.json` (local; gitignored) |

## Actions

| Action | Purpose |
| ------ | ------- |
| `entities` | List createable Salesforce sObjects (authoring plugin) |
| `describe` | Describe fields for one entity (authoring plugin) |
| `submit` | Create a Salesforce record (EDS `sf-form` or AEM Forms REST submit) |
| `oauth-callback` | Exchange authorization `code` for a refresh token |

After deploy, package URLs look like:

```
https://31876-374salmonbooby.adobeioruntime.net/api/v1/web/salesforce-entity-bridge/entities
https://31876-374salmonbooby.adobeioruntime.net/api/v1/web/salesforce-entity-bridge/describe
https://31876-374salmonbooby.adobeioruntime.net/api/v1/web/salesforce-entity-bridge/submit
https://31876-374salmonbooby.adobeio-static.net/api/v1/web/salesforce-entity-bridge/oauth-callback
```

Plugin **Settings → App Builder base URL**:

```
https://31876-374salmonbooby.adobeioruntime.net/api/v1/web/salesforce-entity-bridge
```

Submission behaviour mirrors securgov `demo-open-auth` `salesforce-submit`:

- Accepts flat field maps, `{ entity, fields }`, AEM Forms `data` JSON, and multipart `data`
- Allowlists `salesforce_car_licence_details__c` fields (Name__c, Email_Address__c, …)
- Validates required name + email for that object
- Returns `{ status: "success"|"failure", id, message, errors }`

## Setup

1. Install the [Adobe I/O CLI](https://developer.adobe.com/app-builder/docs/getting_started/installation/) and log in.
2. From this folder, select the project (uses `.aio` or the downloaded Console JSON):

   ```sh
   aio app use 374SalmonBooby-31876-Production.json
   # or, if .aio is already present:
   aio app use
   ```

3. Configure secrets:

   ```sh
   cp .env.example .env
   # edit .env — Connected App values + callback URL for this project
   npm i
   aio app deploy
   ```

4. In the Connected App, set the callback URL to:

   `https://31876-374salmonbooby.adobeio-static.net/api/v1/web/salesforce-entity-bridge/oauth-callback`

5. Paste the App Builder base URL into the Experience Workspace plugin **Settings**.

## `.env` keys

| Variable | Notes |
| -------- | ----- |
| `SALESFORCE_CONSUMER_KEY` | Connected App consumer key |
| `SALESFORCE_CONSUMER_SECRET` | Connected App consumer secret |
| `SALESFORCE_REFRESH_TOKEN` | OAuth refresh token |
| `SALESFORCE_AUTHORIZATION_URL` | Usually `https://login.salesforce.com/services/oauth2/authorize` |
| `SALESFORCE_TOKEN_URL` | `https://{instance}/services/oauth2/token` |
| `SALESFORCE_CALLBACK_URL` | This project's `oauth-callback` URL |
| `SALESFORCE_OAUTH_STATE` | OAuth `state` value used when obtaining the refresh token |
| `SALESFORCE_INSTANCE_URL` | `https://{org}.my.salesforce.com` |
| `SALESFORCE_API_VERSION` | e.g. `v59.0` |
| `SALESFORCE_OBJECT_NAME` | Preferred default sObject |
| `SALESFORCE_OAUTH_SCOPE` | Space-separated scopes |

Do not commit `.env`, `.aio`, or `*-Production.json`. Keep the same Salesforce values in the da.live org `secrets` sheet (plugin Settings).
