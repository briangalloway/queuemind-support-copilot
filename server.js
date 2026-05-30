// Zero-dependency Node.js stateful API server to serve Mock Helpdesk & persist DB state
// Run: node server.js
// Access: http://localhost:8282

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8282;
const DB_FILE = './db.json';

// Initialize the database state
let dbState = null;

function loadInitialMockData() {
  try {
    // Standard Node require to load mockData.js (cleared VM evaluation)
    const mockDataModule = require('./mockData');
    return JSON.parse(JSON.stringify(mockDataModule));
  } catch (err) {
    console.error("Failed to load initial mockData.js:", err);
    return { engineers: [], helpdeskTickets: [], closedTickets: [] };
  }
}

function initDatabase() {
  if (fs.existsSync(DB_FILE)) {
    try {
      dbState = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      console.log("Loaded existing state from db.json");
    } catch (err) {
      console.error("Error reading db.json, re-initializing:", err);
    }
  }
  
  if (!dbState) {
    console.log("Initializing database state from mockData.js...");
    dbState = loadInitialMockData();
    saveDatabase();
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf8');
    console.log("Database state persisted to db.json");
  } catch (err) {
    console.error("Error writing db.json:", err);
  }
}

initDatabase();

// CORS Headers for Extension access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', err => reject(err));
  });
}

http.createServer(async (req, res) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  // Resolve URL path
  let reqUrl = req.url.split('?')[0]; // strip query params

  // API Route - Get State
  if (reqUrl === '/api/state' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify(dbState));
    return;
  }

  // API Route - Get Solve Times Stats
  if (reqUrl === '/api/stats/solve-times' && req.method === 'GET') {
    if (dbState && dbState.closedTickets) {
      const stats = {};
      const categories = ["Auth/OAuth", "MTA/Routing", "Webhooks", "Custom Code", "Logic/Formatting", "API/CRM"];
      categories.forEach(cat => {
        const catTickets = dbState.closedTickets.filter(t => t.category === cat);
        if (catTickets.length === 0) {
          stats[cat] = { avgHours: 12.0, total: 0 };
        } else {
          const sum = catTickets.reduce((acc, t) => acc + (t.timeToSolveHours || 0), 0);
          stats[cat] = {
            avgHours: parseFloat((sum / catTickets.length).toFixed(1)),
            total: catTickets.length
          };
        }
      });
      res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
      res.end(JSON.stringify(stats));
      return;
    }
    res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ error: "Database state not initialized" }));
    return;
  }

  // API Route - Reassign Ticket
  if (reqUrl === '/api/reassign' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const { ticketId, targetEngId } = body;
    
    if (ticketId && targetEngId && dbState) {
      const ticketIdClean = ticketId.replace('T-', '');
      const backlogId = `t_${ticketIdClean}`;
      const targetEng = dbState.engineers.find(e => e.id === targetEngId);
      
      if (targetEng) {
        // Find current owner and remove the ticket from their backlog
        let ticketObj = null;
        dbState.engineers.forEach(e => {
          const index = e.backlog.findIndex(t => t.id === backlogId || t.id === ticketId);
          if (index !== -1) {
            ticketObj = e.backlog[index];
            e.backlog.splice(index, 1);
          }
        });

        // If not found in any engineer's backlog, look in unassigned helpdeskTickets
        if (!ticketObj) {
          const htIndex = dbState.helpdeskTickets.findIndex(t => t.id === ticketId || t.id === `T-${ticketIdClean}`);
          if (htIndex !== -1) {
            const rawT = dbState.helpdeskTickets[htIndex];
            ticketObj = {
              id: backlogId,
              account: rawT.account,
              subject: rawT.subject,
              category: rawT.category,
              complexity: rawT.complexity || "Medium",
              sentiment: "Neutral",
              lastUpdate: "Just reassigned",
              threadLength: rawT.conversations ? rawT.conversations.length : 1
            };
          }
        }

        // Update the main helpdesk tickets table as well
        const helpdeskTicket = dbState.helpdeskTickets.find(t => t.id === ticketId || t.id === `T-${ticketIdClean}`);
        if (helpdeskTicket) {
          helpdeskTicket.assignedTo = targetEng.name;
          helpdeskTicket.status = "Open"; // reset stalled/stale status
        }

        // Add the ticket to the target engineer's backlog
        if (ticketObj) {
          ticketObj.lastUpdate = "Just reassigned";
          ticketObj.sentiment = "Neutral";
          // Ensure correct ID format for backlog
          ticketObj.id = backlogId;
          targetEng.backlog.push(ticketObj);
        }

        saveDatabase();
        res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
        res.end(JSON.stringify({ success: true, message: `Ticket ${ticketId} reassigned to ${targetEng.name}.` }));
        return;
      }
    }
    
    res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ error: "Invalid request parameters" }));
    return;
  }

  // API Route - Submit Manager Reply
  if (reqUrl === '/api/reply' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const { ticketId, message } = body;
    
    if (ticketId && message && dbState) {
      const ticketIdClean = ticketId.replace('T-', '').replace('t_', '');
      const backlogId = `t_${ticketIdClean}`;
      const helpdeskId = `T-${ticketIdClean}`;
      
      const helpdeskTicket = dbState.helpdeskTickets.find(t => t.id === helpdeskId || t.id === ticketIdClean);
      if (helpdeskTicket) {
        if (!helpdeskTicket.conversations) {
          helpdeskTicket.conversations = [];
        }
        helpdeskTicket.conversations.push({
          sender: "agent",
          name: "Zapier Support Manager",
          message: message,
          timestamp: new Date().toISOString()
        });
        helpdeskTicket.status = "Open";
        
        dbState.engineers.forEach(e => {
          const bt = e.backlog.find(t => t.id === backlogId || t.id === ticketId);
          if (bt) {
            bt.threadLength = helpdeskTicket.conversations.length;
            bt.lastUpdate = "Just replied";
            bt.status = "Open";
          }
        });
        
        saveDatabase();
        res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
        res.end(JSON.stringify({ success: true, message: `Reply added to ticket ${ticketId}.` }));
        return;
      }
    }
    
    res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ error: "Invalid request parameters or ticket not found" }));
    return;
  }

  // API Route - Reset Demo Database
  if (reqUrl === '/api/reset' && req.method === 'POST') {
    console.log("Resetting database state to mock defaults...");
    dbState = loadInitialMockData();
    saveDatabase();
    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ success: true, message: "Database reset to mock defaults." }));
    return;
  }

  // Static files server
  let filePath = '.' + reqUrl;
  if (filePath === './') {
    filePath = './mock_helpdesk.html';
  }

  const absolutePath = path.resolve(filePath);
  const workspaceRoot = path.resolve('.');

  // Basic directory traversal guard
  if (!absolutePath.startsWith(workspaceRoot)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 File Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
}).listen(PORT, () => {
  console.log(`\n============================================================`);
  console.log(`QueueMind Stateful API Server running successfully!`);
  console.log(`Access Mock Helpdesk: http://localhost:${PORT}/`);
  console.log(`============================================================\n`);
});
