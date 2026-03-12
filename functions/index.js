const { onRequest } = require("firebase-functions/v2/https");
const { Client } = require("ssh2");
const { defineSecret } = require("firebase-functions/params");

// Define the secret you stored in Firebase
const sshKey = defineSecret("SSH_PRIVATE_KEY");

// Retry function with exponential backoff
const executeSSHCommand = (cmd, maxRetries = 3) => {
  return new Promise((resolve, reject) => {
    const attempt = (retryCount) => {
      const conn = new Client();
      let responded = false;
      
      const timeout = setTimeout(() => {
        conn.end();
        if (retryCount < maxRetries - 1) {
          attempt(retryCount + 1);
        } else {
          reject(new Error('SSH command timeout after retries'));
        }
      }, 10000);

      conn.on("ready", () => {
        conn.exec(cmd, (err, stream) => {
          clearTimeout(timeout);
          if (err) {
            conn.end();
            if (retryCount < maxRetries - 1) {
              attempt(retryCount + 1);
            } else {
              reject(err);
            }
            return;
          }
          let data = '';
          stream.on('data', (d) => { data += d; });
          stream.on('close', () => { 
            conn.end();
            if (!responded) {
              responded = true;
              resolve(data);
            }
          });
        });
      }).on("error", (err) => {
        clearTimeout(timeout);
        if (retryCount < maxRetries - 1) {
          attempt(retryCount + 1);
        } else {
          reject(err);
        }
      }).connect({
        host: process.env.SSH_HOST || "your-server-ip",
        port: 50022,
        username: "sshuser",
        privateKey: sshKey.value(),
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

    const data = await executeSSHCommand(cmd);
    res.status(200).send(data);
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

exports.testConnection = onRequest({ secrets: [sshKey] }, async (req, res) => {
  try {
    const data = await executeSSHCommand("hostname");
    res.status(200).send("Connection successful! Server hostname: " + data.trim());
  } catch (err) {
    res.status(500).send("Connection failed: " + err.message);
  }
});