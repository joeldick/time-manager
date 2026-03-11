const { onRequest } = require("firebase-functions/v2/https");
const { Client } = require("ssh2");
const { defineSecret } = require("firebase-functions/params");

// Define the secret you stored in Firebase
const sshKey = defineSecret("SSH_PRIVATE_KEY");

exports.grantTime = onRequest({ 
  secrets: [sshKey],
  cors: true // Essential for the frontend to call this
}, (req, res) => {
  const conn = new Client();
  
  conn.on("ready", () => {
    // Example: Granting time by running a shell script on your remote-server
    conn.exec("uptime", (err, stream) => {
      if (err) {
        conn.end();
        return res.status(500).send("SSH Execution Error");
      }
      stream.on("close", () => {
        conn.end();
        res.status(200).send("Time granted successfully.");
      });
    });
  }).on("error", (err) => {
    res.status(500).send("Connection failed: " + err.message);
  }).connect({
    host: "localhost",
    port: 50022,
    username: "sshuser",
    privateKey: sshKey.value(),
  });
});