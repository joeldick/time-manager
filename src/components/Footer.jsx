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

export default Footer;
