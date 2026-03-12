# Time Manager

A web-based application for managing computer usage time limits for multiple users via SSH. Built with React, Vite, Firebase, and Node.js Cloud Functions.

## Features

- **Google Sign-In Authentication** - Secure login with email-based access control
- **Real-time Time Display** - Shows remaining computer time in HH:MM:SS format
- **Time Management** - Add, subtract, or reset time limits for each user
- **User Feedback** - On-page messages for all actions (add/subtract/reset/refresh)
- **Retry Logic** - Exponential backoff for SSH connections to handle temporary failures
- **Session Timeout** - 30-minute inactivity timeout for security
- **Responsive UI** - Clean interface with professional footer
- **Copy to Clipboard** - Easy error message reporting

## Tech Stack

- **Frontend**: React 19 + Vite 7
- **Backend**: Firebase Cloud Functions (Node.js)
- **Authentication**: Firebase Auth with Google Sign-In
- **Infrastructure**: Firebase Hosting & Secrets Manager
- **SSH**: ssh2 library for server communication
- **CI/CD**: GitHub Actions for auto-deployment

## Prerequisites

- Node.js 18+
- Firebase CLI
- SSH access to your server
- Firebase project (with Blaze plan for Cloud Functions)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/time-manager.git
cd time-manager
```

2. Install dependencies:
```bash
npm install
cd functions && npm install && cd ..
```

3. Set up Firebase:
```bash
firebase login
firebase use gimmetime
```

4. Download service account key (if you don't have it locally):
   - Go to Firebase Console > Project Settings > Service Accounts
   - Click "Generate New Private Key"
   - Save as `serviceAccountKey.json` in the project root (already in .gitignore)

5. Initialize Firestore and configuration:
```bash
npm run setup-firebase
```

This uses your existing SSH key from Secret Manager and creates/initializes Firestore.

6. Update configuration with your actual settings:
```bash
npm run manage-config -- add-kid child1
npm run manage-config -- add-kid child2
npm run manage-config -- add-email authorized@example.com
npm run manage-config -- list
```

## Local Development

Start the Firebase emulators and dev server:

**Terminal 1 - Emulators:**
```bash
firebase emulators:start
```

**Terminal 2 - Vite Dev Server:**
```bash
npm run dev
```

Open http://localhost:5173 in your browser.

## Deployment

Push to main branch to trigger GitHub Actions:
```bash
git push origin main
```

The workflow will automatically build and deploy to Firebase Hosting.

Manual deployment:
```bash
npm run build
firebase deploy
```

## Configuration

Configuration is stored in Firestore under `config/app` collection. Use the CLI tool to manage it:

### Managing Kids
```bash
npm run manage-config -- add-kid child1
npm run manage-config -- remove-kid child1
```

### Managing Authorized Emails
```bash
npm run manage-config -- add-email user@example.com
npm run manage-config -- remove-email user@example.com
```

### View Current Configuration
```bash
npm run manage-config -- list
```

### SSH Server
Configure SSH connection in `functions/index.js`:
```javascript
host: process.env.SSH_HOST || "your-server-ip",
port: 50022,
username: "your-username",
```

## Project Structure

```
├── src/
│   ├── App.jsx              # Main React component
│   ├── App.css              # Styles
│   └── main.jsx             # Entry point
├── functions/
│   ├── index.js             # Cloud Functions (grantTime, testConnection)
│   └── package.json
├── firebase.json            # Firebase configuration
├── vite.config.js           # Vite configuration
├── package.json
└── README.md
```

## API Endpoints

All endpoints are Cloud Functions accessed via `/grantTime` and `/testConnection`:

### grantTime
- `action=status&kid=<name>` - Get remaining time
- `action=add&kid=<name>&minutes=<num>` - Add time
- `action=subtract&kid=<name>&minutes=<num>` - Remove time
- `action=reset&kid=<name>` - Reset to 0

### testConnection
- Tests SSH connectivity to the server

## Security

- SSH private key stored in Firebase Secret Manager
- Email-based access control
- 30-minute session timeout
- No sensitive data in version control
- Server IP and credentials managed via environment variables

## Error Handling

- Exponential backoff retry logic (3 attempts, 2^n second delays)
- User-friendly error messages displayed on-page
- Copy-to-clipboard button for error reporting

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

[Add your license here]

## Support

For issues or questions, please open an issue on GitHub or contact the repository maintainer.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss.

---

Built with ❤️ using React, Firebase, and Node.js
