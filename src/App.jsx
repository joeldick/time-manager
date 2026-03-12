import { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import './App.styles.css';

// Contact Form component
function ContactForm({ isOpen, onClose, baseUrl }) {
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactMessage, setContactMessage] = useState('');

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      setContactMessage('Please fill in all fields');
      return;
    }

    setContactSubmitting(true);
    try {
      const res = await fetch(`${baseUrl}/sendContactEmail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm)
      });

      if (res.ok) {
        setContactMessage('Thank you! Your message has been sent.');
        setContactForm({ name: '', email: '', message: '' });
        setTimeout(onClose, 2000);
      } else {
        setContactMessage('Failed to send message. Please try again.');
      }
    } catch (err) {
      setContactMessage('Error sending message: ' + err.message);
    } finally {
      setContactSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="contact-form-overlay">
      <div className="contact-form-modal">
        <h2>Contact Support</h2>
        <form onSubmit={handleContactSubmit}>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={contactForm.name}
              onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
              placeholder="Your name"
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={contactForm.email}
              onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
              placeholder="your@email.com"
            />
          </div>
          <div className="form-group">
            <label>Message</label>
            <textarea
              value={contactForm.message}
              onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
              placeholder="Your message..."
            />
          </div>
          {contactMessage && (
            <div className={`contact-message ${contactMessage.includes('Thank you') ? 'success' : 'error'}`}>
              {contactMessage}
            </div>
          )}
          <div className="form-buttons">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" disabled={contactSubmitting} className="btn-submit">
              {contactSubmitting ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Footer component
function Footer({ onContactClick }) {
  return (
    <footer>
      <div className="footer-version">
        Time Manager v1.0.0
      </div>
      <div className="footer-links">
        <a href="https://github.com/joeldick/time-manager" target="_blank" rel="noopener noreferrer" className="footer-link">
          GitHub Repository
        </a>
        <a href="https://github.com/joeldick/time-manager/issues" target="_blank" rel="noopener noreferrer" className="footer-link">
          Report Issue
        </a>
        <button onClick={onContactClick} className="footer-link-button">
          Contact Support
        </button>
      </div>
      <div className="footer-copyright">
        © 2026 Time Manager
      </div>
    </footer>
  );
}

// Firebase config
// Note: API key is loaded from environment variable for security
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "gimmetime.firebaseapp.com",
  projectId: "gimmetime",
  storageBucket: "gimmetime.firebasestorage.app",
  messagingSenderId: "306905926127",
  appId: "1:306905926127:web:f6f0a252d1a2d0e0c38e1a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Connect to emulators in local development
// Note: We use production Auth for testing with real authorization
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  // Don't connect to Auth emulator - use production auth for real testing
  // try {
  //   connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  // } catch (e) {
  //   // Emulator already connected or not available
  // }
}

function App() {
  const [kids, setKids] = useState([]);
  const [allowedEmails, setAllowedEmails] = useState([]);
  const [times, setTimes] = useState({});
  const [user, setUser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' }); // 'success', 'error', 'info'
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  let timeoutId = null;
  const authInitializedRef = useRef(false);

  // Show message - never auto-dismisses, user must click close
  const showMessage = (text, type = 'info') => {
    setMessage({ text, type });
  };

  // Clear message manually
  const clearMessage = () => {
    setMessage({ text: '', type: '' });
  };

  // Helper to determine the API base URL based on environment
  const getBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://127.0.0.1:5002/gimmetime/us-central1';
    }
    return '';
  };

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

  // Reset session timeout
  const resetSessionTimeout = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
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
          
          // Initialize times object with "Loading..." for each kid
          const initialTimes = {};
          loadedKids.forEach(kid => {
            initialTimes[kid] = 'Loading...';
          });
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
        // No user logged in
        setUser(null);
        setIsAuthorized(false);
        authInitializedRef.current = false;
      }
    });
    return () => unsubscribe();
  }, []);

  // Check authorization after config loads
  useEffect(() => {
    if (user && allowedEmails.length > 0) {
      const authorized = allowedEmails.includes(user.email);
      setIsAuthorized(authorized);
      
      // Only set message on initial check
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
      // Config loaded but is empty
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
      if (timeoutId) clearTimeout(timeoutId);
    } catch (error) {
      showMessage('Logout failed: ' + error.message, 'error');
    }
  };

  const testConnection = async () => {
    try {
      const baseUrl = getBaseUrl();
      const url = `${baseUrl}/testConnection`;
      const res = await fetchWithRetry(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.text();
      showMessage(data, 'success');
    } catch (err) {
      showMessage("Connection failed: " + err.message, 'error');
    }
  };

  const fetchTime = async (kid, showRefreshMessage = false) => {
    if (showRefreshMessage) {
      setTimes(prev => ({ ...prev, [kid]: 'Updating...' }));
    }
    try {
      const baseUrl = getBaseUrl();
      const res = await fetchWithRetry(`${baseUrl}/grantTime?action=status&kid=${kid}`);
      const data = await res.text();
      const match = data.match(/TIME_LEFT_DAY:\s*(\d+)/);
      const seconds = match ? parseInt(match[1]) : 0;
      const timeLeft = formatTime(seconds);
      setTimes(prev => ({ ...prev, [kid]: timeLeft }));
      if (showRefreshMessage) {
        showMessage(`Time Left refreshed for ${kid}`, 'success');
      }
    } catch (e) {
      setTimes(prev => ({ ...prev, [kid]: 'Error' }));
      if (showRefreshMessage) {
        showMessage(`Failed to refresh time for ${kid}`, 'error');
      }
    }
  };

  const addTime = async (kid, mins) => {
    setTimes(prev => ({ ...prev, [kid]: 'Updating...' }));
    const baseUrl = getBaseUrl();
    try {
      await fetchWithRetry(`${baseUrl}/grantTime?action=add&kid=${kid}&minutes=${mins}`);
      await fetchTime(kid);
      showMessage(`${mins} minutes added to ${kid}`, 'success');
    } catch (e) {
      setTimes(prev => ({ ...prev, [kid]: 'Error' }));
      showMessage(`Failed to add time for ${kid}`, 'error');
    }
  };

  const subtractTime = async (kid, mins) => {
    setTimes(prev => ({ ...prev, [kid]: 'Updating...' }));
    const baseUrl = getBaseUrl();
    try {
      await fetchWithRetry(`${baseUrl}/grantTime?action=subtract&kid=${kid}&minutes=${mins}`);
      await fetchTime(kid);
      showMessage(`${mins} minutes removed from ${kid}`, 'success');
    } catch (e) {
      setTimes(prev => ({ ...prev, [kid]: 'Error' }));
      showMessage(`Failed to subtract time for ${kid}`, 'error');
    }
  };

  const resetTime = async (kid) => {
    setTimes(prev => ({ ...prev, [kid]: 'Updating...' }));
    const baseUrl = getBaseUrl();
    try {
      await fetchWithRetry(`${baseUrl}/grantTime?action=reset&kid=${kid}`);
      await fetchTime(kid);
      showMessage(`Time reset to 0 for ${kid}`, 'success');
    } catch (e) {
      setTimes(prev => ({ ...prev, [kid]: 'Error' }));
      showMessage(`Failed to reset time for ${kid}`, 'error');
    }
  };

  useEffect(() => {
    if (user) {
      const fetchAllTimes = async () => {
        for (const kid of kids) {
          await fetchTime(kid);
        }
      };
      fetchAllTimes();
    }
  }, [user]);

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
        <ContactForm 
          isOpen={isContactFormOpen} 
          onClose={() => setIsContactFormOpen(false)} 
          baseUrl={getBaseUrl()}
        />
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
          <button onClick={handleLogout} className="logout-button">
            Sign Out
          </button>
        </div>

        {/* Message display */}
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
            <button onClick={clearMessage} className="message-close-btn">
              ×
            </button>
          </div>
        )}
        
        {isAuthorized && (
          <button onClick={testConnection} className="test-connection-button">
            Test Remote-Server Connection
          </button>
        )}

        <div className="kids-container">
          {isAuthorized && kids.map(kid => (
            <div key={kid} className="kid-card">
              <h2>{kid.toUpperCase()}</h2>
              <p>
                <span className="time-left-label">Time Left:</span>{' '}
                <span className="time-left-value">{times[kid] || 'Loading...'}</span>
              </p>
              <div className="button-group">
                {[5, 10, 20, 30].map(m => (
                  <button key={m} onClick={() => addTime(kid, m)} className="time-button">
                    +{m} min
                  </button>
                ))}
              </div>
              <div className="button-group">
                {[5, 10, 20, 30].map(m => (
                  <button key={`sub-${m}`} onClick={() => subtractTime(kid, m)} className="time-button">
                    -{m} min
                  </button>
                ))}
              </div>
              <button onClick={() => fetchTime(kid, true)} className="refresh-button">
                Refresh Time Left
              </button>
              <button onClick={() => resetTime(kid)} className="reset-button">
                Reset to 0
              </button>
            </div>
          ))}
        </div>
      </div>
      <ContactForm 
        isOpen={isContactFormOpen} 
        onClose={() => setIsContactFormOpen(false)} 
        baseUrl={getBaseUrl()}
      />
      <Footer onContactClick={() => setIsContactFormOpen(true)} />
    </div>
  );
}

export default App;