const { Core } = require('@adobe/aio-sdk');
const { sfFetch, jsonResponse, handleOptions, credentials } = require('../shared/salesforce');
const { errorResponse } = require('../shared/utils');

/**
 * Describe one Salesforce sObject (fields for the form builder).
 */
async function main(params) {
  const logger = Core.Logger('describe', { level: params.LOG_LEVEL || 'info' });

  if (params.__ow_method && String(params.__ow_method).toLowerCase() === 'options') {
    return handleOptions();
  }

  const { defaultObject } = credentials(params);
  const entity = params.entity || params.name || defaultObject;
  if (!entity) {
    return errorResponse(400, 'Missing entity name.', logger);
  }

  try {
    const safe = encodeURIComponent(String(entity));
    const data = await sfFetch(params, `/sobjects/${safe}/describe`);
    logger.info(`Described ${data.name} (${(data.fields || []).length} fields)`);
    return jsonResponse(200, {
      name: data.name,
      label: data.label,
      fields: data.fields || [],
    });
  } catch (error) {
    return errorResponse(error.statusCode || 500, error.message, logger);
  }
}

exports.main = main;
