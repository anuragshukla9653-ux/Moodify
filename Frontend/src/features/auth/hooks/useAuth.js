import { login, register, getMe, logout } from "../services/auth.api";
import { useCallback, useContext, useEffect } from "react";
import { AuthContext } from "../auth.context";


export const useAuth = () => {
    const context = useContext(AuthContext)
    const { user, setUser, loading, setLoading } = context

    async function handleRegister({ email, username, password }) {
        setLoading(true)
        try {
            const data = await register({ username, email, password })
            setUser(data.user)
            return data.user
        } catch (error) {
            console.error("Unable to register", error)
            throw error
        } finally {
            setLoading(false)
        }
    }

    async function handleLogin ({ username, password, email }) {
        setLoading(true)
        try {
            const data = await login({ username, email, password })
            setUser(data.user)
            return data.user
        } catch (error) {
            console.error("Unable to login", error)
            throw error
        } finally {
            setLoading(false)
        }
    }

    const handleGetMe = useCallback(async () => {
        setLoading(true)
        try {
            const data = await getMe()
            setUser(data.user)
            return data.user
        } catch (error) {
            setUser(null)
            console.warn("Unable to restore session", error)
            return null
        } finally {
            setLoading(false)
        }
    }, [setLoading, setUser])

    async function handleLogout() {
        setLoading(true)
        try {
            await logout()
            setUser(null)
        } catch (error) {
            console.error("Unable to logout", error)
            setUser(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void handleGetMe()
    }, [handleGetMe])  

    return ({
        user, loading, handleLogin, handleRegister, handleGetMe, handleLogout,
    })
}
