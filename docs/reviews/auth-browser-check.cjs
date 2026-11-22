// Build with auth-vite.config.mts first. Uses synthetic Firebase identities and a
// localhost API fixture; never connects to production or a real database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const build = path.resolve('recovery.local/auth-browser-build');
  assert.ok(fs.existsSync(path.join(build, 'index.html')), 'Build the auth browser fixture first');
  const reportDir = path.resolve('recovery.local/auth-tests');
  fs.mkdirSync(reportDir, { recursive: true });
  const browserDir = fs.mkdtempSync(path.join(reportDir, 'browser-'));
  let mode = 'conflict', delay = 0, meRequests = 0;
  const profile = { id: 'fixture-profile', firstName: 'Returning', lastName: 'Member',
    email: 'member@example.test', interests: [], profilePictures: [], profileVideos: [],
    isPremium: false, isActive: true, location: 'Testville', dateOfBirth: '1995-06-15' };
  const server = http.createServer(async (req, res) => {
    const route = new URL(req.url, 'http://localhost').pathname;
    if (route.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json');
      if (route === '/api/auth/me') {
        meRequests++;
        const snapshot = mode;
        await pause(delay);
        if (snapshot === 'conflict') {
          res.writeHead(409).end(JSON.stringify({ code: 'auth/profile-conflict', error: 'Existing email needs reconnecting' }));
        } else if (snapshot === 'error') {
          res.writeHead(503).end(JSON.stringify({ error: 'Unavailable' }));
        } else res.end(JSON.stringify({ user: snapshot === 'new' ? null : profile }));
      } else {
        res.end(JSON.stringify({ posts: [], notifications: [], users: [], matches: [], stories: [], nextCursor: null, unreadCount: 0 }));
      }
      return;
    }
    let file = path.resolve(build, '.' + route);
    if (!file.startsWith(build + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(build, 'index.html');
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let chrome, socket, sequence = 0;
  const pending = new Map(), exceptions = [], checks = [];
  try {
    chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
      '--headless=new', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${browserDir}`, '--no-first-run', '--disable-extensions', '--disable-background-networking', 'about:blank',
    ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    console.log('Started local browser fixture');
    const endpoint = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Chrome startup timed out')), 15000);
      let output = '';
      chrome.on('error', error => { clearTimeout(timer); reject(error); });
      chrome.stderr.on('data', data => {
        output += data;
        const match = /DevTools listening on (ws:\/\/\S+)/.exec(output);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
    });
    const pages = await fetch(endpoint.replace(/^ws:/, 'http:').split('/devtools/')[0] + '/json/list', { signal: AbortSignal.timeout(5000) }).then(r => r.json());
    socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Browser connection timed out')), 5000);
      socket.onopen = () => { clearTimeout(timer); resolve(); };
      socket.onerror = error => { clearTimeout(timer); reject(error); };
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('Browser command timed out: ' + method)); }, 10000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const task = pending.get(message.id);
        if (!task) return;
        pending.delete(message.id);
        clearTimeout(task.timer);
        if (message.error) task.reject(new Error(JSON.stringify(message.error))); else task.resolve(message.result);
      } else if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
    };
    await send('Runtime.enable');
    await send('Page.enable');
    console.log('Browser connected; checking auth routes');
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    };
    const waitFor = async (expression, label) => {
      for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await pause(100); }
      throw new Error('Timed out: ' + label + ' at ' + await evaluate('location.pathname + " " + document.body.innerText.slice(0, 350)'));
    };
    const click = async label => {
      const expression = `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)})`;
      await waitFor(`!!(${expression}) && !(${expression}).disabled`, label);
      await evaluate(`(${expression}).click()`);
    };
    const navigate = async route => {
      await send('Page.navigate', { url: origin + route });
      await waitFor('!!window.authFixture', 'app load');
    };
    const fresh = async nextMode => {
      mode = nextMode; delay = 0;
      if (await evaluate('!!window.authFixture')) await evaluate('window.authFixture.signOut()');
      await navigate('/signup');
      await waitFor("document.body.innerText.includes('Create account')", 'signup');
    };
    const noOnboarding = async () => {
      assert.equal(await evaluate("document.body.innerText.includes(\"What's your first name?\")"), false);
    };

    await fresh('conflict');
    const beforeGoogle = meRequests;
    await click('Continue with Google');
    await waitFor("document.body.innerText.includes('Your profile needs reconnecting')", 'Google conflict');
    await noOnboarding();
    assert.equal(meRequests - beforeGoogle, 1, 'Listener and sign-in handler should share their lookup');
    checks.push('Google conflict blocks onboarding and shares the profile lookup');
    fs.writeFileSync(path.join(reportDir, 'profile-conflict.png'), Buffer.from((await send('Page.captureScreenshot')).data, 'base64'));

    await navigate('/onboarding');
    await waitFor("document.body.innerText.includes('Your profile needs reconnecting')", 'restored conflict');
    await noOnboarding();
    checks.push('Restored sessions and direct onboarding links show recovery');

    await click('Back to sign in');
    await waitFor("location.pathname === '/login' && document.body.innerText.includes('Welcome back')", 'sign-out');
    checks.push('Recovery provides a working return to sign-in');

    await fresh('existing');
    await click('Continue with Google');
    await waitFor("location.pathname === '/home'", 'existing Google profile');
    await noOnboarding();
    checks.push('Existing Google profile goes to home');

    await fresh('new');
    await click('Continue with Google');
    await waitFor("location.pathname === '/onboarding' && document.body.innerText.includes(\"What's your first name?\")", 'new Google profile');
    checks.push('Confirmed new Google account reaches onboarding');

    await fresh('error');
    await click('Continue with Google');
    await waitFor("document.body.innerText.includes('We could not load your profile')", 'failed profile lookup');
    await noOnboarding();
    mode = 'existing';
    await click('Check again');
    await waitFor("location.pathname === '/home'", 'retry');
    checks.push('Failed lookup blocks onboarding; successful retry opens home');

    for (const scenario of ['conflict', 'existing', 'new']) {
      await fresh(scenario);
      await evaluate(`(() => {
        const inputs = document.querySelectorAll('input');
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        inputs.forEach((input, index) => { set.call(input, index ? 'fixture-password' : 'member@example.test'); input.dispatchEvent(new Event('input', { bubbles: true })); });
      })()`);
      await click('Create account');
      await waitFor(scenario === 'conflict'
        ? "document.body.innerText.includes('Your profile needs reconnecting')"
        : `location.pathname === '${scenario === 'existing' ? '/home' : '/onboarding'}'`, 'email signup ' + scenario);
      if (scenario !== 'new') await noOnboarding();
      checks.push('Email signup resolves profile before navigation: ' + scenario);
    }

    mode = 'existing'; delay = 800;
    await navigate('/onboarding');
    await pause(150);
    await noOnboarding();
    await waitFor("location.pathname === '/home'", 'delayed profile');
    checks.push('Pending restored profile lookup never flashes onboarding');

    delay = 800;
    await navigate('/onboarding');
    await pause(100);
    mode = 'conflict'; delay = 0;
    await evaluate("window.authFixture.signIn('fixture-other-user')");
    await waitFor("document.body.innerText.includes('Your profile needs reconnecting')", 'changed identity');
    await pause(900);
    assert.ok(await evaluate("document.body.innerText.includes('Your profile needs reconnecting')"));
    await noOnboarding();
    checks.push('Late response for the previous identity cannot overwrite the new session');
    assert.deepEqual(exceptions, [], 'No uncaught browser exceptions');
    fs.writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify({ checks, meRequests, exceptions }, null, 2));
    console.log(JSON.stringify({ passed: checks.length, checks, exceptions }));
  } finally {
    socket?.close();
    chrome?.kill();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
