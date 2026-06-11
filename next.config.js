const { withSentryConfig } = require("@sentry/nextjs");
const createNextIntlPlugin = require("next-intl/plugin");
const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// ─── Help search index generation ────────────────────────────────────────────
function stripMarkdownCJS(md) {
  return md
    .replace(/^---[\s\S]*?---\n?/m, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*>\s*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

(function generateHelpSearchIndex() {
  const helpDir = path.join(process.cwd(), "content/help");
  const outPath = path.join(process.cwd(), "public/help/search-index.json");

  if (!fs.existsSync(helpDir)) return;

  const entries = [];

  for (const dirent of fs.readdirSync(helpDir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const dirPath = path.join(helpDir, dirent.name);

    for (const file of fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"))) {
      const slug = file.replace(/\.md$/, "");
      const raw = fs.readFileSync(path.join(dirPath, file), "utf-8");
      const { data, content } = matter(raw);

      entries.push({
        slug,
        title: data.title ?? "",
        description: data.description ?? "",
        category: data.category ?? dirent.name,
        tags: data.tags ?? [],
        content: stripMarkdownCJS(content),
      });
    }
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(entries), "utf-8");
  console.log(`[help] search index: ${entries.length} articles → public/help/search-index.json`);
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cal.com https://us-assets.i.posthog.com blob:",
              "style-src 'self' 'unsafe-inline' https://cal.com",
              "img-src 'self' blob: data: https://*.supabase.co https://cal.com",
              "font-src 'self' https://cal.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://*.ingest.de.sentry.io https://cal.com https://us.i.posthog.com https://us-assets.i.posthog.com blob:",
              "frame-src https://cal.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = withSentryConfig(withNextIntl(nextConfig), {
  // Suppress source map upload warnings when SENTRY_AUTH_TOKEN is not set
  silent: true,

  // Upload source maps for better stack traces in production
  widenClientFileUpload: true,

  // Skip source map upload when SENTRY_AUTH_TOKEN is not set (e.g. local builds)
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
