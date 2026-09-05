# Notes for AI maintainers

Read `README.md` first; it documents the file layout and the project/post fields.

Rules that are not obvious from the code:

- **Never** touch the demo directories at the top level (`convex-hull/`, `conways-game-of-life/`, `gpt-in-education/`, `compilers/`, and the rest), `CNAME`, or `.nojekyll`. They are separate deployments into this domain.
- `index.html`, `writing/`, `projects/*/` and `feed.xml` are generated. Edit `site.json`, `projects.json`, `posts/`, `style.css`, or `build.mjs`, then run `node build.mjs` and commit the outputs too.
- Keep `build.mjs` and `tools/icons.mjs` dependency-free. No `package.json`, no npm. The point is that it still builds untouched in years.
- Every project field except `name` is optional. Do not add placeholder values to make an entry "complete".
- The site must never read as a resume: no skills lists, no experience section, no tech-stack badges, no third-person bio, no hire-me call to action. First person, plain statements.
- The home page is deliberately a simulated iPhone 5 running iOS 6 (2012): lock screen, paged home screen, dock, apps that zoom open, demos in an iframe inside the screen. Ben asked for the phone itself, not just its visual language. The post-AI section of the Projects app is deliberately iOS 7 flat. Do not "clean it up" toward a minimal white-and-sans-serif page.
- The phone's screen is 320×568 CSS px and is scaled with CSS `zoom` on desktop. Keep new UI inside those bounds; test at 320 wide.
- `[hidden] { display: none !important }` in style.css is load-bearing: the lock and app panels are flex containers.
- Status vocabulary is candid but not self-scoring: works, mostly works, rough, barely works, done, ongoing, abandoned. Nothing gets hidden for being weak.
