#!/usr/bin/env node

/**
 * Add a new topic to the blog queue.
 * Usage: node scripts/add-topic.js "slug" "keyword" "Tag" "angle description"
 */

const fs = require('fs');
const path = require('path');

const TOPICS_FILE = path.join(__dirname, 'topics.json');

const [,, slug, keyword, tag, angle] = process.argv;

if (!slug || !keyword || !tag || !angle) {
  console.log('Usage: node scripts/add-topic.js "slug" "keyword" "Tag" "angle"');
  console.log('Example: node scripts/add-topic.js "love-languages-explained" "love languages explained" "Psychology" "The 5 love languages and why they matter for modern couples"');
  process.exit(1);
}

const topics = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf-8'));
topics.queue.push({ slug, keyword, tag, angle });
fs.writeFileSync(TOPICS_FILE, JSON.stringify(topics, null, 2) + '\n');

console.log(`Added "${keyword}" to queue. Queue size: ${topics.queue.length}`);
