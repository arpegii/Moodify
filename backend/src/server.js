import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn("Missing Spotify credentials. Update backend/.env before running auth flow.");
}

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production"
};

const moodTargets = {
  happy: {
    seed_genres: "pop,dance,party",
    target_valence: 0.88,
    target_energy: 0.78,
    target_danceability: 0.8
  },
  chill: {
    seed_genres: "chill,ambient,lo-fi",
    target_valence: 0.55,
    target_energy: 0.35,
    target_danceability: 0.45
  },
  energetic: {
    seed_genres: "edm,work-out,rock",
    target_valence: 0.72,
    target_energy: 0.94,
    target_danceability: 0.7
  },
  focused: {
    seed_genres: "classical,study,piano",
    target_valence: 0.48,
    target_energy: 0.4,
    target_instrumentalness: 0.82
  },
  melancholic: {
    seed_genres: "acoustic,sad,indie",
    target_valence: 0.22,
    target_energy: 0.32,
    target_danceability: 0.3
  }
};

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET || "moodify"));

function getBasicToken() {
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  return `Basic ${auth}`;
}

async function exchangeCodeForToken(code) {
  const response = await axios.post(
    "https://accounts.spotify.com/api/token",
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI
    }),
    {
      headers: {
        Authorization: getBasicToken(),
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );

  return response.data;
}

async function refreshAccessToken(refreshToken) {
  const response = await axios.post(
    "https://accounts.spotify.com/api/token",
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    }),
    {
      headers: {
        Authorization: getBasicToken(),
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );

  return response.data;
}

async function getValidAccessToken(req, res) {
  const accessToken = req.cookies.spotify_access_token;
  const refreshToken = req.cookies.spotify_refresh_token;
  const expiresAt = Number(req.cookies.spotify_expires_at || 0);

  if (!refreshToken) {
    return null;
  }

  if (accessToken && Date.now() < expiresAt - 5000) {
    return accessToken;
  }

  try {
    const refreshed = await refreshAccessToken(refreshToken);
    const newAccessToken = refreshed.access_token;
    const newExpiresAt = Date.now() + refreshed.expires_in * 1000;

    res.cookie("spotify_access_token", newAccessToken, {
      ...cookieOptions,
      maxAge: refreshed.expires_in * 1000
    });
    res.cookie("spotify_expires_at", String(newExpiresAt), {
      ...cookieOptions,
      maxAge: refreshed.expires_in * 1000
    });

    return newAccessToken;
  } catch {
    res.clearCookie("spotify_access_token", cookieOptions);
    res.clearCookie("spotify_refresh_token", cookieOptions);
    res.clearCookie("spotify_expires_at", cookieOptions);
    return null;
  }
}

async function spotifyGet(path, token, params = {}) {
  const response = await axios.get(`https://api.spotify.com/v1${path}`, {
    params,
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
}

async function spotifyPost(path, token, data) {
  const response = await axios.post(`https://api.spotify.com/v1${path}`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
}

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "moodify-backend" });
});

app.get(["/auth/login", "/api/auth/login"], (_req, res) => {
  const scope = [
    "user-read-private",
    "playlist-modify-public",
    "playlist-modify-private"
  ].join(" ");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID || "",
    scope,
    redirect_uri: REDIRECT_URI,
    show_dialog: "true"
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

app.get(["/auth/callback", "/api/auth/callback"], async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`${FRONTEND_URL}/?auth=error`);
  }

  if (!code || typeof code !== "string") {
    return res.redirect(`${FRONTEND_URL}/?auth=missing_code`);
  }

  try {
    const tokenData = await exchangeCodeForToken(code);
    const expiresAt = Date.now() + tokenData.expires_in * 1000;

    res.cookie("spotify_access_token", tokenData.access_token, {
      ...cookieOptions,
      maxAge: tokenData.expires_in * 1000
    });
    res.cookie("spotify_refresh_token", tokenData.refresh_token, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000
    });
    res.cookie("spotify_expires_at", String(expiresAt), {
      ...cookieOptions,
      maxAge: tokenData.expires_in * 1000
    });

    return res.redirect(`${FRONTEND_URL}/?auth=success`);
  } catch {
    return res.redirect(`${FRONTEND_URL}/?auth=token_error`);
  }
});

app.post(["/auth/logout", "/api/auth/logout"], (_req, res) => {
  res.clearCookie("spotify_access_token", cookieOptions);
  res.clearCookie("spotify_refresh_token", cookieOptions);
  res.clearCookie("spotify_expires_at", cookieOptions);
  res.json({ ok: true });
});

app.get("/api/auth/status", async (req, res) => {
  const token = await getValidAccessToken(req, res);
  if (!token) {
    return res.json({ connected: false });
  }

  try {
    const profile = await spotifyGet("/me", token);
    return res.json({ connected: true, profile: { id: profile.id, name: profile.display_name } });
  } catch {
    return res.json({ connected: false });
  }
});

app.post("/api/playlists/from-mood", async (req, res) => {
  const { mood } = req.body;
  const moodKey = String(mood || "").toLowerCase();
  const settings = moodTargets[moodKey];

  if (!settings) {
    return res.status(400).json({ error: "Unsupported mood" });
  }

  const token = await getValidAccessToken(req, res);
  if (!token) {
    return res.status(401).json({ error: "Not authenticated with Spotify" });
  }

  try {
    const me = await spotifyGet("/me", token);
    const recs = await spotifyGet("/recommendations", token, {
      ...settings,
      limit: 20
    });

    const uris = (recs.tracks || []).map((track) => track.uri).filter(Boolean);
    if (!uris.length) {
      return res.status(404).json({ error: "No recommended tracks for this mood" });
    }

    const now = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });

    const playlist = await spotifyPost(`/users/${me.id}/playlists`, token, {
      name: `${moodKey[0].toUpperCase() + moodKey.slice(1)} Mood Mix (${now})`,
      description: `Auto-generated by Moodify for a ${moodKey} vibe`,
      public: false
    });

    await spotifyPost(`/playlists/${playlist.id}/tracks`, token, { uris });

    return res.json({
      ok: true,
      playlist: {
        id: playlist.id,
        name: playlist.name,
        url: playlist.external_urls?.spotify
      },
      tracksAdded: uris.length
    });
  } catch (error) {
    const details = error?.response?.data || error.message;
    return res.status(500).json({ error: "Failed to create playlist", details });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
