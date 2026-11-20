/*
 * Salesforce OAuth authorization-code callback.
 * Same flow as securgov/demo-open-auth salesforce-oauth-callback:
 * exchange ?code=… for a refresh_token to store in .env.
 */

const fetch = require('node-fetch');
const { Core } = require('@adobe/aio-sdk');
const {
  isOptions,
  jsonResponse,
  optionsResponse,
  methodOf,
} = require('../shared/utils');

function missingConfiguration(params) {
  const required = [
    'SALESFORCE_CONSUMER_KEY',
    'SALESFORCE_CONSUMER_SECRET',
    'SALESFORCE_TOKEN_URL',
    'SALESFORCE_CALLBACK_URL',
    'SALESFORCE_OAUTH_STATE',
  ];
  return required.filter((key) => !String(params[key] || '').trim() || params[key] === 'XX');
}

async function exchangeAuthorizationCode(params) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: params.SALESFORCE_CONSUMER_KEY,
    client_secret: params.SALESFORCE_CONSUMER_SECRET,
    redirect_uri: params.SALESFORCE_CALLBACK_URL,
    code: params.code,
  });
  const response = await fetch(params.SALESFORCE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error('Salesforce authorization code exchange failed');
    error.status = response.status;
    error.details = result;
    throw error;
  }
  return result;
}

async function main(params) {
  const logger = Core.Logger('oauth-callback', { level: params.LOG_LEVEL || 'info' });

  if (isOptions(params)) return optionsResponse();
  if (methodOf(params) !== 'GET') {
    return jsonResponse(405, { status: 'failure', message: 'Method not allowed' }, { Allow: 'GET' });
  }

  const missing = missingConfiguration(params);
  if (missing.length) {
    logger.error(`Missing Salesforce OAuth configuration: ${missing.join(', ')}`);
    return jsonResponse(500, {
      status: 'failure',
      message: 'Salesforce OAuth callback is not configured',
    });
  }
  if (params.error) {
    return jsonResponse(400, {
      status: 'failure',
      message: String(params.error_description || params.error),
    });
  }
  if (!params.code) {
    return jsonResponse(400, { status: 'failure', message: 'Missing authorization code' });
  }
  if (params.state !== params.SALESFORCE_OAUTH_STATE) {
    return jsonResponse(400, { status: 'failure', message: 'Invalid OAuth state' });
  }

  try {
    const tokens = await exchangeAuthorizationCode(params);
    if (!tokens.refresh_token) {
      return jsonResponse(400, {
        status: 'failure',
        message: 'Salesforce did not return a refresh token. Re-authorize with refresh_token scope.',
      });
    }
    return jsonResponse(200, {
      status: 'success',
      message: 'Copy refreshToken to SALESFORCE_REFRESH_TOKEN in .env, then redeploy.',
      refreshToken: tokens.refresh_token,
      instanceUrl: tokens.instance_url,
    }, {
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    });
  } catch (error) {
    logger.error(`${error.message} (${error.status || 500})`);
    return jsonResponse(error.status || 502, {
      status: 'failure',
      message: error.message,
      errors: error.details,
    }, {
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    });
  }
}

exports.main = main;
exports.missingConfiguration = missingConfiguration;
