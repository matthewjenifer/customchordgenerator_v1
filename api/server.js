// api/server.js
const express = require('express');
const fs = require('fs');
const cors = require('cors');
const app = express();
const PORT = 3001;

// Load or initialize the visits.json file
let visits = {};
const dbFile = './visits.json';

if (fs.existsSync(dbFile)) {
  visits = JSON.parse(fs.readFileSync(dbFile));
} else {
  fs.writeFileSync(dbFile, JSON.stringify(visits));
}

app.use(cors());

// Increment unique visit based on IP
app.get('/api/visit', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (!visits[ip]) {
    visits[ip] = true;
    fs.writeFileSync(dbFile, JSON.stringify(visits));
  }
  res.json({ uniqueVisitors: Object.keys(visits).length });
});

// Endpoint to just fetch the count (optional)
app.get('/api/unique-visits', (req, res) => {
  res.json({ uniqueVisitors: Object.keys(visits).length });
});

app.listen(PORT, () => {
  console.log(`Visitor counter API running at http://localhost:${PORT}`);
});
