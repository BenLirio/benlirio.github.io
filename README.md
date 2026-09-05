# benlirio.com

A shelf for the things I make, presented as a simulated iPhone 5 running iOS 6. Static HTML on GitHub Pages, no framework.

The home page is the phone: a lock screen (the intro paragraph is the notification; slide, click or press Enter to unlock), a paged home screen of the demos (swipe, drag, arrow keys or the mouse wheel), a dock with About / Projects / Writing / Mail, and apps that zoom open from their icon. Demos run in an iframe inside the screen; the home button (or Escape) closes them. Every state has a URL: `#about`, `#projects`, `#writing`, `#writing/<post-slug>`, `#demo/<project-slug>`. On a real phone the screen fills the viewport and the bezel disappears.

## Layout

| Path | What |
| --- | --- |
| `site.json` | Name, email, intro paragraph, the pre/post-AI note and cutoff year. |
| `projects.json` | The project list. **One entry per project, only `name` is required.** |
| `posts/*.md` | Writing. Markdown with a small front matter block. |
| `projects/*.md` | Optional per-project writeup. Almost none exist; that is fine. |
| `icons/*.png` | Square icons, made from screenshots of the demos by `tools/icons.mjs`. |
| `build.mjs` | Renders everything. Uses only Node's standard library. |
| `phone.js` | The phone's behavior: lock screen, paging, opening apps, routing. No dependencies. |
| `style.css`, `favicon.svg` | Hand-written. |
| `index.html`, `writing/`, `feed.xml` | **Generated.** Edit the sources, then rebuild. |

Everything else at the top level (`convex-hull/`, `conways-game-of-life/`, `gpt-in-education/`, `compilers/`, …) is a demo deployed into this domain from another repo. Leave those directories, `CNAME` and `.nojekyll` alone.

## Build

```sh
node build.mjs
```

Commit the generated files along with the sources. There is no CI step and nothing to install.

## Add a project

Append an object to `projects.json`. Newest first is the convention. Fields:

```jsonc
{
  "name": "Thing",                         // required
  "date": "Fall 2026",                     // any text; the last 4-digit year decides the era
  "status": "works",                       // free text: works, mostly works, rough, barely works, done, ongoing, abandoned…
  "blurb": "One line about it.",
  "demo": "/thing/",                       // or a full URL; also puts it on the icon grid
  "demoLabel": "read",                     // word used for the demo link (default "demo")
  "source": "https://github.com/…",        // or {"server": "…", "client": "…"}
  "icon": "icons/thing.png",               // optional; icons/<slug>.png is picked up automatically
  "era": "pre",                            // optional override: "pre" or "post"; otherwise decided by date vs site.json eraCutoff
  "slug": "thing"                          // optional; derived from name
}
```

Missing fields are simply not shown. An entry with only a `name` renders as a row with a generic lettered icon.

To give it an icon, add an entry to `ICONS` in `tools/icons.mjs` (URL, viewport, crop box, optional clicks or drags so the canvas has something on it), then:

```sh
python3 -m http.server 8765      # only needed for demos that live in this repo
node tools/icons.mjs thing       # writes icons/thing.png; DEBUG=1 dumps full viewports to tools/debug/
```

## Add a post

Create `posts/YYYY-MM-DD-some-title.md`:

```markdown
---
title: Some title
date: 2026-09-04
---

Text. Headings, lists, links, code fences, blockquotes and images all work.
```

The date and slug come from the file name if the front matter omits them. Rebuild; the post lands at `/writing/some-title/` and in `feed.xml`.

## Add a project writeup

Create `projects/<slug>.md` where `<slug>` matches the project's slug (its name, lowercased and hyphenated, or the explicit `slug` field). Rebuild. The project's row gets a chevron linking to `/projects/<slug>/`. Nothing else changes, and nothing is required.
