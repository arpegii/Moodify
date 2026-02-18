const moodTargets = {
  happy: {
    seed_genres: "pop,dance,party",
    target_valence: 0.88,
    target_energy: 0.78,
    target_danceability: 0.8,
  },
  chill: {
    seed_genres: "chill,ambient,lo-fi",
    target_valence: 0.55,
    target_energy: 0.35,
    target_danceability: 0.45,
  },
  energetic: {
    seed_genres: "edm,work-out,rock",
    target_valence: 0.72,
    target_energy: 0.94,
    target_danceability: 0.7,
  },
  focused: {
    seed_genres: "classical,study,piano",
    target_valence: 0.48,
    target_energy: 0.4,
    target_instrumentalness: 0.82,
  },
  melancholic: {
    seed_genres: "acoustic,sad,indie",
    target_valence: 0.22,
    target_energy: 0.32,
    target_danceability: 0.3,
  },
};

function getAppOrigin(req) {
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }

  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function getRedirectUri(req) {
  return process.env.SPOTIFY_REDIRECT_URI || `${getAppOrigin(req)}/api/auth/callback`;
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || "";
  const out = {};

  cookieHeader.split(";").forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const splitAt = trimmed.indexOf("=");
    if (splitAt < 0) return;
    const key = trimmed.slice(0, splitAt);
    const value = trimmed.slice(splitAt + 1);
    out[key] = decodeURIComponent(value);
  });

  return out;
}

function isProduction() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

function getCookieOptions() {
  const secure = process.env.COOKIE_SECURE
    ? String(process.env.COOKIE_SECURE).toLowerCase() === "true"
    : isProduction();

  const sameSite = process.env.COOKIE_SAME_SITE || (isProduction() ? "None" : "Lax");

  return { secure, sameSite };
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly"];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  if (options.secure) {
    parts.push("Secure");
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  return parts.join("; ");
}

function setAuthCookies(res, tokenData) {
  const opts = getCookieOptions();
  const expiresAt = Date.now() + tokenData.expires_in * 1000;
  const cookies = [
    serializeCookie("spotify_access_token", tokenData.access_token, {
      ...opts,
      maxAge: tokenData.expires_in,
    }),
    serializeCookie("spotify_expires_at", String(expiresAt), {
      ...opts,
      maxAge: tokenData.expires_in,
    }),
  ];

  if (tokenData.refresh_token) {
    cookies.push(
      serializeCookie("spotify_refresh_token", tokenData.refresh_token, {
        ...opts,
        maxAge: 30 * 24 * 60 * 60,
      })
    );
  }

  res.setHeader("Set-Cookie", cookies);
}

function clearAuthCookies(res) {
  const opts = getCookieOptions();
  res.setHeader("Set-Cookie", [
    serializeCookie("spotify_access_token", "", { ...opts, maxAge: 0 }),
    serializeCookie("spotify_refresh_token", "", { ...opts, maxAge: 0 }),
    serializeCookie("spotify_expires_at", "", { ...opts, maxAge: 0 }),
  ]);
}

function getBasicAuthHeader() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET");
  }

  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function requestSpotifyToken(params) {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: getBasicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error_description || payload?.error || "Spotify token request failed");
  }

  return payload;
}

async function spotifyRequest(method, path, accessToken, { query, body } = {}) {
  const url = new URL(`https://api.spotify.com/v1${path}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(payload?.error?.message || payload?.error || "Spotify API request failed");
    error.status = response.status;
    error.details = payload;
    throw error;
  }

  return payload;
}

async function getValidAccessToken(req, res) {
  const cookies = parseCookies(req);
  const accessToken = cookies.spotify_access_token;
  const refreshToken = cookies.spotify_refresh_token;
  const expiresAt = Number(cookies.spotify_expires_at || 0);

  if (accessToken && Date.now() < expiresAt - 5000) {
    return accessToken;
  }

  if (!refreshToken) {
    return null;
  }

  try {
    const refreshed = await requestSpotifyToken({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    setAuthCookies(res, {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token || refreshToken,
      expires_in: refreshed.expires_in,
    });

    return refreshed.access_token;
  } catch {
    clearAuthCookies(res);
    return null;
  }
}

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.end();
}

function getQuery(req) {
  if (req.query && typeof req.query === "object") {
    return req.query;
  }

  const parsed = new URL(req.url, "http://localhost");
  const query = {};
  parsed.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  return query;
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string") {
    return JSON.parse(req.body || "{}");
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export {
  moodTargets,
  getAppOrigin,
  getRedirectUri,
  requestSpotifyToken,
  spotifyRequest,
  setAuthCookies,
  clearAuthCookies,
  getValidAccessToken,
  json,
  redirect,
  getQuery,
  readJsonBody,
};
