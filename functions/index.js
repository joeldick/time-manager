const { onRequest } = require("firebase-functions/v2/https");
const { Client } = require("ssh2");
const { defineSecret } = require("firebase-functions/params");
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// Define the secret you stored in Firebase
const sshKey = defineSecret("SSH_PRIVATE_KEY");

// Function to get secret from Secret Manager (for emulator/fallback)
const getSSHKeyFromSecretManager = async () => {
  try {
    const client = new SecretManagerServiceClient();
    const projectId = process.env.GCLOUD_PROJECT || "gimmetime";
    const name = client.secretVersionPath(projectId, "SSH_PRIVATE_KEY", "latest");
    console.log(`[SSH Debug] Fetching SSH key from Secret Manager: project=${projectId}`);
    const [version] = await client.accessSecretVersion({ name });
    const key = version.payload.data.toString();
    console.log(`[SSH Debug] Successfully fetched SSH key from Secret Manager (length: ${key.length})`);
    return key;
  } catch (err) {
    console.error("[SSH Debug] Failed to fetch SSH key from Secret Manager:", err.message);
    return null;
  }
};

// Function to get SSH configuration from Firestore config
const getSSHConfigFromFirestore = async () => {
  try {
    const configRef = admin.firestore().collection('config').doc('app');
    const config = await configRef.get();
    const configData = config.data() || {};
    const sshHost = configData.sshHost;
    const sshPort = configData.sshPort || 22;  // Default to standard SSH port if not set
    const sshUsername = configData.sshUsername;
    
    if (!sshHost) {
      throw new Error("SSH host not configured in Firestore config/app document");
    }
    if (!sshUsername) {
      throw new Error("SSH username not configured in Firestore config/app document");
    }
    
    return { sshHost, sshPort, sshUsername };
  } catch (err) {
    console.error("[SSH Debug] Failed to get SSH configuration from Firestore:", err.message);
    throw err;
  }
};

// Retry function with exponential backoff
const executeSSHCommand = async (cmd, sshConfig, maxRetries = 3) => {
  return new Promise(async (resolve, reject) => {
    const { sshHost, sshPort, sshUsername } = sshConfig;
    
    // Try to get SSH key from defineSecret first, then fallback to Secret Manager
    let privateKey = sshKey.value();
    console.log(`[SSH Debug] defineSecret SSH_PRIVATE_KEY available: ${!!privateKey}`);
    
    if (!privateKey) {
      console.log("[SSH Debug] SSH key not available from defineSecret, fetching from Secret Manager...");
      privateKey = await getSSHKeyFromSecretManager();
    }
    
    if (!privateKey) {
      const err = "SSH private key not available from any source (defineSecret or Secret Manager)";
      console.error(`[SSH Debug] ${err}`);
      reject(new Error(err));
      return;
    }
    
    console.log(`[SSH Debug] SSH connection attempt to ${sshHost}:${sshPort} (attempt 1/${maxRetries})`);
    
    const attempt = (retryCount) => {
      const conn = new Client();
      let responded = false;
      
      const timeout = setTimeout(() => {
        console.log(`[SSH Debug] Connection timeout on attempt ${retryCount + 1}`);
        conn.end();
        if (retryCount < maxRetries - 1) {
          const waitTime = Math.pow(2, retryCount);
          console.log(`[SSH Debug] Retrying in ${waitTime} seconds...`);
          setTimeout(() => attempt(retryCount + 1), waitTime * 1000);
        } else {
          reject(new Error('SSH command timeout after retries'));
        }
      }, 10000);

      conn.on("ready", () => {
        console.log(`[SSH Debug] SSH connection ready, executing: ${cmd}`);
        conn.exec(cmd, (err, stream) => {
          clearTimeout(timeout);
          if (err) {
            console.error(`[SSH Debug] SSH exec error on attempt ${retryCount + 1}:`, err.message);
            conn.end();
            if (retryCount < maxRetries - 1) {
              const waitTime = Math.pow(2, retryCount);
              console.log(`[SSH Debug] Retrying in ${waitTime} seconds...`);
              setTimeout(() => attempt(retryCount + 1), waitTime * 1000);
            } else {
              reject(err);
            }
            return;
          }
          let data = '';
          stream.on('data', (d) => { data += d; });
          stream.on('close', () => { 
            console.log(`[SSH Debug] SSH stream closed, got ${data.length} bytes of data`);
            conn.end();
            if (!responded) {
              responded = true;
              resolve(data);
            }
          });
        });
      }).on("error", (err) => {
        console.error(`[SSH Debug] SSH connection error on attempt ${retryCount + 1}:`, err.message);
        clearTimeout(timeout);
        if (retryCount < maxRetries - 1) {
          const waitTime = Math.pow(2, retryCount);
          console.log(`[SSH Debug] Retrying in ${waitTime} seconds...`);
          setTimeout(() => attempt(retryCount + 1), waitTime * 1000);
        } else {
          reject(err);
        }
      }).connect({
        host: sshHost,
        port: sshPort,
        username: sshUsername,
        privateKey: privateKey,
        readyTimeout: 15000,
        connectionTimeout: 15000
      });
    };
    
    attempt(0);
  });
};

exports.grantTime = onRequest({ secrets: [sshKey] }, async (req, res) => {
  const { action, kid, minutes } = req.query;
  
  try {
    // Get SSH configuration from Firestore config
    const sshConfig = await getSSHConfigFromFirestore();
    
    let cmd;
    if (action === 'status') {
      cmd = `timekpra --userinfo ${kid}`;
    } else if (action === 'add') {
      cmd = `timekpra --settimeleft ${kid} '+' ${minutes * 60}`;
    } else if (action === 'subtract') {
      cmd = `timekpra --settimeleft ${kid} '-' ${minutes * 60}`;
    } else if (action === 'reset') {
      cmd = `timekpra --settimeleft ${kid} '=' 0`;
    }

    const data = await executeSSHCommand(cmd, sshConfig);
    res.status(200).send(data);
  } catch (err) {
    console.error('[SSH Error in grantTime]', err.message);
    console.error('[SSH Error Stack]', err.stack);
    // Return error details instead of silent mock data
    res.status(500).send(`SSH Error: ${err.message}`);
  }
});

exports.testConnection = onRequest({ secrets: [sshKey] }, async (req, res) => {
  try {
    // Get SSH configuration from Firestore config
    const sshConfig = await getSSHConfigFromFirestore();
    
    const data = await executeSSHCommand("hostname", sshConfig);
    res.status(200).send("Connection successful! Server hostname: " + data.trim());
  } catch (err) {
    console.error('[SSH Error in testConnection]', err.message);
    console.error('[SSH Error Stack]', err.stack);
    // Return error details instead of silent mock data
    res.status(500).send(`SSH Error: ${err.message}`);
  }
});

exports.sendContactEmail = onRequest(async (req, res) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    const { name, email, message } = req.body;

    // Validate input
    if (!name || !email || !message) {
      return res.status(400).send('Missing required fields: name, email, message');
    }

    // Get support email from environment variable
    const supportEmail = process.env.SUPPORT_EMAIL;

    if (!supportEmail) {
      console.error('[Contact Form] Support email not configured. Set SUPPORT_EMAIL environment variable.');
      return res.status(500).send('Support email not configured on this deployment');
    }

    // Get Gmail credentials from environment variables (stored in Firebase config)
    const gmailUser = process.env.GMAIL_USER;
    const gmailPassword = process.env.GMAIL_PASSWORD;

    if (!gmailUser || !gmailPassword) {
      console.error('[Contact Form] Gmail credentials not configured');
      return res.status(500).send('Email service not properly configured');
    }

    // Create a transporter using Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPassword
      }
    });

    // Email options
    const mailOptions = {
      from: gmailUser,
      to: supportEmail,
      subject: `Time Manager Contact Form: ${name}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
        <hr>
        <p><em>Reply to: ${email}</em></p>
      `
    };

    // Send email
    await transporter.sendMail(mailOptions);

    console.log(`[Contact Form] Email sent from ${email} to ${supportEmail}`);
    res.status(200).send({ success: true, message: 'Email sent successfully' });
  } catch (err) {
    console.error('[Contact Form Error]', err.message);
    console.error('[Contact Form Error Stack]', err.stack);
    res.status(500).send(`Error sending email: ${err.message}`);
  }
});