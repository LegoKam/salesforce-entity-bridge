function errorResponse(statusCode, message, logger) {
  if (logger) logger.error(message);
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    body: { error: message },
  };
}

module.exports = {
  errorResponse,
};
