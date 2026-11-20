const { sfFetch, credentials, missingConfig } = require('../shared/salesforce');
const { createLogger } = require('../shared/logger');
const {
  isOptions,
  jsonResponse,
  optionsResponse,
  methodOf,
  parseJsonBody,
} = require('../shared/utils');

/**
 * Describe one Salesforce sObject (fields for the form builder).
 */
async function main(params) {
  const logger = createLogger('describe', params.LOG_LEVEL || 'info');

  if (isOptions(params)) return optionsResponse();
  if (methodOf(params) !== 'POST' && methodOf(params) !== 'GET') {
    return jsonResponse(405, { status: 'failure', message: 'Method not allowed' }, { Allow: 'GET, POST, OPTIONS' });
  }

  const missing = missingConfig(params);
  if (missing.length) {
    logger.error(`Missing Salesforce configuration: ${missing.join(', ')}`);
    return jsonResponse(500, {
      status: 'failure',
      message: 'Salesforce integration is not configured',
    });
  }

  const input = parseJsonBody(params);
  const { objectName: defaultObject } = credentials(params);
  const entity = input.entity || input.name || defaultObject;
  if (!entity) {
    return jsonResponse(400, { status: 'failure', message: 'Missing entity name.' });
  }

  try {
    const safe = encodeURIComponent(String(entity).replace(/[^a-zA-Z0-9_]/g, ''));
    const data = await sfFetch(params, `/sobjects/${safe}/describe`);
    logger.info(`Described ${data.name} (${(data.fields || []).length} fields)`);
    return jsonResponse(200, {
      status: 'success',
      name: data.name,
      label: data.label,
      fields: data.fields || [],
    });
  } catch (error) {
    logger.error(`${error.message} (${error.status || 500})`);
    return jsonResponse(error.status || 502, {
      status: 'failure',
      message: error.message,
      errors: error.details,
    });
  }
}

exports.main = main;
