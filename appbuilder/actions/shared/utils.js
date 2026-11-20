/*
 * Shared HTTP helpers for Adobe I/O Runtime web actions
 * (aligned with securgov/demo-open-auth actions/utils.js).
 */

function corsHeaders(extra = {}) {
  // Do not set Access-Control-* here: Adobe I/O Runtime's API gateway already
  // adds CORS for web actions. Duplicating them yields invalid values like
  // `Access-Control-Allow-Origin: *,*` which browsers reject ("Failed to fetch").
  return {
    'Content-Type': 'application/json',
    ...extra,
  };
}

function methodOf(params) {
  // eslint-disable-next-line no-underscore-dangle
  return String(params.__ow_method || 'GET').toUpperCase();
}

function isOptions(params) {
  return methodOf(params) === 'OPTIONS';
}

function jsonResponse(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: corsHeaders(extraHeaders),
    body,
  };
}

function optionsResponse() {
  return {
    statusCode: 200,
    headers: corsHeaders(),
    body: {},
  };
}

function errorResponse(statusCode, message, logger, extra = {}) {
  if (logger) logger.error(message);
  return jsonResponse(statusCode, { status: 'failure', message, ...extra });
}

/**
 * Merge a JSON (or base64 JSON) __ow_body into params, matching Runtime + AEM Forms.
 */
function parseJsonBody(params) {
  // eslint-disable-next-line no-underscore-dangle
  if (!params.__ow_body || typeof params.__ow_body !== 'string') return params;
  // eslint-disable-next-line no-underscore-dangle
  let raw = params.__ow_body;
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    const trimmed = decoded.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) raw = decoded;
  } catch {
    // keep original
  }
  try {
    const parsed = JSON.parse(raw);
    return { ...params, ...parsed };
  } catch {
    return params;
  }
}

function parseJson(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/**
 * AEM Forms often posts multipart/form-data with a `data` part containing JSON.
 */
function parseMultipartData(params) {
  // eslint-disable-next-line no-underscore-dangle
  const contentType = String((params.__ow_headers || {})['content-type'] || '');
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  // eslint-disable-next-line no-underscore-dangle
  if (!boundaryMatch || typeof params.__ow_body !== 'string') return undefined;

  // eslint-disable-next-line no-underscore-dangle
  let body = params.__ow_body;
  try {
    const decoded = Buffer.from(body, 'base64').toString('utf8');
    if (decoded.includes(`--${boundaryMatch[1] || boundaryMatch[2]}`)) body = decoded;
  } catch {
    // Use the original body when it is not base64 encoded.
  }

  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const dataPart = body.split(`--${boundary}`).find((part) => (
    /Content-Disposition:[^\r\n]*name="data"/i.test(part)
  ));
  if (!dataPart) return undefined;
  const separator = dataPart.includes('\r\n\r\n') ? '\r\n\r\n' : '\n\n';
  const value = dataPart.split(separator).slice(1).join(separator).replace(/\r?\n$/, '')
    .trim();
  return parseJson(value);
}

module.exports = {
  corsHeaders,
  methodOf,
  isOptions,
  jsonResponse,
  optionsResponse,
  errorResponse,
  parseJsonBody,
  parseJson,
  parseMultipartData,
};
