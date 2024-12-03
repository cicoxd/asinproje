// App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BrowserRouter as Router,
  Route,
  Switch,
  Redirect
} from 'react-router-dom';

const API_URL = 'http://your-domain.com:3000';

function Login({ setToken }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${API_URL}/login`, { email, password });
      setToken(data.token);
      localStorage.setItem('token', data.token);
    } catch (error) {
      alert('Login failed');
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">Login</button>
      </form>
    </div>
  );
}

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/register`, { email, password });
      alert('Registration successful. Please wait for admin approval.');
    } catch (error) {
      alert('Registration failed');
    }
  };

  return (
    <div className="register-container">
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">Register</button>
      </form>
    </div>
  );
}

function AdminPanel() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [stats, setStats] = useState([]);

  useEffect(() => {
    loadPendingUsers();
    loadStats();
  }, []);

  const loadPendingUsers = async () => {
    const { data } = await axios.get(`${API_URL}/admin/pending-users`);
    setPendingUsers(data);
  };

  const loadStats = async () => {
    const { data } = await axios.get(`${API_URL}/asins/stats`);
    setStats(data);
  };

  const approveUser = async (userId) => {
    await axios.post(`${API_URL}/admin/approve-user/${userId}`);
    loadPendingUsers();
  };

  return (
    <div className="admin-panel">
      <h2>Pending Users</h2>
      <ul>
        {pendingUsers.map(user => (
          <li key={user._id}>
            {user.email}
            <button onClick={() => approveUser(user._id)}>Approve</button>
          </li>
        ))}
      </ul>

      <h2>User Statistics</h2>
      <ul>
        {stats.map(stat => (
          <li key={stat._id}>
            {stat.user[0].email}:
            Approved: {stat.approved},
            Rejected: {stat.rejected}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ASINManager() {
  const [asins, setAsins] = useState([]);
  const [currentAsin, setCurrentAsin] = useState(null);

  useEffect(() => {
    loadPendingASINs();
  }, []);

  const loadPendingASINs = async () => {
    const { data } = await axios.get(`${API_URL}/asins/pending`);
    setAsins(data);
    setCurrentAsin(data[0] || null);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      const asins = e.target.result.split('\n').map(asin => asin.trim()).filter(Boolean);
      await axios.post(`${API_URL}/asins/bulk`, { asins });
      loadPendingASINs();
    };
    reader.readAsText(file);
  };

  const handleDecision = async (status) => {
    if (!currentAsin) return;
    await axios.post(`${API_URL}/asins/${currentAsin._id}/review`, { status });
    loadPendingASINs();
  };

  return (
    <div className="asin-manager">
      <input type="file" accept=".txt" onChange={handleFileUpload} />
      
      {currentAsin && (
        <div className="asin-review">
          <h3>Current ASIN: {currentAsin.asin}</h3>
          <iframe src={`https://www.amazon.com/dp/${currentAsin.asin}`} />
          <iframe src={`https://www.amazon.ca/dp/${currentAsin.asin}`} />
          <button onClick={() => handleDecision('approved')}>Approve</button>
          <button onClick={() => handleDecision('rejected')}>Reject</button>
        </div>
      )}

      <div className="stats">
        Remaining ASINs: {asins.length}
      </div>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  if (!token) {
    return (
      <Router>
        <Switch>
          <Route path="/register" component={Register} />
          <Route path="/login" render={() => <Login setToken={setToken} />} />
          <Redirect to="/login" />
        </Switch>
      </Router>
    );
  }

  return (
    <Router>
      <Switch>
        <Route path="/admin" component={AdminPanel} />
        <Route path="/asins" component={ASINManager} />
        <Redirect to="/asins" />
      </Switch>
    </Router>
  );
}

export default App;
