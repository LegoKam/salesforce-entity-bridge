/*
 * Organisation-wide Salesforce connection settings, stored as key/value rows
 * in a `secrets` sheet of the org's da.live config
 * (https://da.live/config#/{org}/). Access is governed by the org's CONFIG
 * permissions.
 *
 * The same values must also be set as App Builder action inputs / .env so
 * form submissions never expose credentials to the browser.
 */

const DA_ADMIN = 'https://admin.da.live';

export const SHEET_NAME = 'secrets';

export const KEYS = {
  instanceUrl: 'sf.instance-url',
  clientId: 'sf.client-id',
  clientSecret: 'sf.client-secret',
  oauthAuthorizeUrl: 'sf.oauth-authorize-url',
  tokenUrl: 'sf.token-url',
  refreshToken: 'sf.refresh-token',
  scope: 'sf.scope',
  appBuilderUrl: 'sf.app-builder-url',
};

const DEFAULTS = {
  oauthAuthorizeUrl: 'https://login.salesforce.com/services/oauth2/authorize',
  scope: 'api chatter_api full id openid refresh_token visualforce web',
};

const toSheet = (data) => ({
  total: data.length,
  limit: data.length,
  offset: 0,
  data,
});

const isMultiSheet = (json) => json?.[':type'] === 'multi-sheet';

const singleSheetName = (json) => json?.[':sheetname'] || 'data';

function getSheetRows(json, name) {
  if (!json) return [];
  if (isMultiSheet(json)) return json[name]?.data || [];
  if (singleSheetName(json) === name && Array.isArray(json.data)) return json.data;
  return [];
}

/** Read the plugin's settings out of a da.live config JSON. */
export function readSettings(json) {
  const rows = getSheetRows(json, SHEET_NAME);
  const settings = { ...DEFAULTS };
  Object.entries(KEYS).forEach(([prop, key]) => {
    const row = rows.find((r) => r.key === key);
    if (row?.value) settings[prop] = String(row.value);
    else if (settings[prop] === undefined) settings[prop] = '';
  });
  return settings;
}

/**
 * Return a copy of the config JSON with the plugin's rows written into the
 * `secrets` sheet. Every other sheet, row and property is carried over as is.
 * A setting that is `undefined` keeps its stored value.
 */
export function upsertSettings(json, settings) {
  const rows = getSheetRows(json, SHEET_NAME).map((row) => ({ ...row }));
  Object.entries(KEYS).forEach(([prop, key]) => {
    const value = settings[prop];
    if (value === undefined) return;
    const existing = rows.find((r) => r.key === key);
    if (existing) existing.value = value;
    else rows.push({ key, value });
  });
  const sheet = toSheet(rows);

  if (!json) {
    return {
      data: toSheet([]),
      [SHEET_NAME]: sheet,
      ':names': ['data', SHEET_NAME],
      ':version': 3,
      ':type': 'multi-sheet',
    };
  }

  if (isMultiSheet(json)) {
    const names = json[':names'] || [];
    return {
      ...json,
      [SHEET_NAME]: sheet,
      ':names': names.includes(SHEET_NAME) ? names : [...names, SHEET_NAME],
    };
  }

  const existingName = singleSheetName(json);
  if (existingName === SHEET_NAME) return { ...json, ...sheet };

  // A single-sheet config becomes a multi-sheet one to make room for `secrets`.
  const { ':sheetname': _name, ':type': _type, ...rest } = json;
  const meta = {};
  const first = {};
  Object.entries(rest).forEach(([key, value]) => {
    if (key.startsWith(':')) meta[key] = value;
    else first[key] = value;
  });
  return {
    [existingName]: first,
    [SHEET_NAME]: sheet,
    ...meta,
    ':names': [existingName, SHEET_NAME],
    ':version': 3,
    ':type': 'multi-sheet',
  };
}

function httpError(action, resp) {
  const denied = resp.status === 401 || resp.status === 403;
  const reason = denied
    ? 'you do not have permission for this organisation\'s config'
    : `da.live responded with ${resp.status}`;
  const error = new Error(`Could not ${action} the settings: ${reason}.`);
  error.status = resp.status;
  return error;
}

async function fetchConfig(org, token) {
  const resp = await fetch(`${DA_ADMIN}/config/${org}/`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (resp.status === 404) return null;
  if (!resp.ok) throw httpError('load', resp);
  const text = await resp.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Could not load the settings: the organisation config is not valid JSON.');
  }
}

export async function loadSettings({ org, token }) {
  return readSettings(await fetchConfig(org, token));
}

/**
 * Save settings for the organisation. The config is re-read immediately before
 * writing, and nothing is written if that read fails.
 */
export async function saveSettings({ org, token, settings }) {
  const current = await fetchConfig(org, token);
  const next = upsertSettings(current, settings);
  const body = new FormData();
  body.append('config', JSON.stringify(next));
  const resp = await fetch(`${DA_ADMIN}/config/${org}/`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (!resp.ok) throw httpError('save', resp);
  return readSettings(next);
}

export function isConfigured(settings) {
  return !!(
    settings?.instanceUrl
    && settings?.clientId
    && settings?.clientSecret
    && settings?.tokenUrl
    && settings?.refreshToken
    && settings?.appBuilderUrl
  );
}

/** Normalise an instance host to https://host with no trailing slash. */
export function normaliseInstanceUrl(value) {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, '');
  return `https://${raw}`;
}
