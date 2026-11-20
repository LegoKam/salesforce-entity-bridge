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
   # edit .env with Connected App values
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

## Secrets

Keep Salesforce credentials in Runtime `.env` / workspace secrets **and** in the da.live org `secrets` sheet (for the authoring plugin). Do not put client secret or refresh token into page content or git.
