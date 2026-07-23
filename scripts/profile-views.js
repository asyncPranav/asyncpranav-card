// scripts/profile-views.js
// Reads the current count off komarev's ghpvc badge (https://komarev.com/ghpvc)
// so it can be baked into the generated card as a "Profile Views" stat.
//
// IMPORTANT — this does NOT drive the counter by itself. komarev only
// increments when its badge image is actually requested, i.e. it needs to be
// embedded as a live <img> in the profile README (the one GitHub renders on
// your profile page), not just read here. This helper just asks komarev
// "what's the count right now" every time the pipeline runs (every 6h) and
// displays that number on the card. Add this line to your profile README.md
// so the counter actually moves:
//
//   ![](https://komarev.com/ghpvc/?username=USER_NAME&style=flat&color=E8A33D)
//
// If komarev is briefly unreachable, we fall back to the last cached value
// instead of showing nothing.

const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '..', 'cache');

function cachePath(username) {
  return path.join(CACHE_DIR, `${username}.json`);
}

function readCache(username) {
  try {
    return JSON.parse(fs.readFileSync(cachePath(username), 'utf8'));
  } catch {
    return {};
  }
}

function readCachedViews(username) {
  return readCache(username)._meta?.profileViews ?? null;
}

function writeCachedViews(username, views) {
  const cache = readCache(username);
  cache._meta = {
    ...(cache._meta || {}),
    profileViews: views,
    profileViewsSyncedAt: new Date().toISOString(),
  };
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cachePath(username), JSON.stringify(cache, null, 2));
}

/** Pulls the count out of komarev's badge SVG. Handles a couple of layouts
 * defensively since it's a third-party service we don't control. */
function parseCount(svgText) {
  const titleMatch = svgText.match(/<title>[^:]*:\s*([\d,]+)/i);
  if (titleMatch) return titleMatch[1];

  const textMatches = [...svgText.matchAll(/<text[^>]*>([\d,]+)<\/text>/g)];
  if (textMatches.length) return textMatches[textMatches.length - 1][1];

  return null;
}

async function getProfileViews(username) {
  try {
    const res = await fetch(`https://komarev.com/ghpvc/?username=${encodeURIComponent(username)}`);
    if (!res.ok) throw new Error(`komarev responded ${res.status}`);
    const svgText = await res.text();
    const raw = parseCount(svgText);
    if (!raw) throw new Error('could not parse count out of badge svg');

    const views = parseInt(raw.replace(/,/g, ''), 10);
    writeCachedViews(username, views);
    return views;
  } catch (err) {
    console.warn(`profile views fetch failed (${err.message}), using cached value`);
    return readCachedViews(username);
  }
}

module.exports = { getProfileViews };
