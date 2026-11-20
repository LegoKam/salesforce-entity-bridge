# Salesforce Entity Bridge — Experience Workspace plugin

An Edge Delivery Services / Experience Workspace plugin that connects to Salesforce, lists available entities (Lead, Contact, …), lets authors pick fields and HTML control types, then inserts an `sf-form` block onto the page. Published forms submit to Salesforce through **Adobe App Builder** (I/O Runtime). Connection details live in the organisation’s da.live **secrets** sheet and in App Builder `.env` — never in page content or git.

Plugin files live in [`tools/salesforce-entity-bridge/`](tools/salesforce-entity-bridge/). Runtime actions live in [`appbuilder/`](appbuilder/).

## Environments

- Preview: https://main--salesforce-entity-bridge--LegoKam.aem.page/
- Live: https://main--salesforce-entity-bridge--LegoKam.aem.live/

Replace `LegoKam` / `salesforce-entity-bridge` with your org and site names if this repo was forked.

## What you get

- **Settings** — Salesforce Connected App + App Builder URL stored in da.live `secrets`
- **Load entities** — createable sObjects from Salesforce (via App Builder)
- **Field picker** — choose fields and override HTML types (`text`, `email`, `select`, …)
- **Insert form** — writes an `sf-form` block into the document
- **Runtime submit** — visitor submissions create Salesforce records through App Builder

## Architecture

```
Authoring (da.live canvas)
  Plugin → App Builder /entities + /describe → Salesforce

Published site
  sf-form block → App Builder /submit → Salesforce (create sObject)
```

## Install

### 1. Clone and run locally

```sh
git clone https://github.com/LegoKam/salesforce-entity-bridge.git
cd salesforce-entity-bridge
npm i
npx -y @adobe/aem-cli up
```

Plugin page: `http://localhost:3000/tools/salesforce-entity-bridge/salesforce-entity-bridge.html`

### 2. Deploy App Builder actions

See [`appbuilder/README.md`](appbuilder/README.md). Copy `.env.example` → `.env`, fill Connected App values, then `aio app deploy`.

### 3. Register the plugin in da.live

1. Open the site config: [da.live/config#/legokam/salesforce-entity-bridge/](https://da.live/config#/legokam/salesforce-entity-bridge/)
2. Open the **library** sheet (create it if needed).
3. Add a row:

   | title                      | path                                                              | ref   |
   | -------------------------- | ----------------------------------------------------------------- | ----- |
   | Salesforce Entity Bridge   | `/tools/salesforce-entity-bridge/salesforce-entity-bridge.html`   |       |

   For **local development** before the code is on `main`:

   | title                      | path                                                                            | ref   |
   | -------------------------- | ------------------------------------------------------------------------------- | ----- |
   | Salesforce Entity Bridge   | `http://localhost:3000/tools/salesforce-entity-bridge/salesforce-entity-bridge.html` | local |

4. Save the config.

### 4. Open Experience Workspace

- Local: [da.live/canvas?ref=local#/legokam/salesforce-entity-bridge/index](https://da.live/canvas?ref=local#/legokam/salesforce-entity-bridge/index)
- Shipped: [da.live/canvas#/legokam/salesforce-entity-bridge/index](https://da.live/canvas#/legokam/salesforce-entity-bridge/index)

Open **Panels → Extensions → Salesforce Entity Bridge**.

## Configure secrets

In the plugin, open **Settings** and save:

| da.live secret key         | App Builder `.env` | Example |
| -------------------------- | ------------------ | ------- |
| `sf.instance-url`          | `SALESFORCE_INSTANCE_URL` | `https://YOUR_ORG.my.salesforce.com` |
| `sf.client-id`             | `SALESFORCE_CONSUMER_KEY` | Connected App consumer key |
| `sf.client-secret`         | `SALESFORCE_CONSUMER_SECRET` | Connected App consumer secret |
| `sf.oauth-authorize-url`   | `SALESFORCE_AUTHORIZATION_URL` | `https://login.salesforce.com/services/oauth2/authorize` |
| `sf.token-url`             | `SALESFORCE_TOKEN_URL` | `https://YOUR_ORG.my.salesforce.com/services/oauth2/token` |
| `sf.refresh-token`         | `SALESFORCE_REFRESH_TOKEN` | OAuth refresh token |
| `sf.scope`                 | `SALESFORCE_OAUTH_SCOPE` | `api chatter_api full id openid refresh_token visualforce web` |
| `sf.callback-url`          | `SALESFORCE_CALLBACK_URL` | App Builder OAuth callback URL |
| `sf.oauth-state`           | `SALESFORCE_OAUTH_STATE` | OAuth state |
| `sf.api-version`           | `SALESFORCE_API_VERSION` | `v59.0` |
| `sf.object-name`           | `SALESFORCE_OBJECT_NAME` | e.g. `salesforce_car_licence_details__c` |
| `sf.app-builder-url`       | *(plugin only)* | App Builder package base URL (…`/salesforce-entity-bridge`) |

You can also edit the org **secrets** sheet at [da.live/config#/legokam/](https://da.live/config#/legokam/) (`key` / `value` headers).

Mirror the same Salesforce values into `appbuilder/.env` (see `.env.example`) before deploying Runtime. Use **Test connection** after App Builder is deployed. Replace any `XX` placeholders for secret and refresh token.

**Security:** anyone who can read the org config can read these secrets. Published pages only store the App Builder submit URL, not client secret or refresh token.

## Use

1. Open **Settings**, save connection details + App Builder URL, **Test connection**.
2. **Load entities**, pick e.g. **Lead**.
3. Tick fields (required fields are pre-selected). Adjust HTML control types as needed.
4. **Build form**, then **Insert at cursor** (or replace selection).
5. Publish the page. Visitors submit → App Builder creates the Salesforce record.

## Develop

```sh
npx -y @adobe/aem-cli up   # http://localhost:3000
npm run lint
```

| Path | Role |
| ---- | ---- |
| `tools/salesforce-entity-bridge/` | Experience Workspace plugin |
| `blocks/sf-form/` | Page form block + submit wiring |
| `appbuilder/` | Adobe App Builder Runtime actions |

Useful SDK actions: `getSelection`, `sendHTML`. See [Developing apps & plugins](https://docs.da.live/developers/guides/developing-apps-and-plugins).

## Edge Delivery docs

1. [Developer Tutorial](https://www.aem.live/developer/tutorial)
2. [The Anatomy of a Project](https://www.aem.live/developer/anatomy-of-a-project)
3. [Markup, Sections, Blocks, and Auto Blocking](https://www.aem.live/developer/markup-sections-blocks)
