// Local production-build smoke check. External requests are blocked deliberately.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');

async function main() {
  const root = path.resolve(__dirname, '../..');
  const dist = path.join(root, 'dist');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vipi-defect-browser-'));
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(dist, '.' + pathname);
    if (file !== dist && !file.startsWith(dist + path.sep)) { res.writeHead(403).end(); return; }
    if (!path.extname(file)) file = path.join(dist, 'index.html');
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  let chrome, socket;
  const pending = new Map();
  let sequence = 0;
  const exceptions = [];
  const results = [];
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
      '--headless=new', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
      '--disable-extensions', '--disable-background-networking', 'about:blank',
    ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    const endpoint = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Chrome debugging endpoint timed out')), 15000);
      let output = '';
      chrome.on('error', reject);
      chrome.stderr.on('data', data => {
        output += data;
        const match = /DevTools listening on (ws:\/\/\S+)/.exec(output);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
    });
    const debuggerOrigin = endpoint.replace(/^ws:/, 'http:').split('/devtools/')[0];
    const pages = await fetch(debuggerOrigin + '/json/list').then(r => r.json());
    socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(method + ' timed out')); }, 10000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    }
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const operation = pending.get(message.id);
        if (operation) { clearTimeout(operation.timer); pending.delete(message.id); message.error ? operation.reject(new Error(message.error.message)) : operation.resolve(message.result); }
      } else if (message.method === 'Runtime.exceptionThrown') {
        exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      } else if (message.method === 'Fetch.requestPaused') {
        const { requestId, request } = message.params;
        const allow = request.url.startsWith(origin + '/') || request.url.startsWith('data:');
        send(allow ? 'Fetch.continueRequest' : 'Fetch.failRequest', { requestId, ...(allow ? {} : { errorReason: 'BlockedByClient' }) }).catch(() => {});
      }
    };
    await send('Page.enable'); await send('Runtime.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
      for (const [route, expected] of [['/', '/'], ['/login', '/login'], ['/signup', '/signup'], ['/home', '/login'], ['/missing-route', '/']]) {
        await send('Page.navigate', { url: origin + route });
        let state;
        for (let attempt = 0; attempt < 40; attempt++) {
          await pause(200);
          const evaluation = await send('Runtime.evaluate', {
            expression: `JSON.stringify({path:location.pathname,ready:document.readyState,text:document.body.innerText.length,overflow:document.documentElement.scrollWidth>innerWidth+1})`, returnByValue: true,
          });
          if (evaluation.result.value) state = JSON.parse(evaluation.result.value);
          if (state?.path === expected && state.ready === 'complete' && state.text > 30) break;
        }
        const passed = state?.path === expected && state.ready === 'complete' && state.text > 30 && !state.overflow;
        results.push({ width, height, route, expected, ...state, passed });
      }
    }
    const report = { checkedAt: new Date().toISOString(), externalRequestsBlocked: true, scope: 'Public routes, authentication redirects and responsive layout only; no live account or provider operations', results, exceptions };
    fs.writeFileSync(path.join(__dirname, 'defect-browser-smoke.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ checks: results.length, passed: results.filter(r => r.passed).length, exceptions: exceptions.length }));
    if (results.some(r => !r.passed) || exceptions.length) process.exitCode = 1;
    await send('Browser.close').catch(() => {});
  } finally {
    socket?.close();
    for (const operation of pending.values()) clearTimeout(operation.timer);
    chrome?.kill();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await pause(1000);
    if (path.dirname(profile) === path.resolve(os.tmpdir()) && path.basename(profile).startsWith('vipi-defect-browser-')) {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
    }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
