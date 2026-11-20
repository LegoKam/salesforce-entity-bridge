/*
 * Create a Salesforce record from a published form submission.
 *
 * Input shapes accepted (from securgov/demo-open-auth salesforce-submit):
 *   1. Flat field map: { Name__c, Email_Address__c, … }
 *   2. Plugin shape:   { entity, fields: { … } }
 *   3. AEM Forms:      { data: "<json>" } with optional nested *Input object
 *   4. Multipart:      form-data part name="data" containing the same JSON
 *
 * Only Salesforce-like API field names are forwarded (allowlist / heuristic).
 */

const { createRecord, credentials, missingConfig } = require('../shared/salesforce');
const { createLogger } = require('../shared/logger');
const {
  isOptions,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
  parseJson,
  parseMultipartData,
  methodOf,
} = require('../shared/utils');

/** Known fields for salesforce_car_licence_details__c (demo-open-auth). */
const CAR_LICENCE_FIELDS = [
  'Name__c',
  'Email_Address__c',
  'Mobile_Number__c',
  'Held_Other_NSW_Licence_or_Photo_Card__c',
  'Licence_Number__c',
  'Previous_Licence_Expiry_Date__c',
  'Wear_Glasses_or_Contact_Lenses_for_Drivi__c',
  'Has_Epilepsy__c',
  'Has_Diabetes__c',
  'attribute__c',
];

const RESERVED_KEYS = new Set([
  'entity', 'fields', 'data', 'status', 'message', 'errors',
  'LOG_LEVEL', '__ow_method', '__ow_headers', '__ow_path', '__ow_body',
  'SALESFORCE_CONSUMER_KEY', 'SALESFORCE_CONSUMER_SECRET', 'SALESFORCE_REFRESH_TOKEN',
  'SALESFORCE_TOKEN_URL', 'SALESFORCE_INSTANCE_URL', 'SALESFORCE_API_VERSION',
  'SALESFORCE_OBJECT_NAME', 'SALESFORCE_OAUTH_SCOPE', 'SALESFORCE_AUTHORIZATION_URL',
  'SALESFORCE_CALLBACK_URL', 'SALESFORCE_OAUTH_STATE',
]);

function isSalesforceFieldName(name) {
  if (!name || RESERVED_KEYS.has(name) || name.startsWith('_')) return false;
  // Standard or custom API names: FirstName, Email, Name__c, My_Field__c
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(name);
}

function nestedInputKey(objectName) {
  if (!objectName) return null;
  // salesforce_car_licence_details__c → CarLicenceInput (demo convention)
  if (/car_licence/i.test(objectName)) return 'CarLicenceInput';
  const base = objectName.replace(/__c$/i, '').split('_').filter(Boolean);
  if (!base.length) return null;
  const pascal = base.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('');
  return `${pascal}Input`;
}

function extractSalesforceInput(params) {
  const input = parseJsonBody(params);
  const multipartData = parseMultipartData(params);
  const submittedData = parseJson(input.data) || multipartData || input;

  if (submittedData && typeof submittedData === 'object' && submittedData.fields
    && typeof submittedData.fields === 'object' && !Array.isArray(submittedData.fields)) {
    return {
      entity: submittedData.entity,
      record: submittedData.fields,
    };
  }

  const { objectName } = credentials(params);
  const nestedKey = nestedInputKey(objectName);
  if (nestedKey && submittedData && submittedData[nestedKey]) {
    return { entity: objectName, record: submittedData[nestedKey] };
  }
  // Common AEM Forms wrapper keys
  if (submittedData?.CarLicenceInput) {
    return { entity: objectName, record: submittedData.CarLicenceInput };
  }

  return { entity: submittedData?.entity || objectName, record: submittedData };
}

function buildSalesforcePayload(record, objectName) {
  const source = record && typeof record === 'object' ? record : {};
  const allowlist = /car_licence/i.test(objectName || '') ? CAR_LICENCE_FIELDS : null;

  if (allowlist) {
    return allowlist.reduce((payload, field) => {
      if (source[field] !== undefined && source[field] !== '') payload[field] = source[field];
      return payload;
    }, {});
  }

  return Object.entries(source).reduce((payload, [key, value]) => {
    if (!isSalesforceFieldName(key)) return payload;
    if (value === undefined || value === null || value === '') return payload;
    payload[key] = value;
    return payload;
  }, {});
}

function validatePayload(payload, objectName) {
  const errors = [];
  if (/car_licence/i.test(objectName || '')) {
    if (!String(payload.Name__c || '').trim()) errors.push('Name__c is required');
    if (!String(payload.Email_Address__c || '').trim()) {
      errors.push('Email_Address__c is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.Email_Address__c)) {
      errors.push('Email_Address__c must be a valid email address');
    }
  } else if (!Object.keys(payload).length) {
    errors.push('No Salesforce fields were submitted');
  }
  return errors;
}

function authParams(params) {
  return {
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
}

async function main(params) {
  const logger = createLogger('submit', params.LOG_LEVEL || 'info');

  if (isOptions(params)) return optionsResponse();
  if (methodOf(params) !== 'POST') {
    return jsonResponse(405, { status: 'failure', message: 'Method not allowed' }, { Allow: 'POST, OPTIONS' });
  }

  const missing = missingConfig(params);
  if (missing.length) {
    logger.error(`Missing Salesforce configuration: ${missing.join(', ')}`);
    return jsonResponse(500, {
      status: 'failure',
      message: 'Salesforce integration is not configured',
    });
  }

  const { entity: requestedEntity, record } = extractSalesforceInput(params);
  const { objectName: defaultObject } = credentials(params);
  const entity = String(requestedEntity || defaultObject || '')
    .replace(/[^a-zA-Z0-9_]/g, '');
  const payload = buildSalesforcePayload(record, entity);
  const validationErrors = validatePayload(payload, entity);
  if (validationErrors.length) {
    return jsonResponse(400, { status: 'failure', message: validationErrors.join('; ') });
  }

  try {
    const result = await createRecord(authParams(params), entity, payload);
    logger.info(`Created ${entity} ${result.id}`);
    return jsonResponse(201, {
      status: 'success',
      id: result.id,
      success: result.success !== false,
      entity,
      errors: result.errors || [],
      message: `Created ${entity}`,
    });
  } catch (error) {
    logger.error(`${error.message} (${error.status || 500})`);
    const statusCode = error.status >= 400 && error.status < 500 ? error.status : 502;
    return jsonResponse(statusCode, {
      status: 'failure',
      message: error.message,
      errors: error.details,
    });
  }
}

exports.main = main;
exports.buildSalesforcePayload = buildSalesforcePayload;
exports.extractSalesforceInput = extractSalesforceInput;
exports.validatePayload = validatePayload;
exports.CAR_LICENCE_FIELDS = CAR_LICENCE_FIELDS;
