'use strict';
// RHINE LAB live channel: one shared scene state and message log for the studio,
// the theme editor canvas and every OBS browser source on this machine.
const MAX_BODY = 2 * 1024 * 1024;
const HISTORY_LIMIT = 90;
const TEXT_LIMIT = 400;

function clean(value, max = TEXT_LIMIT) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function number(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeMessage(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = ['normal', 'sc', 'gift', 'fleet', 'system'].includes(raw.kind) ? raw.kind : 'normal';
  const message = {
    id: clean(raw.id, 100) || 'm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
    kind,
    user: clean(raw.user, 60) || '匿名观众',
    text: clean(raw.text, 300),
    badge: clean(raw.badge, 16),
    ts: Math.round(number(raw.ts, Date.now(), 0, 9999999999999)),
  };
  if (kind === 'sc') {
    message.amount = Math.round(number(raw.amount, 0, 0, 999999));
    message.duration = Math.round(number(raw.duration, 180, 8, 7200));
  } else if (kind === 'gift') {
    message.name = clean(raw.name, 60) || '补给';
    message.count = Math.round(number(raw.count, 1, 1, 999999));
    message.value = Math.round(number(raw.value, 0, 0, 99999999));
  } else if (kind === 'fleet') {
    const rank = ['captain', 'admiral', 'governor'].includes(raw.rank) ? raw.rank : 'captain';
    message.rank = rank;
    message.rankLabel = clean(raw.rankLabel, 8) || { captain: '舰长', admiral: '提督', governor: '总督' }[rank];
    message.rankEn = clean(raw.rankEn, 16) || rank.toUpperCase();
    message.price = Math.round(number(raw.price, 0, 0, 9999999));
  } else if (kind === 'system') {
    message.text = clean(raw.text, 160) || '通讯链路已更新';
  }
  return message;
}

function createRhineLive({ now = Date.now } = {}) {
  const clients = new Set();
  let state = null;
  let history = [];
  let revision = 0;

  function snapshot() {
    return { state, messages: history, revision, serverNow: now() };
  }

  function send(res, type, data) {
    try {
      res.write('event: ' + type + '\ndata: ' + JSON.stringify(data) + '\n\n');
    } catch {
      clients.delete(res);
    }
  }

  function broadcast(type, data) {
    for (const client of clients) {
      if (client.writableEnded || client.destroyed) {
        clients.delete(client);
        continue;
      }
      send(client, type, data);
    }
  }

  function push(raw) {
    const message = normalizeMessage(raw);
    if (!message) return null;
    history.push(message);
    if (history.length > HISTORY_LIMIT) history = history.slice(-HISTORY_LIMIT);
    broadcast('message', message);
    return message;
  }

  function readBody(req, limit = MAX_BODY) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > limit) {
          reject(Error('too large'));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        if (!chunks.length) return resolve(null);
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (error) {
          reject(error);
        }
      });
      req.on('error', reject);
    });
  }

  function handle(req, res) {
    const url = new URL(req.url, 'http://' + req.headers.host);
    const origin = req.headers.origin;
    const port = req.socket.localPort;
    if (origin && !['http://127.0.0.1:' + port, 'http://localhost:' + port, 'http://[::1]:' + port].includes(origin)) {
      res.writeHead(403).end();
      return;
    }
    const json = (status, data) => {
      const body = JSON.stringify(data);
      res
        .writeHead(status, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(body),
          'Cache-Control': 'no-store',
        })
        .end(body);
    };

    if (url.pathname === '/api/rhine/health' && req.method === 'GET') {
      json(200, { ok: true, clients: clients.size, messages: history.length });
      return;
    }
    if (url.pathname === '/api/rhine/state' && req.method === 'GET') {
      json(200, snapshot());
      return;
    }
    if (url.pathname === '/api/rhine/events' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write(': RHINE LAB LIVE CHANNEL READY\n\n');
      send(res, 'ready', snapshot());
      clients.add(res);
      const heartbeat = setInterval(() => {
        try {
          res.write(': ping\n\n');
        } catch {
          clients.delete(res);
        }
      }, 15000);
      res.on('close', () => {
        clearInterval(heartbeat);
        clients.delete(res);
      });
      return;
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { Allow: 'GET, POST' }).end();
      return;
    }
    if (!origin || !String(req.headers['content-type']).startsWith('application/json')) {
      res.writeHead(403).end();
      return;
    }
    readBody(req)
      .then((body) => {
        if (res.writableEnded) return;
        if (url.pathname === '/api/rhine/state') {
          if (!body || typeof body.state !== 'object' || body.state === null) {
            json(400, { ok: false, error: 'missing state' });
            return;
          }
          state = body.state;
          revision += 1;
          broadcast('state', state);
          json(200, { ok: true });
          return;
        }
        if (url.pathname === '/api/rhine/message') {
          const message = push(body && body.message);
          json(message ? 200 : 400, { ok: !!message });
          return;
        }
        if (url.pathname === '/api/rhine/messages') {
          const list = body && Array.isArray(body.messages) ? body.messages.slice(0, 120) : [];
          list.forEach(push);
          json(200, { ok: true, count: list.length });
          return;
        }
        if (url.pathname === '/api/rhine/clear') {
          history = [];
          broadcast('clear', {});
          json(200, { ok: true });
          return;
        }
        if (url.pathname === '/api/rhine/boot') {
          broadcast('boot', {});
          json(200, { ok: true });
          return;
        }
        json(404, { ok: false, error: 'unknown api' });
      })
      .catch(() => {
        if (!res.headersSent) json(400, { ok: false, error: 'invalid body' });
        else res.end();
      });
  }

  return {
    handle,
    snapshot,
    get state() {
      return state;
    },
    close() {
      for (const client of clients) client.end();
      clients.clear();
      history = [];
    },
  };
}

module.exports = { createRhineLive, normalizeMessage };
