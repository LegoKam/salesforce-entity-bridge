const { Core } = require('@adobe/aio-sdk');
const { sfFetch, jsonResponse, handleOptions, credentials } = require('../shared/salesforce');
const { errorResponse } = require('../shared/utils');

/**
 * Create a Salesforce record from a published sf-form submission.
 * Body: { entity: "Lead", fields: { FirstName, LastName, ... } }
 *
 * Credentials come from Runtime action inputs (.env). Client-posted
 * SALESFORCE_* keys are ignored so a public form cannot override secrets.
 */
async function main(params) {
  const logger = Core.Logger('submit', { level: params.LOG_LEVEL || 'info' });

  if (params.__ow_method && String(params.__ow_method).toLowerCase() === 'options') {
    return handleOptions();
  }

  const { defaultObject } = credentials(params);
  const entity = params.entity || defaultObject;
  const fields = params.fields || params.data || {};
  if (!entity) {
    return errorResponse(400, 'Missing entity.', logger);
  }
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return errorResponse(400, 'Missing fields object.', logger);
  }

  const authParams = {
    LOG_LEVEL: params.LOG_LEVEL,
    SALESFORCE_INSTANCE_URL: params.SALESFORCE_INSTANCE_URL,
    SALESFORCE_CONSUMER_KEY: params.SALESFORCE_CONSUMER_KEY,
    SALESFORCE_CONSUMER_SECRET: params.SALESFORCE_CONSUMER_SECRET,
    SALESFORCE_TOKEN_URL: params.SALESFORCE_TOKEN_URL,
    SALESFORCE_REFRESH_TOKEN: params.SALESFORCE_REFRESH_TOKEN,
    SALESFORCE_OAUTH_SCOPE: params.SALESFORCE_OAUTH_SCOPE,
    SALESFORCE_API_VERSION: params.SALESFORCE_API_VERSION,
    SALESFORCE_OBJECT_NAME: params.SALESFORCE_OBJECT_NAME,
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
      `/sobjects/${safe}`,
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
