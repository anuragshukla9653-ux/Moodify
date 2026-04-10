import { useEffect, useRef, useState } from 'react'
import { useSong } from '../hooks/useSong'
import '../styles/player.css'

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2]

const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00'
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0')
    return `${minutes}:${secs}`
}

const Player = () => {
    const { song, shouldAutoPlay, setShouldAutoPlay } = useSong()

    const audioRef = useRef(null)
    const progressRef = useRef(null)
    const previousVolumeRef = useRef(1)
    const playbackStateRef = useRef({
        isPlaying: false,
        speed: 1,
        volume: 1,
        isMuted: false,
        shouldAutoPlay: false,
    })

    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [speed, setSpeed] = useState(1)
    const [volume, setVolume] = useState(1)
    const [showSpeed, setShowSpeed] = useState(false)
    const [isMuted, setIsMuted] = useState(false)

    useEffect(() => {
        playbackStateRef.current = {
            isPlaying,
            speed,
            volume,
            isMuted,
            shouldAutoPlay,
        }
    }, [isPlaying, speed, volume, isMuted, shouldAutoPlay])

    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return

        const {
            isPlaying: shouldResume,
            speed: currentSpeed,
            volume: currentVolume,
            isMuted: currentMuted,
            shouldAutoPlay: autoPlayNext,
        } = playbackStateRef.current
        const shouldPlayNow = shouldResume || autoPlayNext

        audio.pause()
        audio.currentTime = 0
        audio.load()
        audio.playbackRate = currentSpeed
        audio.volume = currentMuted ? 0 : currentVolume

        if (shouldPlayNow) {
            audio.play()
                .then(() => Promise.resolve().then(() => setShouldAutoPlay(false)))
                .catch((error) => {
                    console.error('Unable to resume playback', error)
                    Promise.resolve().then(() => setShouldAutoPlay(false))
                })
        } else {
            Promise.resolve().then(() => setShouldAutoPlay(false))
        }
    }, [song?.url, setShouldAutoPlay])

    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return

        audio.playbackRate = speed
        audio.volume = isMuted ? 0 : volume
    }, [speed, volume, isMuted])

    const togglePlay = async () => {
        const audio = audioRef.current
        if (!audio) return

        if (isPlaying) {
            audio.pause()
            return
        }

        try {
            await audio.play()
        } catch (error) {
            console.error('Unable to start playback', error)
        }
    }

    const skip = (secs) => {
        const audio = audioRef.current
        if (!audio) return
        audio.currentTime = Math.min(Math.max(audio.currentTime + secs, 0), duration)
    }

    const handleTimeUpdate = () => {
        if (!audioRef.current) return
        setCurrentTime(audioRef.current.currentTime)
    }

    const handleLoadedMetadata = () => {
        if (!audioRef.current) return
        setDuration(audioRef.current.duration || 0)
        setCurrentTime(0)
    }

    const handleAudioPlay = () => {
        setIsPlaying(true)
    }

    const handleAudioPause = () => {
        setIsPlaying(false)
    }

    const handleProgressClick = (e) => {
        const bar = progressRef.current
        const audio = audioRef.current
        if (!bar || !audio || !duration) return

        const rect = bar.getBoundingClientRect()
        const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1)
        const newTime = ratio * duration
        audio.currentTime = newTime
        setCurrentTime(newTime)
    }

    const handleSpeedChange = (nextSpeed) => {
        const audio = audioRef.current
        setSpeed(nextSpeed)

        if (audio) {
            audio.playbackRate = nextSpeed
        }

        setShowSpeed(false)
    }

    const handleVolume = (e) => {
        const nextVolume = parseFloat(e.target.value)
        const audio = audioRef.current

        if (nextVolume > 0) {
            previousVolumeRef.current = nextVolume
        }

        setVolume(nextVolume)
        setIsMuted(nextVolume === 0)

        if (audio) {
            audio.volume = nextVolume
        }
    }

    const toggleMute = () => {
        const audio = audioRef.current
        if (!audio) return

        if (isMuted || volume === 0) {
            const restoredVolume = previousVolumeRef.current || 0.5
            audio.volume = restoredVolume
            setVolume(restoredVolume)
            setIsMuted(false)
            return
        }

        previousVolumeRef.current = volume
        audio.volume = 0
        setVolume(0)
        setIsMuted(true)
    }

    const handleSongEnd = () => {
        setIsPlaying(false)
        setCurrentTime(0)
    }

    const progress = duration ? (currentTime / duration) * 100 : 0

    if (!song) return null

    return (
        <div className="player">
            <audio
                ref={audioRef}
                src={song.url}
                onPlay={handleAudioPlay}
                onPause={handleAudioPause}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleSongEnd}
            />

            <div className="player__info">
                {song.posterUrl ? (
                    <img
                        className="player__poster"
                        src={song.posterUrl}
                        alt={song.title}
                    />
                ) : (
                    <div
                        className="player__poster"
                        style={{
                            display: "grid",
                            placeItems: "center",
                            background: "linear-gradient(135deg, rgba(221, 66, 0, 0.25), rgba(255,255,255,0.05))",
                            color: "#fff",
                            fontSize: "0.72rem",
                            textAlign: "center",
                            padding: "8px",
                        }}
                    >
                        No image
                    </div>
                )}
                <div className="player__meta">
                    <p className="player__title">{song.title}</p>
                    {song.artistName && <p className="player__artist">{song.artistName}</p>}
                    <span className="player__mood">{song.mood}</span>
                </div>
            </div>

            <div className="player__progress-wrap">
                <span className="player__time">{formatTime(currentTime)}</span>
                <div
                    className="player__progress"
                    ref={progressRef}
                    onClick={handleProgressClick}
                >
                    <div className="player__progress-fill" style={{ width: `${progress}%` }} />
                    <div className="player__progress-thumb" style={{ left: `${progress}%` }} />
                </div>
                <span className="player__time">{formatTime(duration)}</span>
            </div>

            <div className="player__controls">
                <div className="player__speed-wrap">
                    <button
                        className="player__btn player__btn--speed"
                        onClick={() => setShowSpeed(!showSpeed)}
                        title="Playback speed"
                    >
                        {speed}x
                    </button>
                    {showSpeed && (
                        <div className="player__speed-menu">
                            {SPEED_OPTIONS.map((nextSpeed) => (
                                <button
                                    key={nextSpeed}
                                    className={`player__speed-option ${nextSpeed === speed ? 'active' : ''}`}
                                    onClick={() => handleSpeedChange(nextSpeed)}
                                >
                                    {nextSpeed}x
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <button
                    className="player__btn player__btn--skip"
                    onClick={() => skip(-5)}
                    title="Back 5s"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                        <path d="M1 4v6h6" />
                        <path d="M3.51 15a9 9 0 1 0 .49-3.6" />
                    </svg>
                    <span>5s</span>
                </button>

                <button
                    className="player__btn player__btn--play"
                    onClick={togglePlay}
                    title={isPlaying ? 'Pause' : 'Play'}
                >
                    {isPlaying ? (
                        <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
                            <rect x="6" y="4" width="4" height="16" rx="1" />
                            <rect x="14" y="4" width="4" height="16" rx="1" />
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
                            <path d="M8 5.14v14l11-7-11-7z" />
                        </svg>
                    )}
                </button>

                <button
                    className="player__btn player__btn--skip"
                    onClick={() => skip(5)}
                    title="Forward 5s"
                >
                    <span>5s</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                        <path d="M23 4v6h-6" />
                        <path d="M20.49 15a9 9 0 1 1-.49-3.6" />
                    </svg>
                </button>

                <div className="player__volume">
                    <button className="player__btn player__btn--vol" onClick={toggleMute} title="Mute">
                        {isMuted || volume === 0 ? (
                            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                <path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.87 8.87 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A8.99 8.99 0 0 0 17.73 18L19 19.27 20.27 18 5.27 3 4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                            </svg>
                        ) : (
                            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                            </svg>
                        )}
                    </button>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolume}
                        className="player__volume-slider"
                    />
                </div>
            </div>
        </div>
    )
}

export default Player
