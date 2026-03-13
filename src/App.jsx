import { useState, useEffect, useRef } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import ContactForm from './components/ContactForm';
import Footer from './components/Footer';
import KidCard from './components/KidCard';
import './App.styles.css';

// Helper to determine the API base URL based on environment
const getBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://127.0.0.1:5002/gimmetime/us-central1';
  }
  return '';
};

const BASE_URL = getBaseUrl();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Convert seconds to HH:MM:SS format
const formatTime = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// Retry logic with exponential backoff
const fetchWithRetry = async (url, maxRetries = 3) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    } catch (err) {
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      } else {
        throw err;
      }
    }
  }
  throw new Error('Max retries exceeded');
};

function App() {
  const [kids, setKids] = useState([]);
  const [allowedEmails, setAllowedEmails] = useState([]);
  const [times, setTimes] = useState({});
  const [user, setUser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' }); // 'success', 'error', 'info'
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);

  const timeoutIdRef = useRef(null);
  const authInitializedRef = useRef(false);

  const showMessage = (text, type = 'info') => setMessage({ text, type });
  const clearMessage = () => setMessage({ text: '', type: '' });

  const resetSessionTimeout = () => {
    if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    timeoutIdRef.current = setTimeout(() => {
      signOut(auth);
      showMessage('Session expired. Please log in again.', 'error');
    }, SESSION_TIMEOUT);
  };

  // Load configuration from Firestore
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, 'config', 'app'));
        if (configDoc.exists()) {
          const data = configDoc.data();
          console.log('Config loaded from Firestore:', data);
          const loadedKids = data.kids || [];
          setKids(loadedKids);
          setAllowedEmails(data.allowedEmails || []);
          const initialTimes = {};
          loadedKids.forEach(kid => { initialTimes[kid] = 'Loading...'; });
          setTimes(initialTimes);
        } else {
          console.warn('Config not found in Firestore. Using defaults.');
          setKids([]);
          setAllowedEmails([]);
          setTimes({});
        }
      } catch (error) {
        console.error('Error loading config:', error);
        setKids([]);
        setAllowedEmails([]);
        setTimes({});
      }
    };
    loadConfig();
  }, []);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setLoading(false);
      if (currentUser) {
        setUser(currentUser);
      } else {
        setUser(null);
        setIsAuthorized(false);
        authInitializedRef.current = false;
      }
    });
    return () => unsubscribe();
  }, []);

  // Check authorization after config and user load
  useEffect(() => {
    if (user && allowedEmails.length > 0) {
      const authorized = allowedEmails.includes(user.email);
      setIsAuthorized(authorized);

      if (!authInitializedRef.current) {
        authInitializedRef.current = true;
        if (authorized) {
          setMessage({ text: '', type: '' });
          resetSessionTimeout();
          window.addEventListener('mousedown', resetSessionTimeout);
          window.addEventListener('keydown', resetSessionTimeout);
        } else {
          setMessage({ text: 'Your email is not authorized to access the time manager.', type: 'error' });
        }
      }
    } else if (user && allowedEmails.length === 0) {
      console.warn('Config loaded but allowedEmails is empty:', allowedEmails);
    }
  }, [user, allowedEmails]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      showMessage('Login failed: ' + error.message, 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setTimes({});
      setMessage({ text: '', type: '' });
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    } catch (error) {
      showMessage('Logout failed: ' + error.message, 'error');
    }
  };

  const testConnection = async () => {
    try {
      const res = await fetchWithRetry(`${BASE_URL}/testConnection`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.text();
      showMessage(data, 'success');
    } catch (err) {
      showMessage('Connection failed: ' + err.message, 'error');
    }
  };

  const fetchTime = async (kid, showRefreshMessage = false) => {
    if (showRefreshMessage) {
      setTimes(prev => ({ ...prev, [kid]: 'Updating...' }));
    }
    try {
      const res = await fetchWithRetry(`${BASE_URL}/grantTime?action=status&kid=${kid}`);
      const data = await res.text();
      const match = data.match(/TIME_LEFT_DAY:\s*(\d+)/);
      const seconds = match ? parseInt(match[1]) : 0;
      setTimes(prev => ({ ...prev, [kid]: formatTime(seconds) }));
      if (showRefreshMessage) showMessage(`Time Left refreshed for ${kid}`, 'success');
    } catch (e) {
      setTimes(prev => ({ ...prev, [kid]: 'Error' }));
      if (showRefreshMessage) showMessage(`Failed to refresh time for ${kid}`, 'error');
    }
  };

  const addTime = async (kid, mins) => {
    setTimes(prev => ({ ...prev, [kid]: 'Updating...' }));
    try {
      await fetchWithRetry(`${BASE_URL}/grantTime?action=add&kid=${kid}&minutes=${mins}`);
      await fetchTime(kid);
      showMessage(`${mins} minutes added to ${kid}`, 'success');
    } catch (e) {
      setTimes(prev => ({ ...prev, [kid]: 'Error' }));
      showMessage(`Failed to add time for ${kid}`, 'error');
    }
  };

  const subtractTime = async (kid, mins) => {
    setTimes(prev => ({ ...prev, [kid]: 'Updating...' }));
    try {
      await fetchWithRetry(`${BASE_URL}/grantTime?action=subtract&kid=${kid}&minutes=${mins}`);
      await fetchTime(kid);
      showMessage(`${mins} minutes removed from ${kid}`, 'success');
    } catch (e) {
      setTimes(prev => ({ ...prev, [kid]: 'Error' }));
      showMessage(`Failed to subtract time for ${kid}`, 'error');
    }
  };

  const resetTime = async (kid) => {
    setTimes(prev => ({ ...prev, [kid]: 'Updating...' }));
    try {
      await fetchWithRetry(`${BASE_URL}/grantTime?action=reset&kid=${kid}`);
      await fetchTime(kid);
      showMessage(`Time reset to 0 for ${kid}`, 'success');
    } catch (e) {
      setTimes(prev => ({ ...prev, [kid]: 'Error' }));
      showMessage(`Failed to reset time for ${kid}`, 'error');
    }
  };

  useEffect(() => {
    if (user && kids.length > 0) {
      kids.forEach(kid => fetchTime(kid));
    }
  }, [user, kids]);

  if (loading) {
    return <div className="loading-container">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="login-container">
        <div className="login-content">
          <h1>Time Manager</h1>
          <button onClick={handleLogin} className="login-button">
            Sign in with Google
          </button>
        </div>
        <ContactForm isOpen={isContactFormOpen} onClose={() => setIsContactFormOpen(false)} baseUrl={BASE_URL} />
        <Footer onContactClick={() => setIsContactFormOpen(true)} />
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="app-content">
        <h1>Time Manager</h1>

        <div className="user-section">
          <span>Welcome, {user.displayName}!</span>
          <button onClick={handleLogout} className="logout-button">Sign Out</button>
        </div>

        {message.text && (
          <div className={`message-box ${message.type}`}>
            <span className="message-text">{message.text}</span>
            <button
              onClick={() => navigator.clipboard.writeText(message.text)}
              title="Copy to clipboard"
              className="message-copy-btn"
            >
              ⧉
            </button>
            <button onClick={clearMessage} className="message-close-btn">×</button>
          </div>
        )}

        {isAuthorized && (
          <button onClick={testConnection} className="test-connection-button">
            Test Remote-Server Connection
          </button>
        )}

        <div className="kids-container">
          {isAuthorized && kids.map(kid => (
            <KidCard
              key={kid}
              kid={kid}
              time={times[kid]}
              onAddTime={addTime}
              onSubtractTime={subtractTime}
              onRefresh={fetchTime}
              onReset={resetTime}
            />
          ))}
        </div>
      </div>

      <ContactForm isOpen={isContactFormOpen} onClose={() => setIsContactFormOpen(false)} baseUrl={BASE_URL} />
      <Footer onContactClick={() => setIsContactFormOpen(true)} />
    </div>
  );
}

export default App;