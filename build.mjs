#!/usr/bin/env node
// Builds the site. No dependencies beyond Node's standard library.
//
//   node build.mjs
//
// Inputs:  site.json, projects.json, posts/*.md, projects/*.md (optional writeups)
// Outputs: index.html, writing/, projects/<slug>/ (only where a writeup exists), feed.xml
//
// Every project field except `name` is optional. See README.md.

import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const read = (p) => readFile(path.join(ROOT, p), 'utf8');
const out = async (p, html) => { await mkdir(path.dirname(path.join(ROOT, p)), { recursive: true }); await writeFile(path.join(ROOT, p), html); console.log('wrote', p); };

// ---------- helpers ----------

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const attr = esc;
const slugify = (s) => String(s).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const yearOf = (s) => { const m = String(s ?? '').match(/\b(19|20)\d{2}\b/g); return m ? Number(m[m.length - 1]) : null; };
const longDate = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

// Tiny markdown renderer. Covers what a post needs: headings, paragraphs, lists,
// blockquotes, fenced code, inline code, bold, italic, links, images, rules.
function inline(md) {
  const codes = [];
  let s = esc(md).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `@@CODE${codes.length - 1}@@`; });
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="$2">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*]+)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^_]+)_(?!\w)/g, '$1<em>$2</em>');
  return s.replace(/@@CODE(\d+)@@/g, (_, i) => `<code>${codes[i]}</code>`);
}

export function markdown(md) {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let i = 0;
  const para = [];
  const flush = () => { if (para.length) { html.push(`<p>${inline(para.join(' '))}</p>`); para.length = 0; } };
  while (i < lines.length) {
    const line = lines[i];
    let m;
    if ((m = line.match(/^```(\w*)\s*$/))) {
      flush(); const buf = []; i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++;
      html.push(`<pre><code${m[1] ? ` class="language-${m[1]}"` : ''}>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    if ((m = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/))) { flush(); const n = m[1].length + 1; html.push(`<h${n}>${inline(m[2])}</h${n}>`); i++; continue; }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flush(); html.push('<hr>'); i++; continue; }
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      flush();
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items = [];
      while (i < lines.length && (/^\s*[-*+]\s+/.test(lines[i]) || /^\s*\d+[.)]\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        if (/^\s{2,}\S/.test(lines[i]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) items[items.length - 1] += ' ' + lines[i].trim();
        else items.push(lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, ''));
        i++;
      }
      html.push(`<${ordered ? 'ol' : 'ul'}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      flush(); const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      html.push(`<blockquote>${markdown(buf.join('\n'))}</blockquote>`);
      continue;
    }
    if (/^\s*$/.test(line)) { flush(); i++; continue; }
    para.push(line.trim()); i++;
  }
  flush();
  return html.join('\n');
}

function frontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const l of m[1].split('\n')) { const k = l.match(/^([\w-]+):\s*(.*)$/); if (k) meta[k[1]] = k[2].replace(/^["']|["']$/g, ''); }
  return { meta, body: m[2] };
}

// ---------- load ----------

const site = JSON.parse(await read('site.json'));
const projects = JSON.parse(await read('projects.json'));

async function loadMarkdownDir(dir) {
  if (!existsSync(path.join(ROOT, dir))) return [];
  const files = (await readdir(path.join(ROOT, dir))).filter((f) => f.endsWith('.md')).sort();
  return Promise.all(files.map(async (f) => {
    const { meta, body } = frontMatter(await read(`${dir}/${f}`));
    const base = f.replace(/\.md$/, '');
    const dateFromName = base.match(/^(\d{4}-\d{2}-\d{2})-(.*)$/);
    return {
      file: f,
      slug: meta.slug || slugify(dateFromName ? dateFromName[2] : base),
      title: meta.title || (dateFromName ? dateFromName[2] : base).replace(/-/g, ' '),
      date: meta.date || (dateFromName ? dateFromName[1] : null),
      html: markdown(body),
      excerpt: body.trim().split(/\n\s*\n/)[0].replace(/[*_`#>\[\]]/g, '').slice(0, 200),
    };
  }));
}

const posts = (await loadMarkdownDir('posts')).sort((a, b) => String(b.date).localeCompare(String(a.date)));
const writeups = await loadMarkdownDir('projects');
const writeupFor = (p) => writeups.find((w) => w.slug === p.slug || w.slug === slugify(p.name));

for (const p of projects) {
  p.slug = p.slug || slugify(p.name);
  if (!p.icon && existsSync(path.join(ROOT, 'icons', `${p.slug}.png`))) p.icon = `icons/${p.slug}.png`;
  p.era = p.era || ((yearOf(p.date) ?? 9999) >= (site.eraCutoff ?? 2024) ? 'post' : 'pre');
  p.writeup = writeupFor(p);
}

// ---------- pieces ----------

const PALETTE = ['#6e8cc9', '#8b6bb1', '#5da06a', '#d08b3c', '#c65a5a', '#4c9cb8', '#8a8f99'];
function iconHtml(p, size) {
  const cls = `icon icon-${size}`;
  if (p.icon) return `<span class="${cls}"><img src="/${attr(p.icon)}" alt="" loading="lazy" width="512" height="512"></span>`;
  let h = 0; for (const ch of p.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const color = PALETTE[h % PALETTE.length];
  return `<span class="${cls} icon-generic" style="--icon-color:${color}"><span>${esc(p.name.trim()[0].toUpperCase())}</span></span>`;
}

function sourceLinks(src) {
  if (!src) return [];
  if (typeof src === 'string') return [`<a href="${attr(src)}">source</a>`];
  return Object.entries(src).map(([label, url]) => `<a href="${attr(url)}">${esc(label)}</a>`);
}

function rowHtml(p) {
  const bits = [];
  if (p.date) bits.push(`<span class="date">${esc(p.date)}</span>`);
  if (p.demo) bits.push(`<a href="${attr(p.demo)}"${demoData(p)}>${esc(p.demoLabel || 'demo')}</a>`);
  bits.push(...sourceLinks(p.source));
  const sub = [bits.join('<span class="sep"> · </span>'), p.blurb ? `<span class="blurb">${esc(p.blurb)}</span>` : ''].filter(Boolean).join('<br>');
  const icon = p.demo ? `<a class="icon-link" href="${attr(p.demo)}"${demoData(p)} tabindex="-1" aria-hidden="true">${iconHtml(p, 'small')}</a>` : iconHtml(p, 'small');
  const chevron = p.writeup ? `<a class="chevron" href="/projects/${attr(p.slug)}/" data-demo="${attr(p.name)}" data-slug="${attr(p.slug)}-writeup" aria-label="Read about ${attr(p.name)}"></a>` : '';
  return `<li class="row${p.writeup ? ' has-more' : ''}">${icon}<span class="cell-text"><span class="cell-title">${esc(p.name)}</span>${sub ? `<span class="cell-sub">${sub}</span>` : ''}</span>${p.status ? `<span class="cell-detail">${esc(p.status)}</span>` : ''}${chevron}</li>`;
}

// A demo link that the phone opens inside its screen. YouTube links get the embeddable URL.
const embedUrl = (u) => { const m = String(u).match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([\w-]+)/); return m ? `https://www.youtube.com/embed/${m[1]}` : u; };
const demoData = (p) => ` data-demo="${attr(p.name)}" data-slug="${attr(p.slug)}" data-src="${attr(embedUrl(p.demo))}"`;

function homeIcon(p) {
  return `<li><a class="app-icon" href="${attr(p.demo)}"${demoData(p)}>${iconHtml(p, 'home')}<span class="app-label">${esc(p.name)}</span></a></li>`;
}

function sysIcon({ app, href, label, cls, email }) {
  return `<li><a class="app-icon" href="${attr(href)}"${app ? ` data-app="${app}"` : ''}${email ? ` data-e="${attr(email)}"` : ''}><span class="icon icon-home icon-sys ${cls}"></span><span class="app-label">${esc(label)}</span></a></li>`;
}

// The email address is written backwards in the HTML (site.json stores it that way) and shown
// the right way round by CSS; the script in head() turns it into a real mailto: link on load.
const emailHtml = (cls = '') => site.emailReversed ? `<a class="${cls}" href="#contact" data-e="${attr(site.emailReversed)}"><span class="rev">${esc(site.emailReversed)}</span></a>` : '';
const EMAIL_SCRIPT = `<script>addEventListener('DOMContentLoaded',function(){for(var a of document.querySelectorAll('a[data-e]')){var e=Array.from(a.dataset.e).reverse().join('');a.href='mailto:'+e;var s=a.querySelector('.rev');if(s){s.textContent=e;s.classList.remove('rev');}}});</script>`;

function head({ title, description, url, extraHead = '' }) {
  const full = title === site.title ? site.title : `${title} – ${site.title}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${esc(full)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="description" content="${attr(description)}">
  <meta property="og:title" content="${attr(full)}">
  <meta property="og:description" content="${attr(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${attr(site.url + url)}">
  <meta property="og:image" content="${attr(site.url)}/icon-512.png">
  <link rel="canonical" href="${attr(site.url + url)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/icon-512.png" type="image/png" sizes="512x512">
  <link rel="apple-touch-icon" href="/icon-512.png">
  <link rel="alternate" type="application/atom+xml" title="${attr(site.title)} – writing" href="/feed.xml">
  <link rel="stylesheet" href="/style.css">
  ${EMAIL_SCRIPT}
${extraHead}</head>`;
}

function navbar({ title, back, right, cls = '', titleId = '', backId = '' }) {
  return `<header class="navbar ${cls}">
  <div class="navbar-inner">
    ${back ? `<a class="nav-btn nav-back" href="${attr(back.href)}"${backId ? ` id="${backId}"` : ''}${back.hidden ? ' hidden' : ''}>${esc(back.label)}</a>` : '<span class="nav-spacer"></span>'}
    <h1 class="nav-title"${titleId ? ` id="${titleId}"` : ''}>${esc(title)}</h1>
    ${right ? `<a class="nav-btn" href="${attr(right.href)}"${right.id ? ` id="${right.id}"` : ''}${right.blank ? ' target="_blank" rel="noopener"' : ''}>${esc(right.label)}</a>` : '<span class="nav-spacer"></span>'}
  </div>
</header>`;
}

function footer() {
  const bits = [emailHtml()].filter(Boolean);
  if (site.github) bits.push(`<a href="${attr(site.github)}">github</a>`);
  bits.push('<a href="/feed.xml">rss</a>');
  return `<footer class="site-footer"><p>${bits.join('<span class="sep"> · </span>')}</p></footer>`;
}

// ---------- the phone (index.html) ----------

function indexPage() {
  const demos = projects.filter((p) => p.demo);
  const PER_PAGE = 16;
  const pages = [];
  for (const [title, era] of [[site.postAiTitle || 'With AI', 'post'], [site.preAiTitle || 'By hand', 'pre']]) {
    const list = demos.filter((p) => p.era === era);
    for (let i = 0; i < list.length; i += PER_PAGE) pages.push({ title: i ? '' : title, apps: list.slice(i, i + PER_PAGE) });
  }
  const post = projects.filter((p) => p.era === 'post');
  const pre = projects.filter((p) => p.era === 'pre');
  const group = (title, list, cls, note = '') => list.length ? `
      <div class="era era-${cls}">${note}
        <h2 class="group-header">${esc(title)}</h2>
        <ul class="group ${cls}">
${list.map(rowHtml).join('\n')}
        </ul>
      </div>` : '';
  const postList = posts.map((p) => `<li><a href="/writing/${attr(p.slug)}/" data-post="${attr(p.slug)}">${esc(p.title)}</a>${p.date ? `<span class="post-date">${esc(longDate(p.date))}</span>` : ''}</li>`).join('\n          ');
  const postViews = posts.map((p) => `<article class="scroll paper post view" id="post-${attr(p.slug)}" data-title="${attr(p.title)}" hidden>
        <h1>${esc(p.title)}</h1>
        ${p.date ? `<p class="post-date"><time datetime="${attr(p.date)}">${esc(longDate(p.date))}</time></p>` : ''}
${p.html}
      </article>`).join('\n      ');
  const dock = [
    sysIcon({ app: 'about', href: '#about', label: 'About', cls: 'icon-about' }),
    sysIcon({ app: 'projects', href: '#projects', label: 'Projects', cls: 'icon-projects' }),
    sysIcon({ app: 'writing', href: '#writing', label: 'Writing', cls: 'icon-writing' }),
    site.emailReversed ? sysIcon({ href: '#contact', label: 'Mail', cls: 'icon-mail', email: site.emailReversed }) : '',
  ].join('');

  return `${head({ title: site.title, description: site.description, url: '/' })}
<body class="phone-body">
<div class="stage">
<div class="phone" id="phone">
  <div class="bezel-top"><span class="camera"></span><span class="speaker"></span></div>
  <div class="screen" id="screen">
    <div class="statusbar" aria-hidden="true">
      <span class="signal"><i></i><i></i><i></i><i></i><i class="off"></i><span>${esc(site.carrier || site.title.split(' ')[0])}</span></span>
      <span class="clock" data-clock="status">9:41 AM</span>
      <span class="battery"><span></span></span>
    </div>

    <div class="home" id="home">
      <div class="pages" id="pages" tabindex="0" aria-label="Home screen">
${pages.map((pg) => `        <section class="page">${pg.title ? `<h2 class="page-title">${esc(pg.title)}</h2>` : ''}<ul class="grid">${pg.apps.map(homeIcon).join('')}</ul></section>`).join('\n')}
      </div>
      <div class="dots" id="dots" aria-hidden="true"><span class="dot dot-search"></span>${pages.map((_, i) => `<span class="dot${i === 0 ? ' on' : ''}"></span>`).join('')}</div>
      <div class="dock"><ul class="grid">${dock}</ul></div>
    </div>

    <section class="app app-about" id="app-about" data-app="about" aria-hidden="true" hidden>
      ${navbar({ title: 'About' })}
      <div class="scroll">
        <div class="group intro-cell"><p>${inline(site.intro)}</p></div>
        <ul class="group">
          ${site.emailReversed ? `<li class="row">${emailHtml('row-link')}</li>` : ''}
          ${site.github ? `<li class="row"><a class="row-link" href="${attr(site.github)}">GitHub</a></li>` : ''}
          <li class="row"><a class="row-link" href="/feed.xml">RSS feed</a></li>
        </ul>
      </div>
    </section>

    <section class="app app-projects" id="app-projects" data-app="projects" aria-hidden="true" hidden>
      ${navbar({ title: 'Projects' })}
      <div class="scroll">
${group(site.postAiTitle || 'With AI', post, 'flat')}
${group(site.preAiTitle || 'By hand', pre, 'glossy', site.eraNote ? `\n        <p class="era-note">${inline(site.eraNote)}</p>` : '')}
      </div>
    </section>

    <section class="app app-writing" id="app-writing" data-app="writing" aria-hidden="true" hidden>
      ${navbar({ title: 'Writing', cls: 'notes-bar', titleId: 'writing-title', backId: 'writing-back', back: { href: '#writing', label: 'Writing', hidden: true } })}
      <div class="scroll paper view" id="writing-list">
        <ul class="post-list">
          ${postList}
        </ul>
      </div>
      ${postViews}
    </section>

    <section class="app app-frame" id="app-frame" data-app="frame" aria-hidden="true" hidden>
      ${navbar({ title: '', titleId: 'frame-title', right: { href: '#', label: 'Open ↗', id: 'frame-open', blank: true } })}
      <iframe id="frame" src="about:blank" title="Demo" allow="fullscreen"></iframe>
    </section>

    <div class="lock" id="lock" tabindex="0" aria-label="Lock screen. Press Enter to unlock.">
      <div class="lock-time"><div class="lock-clock" data-clock="lock">9:41</div><div class="lock-date" data-date>Friday, September 4</div></div>
      <div class="lock-note">
        <span class="icon icon-sys icon-about"></span>
        <div class="lock-note-body">
          <div class="lock-note-title">${esc(site.title)}</div>
          <p>${inline(site.intro)}</p>
          ${site.emailReversed ? `<p class="lock-note-email">${emailHtml()}</p>` : ''}
        </div>
      </div>
      <div class="unlock"><div class="unlock-track" id="unlock-track"><div class="knob" id="knob" role="button" aria-label="Unlock"></div><span class="unlock-text" id="unlock-text">slide to unlock</span></div></div>
    </div>
  </div>
  <div class="bezel-bottom"><button class="home-btn" id="homebtn" type="button" aria-label="Home"><span></span></button></div>
</div>
<p class="stage-foot">${[emailHtml(), site.github ? `<a href="${attr(site.github)}">github</a>` : '', '<a href="/writing/">writing</a>', '<a href="/feed.xml">rss</a>'].filter(Boolean).join(' · ')}</p>
</div>
<noscript><style>.lock, .stage-foot { display: none; } .home { position: static; } .app[hidden] { display: flex !important; position: static; } .screen { height: auto; }</style><p style="color:#ccc;text-align:center;font-size:14px">This page is a small iPhone that needs JavaScript. Without it: <a href="/writing/" style="color:#fff">writing</a>, and the projects are listed below.</p></noscript>
<script src="/phone.js" defer></script>
</body>
</html>
`;
}

function writingIndexPage() {
  return `${head({ title: 'Writing', description: `Posts by ${site.title}.`, url: '/writing/' })}
<body class="notes-page">
${navbar({ title: 'Writing', back: { href: '/', label: site.title } })}
<main>
  <div class="paper">
    <ul class="post-list">
${posts.map((p) => `      <li><a href="/writing/${attr(p.slug)}/">${esc(p.title)}</a>${p.date ? `<span class="post-date">${esc(longDate(p.date))}</span>` : ''}</li>`).join('\n')}
    </ul>
  </div>
</main>
${footer()}
</body>
</html>
`;
}

function postPage(p) {
  return `${head({ title: p.title, description: p.excerpt, url: `/writing/${p.slug}/`, extraHead: '  <meta property="og:type" content="article">\n' })}
<body class="notes-page">
${navbar({ title: 'Writing', back: { href: '/', label: site.title } })}
<main>
  <article class="paper post">
    <h1>${esc(p.title)}</h1>
    ${p.date ? `<p class="post-date"><time datetime="${attr(p.date)}">${esc(longDate(p.date))}</time></p>` : ''}
${p.html}
  </article>
</main>
${footer()}
</body>
</html>
`;
}

function projectPage(p) {
  const w = p.writeup;
  const links = [];
  if (p.demo) links.push(`<a class="row-link" href="${attr(p.demo)}">${esc(p.demoLabel ? p.demoLabel[0].toUpperCase() + p.demoLabel.slice(1) : 'Open the demo')}</a>`);
  links.push(...sourceLinks(p.source).map((a) => a.replace('<a ', '<a class="row-link" ').replace(/>(\w)([^<]*)<\/a>$/, (_, c, r) => `>${c.toUpperCase()}${r}</a>`)));
  return `${head({ title: p.name, description: w.excerpt || p.blurb || p.name, url: `/projects/${p.slug}/` })}
<body class="project-page">
${navbar({ title: p.name, back: { href: '/', label: site.title } })}
<main>
  <ul class="group glossy project-head">
    <li class="row">${iconHtml(p, 'small')}<span class="cell-text"><span class="cell-title">${esc(p.name)}</span>${p.date || p.blurb ? `<span class="cell-sub">${[p.date, p.blurb].filter(Boolean).map(esc).join('<span class="sep"> · </span>')}</span>` : ''}</span>${p.status ? `<span class="cell-detail">${esc(p.status)}</span>` : ''}</li>
${links.map((l) => `    <li class="row">${l}</li>`).join('\n')}
  </ul>
  <article class="group prose">
${w.html}
  </article>
</main>
${footer()}
</body>
</html>
`;
}

function feed() {
  const updated = posts[0]?.date ? `${posts[0].date}T00:00:00Z` : new Date().toISOString();
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${esc(site.title)}</title>
  <subtitle>${esc(site.description)}</subtitle>
  <link href="${attr(site.url)}/feed.xml" rel="self"/>
  <link href="${attr(site.url)}/"/>
  <id>${attr(site.url)}/</id>
  <updated>${updated}</updated>
  <author><name>${esc(site.title)}</name></author>
${posts.map((p) => `  <entry>
    <title>${esc(p.title)}</title>
    <link href="${attr(site.url)}/writing/${attr(p.slug)}/"/>
    <id>${attr(site.url)}/writing/${attr(p.slug)}/</id>
    <updated>${p.date ? `${p.date}T00:00:00Z` : updated}</updated>
    <content type="html">${esc(p.html)}</content>
  </entry>`).join('\n')}
</feed>
`;
}

// ---------- write ----------

await out('index.html', indexPage());
await out('writing/index.html', writingIndexPage());
for (const p of posts) await out(`writing/${p.slug}/index.html`, postPage(p));
if (existsSync(path.join(ROOT, 'projects'))) {
  // remove stale generated project pages, then write current ones
  for (const d of await readdir(path.join(ROOT, 'projects'), { withFileTypes: true })) if (d.isDirectory()) await rm(path.join(ROOT, 'projects', d.name), { recursive: true });
  for (const p of projects) if (p.writeup) await out(`projects/${p.slug}/index.html`, projectPage(p));
}
await out('feed.xml', feed());
