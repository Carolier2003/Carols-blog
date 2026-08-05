# AGENTS.md

Project-wide guidance for coding agents. See `CLAUDE.md` for a detailed architecture
overview (content system, routing, layouts, OG image generation, styling, Giscus comments).

## Cursor Cloud specific instructions

This is **AstroPaper**, a static Astro 5 blog (single app, no separate backend). Standard
commands live in `package.json` scripts and `CLAUDE.md`; below are only the non-obvious caveats.

- **Package manager is `pnpm`.** Both `package-lock.json` and `pnpm-lock.yaml` exist, but the
  `packageManager` field and CI (`.github/workflows/ci.yml`) use pnpm. Do not use npm to install.
- **Ignored build scripts are fine.** `pnpm install` prints a warning that `sharp` and `esbuild`
  build scripts are ignored. The build still works (they ship prebuilt binaries). Do **not** run
  the interactive `pnpm approve-builds`.
- **Dev server:** `pnpm dev` serves at `http://localhost:4321/` (add `--host 0.0.0.0` to expose).
  New/edited Markdown posts in `src/data/blog/` hot-reload automatically.
- **`pnpm build`** runs `astro check` (type check) → `astro build` → Pagefind index → copies the
  index into `public/`. Pagefind static search only works after at least one build has run.
- **Lint/format report pre-existing issues.** `pnpm lint` and `pnpm format:check` currently fail
  on the repo's own customized code (e.g. `no-console`, `no-var`, formatting). This is the state of
  the code, not an environment problem — the tooling itself runs correctly. Use `pnpm format` and
  `eslint --fix` only when intentionally cleaning up.
- **Admin pages / Cloudflare Pages functions** (`functions/admin/`, `src/pages/admin/`) need
  `ADMIN_USERNAME` / `ADMIN_PASSWORD` and only run under `wrangler pages dev` (`pnpm preview:pages`),
  using `.dev.vars` locally. The plain `pnpm dev` server does not require these.
