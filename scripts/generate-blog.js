#!/usr/bin/env node

/**
 * Daily Blog Generator for blindside.to
 * Generates SEO-optimized blog articles using Claude API,
 * updates the blog index and sitemap automatically.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const BLOG_DIR = path.join(ROOT, 'blog');
const TOPICS_FILE = path.join(__dirname, 'topics.json');
const SITEMAP_FILE = path.join(ROOT, 'sitemap.xml');
const BLOG_INDEX_FILE = path.join(BLOG_DIR, 'index.html');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const TODAY = new Date().toISOString().split('T')[0];
const TODAY_DISPLAY = new Date().toLocaleDateString('en-US', {
  year: 'numeric', month: 'long', day: 'numeric'
});

// ---------------------------------------------------------------------------
// Claude API call
// ---------------------------------------------------------------------------
function callClaude(prompt, system) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system,
      messages: [{ role: 'user', content: prompt }]
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error.message));
          else resolve(parsed.content[0].text);
        } catch (e) { reject(new Error(`API parse error: ${data.slice(0, 500)}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Pick next topic from queue
// ---------------------------------------------------------------------------
function getNextTopic() {
  const topics = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf-8'));
  if (topics.queue.length === 0) {
    console.error('No topics left in queue!');
    process.exit(1);
  }
  const topic = topics.queue.shift();
  topics.generated.push({ ...topic, date: TODAY });
  fs.writeFileSync(TOPICS_FILE, JSON.stringify(topics, null, 2) + '\n');
  return topic;
}

// ---------------------------------------------------------------------------
// Get existing blog posts for internal linking
// ---------------------------------------------------------------------------
function getExistingPosts() {
  const indexHtml = fs.readFileSync(BLOG_INDEX_FILE, 'utf-8');
  const posts = [];
  const regex = /href="\/blog\/([^"]+)"[^>]*class="blog-index-card"[\s\S]*?<h2>([\s\S]*?)<\/h2>/g;
  let match;
  while ((match = regex.exec(indexHtml)) !== null) {
    posts.push({ slug: match[1], title: match[2].trim() });
  }
  return posts;
}

// ---------------------------------------------------------------------------
// Generate the article HTML
// ---------------------------------------------------------------------------
async function generateArticle(topic, existingPosts) {
  const relatedPosts = existingPosts
    .filter(p => p.slug !== topic.slug)
    .slice(0, 4)
    .map(p => `- "${p.title}" at /blog/${p.slug}`)
    .join('\n');

  const system = `You are a blog writer for blindside.to — a free couples game where both partners answer the same questions blindly, then reveal answers together. No app download needed. The site is at https://blindside.to/

Your job: write SEO-optimized, genuinely helpful blog articles that rank for target keywords. The articles should feel human-written, conversational, and authoritative — not generic AI slop.

CRITICAL RULES:
- Write in a warm, smart, slightly witty tone. Think: your clever friend who also happens to read psychology journals.
- NEVER use filler phrases like "In today's fast-paced world" or "In conclusion". Just say the thing.
- NEVER use the word "delve" or "tapestry" or "navigate" (as metaphor) or "foster" or "landscape" (as metaphor).
- Use short paragraphs. Mix sentence lengths. Use bold for key phrases.
- Include 2 CTA boxes linking to blindside.to — one mid-article, one near the end.
- Include practical, actionable content — not just fluffy advice.
- Write 1500-2200 words of body content.
- Target the primary keyword naturally — aim for 0.8-1.2% keyword density.
- Use H2 and H3 headings that include keyword variations (good for SEO).
- Include a FAQ section at the end with 3-4 questions using schema-friendly format.
- Mention blindside naturally 2-3 times in the body (not forced).`;

  const prompt = `Write a blog article for blindside.to:

**Target keyword:** "${topic.keyword}"
**Slug:** ${topic.slug}
**Tag:** ${topic.tag}
**Angle:** ${topic.angle}
**Date:** ${TODAY_DISPLAY}

**Existing posts for internal linking (link to 2-3 of these naturally in the article):**
${relatedPosts}

Return ONLY the raw HTML for the <article class="blog-article"> content (everything between the opening and closing article tags, NOT including the article tags themselves). Include:

1. The meta div with tag, date, and reading time
2. The h1 title (compelling, includes keyword, under 65 chars for SERP)
3. All body content with h2/h3 headings, paragraphs, lists, blockquotes
4. 2 CTA boxes using this exact format:
<div class="blog-cta">
  <h3>CTA headline</h3>
  <p>CTA description</p>
  <a href="/" class="cta-btn">Play Free on blindside</a>
</div>
5. FAQ section using this format for each Q&A:
<h3>Question here?</h3>
<p>Answer here.</p>
6. Related posts section:
<div class="blog-related">
  <h2>Keep reading</h2>
  <div class="blog-related-grid">
    <a href="/blog/SLUG" class="blog-related-card">
      <h3>Title</h3>
      <p>Short description</p>
    </a>
    (2 related posts)
  </div>
</div>

Do NOT include any markdown, code fences, or explanation. Just the raw inner HTML.`;

  return callClaude(prompt, system);
}

// ---------------------------------------------------------------------------
// Generate meta description and title
// ---------------------------------------------------------------------------
async function generateMeta(topic, articleHtml) {
  const system = 'You are an SEO expert. Return ONLY valid JSON, no markdown or explanation.';
  const prompt = `Given this blog article HTML for the keyword "${topic.keyword}", generate SEO metadata.

Article starts with: ${articleHtml.slice(0, 800)}

Return JSON with these exact fields:
{
  "title": "Page title (under 60 chars, includes keyword, ends with | blindside.)",
  "description": "Meta description (under 155 chars, includes keyword, compelling click-through)",
  "h1": "The h1 from the article (extract it exactly)",
  "readTime": "X min read",
  "keywords": "comma-separated secondary keywords (5-8 keywords)"
}`;

  const raw = await callClaude(prompt, system);
  // Extract JSON from response (handle potential markdown wrapping)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse meta JSON: ' + raw.slice(0, 200));
  return JSON.parse(jsonMatch[0]);
}

// ---------------------------------------------------------------------------
// Build the full HTML page
// ---------------------------------------------------------------------------
function buildPage(topic, meta, articleHtml) {
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<script>(function(){var t=localStorage.getItem('bs-theme')||'light';document.documentElement.setAttribute('data-theme',t);})()</script>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${meta.title}</title>
<meta name="description" content="${meta.description}">
<meta name="keywords" content="${meta.keywords}">
<link rel="canonical" href="https://blindside.to/blog/${topic.slug}">
<meta property="og:type" content="article">
<meta property="og:url" content="https://blindside.to/blog/${topic.slug}">
<meta property="og:title" content="${meta.title.replace(' | blindside.', '')}">
<meta property="og:description" content="${meta.description}">
<meta property="og:image" content="https://blindside.to/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../blog.css">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "${meta.h1.replace(/"/g, '\\"')}",
  "description": "${meta.description.replace(/"/g, '\\"')}",
  "datePublished": "${TODAY}",
  "dateModified": "${TODAY}",
  "author": { "@type": "Organization", "name": "blindside" },
  "publisher": { "@type": "Organization", "name": "blindside", "url": "https://blindside.to" },
  "mainEntityOfPage": "https://blindside.to/blog/${topic.slug}"
}
</script>
</head>
<body>

<nav class="blog-nav">
  <a href="/" class="brand">blindside.</a>
  <div class="nav-links">
    <a href="/blog/">blog</a>
    <a href="/">play free</a>
  </div>
</nav>

<article class="blog-article">
${articleHtml}
</article>

<footer class="blog-footer">
  <p><a href="/">blindside.</a> — same questions. blind answers. one reveal.</p>
</footer>

<script src="../../t.js"></script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Update blog index — prepend new card
// ---------------------------------------------------------------------------
function updateBlogIndex(topic, meta) {
  let html = fs.readFileSync(BLOG_INDEX_FILE, 'utf-8');

  const newCard = `    <a href="/blog/${topic.slug}" class="blog-index-card">
      <div class="card-meta">
        <span class="tag">${topic.tag}</span>
        <span>${meta.readTime}</span>
      </div>
      <h2>${meta.h1}</h2>
      <p>${meta.description}</p>
    </a>\n`;

  // Insert after the opening of blog-index-list
  html = html.replace(
    '<div class="blog-index-list">\n',
    '<div class="blog-index-list">\n\n' + newCard
  );

  fs.writeFileSync(BLOG_INDEX_FILE, html);
}

// ---------------------------------------------------------------------------
// Update sitemap
// ---------------------------------------------------------------------------
function updateSitemap(topic) {
  let xml = fs.readFileSync(SITEMAP_FILE, 'utf-8');

  const newEntry = `  <url>
    <loc>https://blindside.to/blog/${topic.slug}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>`;

  xml = xml.replace('</urlset>', newEntry + '\n</urlset>');

  // Also update blog index lastmod
  xml = xml.replace(
    /<url>\s*<loc>https:\/\/blindside\.to\/blog\/<\/loc>\s*<lastmod>[^<]+<\/lastmod>/,
    `<url>\n    <loc>https://blindside.to/blog/</loc>\n    <lastmod>${TODAY}</lastmod>`
  );

  fs.writeFileSync(SITEMAP_FILE, xml);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (!ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }

  console.log(`[blog-gen] Starting blog generation for ${TODAY}`);

  // 1. Pick topic
  const topic = getNextTopic();
  console.log(`[blog-gen] Topic: "${topic.keyword}" (${topic.slug})`);

  // 2. Get existing posts for linking
  const existingPosts = getExistingPosts();
  console.log(`[blog-gen] Found ${existingPosts.length} existing posts for internal linking`);

  // 3. Generate article content
  console.log('[blog-gen] Generating article content...');
  const articleHtml = await generateArticle(topic, existingPosts);

  // 4. Generate meta
  console.log('[blog-gen] Generating SEO metadata...');
  const meta = await generateMeta(topic, articleHtml);
  console.log(`[blog-gen] Title: "${meta.title}"`);

  // 5. Build full page
  const pageHtml = buildPage(topic, meta, articleHtml);

  // 6. Write article file
  const articleDir = path.join(BLOG_DIR, topic.slug);
  fs.mkdirSync(articleDir, { recursive: true });
  fs.writeFileSync(path.join(articleDir, 'index.html'), pageHtml);
  console.log(`[blog-gen] Written: blog/${topic.slug}/index.html`);

  // 7. Update blog index
  updateBlogIndex(topic, meta);
  console.log('[blog-gen] Updated blog index');

  // 8. Update sitemap
  updateSitemap(topic);
  console.log('[blog-gen] Updated sitemap');

  console.log('[blog-gen] Done!');
}

main().catch(err => {
  console.error('[blog-gen] Error:', err.message);
  process.exit(1);
});
