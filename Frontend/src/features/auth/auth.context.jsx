/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect, useState } from "react"
import { getMe, login, logout, register } from "./services/auth.api"

export const AuthContext = createContext()

function getErrorMessage(error, fallback) {
    return error?.response?.data?.message || error?.message || fallback
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    async function handleRegister({ email, username, password }) {
        setLoading(true)
        try {
            const data = await register({ username, email, password })
            setUser(data.user)
            return data.user
        } catch (error) {
            const message = getErrorMessage(error, "Unable to register")
            console.error("Unable to register", message)
            throw new Error(message)
        } finally {
            setLoading(false)
        }
    }

    async function handleLogin({ username, password, email }) {
        setLoading(true)
        try {
            const data = await login({ username, email, password })
            setUser(data.user)
            return data.user
        } catch (error) {
            const message = getErrorMessage(error, "Unable to login")
            console.error("Unable to login", message)
            throw new Error(message)
        } finally {
            setLoading(false)
        }
    }

    async function handleGetMe() {
        setLoading(true)
        try {
            const data = await getMe()
            setUser(data.user)
            return data.user
        } catch (error) {
            setUser(null)

            if (error?.response?.status !== 401) {
                console.warn("Unable to restore session", error)
            }

            return null
        } finally {
            setLoading(false)
        }
    }

    async function handleLogout() {
        setLoading(true)
        try {
            await logout()
        } catch (error) {
            console.error("Unable to logout", error)
        } finally {
            setUser(null)
            setLoading(false)
        }
    }

    useEffect(() => {
        void handleGetMe()
    }, [])

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                setUser,
                setLoading,
                handleLogin,
                handleRegister,
                handleGetMe,
                handleLogout,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}
