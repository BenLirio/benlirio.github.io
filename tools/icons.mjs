#!/usr/bin/env node
// Screenshot each live demo and crop it into a square icon in ./icons/.
// Zero dependencies: drives Google Chrome over the DevTools protocol using
// Node's built-in fetch + WebSocket.
//
//   node tools/icons.mjs            # regenerate every icon
//   node tools/icons.mjs sort-8     # just one (by slug)
//   DEBUG=1 node tools/icons.mjs    # also dump full viewports to tools/debug/
//
// Serve the repo first when a demo lives at a local subpath:
//   python3 -m http.server 8765
//
// Each entry: slug (file name), url, and a clip {x,y,width,height} in CSS px
// of a viewport `vw`x`vh`. Optional: wait (ms), actions (mouse gestures) so a
// blank canvas has something on it before we shoot it.

import { writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const LOCAL = process.env.LOCAL || 'http://127.0.0.1:8765';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const SIZE = 512; // output icon edge, px

const drag = (x1, y1, x2, y2, steps = 24) => ({ type: 'drag', x1, y1, x2, y2, steps });
const click = (x, y) => ({ type: 'click', x, y });
const evaluate = (js, times = 1, delay = 30) => ({ type: 'eval', js, times, delay });

export const ICONS = [
  { slug: 'convex-hull', url: `${LOCAL}/convex-hull/`, vw: 900, vh: 900,
    clip: { x: 150, y: 260, width: 520, height: 520 }, wait: 1500,
    actions: [evaluate(`document.querySelector('#next-button button').click()`, 14, 400)], after: 2500 },
  { slug: 'conways-game-of-life', url: `${LOCAL}/conways-game-of-life/`, vw: 900, vh: 900,
    clip: { x: 200, y: 92, width: 380, height: 380 }, wait: 800,
    actions: [
      // switch the Tool select to "Place Shape" and the Pattern select to the last (biggest) pattern
      evaluate(`(() => { const [pat, tool] = document.querySelectorAll('select');
        pat.selectedIndex = pat.options.length - 1; pat.dispatchEvent(new Event('change'));
        tool.value = 'Place Shape'; tool.dispatchEvent(new Event('change')); })()`),
      click(330, 200), click(470, 330), click(280, 380), click(520, 160),
      click(450, 510)], after: 900 },
  { slug: 'conways-game-of-life-3d-v1', url: `${LOCAL}/conways-game-of-life-3d-v1/`, vw: 900, vh: 900,
    clip: { x: 220, y: 250, width: 420, height: 420 }, wait: 4000 },
  { slug: 'advent-of-code-day-18-boiling-boulders', url: `${LOCAL}/advent-of-code-day-18-boiling-boulders/`, vw: 900, vh: 900,
    clip: { x: 230, y: 130, width: 520, height: 520 }, wait: 5000 },
  { slug: 'regolith-reservoir', url: `${LOCAL}/regolith-reservoir/`, vw: 900, vh: 900,
    clip: { x: 520, y: 0, width: 380, height: 380 }, wait: 3000 },
  { slug: 'batcher-odd-even-merge-sort', url: `${LOCAL}/batcher-odd-even-merge-sort/`, vw: 900, vh: 900,
    clip: { x: 20, y: 40, width: 260, height: 260 }, wait: 1000 },
  { slug: 'sort-8', url: `${LOCAL}/sort-8/`, vw: 900, vh: 900,
    clip: { x: 10, y: 40, width: 260, height: 260 }, wait: 1000 },
  { slug: 'permutations-of-cube', url: `${LOCAL}/permutations-of-cube/`, vw: 900, vh: 900,
    clip: { x: 40, y: 75, width: 360, height: 360 }, wait: 4000 },
  { slug: 'bloch-sphere', url: `${LOCAL}/bloch-sphere/`, vw: 900, vh: 900,
    clip: { x: 120, y: 100, width: 640, height: 640 }, wait: 4000 },
  { slug: 'laplacian-graph-drawing', url: `${LOCAL}/laplacian-graph-drawing/`, vw: 900, vh: 900,
    clip: { x: 28, y: 28, width: 160, height: 160 }, wait: 1500 },
  { slug: 'jos-stam-real-time-fluid-dynamics-for-games', url: `${LOCAL}/jos-stam-real-time-fluid-dynamics-for-games/`, vw: 900, vh: 900,
    clip: { x: 230, y: 90, width: 330, height: 330 }, wait: 1500,
    actions: [drag(260, 140, 520, 360, 40), drag(540, 150, 280, 380, 40), drag(300, 380, 500, 130, 40)], after: 700 },
  { slug: 'gpt-in-education', url: `${LOCAL}/gpt-in-education/`, vw: 900, vh: 900,
    clip: { x: 0, y: 0, width: 300, height: 300 }, wait: 1500 },
  { slug: 'space-ship-generator', url: 'https://benlirio.com/space-ship-client/', vw: 1280, vh: 720,
    clip: { x: 280, y: 0, width: 720, height: 720 }, wait: 6000 },
  { slug: 'ai-conways-game-of-life', url: 'https://benlirio.com/the-one-prompt/', vw: 1280, vh: 900,
    clip: { x: 0, y: 0, width: 560, height: 560 }, wait: 5000 },
  { slug: 'word-guess', url: 'https://word-guess.com/', vw: 900, vh: 1200,
    clip: { x: 60, y: 560, width: 480, height: 480 }, wait: 5000 },
  { slug: 'word-battle', url: 'https://word-battle.com/', vw: 900, vh: 900,
    clip: { x: 200, y: 20, width: 500, height: 500 }, wait: 5000 },
  { slug: 'leveled-homomorphic-encryption', url: 'https://img.youtube.com/vi/5fEtv2SdH8E/hqdefault.jpg', vw: 480, vh: 360,
    clip: { x: 60, y: 0, width: 360, height: 360 }, wait: 1000 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id); this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method) this.listeners.forEach((l) => l(msg));
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  waitFor(method, timeout = 15000) {
    return new Promise((resolve) => {
      const t = setTimeout(() => { off(); resolve(null); }, timeout);
      const l = (m) => { if (m.method === method) { clearTimeout(t); off(); resolve(m.params); } };
      const off = () => { this.listeners = this.listeners.filter((x) => x !== l); };
      this.listeners.push(l);
    });
  }
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  return new CDP(ws);
}

async function mouse(cdp, a) {
  if (a.type === 'eval') { for (let i = 0; i < a.times; i++) { await cdp.send('Runtime.evaluate', { expression: a.js }); await sleep(a.delay); } return; }
  const ev = (type, x, y, extra = {}) => cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', ...extra });
  if (a.type === 'click') { await ev('mouseMoved', a.x, a.y); await ev('mousePressed', a.x, a.y, { clickCount: 1 }); await ev('mouseReleased', a.x, a.y, { clickCount: 1 }); return; }
  await ev('mouseMoved', a.x1, a.y1); await ev('mousePressed', a.x1, a.y1, { clickCount: 1, buttons: 1 });
  for (let i = 1; i <= a.steps; i++) { const t = i / a.steps; await ev('mouseMoved', a.x1 + (a.x2 - a.x1) * t, a.y1 + (a.y2 - a.y1) * t, { buttons: 1 }); await sleep(16); }
  await ev('mouseReleased', a.x2, a.y2, { clickCount: 1 });
}

async function shoot(icon) {
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const cdp = await connect(target.webSocketDebuggerUrl);
  try {
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: icon.vw, height: icon.vh, deviceScaleFactor: 1, mobile: false });
    const loaded = cdp.waitFor('Page.loadEventFired');
    await cdp.send('Page.navigate', { url: icon.url });
    await loaded;
    await sleep(icon.wait ?? 1000);
    for (const a of icon.actions ?? []) await mouse(cdp, a);
    if (icon.after) await sleep(icon.after);
    if (process.env.DEBUG) {
      const full = await cdp.send('Page.captureScreenshot', { format: 'png' });
      await mkdir('tools/debug', { recursive: true });
      await writeFile(`tools/debug/${icon.slug}.png`, Buffer.from(full.data, 'base64'));
    }
    const scale = SIZE / icon.clip.width;
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { ...icon.clip, scale } });
    await writeFile(`icons/${icon.slug}.png`, Buffer.from(shot.data, 'base64'));
    console.log('wrote icons/%s.png', icon.slug);
  } finally {
    cdp.ws.close();
    await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`).catch(() => {});
  }
}

async function main() {
  const only = process.argv.slice(2);
  const list = only.length ? ICONS.filter((i) => only.includes(i.slug)) : ICONS;
  await mkdir('icons', { recursive: true });
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, '--hide-scrollbars', '--no-first-run',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--user-data-dir=/tmp/benlirio-icons-profile', 'about:blank',
  ], { stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await sleep(200); } }
    for (const icon of list) { try { await shoot(icon); } catch (e) { console.error('FAILED %s: %s', icon.slug, e.message); } }
  } finally { chrome.kill(); }
}

main();
