const { Core } = require('@adobe/aio-sdk');
const { sfFetch, jsonResponse, handleOptions } = require('../shared/salesforce');
const { errorResponse } = require('../shared/utils');

/**
 * List createable Salesforce sObjects for the authoring plugin.
 */
async function main(params) {
  const logger = Core.Logger('entities', { level: params.LOG_LEVEL || 'info' });

  if (params.__ow_method && String(params.__ow_method).toLowerCase() === 'options') {
    return handleOptions();
  }

  try {
    const data = await sfFetch(params, '/services/data/v59.0/sobjects');
    const entities = (data.sobjects || [])
      .filter((s) => s.createable && s.queryable && !s.deprecatedAndHidden)
      .map((s) => ({
        name: s.name,
        label: s.label,
        createable: s.createable,
        custom: s.custom,
      }));
    logger.info(`Returning ${entities.length} entities`);
    return jsonResponse(200, { entities });
  } catch (error) {
    return errorResponse(error.statusCode || 500, error.message, logger);
  }
}

exports.main = main;
