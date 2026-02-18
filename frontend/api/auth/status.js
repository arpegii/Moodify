import { getValidAccessToken, json, spotifyRequest } from "../_lib/spotify.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const accessToken = await getValidAccessToken(req, res);
  if (!accessToken) {
    return json(res, 200, { connected: false });
  }

  try {
    const me = await spotifyRequest("GET", "/me", accessToken);
    return json(res, 200, {
      connected: true,
      profile: {
        id: me.id,
        name: me.display_name,
      },
    });
  } catch {
    return json(res, 200, { connected: false });
  }
}
