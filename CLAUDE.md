# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AstroPaper is a minimal, responsive, accessible and SEO-friendly Astro blog theme. It's built with Astro 5, TypeScript, and TailwindCSS v4.

## Common Commands

All commands use `pnpm`:

```bash
# Development
pnpm dev              # Start dev server at localhost:4321

# Build
pnpm build            # Production build with type check, pagefind index, and OG image gen
pnpm preview          # Preview production build locally

# Code Quality
pnpm lint             # ESLint check
pnpm format           # Prettier format
pnpm format:check     # Check formatting without writing
pnpm sync             # Generate Astro TypeScript types

# Docker (alternative)
docker compose up -d  # Run in Docker container
```

## Architecture

### Content System

Blog posts are stored in `src/data/blog/` as Markdown files with frontmatter. The content schema is defined in `src/content.config.ts` using Astro's content collections with Zod validation.

Frontmatter schema includes: `title`, `pubDatetime`, `modDatetime`, `description`, `tags`, `draft`, `featured`, `ogImage` (local asset or remote URL), `canonicalURL`, `timezone`, and `hideEditPost`.

Posts are accessed via `getCollection("blog")` and filtered/sorted using utilities in `src/utils/`.

### Routing Structure

- `/` - Homepage with featured and recent posts
- `/posts/` - Paginated post listing
- `/posts/[...slug]/` - Individual blog post pages (dynamic OG images at `index.png`)
- `/tags/` - Tag index
- `/tags/[tag]/` - Posts filtered by tag
- `/archives/` - All posts chronologically (optional, controlled by `SITE.showArchives`)
- `/search/` - Static search using Pagefind

### Layout Hierarchy

- `Layout.astro` - Base HTML, meta tags, OG images, theme script, JSON-LD structured data
- `Main.astro` - Wrapper with header/footer for standard pages
- `PostDetails.astro` - Blog post layout with prev/next navigation, copy buttons, scroll progress
- `AboutLayout.astro` - About page layout

### Search Implementation

Uses Pagefind for static search. The build process (`pnpm build`) generates the search index. Search requires at least one build to function in development mode. The UI is customized via CSS variables in `search.astro`.

### OG Image Generation

Dynamic OG images are generated at build time using Satori and Resvg:
- `src/utils/generateOgImages.ts` - PNG generation functions
- `src/utils/og-templates/post.js` & `site.js` - Satori JSX templates
- Endpoint at `src/pages/posts/[...slug]/index.png.ts` serves generated images

Controlled by `SITE.dynamicOgImage` in config. Falls back to `SITE.ogImage` if disabled.

### Styling Architecture

Uses TailwindCSS v4 with CSS-based configuration (no `tailwind.config.js`):
- `src/styles/global.css` - Theme variables, base styles, typography prose styles
- Theme variables: `--background`, `--foreground`, `--accent`, `--muted`, `--border`
- Dark mode uses `data-theme="dark"` attribute on `<html>`

**Color Schemes:**
- Light: `#fdfdfd` bg, `#282728` text, `#006cac` accent
- Dark: `#212737` bg, `#eaedf3` text, `#ff6b01` accent

### Key Configuration Files

- `src/config.ts` - Site metadata, pagination settings, feature flags
- `src/constants.ts` - Social links and share links arrays
- `astro.config.ts` - Astro config with remark plugins (TOC, collapse), Shiki themes, Vite plugins
- `src/content.config.ts` - Blog collection schema with Zod

### Utility Functions

- `getSortedPosts.ts` - Sort by publication date (newest first)
- `getPath.ts` - Generate URL paths from post ID/filePath
- `postFilter.ts` - Filter out drafts and future-dated posts
- `slugify.ts` - URL-safe string conversion
- `loadGoogleFont.ts` - Google Fonts loading for OG images

### TypeScript Path Mapping

Uses `@/*` alias pointing to `./src/*` for imports.

### ESLint Configuration

Uses flat config (`eslint.config.js`) with:
- `typescript-eslint` recommended rules
- `eslint-plugin-astro` recommended rules
- Custom rule: `no-console: "error"`
- Ignores: `dist/`, `.astro/`, `public/pagefind/`

### Comment System (Giscus)

Located at `src/components/Comments.astro`. Uses Giscus (GitHub Discussions-based commenting).

**Configuration:**
- Repository: `Carolier2003/Carols-blog`
- Category: `Announcements`
- Mapping: `pathname` (each page maps to its own discussion)

**Custom Themes:**
- `public/giscus-light.css` - Custom theme matching site light mode
- `public/giscus-dark.css` - Custom theme matching site dark mode

**Theme Sync:**
- `src/scripts/theme.ts` sends `postMessage` to Giscus iframe when theme changes
- Initial theme set by `initGiscusTheme()` in Comments.astro
- Handles Astro page transitions via `astro:after-swap` event

**Important - Scoped CSS Gotcha:**
Astro's default `<style>` scopes CSS with `data-astro-cid-*` attributes. JavaScript dynamically created elements (like Giscus iframe) won't have this attribute, so styles won't apply. **Solution**: Use `<style is:global>` for components that render dynamic content via client-side JavaScript.

Example:
```astro
<!-- ❌ Won't work for dynamically created elements -->
<style>
  .comment { ... }  /* becomes .comment[data-astro-cid-xxx] { ... } */
</style>

<!-- ✅ Works for all elements including dynamically created -->
<style is:global>
  .comment { ... }  /* stays as .comment { ... } */
</style>
```

### Important Notes

- **Search in dev mode**: Requires `pnpm build` at least once for Pagefind index to exist
- **Console logging**: ESLint treats `console.log` as error; remove before committing
- **Draft posts**: Filtered by `postFilter` in production but visible in development
- **Scheduled posts**: Uses `scheduledPostMargin` (15 min default) to allow posts slightly in future
- **Theme FOUC prevention**: Inline script in Layout.astro sets theme before render
