import { getSong } from "../service/song.api"
import { useContext } from "react"
import { SongContext } from "../song.context"

export const useSong = () => {
    const context = useContext(SongContext)
    if (!context) {
        throw new Error("useSong must be used inside SongContextProvider")
    }

    const { song, setSong, loading, setLoading, shouldAutoPlay, setShouldAutoPlay } = context

    async function handleGetSong({ mood, autoPlay = false }) {
        setLoading(true)
        setShouldAutoPlay(autoPlay)
        try {
            const data = await getSong({ mood })
            if (data?.song) {
                setSong(data.song)
                return data.song
            }
            setShouldAutoPlay(false)
            return null
        } catch (error) {
            setShouldAutoPlay(false)
            console.error("Unable to load song", error)
            return null
        } finally {
            setLoading(false)
        }
    }

    return {
        song,
        setSong,
        loading,
        handleGetSong,
        shouldAutoPlay,
        setShouldAutoPlay,
    }
}
