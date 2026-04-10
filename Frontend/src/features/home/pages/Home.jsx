import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import FaceExpression from "../../Expression/components/FaceExpression";
import { AuthContext } from "../../auth/auth.context";
import { getMoodHistory, getMoodRecommendations, recordMood } from "../service/song.api";
import { useSong } from "../hooks/useSong";
import "../styles/home.css";
import Player from "../components/Player";

const ALLOWED_MOODS = new Set(["happy", "sad", "surprised"]);

const QUICK_MOODS = [
    {
        mood: "happy",
        title: "Happy",
        description: "Lift the energy and refresh the queue.",
    },
    {
        mood: "sad",
        title: "Sad",
        description: "Keep things soft, warm, and reflective.",
    },
    {
        mood: "surprised",
        title: "Surprised",
        description: "Switch the mood and spark something new.",
    },
];

const MOOD_INFO = {
    happy: {
        title: "Bright mode",
        description: "Upbeat tracks, brighter visuals, and a stronger pulse.",
    },
    sad: {
        title: "Chill mode",
        description: "Slower pacing and softer picks that keep the session calm.",
    },
    surprised: {
        title: "Curveball mode",
        description: "A more playful mix that keeps the experience fresh.",
    },
};

function normalizeTrack(track) {
    if (!track) return null;

    return {
        ...track,
        id: track.id || track._id || null,
        externalId: track.externalId || "",
        title: track.title,
        mood: track.mood,
        url: track.url,
        posterUrl: track.posterUrl || null,
        artistName: track.artistName || "",
        albumName: track.albumName || "",
        source: track.source || "",
    };
}

function capitalizeMood(mood) {
    if (!mood) return "Unknown";
    return mood.charAt(0).toUpperCase() + mood.slice(1);
}

function formatRelativeTime(value) {
    if (!value) return "Just now";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Just now";
    }

    const diffMinutes = Math.max(Math.round((Date.now() - date.getTime()) / 60000), 0);

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
    }).format(date);
}

function formatLongDate(value) {
    if (!value) return "Not saved yet";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Not saved yet";
    }

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
}

function Home() {
    const { user } = useContext(AuthContext);
    const { song, loading, handleGetSong, setSong, setShouldAutoPlay } = useSong();

    const [history, setHistory] = useState([]);
    const [playlist, setPlaylist] = useState([]);
    const [selectedMood, setSelectedMood] = useState(song?.mood || "happy");
    const [dashboardLoading, setDashboardLoading] = useState(true);
    const [savingMood, setSavingMood] = useState(false);
    const [statusMessage, setStatusMessage] = useState("Pick a mood or scan your face to build a session for you.");
    const initialMoodRef = useRef(song?.mood || "happy");

    const currentMood = song?.mood || selectedMood || "happy";
    const currentMoodInfo = MOOD_INFO[currentMood] || MOOD_INFO.happy;
    const currentSong = normalizeTrack(song);

    const historyStats = useMemo(() => {
        const counts = {
            happy: 0,
            sad: 0,
            surprised: 0,
        };

        history.forEach((entry) => {
            if (entry?.mood && counts[entry.mood] !== undefined) {
                counts[entry.mood] += 1;
            }
        });

        const topMood = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || currentMood;
        const recentMood = history[0]?.mood || currentMood;

        let streak = 0;
        for (const entry of history) {
            if (entry?.mood === recentMood) {
                streak += 1;
            } else {
                break;
            }
        }

        return {
            counts,
            topMood,
            recentMood,
            streak,
            total: history.length,
        };
    }, [history, currentMood]);

    const refreshDashboard = useCallback(async (moodSeed) => {
        setDashboardLoading(true);

        try {
            const historyResponse = await getMoodHistory(8).catch(() => ({ history: [] }));
            const nextHistory = historyResponse.history || [];
            setHistory(nextHistory);

            const seedMood = nextHistory[0]?.mood || moodSeed;
            setSelectedMood(seedMood);

            const playlistResponse = await getMoodRecommendations({
                mood: seedMood,
                limit: 6,
            }).catch(() => ({ playlist: [], currentMood: seedMood }));

            const nextPlaylist = (playlistResponse.playlist || [])
                .map(normalizeTrack)
                .filter(Boolean);

            setPlaylist(nextPlaylist);

            if (nextHistory.length > 0) {
                setStatusMessage(`Your latest mood is ${capitalizeMood(seedMood)}. Your recommendations are ready.`);
            } else if (nextPlaylist.length > 0) {
                setStatusMessage(`We started with ${capitalizeMood(seedMood)} to seed your playlist.`);
            } else {
                setStatusMessage("Pick a mood or scan your face to build a session for you.");
            }
        } finally {
            setDashboardLoading(false);
        }
    }, [setDashboardLoading, setHistory, setPlaylist, setSelectedMood, setStatusMessage]);

    useEffect(() => {
        void refreshDashboard(initialMoodRef.current);
    }, [refreshDashboard]);

    const persistMood = async ({
        mood,
        expression = "",
        source = "camera",
        autoPlay = false,
        track = null,
    }) => {
        const normalizedMood = mood?.toLowerCase();
        if (!normalizedMood || !ALLOWED_MOODS.has(normalizedMood)) {
            setStatusMessage(`"${expression || mood || "unknown"}" is not mapped to a music mood yet.`);
            return;
        }

        setSavingMood(true);
        setSelectedMood(normalizedMood);
        setStatusMessage(`Building your ${capitalizeMood(normalizedMood)} session...`);

        try {
            let nextSong = track ? normalizeTrack(track) : null;

            if (nextSong) {
                setSong(nextSong);
                setShouldAutoPlay(autoPlay);
            } else {
                nextSong = await handleGetSong({ mood: normalizedMood, autoPlay });
            }

            const songSource = nextSong?.source || "local";
            const isExternalSong = songSource !== "local";

            await recordMood({
                mood: normalizedMood,
                expression,
                source,
                songId: isExternalSong ? null : nextSong?.id || nextSong?._id || null,
                songExternalId: isExternalSong ? nextSong?.externalId || nextSong?.id || null : null,
                songSource,
                songTitle: nextSong?.title || "",
                songArtistName: nextSong?.artistName || "",
                songPosterUrl: nextSong?.posterUrl || "",
            }).catch(() => null);

            const [historyResponse, playlistResponse] = await Promise.all([
                getMoodHistory(8).catch(() => ({ history: [] })),
                getMoodRecommendations({
                    mood: normalizedMood,
                    limit: 6,
                }).catch(() => ({ playlist: [] })),
            ]);

            const nextHistory = historyResponse.history || [];
            const nextPlaylist = (playlistResponse.playlist || [])
                .map(normalizeTrack)
                .filter(Boolean);

            setHistory(nextHistory);
            setPlaylist(nextPlaylist.length > 0 ? nextPlaylist : nextSong ? [normalizeTrack(nextSong)] : []);
            setStatusMessage(`${capitalizeMood(normalizedMood)} mood saved. Your playlist is ready.`);
        } catch (error) {
            console.error("Unable to update mood session", error);
            setStatusMessage("We could not update the session right now. Please try again.");
        } finally {
            setSavingMood(false);
        }
    };

    const handleExpressionDetected = async (expression) => {
        if (!expression) return;

        const mood = expression.toLowerCase().trim();
        await persistMood({
            mood,
            expression,
            source: "camera",
            autoPlay: true,
        });
    };

    const handleMoodChip = async (mood) => {
        await persistMood({
            mood,
            expression: `Manual ${mood} selection`,
            source: "manual",
            autoPlay: true,
        });
    };

    const handlePlayTrack = async (track) => {
        const normalizedTrack = normalizeTrack(track);
        if (!normalizedTrack) return;

        setSong(normalizedTrack);
        setShouldAutoPlay(true);
        setSelectedMood(normalizedTrack.mood || "happy");
        setStatusMessage(`Playing ${normalizedTrack.title}.`);

        await recordMood({
            mood: normalizedTrack.mood || "happy",
            expression: "Playlist playback",
            source: "playlist",
            songId: normalizedTrack.source && normalizedTrack.source !== "local" ? null : normalizedTrack.id,
            songExternalId: normalizedTrack.source && normalizedTrack.source !== "local" ? normalizedTrack.externalId || normalizedTrack.id : null,
            songSource: normalizedTrack.source || "local",
            songTitle: normalizedTrack.title,
            songArtistName: normalizedTrack.artistName || "",
            songPosterUrl: normalizedTrack.posterUrl || "",
        }).catch(() => null);

        const [historyResponse, playlistResponse] = await Promise.all([
            getMoodHistory(8).catch(() => ({ history: [] })),
            getMoodRecommendations({
                mood: normalizedTrack.mood || "happy",
                limit: 6,
            }).catch(() => ({ playlist: [] })),
        ]);

        setHistory(historyResponse.history || []);
        setPlaylist((playlistResponse.playlist || []).map(normalizeTrack).filter(Boolean));
    };

    const topMoodLabel = capitalizeMood(historyStats.topMood);
    const recentMoodLabel = capitalizeMood(historyStats.recentMood);

    return (
        <main className="home-page">
            <div className="home-shell">
                <section className="home-hero">
                    <div className="home-panel home-hero__main">
                        <p className="home-hero__eyebrow">MoodWave for {user?.username || "you"}</p>
                        <h1 className="home-hero__title">
                            Build a <span>playlist</span> around how you feel.
                        </h1>
                        <p className="home-hero__copy">
                            Scan your expression, track your mood history, and let the app shape a smarter playlist
                            every time you come back. The queue updates around your recent sessions instead of starting
                            from scratch.
                        </p>

                        <div className="home-hero__actions">
                            <button
                                className="home-button home-button--primary"
                                onClick={() => handleMoodChip(currentMood)}
                                disabled={savingMood || loading}
                            >
                                {savingMood ? "Building..." : `Play ${capitalizeMood(currentMood)} mix`}
                            </button>
                            <button
                                className="home-button home-button--ghost"
                                onClick={() => refreshDashboard(currentMood)}
                                disabled={dashboardLoading}
                            >
                                Refresh insights
                            </button>
                        </div>

                        <div className="home-badges">
                            <span className="home-badge">{currentMoodInfo.title}</span>
                            <span className="home-badge">Recent streak: {historyStats.streak} session{historyStats.streak === 1 ? "" : "s"}</span>
                            <span className="home-badge">Playlist size: {playlist.length}</span>
                        </div>
                    </div>

                    <aside className="home-panel home-hero__aside">
                        <div className="home-current">
                            <span className="home-current__label">Now playing</span>
                            <div className="home-current__song">
                                {currentSong?.title || "Waiting for your first pick"}
                            </div>
                            <p className="home-current__meta">
                                {currentSong?.mood ? `${capitalizeMood(currentSong.mood)} mood` : "No track selected yet"}
                            </p>
                            {currentSong?.artistName && (
                                <p className="home-current__artist">
                                    {currentSong.artistName}
                                    {currentSong.albumName ? ` - ${currentSong.albumName}` : ""}
                                </p>
                            )}
                            <p className="home-current__status">
                                {loading ? "Finding the best match for you..." : statusMessage}
                            </p>
                        </div>

                        <div className="home-card">
                            <p className="home-card__eyebrow">Mood insight</p>
                            <div className="home-card__title">{currentMoodInfo.title}</div>
                            <p className="home-card__description">{currentMoodInfo.description}</p>
                        </div>
                    </aside>
                </section>

                <section className="home-metrics">
                    <article className="home-panel home-metric">
                        <div className="home-metric__label">Recent sessions</div>
                        <div className="home-metric__value">{historyStats.total}</div>
                        <div className="home-metric__hint">Mood entries saved in your history.</div>
                    </article>
                    <article className="home-panel home-metric">
                        <div className="home-metric__label">Top mood</div>
                        <div className="home-metric__value">{topMoodLabel}</div>
                        <div className="home-metric__hint">Most repeated mood across recent sessions.</div>
                    </article>
                    <article className="home-panel home-metric">
                        <div className="home-metric__label">Current streak</div>
                        <div className="home-metric__value">{historyStats.streak}</div>
                        <div className="home-metric__hint">{recentMoodLabel} moods in a row.</div>
                    </article>
                    <article className="home-panel home-metric">
                        <div className="home-metric__label">Playlist picks</div>
                        <div className="home-metric__value">{playlist.length}</div>
                        <div className="home-metric__hint">AI-style recommendations for the current session.</div>
                    </article>
                </section>

                <section className="home-layout">
                    <div className="home-column">
                        <article className="home-panel home-card">
                            <div className="home-card__header">
                                <div>
                                    <p className="home-card__eyebrow">Live camera</p>
                                    <h2 className="home-card__title">Camera scanner and permission prompt.</h2>
                                </div>
                                <span className="home-status">
                                    {dashboardLoading ? "Loading dashboard..." : "Ready"}
                                </span>
                            </div>
                            <FaceExpression onClick={handleExpressionDetected} />
                        </article>

                        <article className="home-panel home-card">
                            <div className="home-card__header">
                                <div>
                                    <p className="home-card__eyebrow">Quick moods</p>
                                    <h2 className="home-card__title">Jump straight into a vibe.</h2>
                                </div>
                            </div>
                            <div className="home-chip-row">
                                {QUICK_MOODS.map((item) => (
                                    <button
                                        key={item.mood}
                                        className={`home-chip ${currentMood === item.mood ? "home-chip--active" : ""}`}
                                        onClick={() => handleMoodChip(item.mood)}
                                        disabled={savingMood}
                                        title={item.description}
                                    >
                                        {item.title}
                                    </button>
                                ))}
                            </div>
                            <div className="home-copy-list">
                                {QUICK_MOODS.map((item) => (
                                    <p key={item.mood}>
                                        <strong>{item.title}:</strong> {item.description}
                                    </p>
                                ))}
                            </div>
                        </article>
                    </div>

                    <div className="home-column">
                        <article className="home-panel home-card home-card--history">
                            <div className="home-card__header">
                                <div>
                                    <p className="home-card__eyebrow">Mood history</p>
                                    <h2 className="home-card__title">Your recent emotional sessions.</h2>
                                </div>
                                <span className="home-status">{history.length} saved</span>
                            </div>

                            {dashboardLoading ? (
                                <div className="home-loading">Loading your history and recommendations...</div>
                            ) : history.length > 0 ? (
                                <div className="home-history-list">
                                    {history.map((entry) => (
                                        <article className="home-history-item" key={entry.id}>
                                            {entry.song?.posterUrl ? (
                                                <img
                                                    className="home-history-art"
                                                    src={entry.song.posterUrl}
                                                    alt={entry.song.title || entry.mood}
                                                />
                                            ) : (
                                                <div className="home-history-art home-history-art--fallback">
                                                    {capitalizeMood(entry.mood).slice(0, 1)}
                                                </div>
                                            )}
                                            <div className="home-history-content">
                                                <div className="home-history-meta">
                                                    <span>{capitalizeMood(entry.mood)}</span>
                                                    <span>{entry.source}</span>
                                                    <span>{formatLongDate(entry.createdAt)}</span>
                                                </div>
                                                <div className="home-history-title">
                                                    {entry.song?.title || "Mood logged without a track"}
                                                </div>
                                                <div className="home-history-subtitle">
                                                    {entry.expression || "Saved from the mood picker or camera."}
                                                </div>
                                            </div>
                                            <div className="home-history-time">
                                                {formatRelativeTime(entry.createdAt)}
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <div className="home-empty">
                                    Your mood history will appear here after the first scan or mood pick.
                                </div>
                            )}
                        </article>

                        <article className="home-panel home-card home-card--recommendations">
                            <div className="home-card__header">
                                <div>
                                    <p className="home-card__eyebrow">AI recommendations</p>
                                    <h2 className="home-card__title">
                                        {capitalizeMood(selectedMood)} picks for you
                                    </h2>
                                </div>
                                <span className="home-status">{playlist.length} tracks</span>
                            </div>

                            {playlist.length > 0 ? (
                                <div className="home-playlist-grid">
                                    {playlist.map((track) => (
                                        <article className="home-track" key={track.id || track.title}>
                                            <div className="home-track__art">
                                                {track.posterUrl ? (
                                                    <img src={track.posterUrl} alt={track.title} />
                                                ) : (
                                                    <div className="home-track__art--fallback">
                                                        No cover art
                                                    </div>
                                                )}
                                            </div>
                                            <div className="home-track__body">
                                                <span className="home-pill">{capitalizeMood(track.mood)}</span>
                                                <div className="home-track__title">{track.title}</div>
                                                {track.artistName && (
                                                    <div className="home-track__artist">
                                                        {track.artistName}
                                                        {track.albumName ? ` - ${track.albumName}` : ""}
                                                    </div>
                                                )}
                                                <div className="home-track__reason">{track.reason}</div>
                                            </div>
                                            <div className="home-track__footer">
                                                <button
                                                    className="home-button home-button--primary home-track__play"
                                                    onClick={() => handlePlayTrack(track)}
                                                >
                                                    Play
                                                </button>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <div className="home-empty">
                                    Recommendations will appear here once a mood is saved.
                                </div>
                            )}
                        </article>
                    </div>
                </section>
            </div>

            <Player />
        </main>
    );
}

export default Home;
