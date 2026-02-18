const { clearAuthCookies, json } = require("../_lib/spotify");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  clearAuthCookies(res);
  return json(res, 200, { ok: true });
};