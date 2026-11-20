/*
 * Shared Salesforce OAuth + REST helpers for App Builder web actions.
 * Prefers Runtime inputs / .env; falls back to values posted by the authoring plugin.
 */

const fetch = require('node-fetch');

function pick(params, key) {
  return params?.[key] || params?.[key.replace(/^SF_/, '')] || '';
}

function credentials(params) {
  const instanceUrl = String(
    pick(params, 'SF_INSTANCE_URL') || pick(params, 'instanceUrl') || '',
  ).replace(/\/+$/, '');
  const normalised = instanceUrl
    ? (/^https?:\/\//i.test(instanceUrl) ? instanceUrl : `https://${instanceUrl}`)
    : '';
  return {
    instanceUrl: normalised,
    clientId: pick(params, 'SF_CLIENT_ID') || pick(params, 'clientId'),
    clientSecret: pick(params, 'SF_CLIENT_SECRET') || pick(params, 'clientSecret'),
    tokenUrl: pick(params, 'SF_TOKEN_URL') || pick(params, 'tokenUrl'),
    refreshToken: pick(params, 'SF_REFRESH_TOKEN') || pick(params, 'refreshToken'),
    scope: pick(params, 'SF_SCOPE') || pick(params, 'scope'),
  };
}

function missingCreds(creds) {
  const needed = ['instanceUrl', 'clientId', 'clientSecret', 'tokenUrl', 'refreshToken'];
  return needed.filter((k) => !creds[k]);
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
  };
}

async function sfFetch(params, path, { method = 'GET', body } = {}) {
  const { accessToken, instanceUrl } = await getAccessToken(params);
  const url = `${instanceUrl}${path.startsWith('/') ? path : `/${path}`}`;
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
  sfFetch,
  jsonResponse,
  handleOptions,
  corsHeaders,
};
