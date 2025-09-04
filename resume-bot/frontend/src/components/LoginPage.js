import React, { useState } from "react";
import "./LoginPage.css";

function LoginPage({ onLogin, error }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    onLogin(username, password);
  }

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit} autoComplete="off">
        <h2>HRSBOT HR Login</h2>
        <div className="form-group">
          <input
            type="text"
            id="username"
            name="username"
            placeholder="Username"
            value={username}
            autoFocus
            onChange={e => setUsername(e.target.value)}
            required
            aria-label="Username"
            aria-required="true"
          />
        </div>
        <div className="form-group">
          <input
            type="password"
            id="password"
            name="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            aria-label="Password"
            aria-required="true"
          />
        </div>
        <button type="submit" className="btn-primary">Login</button>
        {error && <div className="login-error" role="alert">{error}</div>}
      </form>
    </div>
  );
}

export default LoginPage;
