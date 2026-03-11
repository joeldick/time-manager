const { onRequest } = require("firebase-functions/v2/https");
const { Client } = require("ssh2");
const { defineSecret } = require("firebase-functions/params");

// Define the secret you stored in Firebase
const sshKey = defineSecret("SSH_PRIVATE_KEY");

exports.grantTime = onRequest({ secrets: [sshKey] }, (req, res) => {
  const { action, kid, minutes } = req.query; // e.g., /grantTime?action=status&kid=alice
  
  const conn = new Client();
  conn.on("ready", () => {
    // If status, run --userinfo. If add/subtract, run --settimeleft with appropriate operator. If reset, set to 0.
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

    conn.exec(cmd, (err, stream) => {
      let data = '';
      stream.on('data', (d) => { data += d; });
      stream.on('close', () => { 
        conn.end(); 
        res.status(200).send(data); // Send back the output of timekpra
      });
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

exports.testConnection = onRequest({ secrets: [sshKey] }, (req, res) => {
  const conn = new Client();
  let responded = false;
  
  conn.on("ready", () => {
    conn.exec("hostname", (err, stream) => {
      if (err) {
        if (!responded) {
          responded = true;
          res.status(500).send("Exec error: " + err.message);
        }
        conn.end();
        return;
      }
      let data = '';
      stream.on('data', (d) => { data += d; });
      stream.on('close', () => { 
        conn.end();
        if (!responded) {
          responded = true;
          res.status(200).send("Connection successful! Server hostname: " + data.trim());
        }
      });
    });
  }).on("error", (err) => {
    if (!responded) {
      responded = true;
      res.status(500).send("Connection failed: " + err.message);
    }
  }).on("close", () => {
    if (!responded) {
      responded = true;
      res.status(500).send("Connection closed unexpectedly");
    }
  }).connect({
    host: "209.227.149.77",
    port: 50022,
    username: "sshuser",
    privateKey: sshKey.value(),
    readyTimeout: 30000,
    connectionTimeout: 30000
  });
});