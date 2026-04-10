import { Link } from "react-router-dom";
import { useState } from "react";
import "../style/login.css";
import FormGroup from '../components/FormGroup';
import { useAuth } from "../hooks/useAuth"
import { useNavigate } from "react-router-dom"

export default function Login() {

    const { handleLogin } = useAuth()
    const navigate = useNavigate()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    async function handleSubmit(e) {
        e.preventDefault()
        await handleLogin({ email, password })
        navigate("/")
    }
    return (
        <main className="login-page">
            <div className="form-container">
                <h1>Login</h1>
                <form onSubmit={handleSubmit}>
                    <FormGroup
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        label="Email" placeholder="Enter your email"
                        type="email"
                        name="email" />
                    <FormGroup
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        label="Password"
                        placeholder="Enter your password" type="password"
                        name="password" />
                    <button className="button" type="submit">Sign in</button>
                </form>
                <p>
                    New here? <Link to="/register">Create an account</Link>
                </p>
            </div>
        </main>
    );
}
