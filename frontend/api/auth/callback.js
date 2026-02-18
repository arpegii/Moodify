const {
  clearAuthCookies,
  getAppOrigin,
  getQuery,
  getRedirectUri,
  requestSpotifyToken,
  redirect,
  setAuthCookies,
} = require("../_lib/spotify");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }

  const query = getQuery(req);
  const code = query.code;
  const err = query.error;
  const appOrigin = getAppOrigin(req);

  if (err) {
    return redirect(res, `${appOrigin}/?auth=error`);
  }

  if (!code || typeof code !== "string") {
    return redirect(res, `${appOrigin}/?auth=missing_code`);
  }

  try {
    const tokenData = await requestSpotifyToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(req),
    });

    setAuthCookies(res, tokenData);
    return redirect(res, `${appOrigin}/?auth=success`);
  } catch {
    clearAuthCookies(res);
    return redirect(res, `${appOrigin}/?auth=token_error`);
  }
};