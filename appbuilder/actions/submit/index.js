const { Core } = require('@adobe/aio-sdk');
const { sfFetch, jsonResponse, handleOptions } = require('../shared/salesforce');
const { errorResponse } = require('../shared/utils');

/**
 * Create a Salesforce record from a published sf-form submission.
 * Body: { entity: "Lead", fields: { FirstName, LastName, ... } }
 *
 * Credentials come from Runtime action inputs (app.config.yaml / .env).
 * Client-posted SF_* keys are ignored so a public form cannot override secrets.
 */
async function main(params) {
  const logger = Core.Logger('submit', { level: params.LOG_LEVEL || 'info' });

  if (params.__ow_method && String(params.__ow_method).toLowerCase() === 'options') {
    return handleOptions();
  }

  const entity = params.entity;
  const fields = params.fields || params.data || {};
  if (!entity) {
    return errorResponse(400, 'Missing entity.', logger);
  }
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return errorResponse(400, 'Missing fields object.', logger);
  }

  // Only pass through configured Runtime inputs for auth — not POST body overrides.
  // Adobe Runtime merges JSON body into params; re-bind from the same SF_* names
  // that app.config.yaml maps from .env (deploy-time values).
  const authParams = {
    LOG_LEVEL: params.LOG_LEVEL,
    SF_INSTANCE_URL: params.SF_INSTANCE_URL,
    SF_CLIENT_ID: params.SF_CLIENT_ID,
    SF_CLIENT_SECRET: params.SF_CLIENT_SECRET,
    SF_TOKEN_URL: params.SF_TOKEN_URL,
    SF_REFRESH_TOKEN: params.SF_REFRESH_TOKEN,
    SF_SCOPE: params.SF_SCOPE,
  };

  try {
    const safe = encodeURIComponent(String(entity));
    const cleaned = {};
    Object.entries(fields).forEach(([key, value]) => {
      if (key.startsWith('_')) return;
      if (value === '' || value === undefined || value === null) return;
      cleaned[key] = value;
    });
    const created = await sfFetch(
      authParams,
      `/services/data/v59.0/sobjects/${safe}`,
      { method: 'POST', body: cleaned },
    );
    logger.info(`Created ${entity} ${created.id}`);
    return jsonResponse(200, {
      id: created.id,
      success: created.success !== false,
      entity,
      message: `Created ${entity}`,
    });
  } catch (error) {
    return errorResponse(error.statusCode || 500, error.message, logger);
  }
}

exports.main = main;
