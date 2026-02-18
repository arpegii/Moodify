const { getRedirectUri, json, redirect } = require("../_lib/spotify");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  if (!process.env.SPOTIFY_CLIENT_ID) {
    return json(res, 500, { error: "Missing SPOTIFY_CLIENT_ID" });
  }

  const scope = [
    "user-read-private",
    "playlist-modify-public",
    "playlist-modify-private",
  ].join(" ");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID,
    redirect_uri: getRedirectUri(req),
    scope,
    show_dialog: "true",
  });

  return redirect(res, `https://accounts.spotify.com/authorize?${params.toString()}`);
};