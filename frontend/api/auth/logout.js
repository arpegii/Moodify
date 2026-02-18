import { clearAuthCookies, json } from "../_lib/spotify.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  clearAuthCookies(res);
  return json(res, 200, { ok: true });
}
