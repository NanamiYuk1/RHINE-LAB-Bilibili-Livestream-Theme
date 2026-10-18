'use strict';
// Original read-only SMTC bridge. Widdit/now-playing-service remains a separate API provider.
const { spawn } = require('node:child_process');
const path = require('node:path');
const crypto = require('node:crypto');
function sanitizeTrack(input, previous = {}) {
  const text = key => String(input[key] || '').slice(0, 2048);
  const same = text('id') === previous.id;
  const suppliedCover = input.cover === undefined && same ? previous.cover : input.cover;
  const cover = typeof suppliedCover === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(suppliedCover) && suppliedCover.length < 6000000 ? suppliedCover : '';
  return {
    connected: input.connected === true, hasSong: input.hasSong === true && !!text('title'),
    paused: input.paused !== false, title: text('title'), artist: text('artist'), album: text('album'),
    id: text('id'), duration: Math.max(0, Math.min(864000, Number(input.duration) || 0)),
    position: Math.max(0, Math.min(864000, Number(input.position) || 0)), cover, stamp: Date.now(),
  };
}
function createWindowsMedia({ spawnProcess = spawn, app = '' } = {}) {
  let child = null, buffer = '', last = 0, retryAt = 0, closed = false;
  let track = sanitizeTrack({}), error = '';
  let cover = null;
  // SMTC sessions can drop for a beat while the player switches tracks. Keep the
  // last recognised song briefly instead of flashing "no song".
  let lastSong = null, lastSongAt = 0;
  function start() {
    if (child || closed || Date.now() < retryAt) return;
    if (process.platform !== 'win32') { error = '内置识别需要 Windows 10 1809 或更新版本。'; return; }
    child = spawnProcess('powershell.exe', ['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'windows-media.ps1'),'-OwnerPid',String(process.pid), ...(app ? ['-App', app] : [])], {windowsHide:true,stdio:['ignore','pipe','pipe']});
    const own = child;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      buffer += chunk;
      if (buffer.length > 7000000) { buffer=''; return; }
      let split;
      while ((split = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0,split).replace(/^\uFEFF/, ''); buffer=buffer.slice(split+1);
        try {
          const data = JSON.parse(line);
          const parsed = sanitizeTrack(data, track);
          last = Date.now();
          error = String(data.error || '').slice(0, 250);
          if (parsed.hasSong && parsed.title) {
            lastSong = parsed;
            lastSongAt = Date.now();
            track = parsed;
          } else if (lastSong && Date.now() - lastSongAt < 10000) {
            track = { ...lastSong, paused: parsed.paused, connected: true, stamp: Date.now() };
          } else {
            track = parsed;
          }
          if (track.cover && (!cover || cover.data !== track.cover)) {
            const match = /^data:([^;]+);base64,(.*)$/.exec(track.cover);
            cover={data:track.cover,type:match[1],bytes:Buffer.from(match[2],'base64'),key:crypto.createHash('sha256').update(track.cover).digest('hex').slice(0,24)};
          }
          if (!track.cover) cover=null;
        } catch { /* Ignore non-JSON diagnostics. */ }
      }
    });
    child.stderr.on('data', chunk => { error=String(chunk).slice(0,250); });
    child.on('error', e => { error=e.message; });
    child.on('exit', () => { if (child===own) child=null; retryAt=Date.now()+5000; });
  }
  return {
    read() { start(); return { track:{...track,connected:track.connected && Date.now()-last<6000,cover:cover?'builtin:'+cover.key:''}, error }; },
    cover() { return cover; },
    stop() { if (child) child.kill(); child=null; buffer=''; track=sanitizeTrack({}); last=0; cover=null; },
    close() { closed=true; this.stop(); },
  };
}
module.exports={createWindowsMedia,sanitizeTrack};
