/* eslint-disable react-refresh/only-export-components */
import { createContext, useState } from "react";

export const SongContext = createContext();

export const SongContextProvider = ({ children }) => {
    const [song, setSong] = useState({
        url: "https://ik.imagekit.io/smj4dtpzzm/cohort-2/moodify/songs/_Paro_Ow5oNKdWI",
        posterUrl: "https://ik.imagekit.io/smj4dtpzzm/cohort-2/moodify/posters/_Paro_MZxMHKvVI.jpeg",
        title: "Paro",
        mood: "sad",
    });

    const [loading, setLoading] = useState(false);
    const [shouldAutoPlay, setShouldAutoPlay] = useState(false);

    return (
        <SongContext.Provider
            value={{
                song,
                setSong,
                loading,
                setLoading,
                shouldAutoPlay,
                setShouldAutoPlay,
            }}
        >
            {children}
        </SongContext.Provider>
    );
};
