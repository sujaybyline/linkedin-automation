function apiSuccess(res, data, status = 200) {
  return res.status(status).json({ data, error: null });
}

function apiError(res, message, status = 400) {
  return res.status(status).json({ data: null, error: { message } });
}

module.exports = { apiSuccess, apiError };
