import { useState } from "react"
import { Link } from "react-router-dom";
import "../style/register.css";
import FormGroup from '../components/FormGroup';
import { useAuth } from "../hooks/useAuth"
import { useNavigate } from "react-router-dom"

const Register = () => {

  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  const { handleRegister} = useAuth()

  const navigate = useNavigate()

  async function handleSubmit (e) {
    e.preventDefault()
    setErrorMessage("")

    if (!username.trim() || !email.trim() || !password.trim()) {
      setErrorMessage("Username, email and password are required")
      return
    }

    try {
      await handleRegister({ username, email, password })
      navigate("/")
    } catch (error) {
      setErrorMessage(error.message || "Unable to register")
    }
  }

  return (
    <main className="register-page">
      <div className="form-container">
        <h1>Register</h1>
        <form onSubmit={handleSubmit}>
          <FormGroup
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            label="Username" placeholder="Enter your username" name="username" />
          <FormGroup
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            label="Email" placeholder="Enter your email" type="email" name="email" />
          <FormGroup
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            label="Password" placeholder="Enter your password" type="password" name="password" />
          <button className="button" type="submit">Create account</button>
          {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
        </form>
        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </main>
  )
}

export default Register;
