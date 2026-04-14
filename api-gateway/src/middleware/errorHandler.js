const { logger } = require("../utils/logger");

function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const payload = {
    error: {
      message: status >= 500 ? "Internal server error" : err.message,
      code: err.code,
    },
  };

  if (status >= 500) {
    logger.error({ err, reqId: req.id }, "Unhandled error");
  }

  res.status(status).json(payload);
}

module.exports = { errorHandler };
