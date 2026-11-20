import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';

// Dynamic support for custom domain vs default GitHub Pages
const customDomain = process.env.CUSTOM_DOMAIN;
const site = customDomain ? `https://${customDomain}` : 'https://exa-dev-templates.github.io';
const base = customDomain ? '/' : '/create-stack';

export default defineConfig({
  site,
  base,
  integrations: [
    mermaid(),
    starlight({
      title: '@exa31/create-stack',
      description: 'Production-ready Scaffolding CLI & Clean Architecture Starter Kits',
      logo: {
        src: './src/assets/logo.svg',
      },
      favicon: '/favicon.svg',
      head: [
        {
          tag: 'link',
          attrs: {
            rel: 'icon',
            type: 'image/x-icon',
            href: base === '/' ? '/favicon.ico' : `${base}/favicon.ico`,
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'apple-touch-icon',
            sizes: '180x180',
            href: base === '/' ? '/apple-touch-icon.png' : `${base}/apple-touch-icon.png`,
          },
        },
      ],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/exa31/templates',
        },
      ],
      defaultLocale: 'root',
      locales: {
        root: {
          label: 'Bahasa Indonesia',
          lang: 'id',
        },
        en: {
          label: 'English',
          lang: 'en',
        },
      },
      sidebar: [
        {
          label: 'Mulai / Getting Started',
          translations: { en: 'Getting Started' },
          items: [
            { label: 'Pengenalan', translations: { en: 'Introduction' }, slug: 'intro' },
            { label: 'Panduan Kilat (Quickstart)', translations: { en: 'Quickstart' }, slug: 'quickstart' },
            { label: 'Mode Scaffolding', translations: { en: 'Scaffolding Modes' }, slug: 'scaffolding-modes' },
            { label: 'Opsi & Prompt CLI', translations: { en: 'CLI Options & Prompts' }, slug: 'cli-options' },
            { label: 'Infrastruktur Docker Lokal', translations: { en: 'Local Docker Infrastructure' }, slug: 'local-infrastructure' },
          ],
        },
        {
          label: '🎨 Frontend Templates',
          items: [
            { label: 'Overview & Standar Frontend', translations: { en: 'Overview & Frontend Standards' }, slug: 'frontend/overview' },
            { label: 'React 19 (Vite + Tailwind v4 + PrimeReact)', slug: 'frontend/template-react' },
            { label: 'Vue 3 (Vite + Tailwind v4 + PrimeVue)', slug: 'frontend/template-vue' },
          ],
        },
        {
          label: '⚙️ Backend Templates',
          items: [
            { label: 'Overview & Clean Architecture', translations: { en: 'Overview & Clean Architecture' }, slug: 'backend/overview' },
            { label: 'Express.js (TypeScript + Zod + Winston)', slug: 'backend/template-express' },
            { label: 'FastAPI Async (Python + Pydantic + asyncpg)', slug: 'backend/template-fastapi-async' },
            { label: 'Golang (Fiber v2 + sqlx + slog)', slug: 'backend/template-golang' },
            { label: 'Java (Spring Boot 4 + Liquibase + JWT)', slug: 'backend/template-java' },
            { label: 'Rust (Axum 0.7 + SQLx + Tracing)', slug: 'backend/template-rust' },
          ],
        },
        {
          label: '🔄 Worker Templates',
          items: [
            { label: 'Overview Consumer & QoS Pattern', translations: { en: 'Consumer & QoS Pattern Overview' }, slug: 'workers/overview' },
            { label: 'Golang Worker', slug: 'workers/template-worker-golang' },
            { label: 'Java Worker', slug: 'workers/template-worker-java' },
            { label: 'Python Worker', slug: 'workers/template-worker-python' },
            { label: 'TypeScript Worker', slug: 'workers/template-worker-typescript' },
            { label: 'Rust Worker', slug: 'workers/template-worker-rust' },
          ],
        },
        {
          label: '📐 Standar Arsitektur (Rules)',
          translations: { en: 'Architectural Standards' },
          items: [
            { label: 'Structured JSON Logging', slug: 'standards/logging' },
            { label: 'Semantic Error Handling', slug: 'standards/error-handling' },
            { label: 'Database Transactions', slug: 'standards/database-transactions' },
            { label: 'Idempotency Protection', slug: 'standards/idempotency' },
            { label: 'Dual-Tier Rate Limiting', translations: { en: 'Dual-Tier Rate Limiting' }, slug: 'standards/rate-limiting' },
            { label: 'Frontend Skeleton Loading', slug: 'standards/frontend-loading' },
            { label: 'Package Security & Audit', slug: 'standards/package-security' },
            { label: 'Standardisasi Import', slug: 'standards/import-standards' },
            { label: 'OpenAPI & Swagger UI', slug: 'standards/api-documentation' },
          ],
        },
        {
          label: '🤖 AI Coding Agents',
          items: [
            { label: 'Panduan AI Assistant & AGENTS.md', translations: { en: 'AI Guidelines & AGENTS.md' }, slug: 'ai/agents-guidelines' },
            { label: 'Penggabungan Skill Otomatis', translations: { en: 'Automatic Skill Merging' }, slug: 'ai/skills-merging' },
          ],
        },
      ],
      customCss: ['./src/styles/custom.css'],
    }),
  ],
});
