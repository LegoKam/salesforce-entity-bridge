/*
 * Shared Salesforce OAuth + REST helpers for App Builder web actions.
 * Patterns drawn from securgov/demo-open-auth salesforce-* actions.
 */

const fetch = require('node-fetch');

function first(...values) {
  return values.find((v) => v != null && String(v).trim() !== '') || '';
}

function stripQuotes(value) {
  return String(value || '').trim().replace(/^["']|["']$/g, '');
}

function credentials(params) {
  const instanceUrl = String(
    first(params.SALESFORCE_INSTANCE_URL, params.instanceUrl),
  ).replace(/\/+$/, '');
  const normalised = instanceUrl
    ? (/^https?:\/\//i.test(instanceUrl) ? instanceUrl : `https://${instanceUrl}`)
    : '';
  let apiVersion = first(params.SALESFORCE_API_VERSION, 'v59.0');
  apiVersion = String(apiVersion).replace(/^\/+|\/+$/g, '');
  if (apiVersion && !apiVersion.startsWith('v')) apiVersion = `v${apiVersion}`;

  const objectName = String(
    first(params.SALESFORCE_OBJECT_NAME, params.objectName, params.entity),
  ).replace(/[^a-zA-Z0-9_]/g, '');

  return {
    instanceUrl: normalised,
    clientId: first(params.SALESFORCE_CONSUMER_KEY, params.clientId),
    clientSecret: first(params.SALESFORCE_CONSUMER_SECRET, params.clientSecret),
    tokenUrl: first(params.SALESFORCE_TOKEN_URL, params.tokenUrl),
    refreshToken: first(params.SALESFORCE_REFRESH_TOKEN, params.refreshToken),
    scope: stripQuotes(first(params.SALESFORCE_OAUTH_SCOPE, params.scope)),
    authorizeUrl: first(params.SALESFORCE_AUTHORIZATION_URL, params.oauthAuthorizeUrl),
    callbackUrl: first(params.SALESFORCE_CALLBACK_URL, params.callbackUrl),
    oauthState: first(params.SALESFORCE_OAUTH_STATE, params.oauthState),
    apiVersion,
    objectName,
  };
}

function missingConfig(params) {
  const required = [
    'SALESFORCE_CONSUMER_KEY',
    'SALESFORCE_CONSUMER_SECRET',
    'SALESFORCE_REFRESH_TOKEN',
    'SALESFORCE_TOKEN_URL',
    'SALESFORCE_INSTANCE_URL',
  ];
  return required.filter((key) => {
    const value = String(params[key] || '').trim();
    return !value || value === 'XX';
  });
}

async function getAccessToken(params) {
  const missing = missingConfig(params);
  if (missing.length) {
    const error = new Error('Salesforce integration is not configured');
    error.status = 500;
    error.missing = missing;
    throw error;
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: params.SALESFORCE_CONSUMER_KEY,
    client_secret: params.SALESFORCE_CONSUMER_SECRET,
    refresh_token: params.SALESFORCE_REFRESH_TOKEN,
  });

  const resp = await fetch(params.SALESFORCE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.access_token) {
    const error = new Error('Salesforce OAuth token exchange failed');
    error.status = resp.status;
    error.details = data;
    throw error;
  }
  return {
    accessToken: data.access_token,
    instanceUrl: String(data.instance_url || params.SALESFORCE_INSTANCE_URL).replace(/\/+$/, ''),
  };
}

function dataBaseUrl(params, instanceUrl) {
  const { apiVersion } = credentials(params);
  return `${instanceUrl}/services/data/${apiVersion}`;
}

async function sfFetch(params, path, { method = 'GET', body } = {}) {
  const { accessToken, instanceUrl } = await getAccessToken(params);
  const finalUrl = path.startsWith('http')
    ? path
    : (path.startsWith('/services/')
      ? `${instanceUrl}${path}`
      : `${dataBaseUrl(params, instanceUrl)}${path.startsWith('/') ? path : `/${path}`}`);

  const resp = await fetch(finalUrl, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!resp.ok) {
    const sfMessage = Array.isArray(data)
      ? data.map((e) => e.message || e.errorCode).join('; ')
      : (data?.message || data?.error || text);
    const error = new Error(sfMessage || `Salesforce API ${resp.status}`);
    error.status = resp.status;
    error.details = data;
    throw error;
  }
  return data;
}

async function createRecord(params, objectName, payload) {
  const safeObject = String(objectName || '').replace(/[^a-zA-Z0-9_]/g, '');
  if (!safeObject) {
    const error = new Error('Missing Salesforce object name');
    error.status = 400;
    throw error;
  }
  return sfFetch(params, `/sobjects/${safeObject}`, { method: 'POST', body: payload });
}

module.exports = {
  credentials,
  missingConfig,
  getAccessToken,
  dataBaseUrl,
  sfFetch,
  createRecord,
};
