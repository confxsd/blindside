// Pack data — loaded from static JSON files in /data/
let packDefs = [];
let packCategories = [];
let packCollections = [];
let activePackFilter = 'all';

// Question cache — loaded on demand per pack/lang
const _questionCache = {};

async function loadPackMeta() {
  const res = await fetch('/data/packs.json');
  const data = await res.json();
  packDefs = data.packDefs;
  packCategories = data.packCategories;
  packCollections = data.packCollections;
}

async function loadQuestions(packKey, lang) {
  const cacheKey = `${lang}:${packKey}`;
  if (_questionCache[cacheKey]) return _questionCache[cacheKey];

  // Try requested language, fall back to English
  let res = await fetch(`/data/${lang}/${packKey}.json`);
  if (!res.ok && lang !== 'en') {
    res = await fetch(`/data/en/${packKey}.json`);
  }
  const questions = await res.json();
  _questionCache[cacheKey] = questions;
  return questions;
}
