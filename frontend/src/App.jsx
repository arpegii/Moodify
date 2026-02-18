import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const moods = [
  { key: "happy", label: "Happy", description: "Upbeat and bright" },
  { key: "chill", label: "Chill", description: "Soft and relaxed" },
  { key: "energetic", label: "Energetic", description: "High intensity" },
  { key: "focused", label: "Focused", description: "Deep work mode" },
  {
    key: "melancholic",
    label: "Melancholic",
    description: "Calm and reflective",
  },
];

function App() {
  const [selectedMood, setSelectedMood] = useState("happy");
  const [connected, setConnected] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [playlist, setPlaylist] = useState(null);

  const authMessage = useMemo(() => {
    const value = new URLSearchParams(window.location.search).get("auth");
    if (value === "success") return "Spotify connected.";
    if (value && value !== "success") return "Spotify login failed. Try again.";
    return "";
  }, []);

  useEffect(() => {
    async function checkStatus() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/status`, {
          credentials: "include",
        });
        const data = await response.json();
        setConnected(Boolean(data.connected));
        setProfileName(data.profile?.name || data.profile?.id || "");
      } catch {
        setError("Could not reach API. Please check your deployment or dev server.");
      } finally {
        setLoading(false);
      }
    }

    checkStatus();
  }, []);

  async function createPlaylist() {
    setSubmitting(true);
    setError("");
    setPlaylist(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/playlists/from-mood`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: selectedMood }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create playlist");
      }

      setPlaylist(data.playlist);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/";
  }

  return (
    <main className="min-h-screen p-6 sm:p-10">
      <section className="mx-auto max-w-3xl rounded-3xl border border-brand-100 bg-white/85 p-8 shadow-xl backdrop-blur">
        <h1 className="text-3xl font-bold text-brand-700 sm:text-4xl">
          Moodify Playlist Builder
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Choose a mood and let Spotify generate a playlist instantly.
        </p>

        {authMessage ? (
          <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
            {authMessage}
          </p>
        ) : null}

        {loading ? (
          <p className="mt-6 text-slate-600">Checking Spotify connection...</p>
        ) : connected ? (
          <div className="mt-6 space-y-5">
            <div className="rounded-xl bg-brand-50 p-3 text-sm text-brand-700">
              Connected as <strong>{profileName || "Spotify user"}</strong>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {moods.map((mood) => {
                const active = selectedMood === mood.key;
                return (
                  <button
                    key={mood.key}
                    type="button"
                    onClick={() => setSelectedMood(mood.key)}
                    className={`rounded-xl border p-4 text-left transition ${
                      active
                        ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100"
                        : "border-slate-200 bg-white hover:border-brand-100"
                    }`}
                  >
                    <div className="font-semibold text-slate-800">
                      {mood.label}
                    </div>
                    <div className="text-xs text-slate-500">
                      {mood.description}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={createPlaylist}
                disabled={submitting}
                className="rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Creating..." : "Create Playlist"}
              </button>
              <button
                type="button"
                onClick={logout}
                className="rounded-full border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <a
            className="mt-6 inline-flex rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
            href={`${API_BASE_URL}/api/auth/login`}
          >
            Connect Spotify
          </a>
        )}

        {error ? (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {playlist ? (
          <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm">
            Playlist created: <strong>{playlist.name}</strong>{" "}
            <a
              className="font-semibold text-brand-700 underline"
              href={playlist.url}
              target="_blank"
              rel="noreferrer"
            >
              Open in Spotify
            </a>
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default App;
