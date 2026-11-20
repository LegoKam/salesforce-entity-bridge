const { sfFetch, credentials, missingConfig } = require('../shared/salesforce');
const { createLogger } = require('../shared/logger');
const {
  isOptions,
  jsonResponse,
  optionsResponse,
  methodOf,
} = require('../shared/utils');

/**
 * List createable Salesforce sObjects for the authoring plugin.
 */
async function main(params) {
  const logger = createLogger('entities', params.LOG_LEVEL || 'info');

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

  try {
    const { objectName: defaultObject } = credentials(params);
    const data = await sfFetch(params, '/sobjects');
    let entities = (data.sobjects || [])
      .filter((s) => s.createable && s.queryable && !s.deprecatedAndHidden)
      .map((s) => ({
        name: s.name,
        label: s.label,
        createable: s.createable,
        custom: s.custom,
      }));

    if (defaultObject) {
      const preferred = entities.find((e) => e.name === defaultObject);
      if (preferred) {
        entities = [preferred, ...entities.filter((e) => e.name !== defaultObject)];
      }
    }

    logger.info(`Returning ${entities.length} entities`);
    return jsonResponse(200, {
      status: 'success',
      entities,
      defaultObject: defaultObject || null,
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
