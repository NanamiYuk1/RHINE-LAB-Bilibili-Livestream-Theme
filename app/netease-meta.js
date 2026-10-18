'use strict';
// NetEase Cloud Music only publishes title/artist through SMTC (timeline and
// artwork are empty), so enrich the track with the public song API.
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map();

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

async function json(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://music.163.com/' },
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw Error('HTTP ' + response.status);
  return response.json();
}

async function lookup(title, artist) {
  const key = normalize(title) + '|' + normalize(artist);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = { duration: 0, cover: '' };
  try {
    const query = encodeURIComponent((title + ' ' + artist).trim());
    const search = await json(
      'https://music.163.com/api/search/get/web?s=' +
        query +
        '&type=1&offset=0&total=true&limit=5',
    );
    const songs = (search && search.result && search.result.songs) || [];
    const wantedTitle = normalize(title);
    const wantedArtist = normalize(artist);
    const match =
      songs.find(
        (song) =>
          normalize(song.name) === wantedTitle &&
          (song.artists || []).some((item) => {
            const name = normalize(item.name);
            return name && (name.includes(wantedArtist) || wantedArtist.includes(name));
          }),
      ) || songs[0];
    if (match) {
      value.duration = Math.max(0, Number(match.duration) / 1000 || 0);
      const detail = await json(
        'https://music.163.com/api/song/detail/?id=' +
          encodeURIComponent(match.id) +
          '&ids=%5B' +
          encodeURIComponent(match.id) +
          '%5D',
      );
      const song = detail && detail.songs && detail.songs[0];
      if (song) {
        if (song.duration) value.duration = Math.max(0, Number(song.duration) / 1000 || value.duration);
        const album = song.album || song.al;
        if (album && album.picUrl) value.cover = String(album.picUrl);
      }
    }
  } catch {
    /* offline or API blocked: keep the SMTC-only data */
  }
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return value;
}

module.exports = { lookup, normalize };
