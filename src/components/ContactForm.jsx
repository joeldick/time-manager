import { useState } from 'react';

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

export default ContactForm;
