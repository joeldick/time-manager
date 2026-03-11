const { onRequest } = require("firebase-functions/v2/https");
const { Client } = require("ssh2");
const { defineSecret } = require("firebase-functions/params");

// Define the secret you stored in Firebase
const sshKey = defineSecret("SSH_PRIVATE_KEY");

exports.grantTime = onRequest({ secrets: [sshKey] }, (req, res) => {
  const { action, kid, minutes } = req.query; // e.g., /grantTime?action=status&kid=alice
  
  const conn = new Client();
  conn.on("ready", () => {
    // If status, run --userinfo. If add, run -t <minutes>
    const cmd = action === 'status' 
      ? `timekpra --userinfo ${kid}` 
      : `timekpra -t ${minutes} --user ${kid}`;

    conn.exec(cmd, (err, stream) => {
      let data = '';
      stream.on('data', (d) => { data += d; });
      stream.on('close', () => { 
        conn.end(); 
        res.status(200).send(data); // Send back the output of timekpra
      });
    });
  }).connect({ /* ... your config ... */ });
});

exports.testConnection = onRequest({ secrets: [sshKey] }, (req, res) => {
  const conn = new Client();
  conn.on("ready", () => {
    conn.exec("hostname", (err, stream) => {
      stream.on('close', () => { conn.end(); });
      res.status(200).send("Connection successful! Server hostname: " + stream.stdout);
    });
  }).on("error", (err) => {
    res.status(500).send("Connection failed: " + err.message);
  }).connect({
    host: "209.227.149.77",
    port: 50022,
    username: "sshuser",
    privateKey: sshKey.value(),
    readyTimeout: 10000 
  });
});