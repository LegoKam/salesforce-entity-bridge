/*
 * Shared Salesforce OAuth + REST helpers for App Builder web actions.
 * Credentials come from Runtime inputs mapped from .env (SALESFORCE_*).
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
    first(params.SALESFORCE_INSTANCE_URL, params.SF_INSTANCE_URL, params.instanceUrl),
  ).replace(/\/+$/, '');
  const normalised = instanceUrl
    ? (/^https?:\/\//i.test(instanceUrl) ? instanceUrl : `https://${instanceUrl}`)
    : '';
  let apiVersion = first(params.SALESFORCE_API_VERSION, params.SF_API_VERSION, 'v59.0');
  apiVersion = String(apiVersion).replace(/^\/+|\/+$/g, '');
  if (apiVersion && !apiVersion.startsWith('v')) apiVersion = `v${apiVersion}`;

  return {
    instanceUrl: normalised,
    clientId: first(params.SALESFORCE_CONSUMER_KEY, params.SF_CLIENT_ID, params.clientId),
    clientSecret: first(
      params.SALESFORCE_CONSUMER_SECRET,
      params.SF_CLIENT_SECRET,
      params.clientSecret,
    ),
    tokenUrl: first(params.SALESFORCE_TOKEN_URL, params.SF_TOKEN_URL, params.tokenUrl),
    refreshToken: first(
      params.SALESFORCE_REFRESH_TOKEN,
      params.SF_REFRESH_TOKEN,
      params.refreshToken,
    ),
    scope: stripQuotes(first(
      params.SALESFORCE_OAUTH_SCOPE,
      params.SF_SCOPE,
      params.scope,
    )),
    authorizeUrl: first(
      params.SALESFORCE_AUTHORIZATION_URL,
      params.SF_OAUTH_AUTHORIZE_URL,
      params.oauthAuthorizeUrl,
    ),
    callbackUrl: first(params.SALESFORCE_CALLBACK_URL, params.callbackUrl),
    oauthState: first(params.SALESFORCE_OAUTH_STATE, params.oauthState),
    apiVersion,
    defaultObject: first(params.SALESFORCE_OBJECT_NAME, params.objectName),
  };
}

function missingCreds(creds) {
  const needed = ['instanceUrl', 'clientId', 'clientSecret', 'tokenUrl', 'refreshToken'];
  return needed.filter((k) => !creds[k] || creds[k] === 'XX');
}

async function getAccessToken(params) {
  const creds = credentials(params);
  const missing = missingCreds(creds);
  if (missing.length) {
    const error = new Error(`Missing Salesforce credentials: ${missing.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: creds.refreshToken,
  });

  const resp = await fetch(creds.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.access_token) {
    const error = new Error(
      data.error_description || data.error || `Salesforce token exchange failed (${resp.status})`,
    );
    error.statusCode = 502;
    throw error;
  }
  return {
    accessToken: data.access_token,
    instanceUrl: (data.instance_url || creds.instanceUrl).replace(/\/+$/, ''),
    apiVersion: creds.apiVersion,
    defaultObject: creds.defaultObject,
  };
}

function apiPath(params, relativePath) {
  const { apiVersion } = credentials(params);
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  if (path.startsWith('/services/')) return path;
  return `/services/data/${apiVersion}${path}`;
}

async function sfFetch(params, path, { method = 'GET', body } = {}) {
  const { accessToken, instanceUrl } = await getAccessToken(params);
  const url = `${instanceUrl}${apiPath(params, path)}`;
  const resp = await fetch(url, {
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
    error.statusCode = resp.status;
    throw error;
  }
  return data;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
    body,
  };
}

function handleOptions() {
  return {
    statusCode: 204,
    headers: corsHeaders(),
    body: {},
  };
}

module.exports = {
  credentials,
  getAccessToken,
  apiPath,
  sfFetch,
  jsonResponse,
  handleOptions,
  corsHeaders,
};
