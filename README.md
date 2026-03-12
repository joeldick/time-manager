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
- **Database**: Firebase Firestore (for configuration management)
- **Authentication**: Firebase Auth with Google Sign-In
- **Infrastructure**: Firebase Hosting & Secret Manager
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

3. Set up Firebase project:
```bash
firebase login
firebase init
```

   During `firebase init`, select:
   - ✅ **Firestore** - For storing configuration (kids, authorized emails)
   - ✅ **Functions** - For SSH command execution
   - ✅ **Hosting** - For deploying the web app
   - ✅ **Authentication** - For Google Sign-In

   When prompted for a project, create a new Firebase project or select an existing one.

4. After initialization, link your project:
```bash
firebase use <your-firebase-project-id>
```

   Replace `<your-firebase-project-id>` with your actual Firebase project ID (e.g., `gimmetime`, `time-manager-abc123`, etc.).

5. Download service account key (if you don't have it locally):
   - Go to Firebase Console > Project Settings > Service Accounts
   - Click "Generate New Private Key"
   - Save as `serviceAccountKey.json` in the project root (already in .gitignore)

6. Initialize Firestore and configuration:
```bash
npm run setup-firebase
```

   This creates/initializes Firestore with default configuration.

7. Update configuration with your actual settings:
```bash
npm run manage-config -- add-kid <child_name>
npm run manage-config -- add-email <your-email@example.com>
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

### Initial Setup Steps

After running `npm run setup-firebase`, configure your children and authorized users:

#### 1. Remove Default Kids
```bash
npm run manage-config -- remove-kid child1
npm run manage-config -- remove-kid child2
npm run manage-config -- remove-kid child3
```

#### 2. Add Your Kids
```bash
npm run manage-config -- add-kid <child_name>
npm run manage-config -- add-kid <child_name>
npm run manage-config -- add-kid <child_name>
```

#### 3. Remove Default Email
```bash
npm run manage-config -- remove-email user@example.com
```

#### 4. Add Authorized Emails
```bash
npm run manage-config -- add-email <your-email@example.com>
npm run manage-config -- add-email <family-email@example.com>
```

**Note:** Only users with email addresses in the authorized list can access the application.

### Managing Kids
```bash
npm run manage-config -- add-kid <child_name>
npm run manage-config -- remove-kid <child_name>
```

### Managing Authorized Emails
```bash
npm run manage-config -- add-email <email@example.com>
npm run manage-config -- remove-email <email@example.com>
```

### View Current Configuration
```bash
npm run manage-config -- list
```

**Important:** Configuration changes are applied immediately to the live application—no redeployment needed!

## SSH Server Setup

To enable the Time Manager to control computer usage on your Linux machine, you need to configure SSH access:

### 1. Enable SSH on Your Linux Machine

```bash
# Install OpenSSH server (if not already installed)
sudo apt-get install openssh-server

# Start SSH service
sudo systemctl start ssh
sudo systemctl enable ssh  # Enable on boot
```

### 2. Configure SSH on a Non-Standard Port (50022)

Edit the SSH configuration file:
```bash
sudo nano /etc/ssh/sshd_config
```

Find and modify these lines:
```
Port 50022
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

Restart SSH to apply changes:
```bash
sudo systemctl restart ssh
```

### 3. Set Up SSH Key Authentication

Generate an SSH key pair (run on your development machine):
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/timemanager_key
```

Copy the public key to your Linux machine:
```bash
ssh-copy-id -i ~/.ssh/timemanager_key.pub -p 50022 your-username@your-server-ip
```

### 4. Set Up Port Forwarding on Your Router

1. Log in to your router's admin panel (usually 192.168.1.1 or 192.168.0.1)
2. Find **Port Forwarding** settings
3. Forward external port 50022 to your Linux machine's internal IP on port 50022
4. Save and apply settings

### 5. (Optional) Set Up Dynamic DNS

If your ISP assigns a dynamic IP address, use a Dynamic DNS (DDNS) service:

Popular options:
- [Duck DNS](https://www.duckdns.org/) (free)
- [No-IP](https://www.noip.com/) (free tier available)
- [Cloudflare DDNS](https://developers.cloudflare.com/dns/zone-setups/zone-transfers/migrated-domains/setup-instructions/)

After setting up DDNS, use your domain name instead of an IP address:

```javascript
// In functions/index.js
host: process.env.SSH_HOST || "yourdomain.duckdns.org",
port: 50022,
username: "your-username",
```

### 6. Configure SSH Host in Firebase

Store your SSH host in Firebase Secret Manager:

```bash
firebase functions:secrets:set SSH_HOST
# Enter: your-server-ip or your-domain.duckdns.org
```

The application will use `process.env.SSH_HOST` to connect to your server.

### 7. Configure Contact Form Email (Optional)

To enable the contact form feature in the application, set up email configuration:

```bash
firebase functions:config:set contact.support_email="your-support@example.com"
firebase functions:config:set contact.gmail_user="your-gmail@gmail.com"
firebase functions:config:set contact.gmail_password="your-app-password"
```

**For local development**, create a `functions/.env.local` file:
```bash
cp functions/.env.example functions/.env.local
# Edit .env.local with your actual Gmail credentials and support email
```

Then load the environment variables when running the emulator:
```bash
export $(cat functions/.env.local | xargs)
firebase emulators:start
```

**Note:** The `.env.local` file is automatically ignored by git (see .gitignore).

### 8. Test SSH Connection

### 8. Test SSH Connection

From your development machine, test the connection:
```bash
ssh -i ~/.ssh/timemanager_key -p 50022 your-username@your-server-ip
```

If successful, you should see your Linux shell prompt.

### 9. Configure SSH Commands

Your Linux machine needs the `timekpra` command installed and available for the SSH user. Ensure it's in the system PATH or referenced with the full path in `functions/index.js`.

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
