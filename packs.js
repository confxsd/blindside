// Pack data — loaded from D1 via API, static JSON fallback
let packDefs = [];
let packCategories = [];
let packCollections = [];
let activePackFilter = 'all';

// Question cache — loaded on demand per pack/lang
const _questionCache = {};

async function loadPackMeta() {
  try {
    const res = await fetch('/api/packs');
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    packDefs = data.packDefs;
    packCategories = data.packCategories;
    packCollections = data.packCollections;
  } catch {
    // Fallback to static JSON if D1 is unavailable
    const res = await fetch('/data/packs.json');
    const data = await res.json();
    packDefs = data.packDefs;
    packCategories = data.packCategories;
    packCollections = data.packCollections;
  }
}

async function loadQuestions(packKey, lang) {
  const cacheKey = `${lang}:${packKey}`;
  if (_questionCache[cacheKey]) return _questionCache[cacheKey];

  try {
    const res = await fetch(`/api/questions?pack=${packKey}&lang=${lang}`);
    if (!res.ok) throw new Error(res.status);
    const questions = await res.json();
    _questionCache[cacheKey] = questions;
    return questions;
  } catch {
    // Fallback to static JSON
    let res = await fetch(`/data/${lang}/${packKey}.json`);
    if (!res.ok && lang !== 'en') {
      res = await fetch(`/data/en/${packKey}.json`);
    }
    const questions = await res.json();
    _questionCache[cacheKey] = questions;
    return questions;
  }
}

// Result definitions cache — loaded on demand per pack/lang
const _resultCache = {};

async function loadResults(packKey, lang) {
  const cacheKey = `${lang}:${packKey}`;
  if (_resultCache[cacheKey]) return _resultCache[cacheKey];

  try {
    const res = await fetch(`/api/results?pack=${packKey}&lang=${lang}`);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    _resultCache[cacheKey] = data;
    return data;
  } catch {
    // Fallback to static JSON
    let res = await fetch(`/data/${lang}/results/${packKey}.json`);
    if (!res.ok && lang !== 'en') {
      res = await fetch(`/data/en/results/${packKey}.json`);
    }
    if (!res.ok) return null;
    const data = await res.json();
    _resultCache[cacheKey] = data;
    return data;
  }
}
