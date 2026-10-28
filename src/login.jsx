
import React, { useState } from "react";
import { Dumbbell, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import "./Login.css";
import API_BASE_URL from "./services/api.js";

const API = import.meta.env.VITE_API_URL || API_BASE_URL;

export default function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint =
        mode === "login"
          ? "/api/auth/login"
          : "/api/auth/register";

      const response = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "login"
            ? { email, password }
            : { name, email, password }
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Authentication failed.");
      }

      // Expected response: { access_token, user: { id, name, email } }
      if (!data.access_token || !data.user?.id) {
        throw new Error("Invalid authentication response from server.");
      }

      // Pass credentials to the parent application.
      onLogin(data);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Cannot connect to the server. Please start the backend."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-decoration">
        <div className="login-logo">
          <Dumbbell size={24} />
        </div>

        <span className="login-eyebrow">YOUR PERSONAL TRAINING LOG</span>

        <h1>
          BUILD STRENGTH.
          <br />
          <span>TRACK PROGRESS.</span>
        </h1>

        <p>
          Your workouts. Your records. Your progress.
          Everything you need to keep moving forward.
        </p>

        <div className="login-stats">
          <div>
            <strong>01</strong>
            <span>SHOW UP</span>
          </div>
          <div>
            <strong>02</strong>
            <span>PUT IN WORK</span>
          </div>
          <div>
            <strong>03</strong>
            <span>GET STRONGER</span>
          </div>
        </div>
      </div>

      <div className="login-side">
        <div className="login-card">
          <div className="mobile-logo">
            <div className="login-logo">
              <Dumbbell size={22} />
            </div>
            <span>FORM / LOG</span>
          </div>

          <span className="login-eyebrow">
            {mode === "login" ? "WELCOME BACK" : "START YOUR JOURNEY"}
          </span>

          <h2>
            {mode === "login" ? "Good to see you." : "Create your account."}
          </h2>

          <p className="login-subtitle">
            {mode === "login"
              ? "Sign in to continue your training."
              : "Create an account to track your progress."}
          </p>

          <form onSubmit={handleSubmit}>
            {mode === "register" && (
              <label className="login-field">
                <span>FULL NAME</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  maxLength={80}
                  required
                />
              </label>
            )}

            <label className="login-field">
              <span>EMAIL ADDRESS</span>
              <div className="login-input-wrap">
                <Mail size={17} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  maxLength={254}
                  required
                />
              </div>
            </label>

            <label className="login-field">
              <span>PASSWORD</span>
              <div className="login-input-wrap">
                <Lock size={17} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  minLength={8}
                  maxLength={128}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            <button className="login-submit" type="submit" disabled={loading}>
              {loading
                ? "PLEASE WAIT..."
                : mode === "login"
                  ? "SIGN IN"
                  : "CREATE ACCOUNT"}
              {!loading && <ArrowRight size={17} />}
            </button>
          </form>

          <div className="login-switch">
            {mode === "login" ? (
              <>
                New to Form / Log?{" "}
                <button onClick={() => {
                  setMode("register");
                  setError("");
                }}>
                  Create account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button onClick={() => {
                  setMode("login");
                  setError("");
                }}>
                  Sign in
                </button>
              </>
            )}
          </div>

          <div className="login-footer">
            FORM / LOG <span>·</span> PERSONAL TRAINING
          </div>
        </div>
      </div>
    </div>
  );
}
