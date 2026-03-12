const { onRequest } = require("firebase-functions/v2/https");
const { Client } = require("ssh2");
const { defineSecret } = require("firebase-functions/params");
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
const admin = require("firebase-admin");

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

// Function to get SSH host from Firestore config
const getSSHHostFromConfig = async () => {
  try {
    const configRef = admin.firestore().collection('config').doc('app');
    const config = await configRef.get();
    const configData = config.data() || {};
    const sshHost = configData.sshHost;
    if (!sshHost) {
      throw new Error("SSH host not configured in Firestore config/app document");
    }
    return sshHost;
  } catch (err) {
    console.error("[SSH Debug] Failed to get SSH host from config:", err.message);
    throw err;
  }
};

// Retry function with exponential backoff
const executeSSHCommand = async (cmd, sshHost, maxRetries = 3) => {
  return new Promise(async (resolve, reject) => {
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
    
    console.log(`[SSH Debug] SSH connection attempt to ${sshHost}:50022 (attempt 1/${maxRetries})`);
    
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
        port: 50022,
        username: "sshuser",
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
    // Get SSH host from Firestore config
    const sshHost = await getSSHHostFromConfig();
    
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

    const data = await executeSSHCommand(cmd, sshHost);
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
    // Get SSH host from Firestore config
    const sshHost = await getSSHHostFromConfig();
    
    const data = await executeSSHCommand("hostname", sshHost);
    res.status(200).send("Connection successful! Server hostname: " + data.trim());
  } catch (err) {
    console.error('[SSH Error in testConnection]', err.message);
    console.error('[SSH Error Stack]', err.stack);
    // Return error details instead of silent mock data
    res.status(500).send(`SSH Error: ${err.message}`);
  }
});