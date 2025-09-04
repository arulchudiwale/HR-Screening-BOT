import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import WeightsForm from './components/WeightsForm';
import ResultsTable from './components/ResultsTable';
import LoginPage from './components/LoginPage';
import { evaluateResumes } from './api/api';
import jswLogo from './assets/jsw-logo.png';
import './App.css';
// at top with your other imports
import AdminLogsTable from "./components/AdminLogsTable";

/* ===================== AUTH HELPERS (ADD) ===================== */
const API = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

function getToken() {
  return localStorage.getItem("token");
}
function getUser() {
  const s = localStorage.getItem("user");
  return s ? JSON.parse(s) : null;
}
function saveSession(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}
function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
function signOut() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.reload();
}
/* ============================================================= */

function App() {
  // HR Authentication state
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [user, setUser] = useState(null);                // (ADD) current user {username, role}
  const [adminLogs, setAdminLogs] = useState([]);        // (ADD) admin-only logs

  // Main app state
  const [jdFile, setJDFile] = useState(null);
  const [resumeFiles, setResumeFiles] = useState([]);
  const [weights, setWeights] = useState({ skills: 40, experience: 30, education: 20, industry: 10 });
  const [remarkStyle, setRemarkStyle] = useState('Professional');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // (ADD) Persisted session on refresh
  useEffect(() => {
    const u = getUser();
    if (u && getToken()) {
      setLoggedIn(true);
      setUser(u);
    }
  }, []);

  // LOGIN HANDLER (REPLACED to call backend /auth/login)
  async function handleLogin(username, password) {
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        const msg = await res.text();
        setLoginError(msg || "Login failed");
        return;
      }
      const { token, user } = await res.json(); // {token, user:{username, role}}
      saveSession(token, user);
      setUser(user);
      setLoggedIn(true);
      setLoginError("");
    } catch (e) {
      setLoginError("Network error logging in");
    }
  }

  // LOGOUT HANDLER (KEEP + clear token/user)
  function handleLogout() {
    // clear persisted auth
    signOut(); // will reload the page; below resets are just-in-case during local dev
    setLoggedIn(false);
    setLoginError("");
    setUser(null);
    setJDFile(null);
    setResumeFiles([]);
    setWeights({ skills: 40, experience: 30, education: 20, industry: 10 });
    setRemarkStyle('Professional');
    setResults(null);
    setLoading(false);
    setError("");
  }

  // FILE HANDLERS
  function handleJDChange(e) {
    setJDFile(e.target.files[0]);
  }
  function handleResumeChange(e) {
    setResumeFiles(Array.from(e.target.files));
  }

  // (ADD) Admin logs fetcher
  async function loadAdminLogs() {
    try {
      const res = await fetch(`${API}/admin/logs?limit=200`, {
        headers: { ...authHeaders() }
      });
      if (res.status === 401) { signOut(); return; }
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json(); // {items:[...]}
      setAdminLogs(data.items || []);
    } catch (e) {
      setError(e.message || "Failed to load logs");
    }
  }

  // SUBMIT HANDLER (MODIFIED to send JWT to /evaluate)
  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 100) > 1) {
      setError("The sum of weights must be 100");
      setLoading(false);
      return;
    }
    if (!jdFile || resumeFiles.length === 0) {
      setError("Please upload a JD and at least one resume.");
      setLoading(false);
      return;
    }
    const allowedExt = ['pdf', 'docx'];
    if (
      jdFile &&
      !allowedExt.includes(jdFile.name.split('.').pop().toLowerCase())
    ) {
      setError("JD must be PDF or DOCX.");
      setLoading(false);
      return;
    }
    if (
      resumeFiles.some(
        file => !allowedExt.includes(file.name.split('.').pop().toLowerCase())
      )
    ) {
      setError("All resumes must be PDF or DOCX files.");
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('jd', jdFile);
    resumeFiles.forEach(file => formData.append('resumes', file));
    formData.append('remarkStyle', remarkStyle);
    formData.append('weights', JSON.stringify(weights));

    try {
      // NOTE: Keeping the import of evaluateResumes, but we now call the backend directly
      // so we can attach the Authorization header required by your FastAPI.
      const res = await fetch(`${API}/evaluate`, {
        method: "POST",
        headers: { ...authHeaders() },   // <-- IMPORTANT: send JWT
        body: formData
      });
      if (res.status === 401) { signOut(); return; }
      if (!res.ok) throw new Error(await res.text());
      const payload = await res.json(); // { success, data, error }
      if (!payload.success) throw new Error(payload.error || "Unknown error");
      setResults(payload.data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
      // Optionally auto-clear inputs on fatal error (UX)
      // setJDFile(null); setResumeFiles([]);
    }
  }

  const isAdmin = !!user && user.role === "admin";

  return (
    <div className="app-container">
      {/* ---- Header with logo, title and user info ---- */}
      <div className="jsw-branding-bar">
        <div className="logo-section">
          <img src={jswLogo} alt="JSW Paints Logo" className="jsw-logo" />
                  <div className="jsw-title">JSW Paints</div>
        </div>
        <h1 className="header-title">HRSBOT-Resume Screening</h1>
        {loggedIn && user && (
          <div className="user-info">
            <span>Signed in as <b>{user.username}</b> ({user.role})</span>
            <button onClick={handleLogout}>Logout</button>
          </div>
        )}
      </div>

      {/* Login gate: if not logged in, show only login form below logo */}
      {!loggedIn ? (
        <LoginPage onLogin={handleLogin} error={loginError} />
      ) : (
        <>

          {/* ---- Main Form ---- */}
          <div className="card">
            <h3>Upload Documents</h3>
            <form onSubmit={handleSubmit}>
              <FileUpload label="Upload JD File" multiple={false} accept=".pdf,.docx" onChange={handleJDChange} />
              <FileUpload label="Upload Resume(s)" multiple={true} accept=".pdf,.docx" onChange={handleResumeChange} />
              <WeightsForm weights={weights} setWeights={setWeights} />
              <div className="form-group">
                <label className="form-label">Remark Style: </label>
                <select 
                  className="form-control" 
                  value={remarkStyle} 
                  onChange={e => setRemarkStyle(e.target.value)}
                >
                  <option value="Professional">Professional</option>
                  <option value="Friendly">Friendly</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <button type="submit" disabled={loading} className="btn-primary">Evaluate</button>
            </form>
          </div>

          {/* ---- Status/Results ---- */}
          {error && (
            <div className="error">
              {error}
            </div>
          )}
          {loading && <div className="loading">Processing...</div>}
          {results && (
            <>
              {/* PASS BOTH LISTS SO EITHER TABLE CAN EXPORT A SINGLE WORKBOOK */}
              <div className="card">
                <ResultsTable
                  title="Accepted Resumes"
                  data={results.accepted}
                  acceptedResults={results.accepted}   // NEW
                  rejectedResults={results.rejected}   // NEW
                />
              </div>
              <div className="card">
                <ResultsTable
                  title="Rejected Resumes"
                  data={results.rejected}
                  acceptedResults={results.accepted}   // NEW
                  rejectedResults={results.rejected}   // NEW
                />
              </div>
            </>
          )}

          {/* ---- Admin-only Logs (ADD) ---- */}
          {isAdmin && (
            <div className="card">
              <AdminLogsTable apiBase={API} />
            </div>
          )}
          
        </>
      )}
    </div>
  );
}

export default App;
