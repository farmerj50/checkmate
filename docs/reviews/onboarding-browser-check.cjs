// Checks the running local demo app with an isolated browser and a disposable profile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
const dotenv = require('../../backend/node_modules/dotenv');

async function main() {
  const origin = 'http://localhost:5173';
  const root = path.resolve(__dirname, '../..');
  const env = dotenv.parse(fs.readFileSync(path.join(root, 'backend/.env.dev')));
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(env.DATABASE_URL).hostname));
  const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
  const email = `onboarding-probe-${randomUUID()}@example.invalid`;
  const firebaseUid = 'demo_' + email.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vipi-onboarding-browser-'));
  const pending = new Map();
  const exceptions = [];
  const checks = [];
  const registrationStatuses = [];
  let chrome, socket, sequence = 0, rejectFirstBirthday = true;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  let send;
  try {
    chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
      '--headless=new', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${directory}`, '--no-first-run', '--no-default-browser-check',
      '--disable-extensions', '--disable-background-networking', 'about:blank',
    ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    const endpoint = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Chrome startup timed out')), 20000);
      let output = '';
      chrome.on('error', reject);
      chrome.stderr.on('data', data => {
        output += data;
        const match = /DevTools listening on (ws:\/\/\S+)/.exec(output);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
    });
    const debuggerOrigin = endpoint.replace(/^ws:/, 'http:').split('/devtools/')[0];
    const pages = await fetch(debuggerOrigin + '/json/list').then(response => response.json());
    socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(method + ' timed out')); }, 15000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const operation = pending.get(message.id);
        if (operation) {
          clearTimeout(operation.timer); pending.delete(message.id);
          message.error ? operation.reject(new Error(message.error.message)) : operation.resolve(message.result);
        }
      } else if (message.method === 'Runtime.exceptionThrown') {
        exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      } else if (message.method === 'Network.responseReceived' && message.params.response.url.endsWith('/api/auth/register')) {
        registrationStatuses.push(message.params.response.status);
      } else if (message.method === 'Fetch.requestPaused') {
        const { requestId, request } = message.params;
        if (request.url === origin + '/api/auth/register' && rejectFirstBirthday) {
          // Exercise real server field errors and UI recovery, retaining the user's valid draft.
          rejectFirstBirthday = false;
          const body = JSON.parse(request.postData);
          body.userData.dateOfBirth = '0001-06-15';
          send('Fetch.continueRequest', { requestId, postData: Buffer.from(JSON.stringify(body)).toString('base64') }).catch(() => {});
        } else {
          const allow = request.url.startsWith(origin + '/') || request.url.startsWith('data:');
          send(allow ? 'Fetch.continueRequest' : 'Fetch.failRequest', { requestId, ...(allow ? {} : { errorReason: 'BlockedByClient' }) }).catch(() => {});
        }
      }
    };
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'Browser evaluation failed');
      return result.result.value;
    };
    const waitFor = async (expression, label) => {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await evaluate(expression)) return;
        await pause(150);
      }
      throw new Error('Timed out: ' + label + ' at ' + await evaluate('location.pathname'));
    };
    const heading = text => waitFor(`document.querySelector('h2')?.innerText.includes(${JSON.stringify(text)})`, text);
    const input = async (selector, value) => {
      await evaluate(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!element) throw new Error('Input not found');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, ${JSON.stringify(value)});
        element.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
    };
    const click = async (text, count = 1) => {
      await evaluate(`(() => {
        const button = [...document.querySelectorAll('button')].find(button => button.innerText.trim().startsWith(${JSON.stringify(text)}));
        if (!button || button.disabled) throw new Error('Button unavailable: ' + ${JSON.stringify(text)});
        for (let i = 0; i < ${count}; i++) button.click();
      })()`);
    };
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    await send('Page.navigate', { url: origin + '/signup' });
    await waitFor("!!document.querySelector('input[type=email]')", 'Signup');
    await input('input[type=email]', 'invalid-email');
    await input('input[type=password]', 'browser-fixture-password');
    await click('Create account');
    await waitFor("document.body.innerText.includes('Enter a valid email address')", 'Email validation');
    assert.equal(await evaluate('location.pathname'), '/signup');
    checks.push('Invalid email stopped before onboarding');
    await input('input[type=email]', email);
    await click('Create account');
    await heading("What's your first name?");
    await input('input', 'Signup');
    await click('Continue', 2);
    await heading("What's your last name?");
    checks.push('Double click advances exactly one question');
    await input('input', 'Probe');
    await click('Continue');
    await heading('When were you born?');
    await input('input', '0001-06-15');
    await click('Continue');
    await waitFor("document.body.innerText.includes('Check your birth year')", 'Birthday validation');
    assert.ok(await evaluate("document.querySelector('h2').innerText.includes('When were you born?')"));
    checks.push('Invalid birth year stopped at birthday question');
    await input('input', '1995-06-15');
    await click('Continue');
    await heading('How do you identify?');
    await click('Prefer not to say', 2);
    await heading('Where are you based?');
    checks.push('Double gender click cannot skip location');
    await input('input', 'New York');
    await click('Continue');
    await heading('What do you do for work?');
    await click('Skip for now');
    await heading('Tell people a little about you.');
    await click('Skip for now');
    await heading('What are you into?');
    for (const interest of ['Travel', 'Music', 'Tech']) await click(interest);
    await click('Continue');
    await heading('What are you looking for?');
    await click('Networking');
    await heading('When were you born?');
    assert.deepEqual(registrationStatuses, [400]);
    assert.equal(await evaluate("document.querySelector('input').value"), '1995-06-15');
    checks.push('Real HTTP 400 returns to the rejected field and keeps its draft');
    await click('Back');
    await heading("What's your last name?");
    assert.equal(await evaluate("document.querySelector('input').value"), 'Probe');
    await click('Continue');
    await heading('When were you born?');
    await click('Continue');
    await heading('How do you identify?');
    await click('Prefer not to say');
    await heading('Where are you based?');
    assert.equal(await evaluate("document.querySelector('input').value"), 'New York');
    await click('Continue');
    await heading('What do you do for work?');
    await click('Skip for now');
    await heading('Tell people a little about you.');
    await click('Skip for now');
    await heading('What are you into?');
    await waitFor("document.body.innerText.includes('3 selected')", 'Retained interests');
    checks.push('Back navigation retains names, location and interests');
    await click('Continue');
    await heading('What are you looking for?');
    await click('Networking');
    await waitFor("location.pathname === '/home'", 'Successful signup destination');
    assert.deepEqual(registrationStatuses, [400, 200]);
    assert.deepEqual(exceptions, []);
    const saved = await prisma.user.findUnique({ where: { firebaseUid }, select: { lookingFor: true } });
    assert.equal(saved?.lookingFor, 'NETWORKING');
    checks.push('Retry creates the networking profile and opens the home feed');
    const report = { checkedAt: new Date().toISOString(), checks, registrationStatuses, browserExceptions: exceptions.length };
    fs.writeFileSync(path.join(__dirname, 'onboarding-browser-check.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } catch (error) {
    console.error(JSON.stringify({ completedChecks: checks, registrationStatuses, error: error.message }));
    throw error;
  } finally {
    if (send) await send('Browser.close').catch(() => {});
    socket?.close();
    for (const operation of pending.values()) clearTimeout(operation.timer);
    await pause(1000);
    if (chrome?.exitCode === null) chrome.kill();
    await pause(1000);
    const deleted = await prisma.user.deleteMany({ where: { firebaseUid, email } });
    console.log(JSON.stringify({ temporaryProfilesRemoved: deleted.count }));
    await prisma.$disconnect();
    if (path.dirname(directory) === path.resolve(os.tmpdir()) && path.basename(directory).startsWith('vipi-onboarding-browser-')) {
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
    }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
