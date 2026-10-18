'use strict';
// RHINE LAB first-run defaults: seed the three base layouts and a default
// published theme when the user data directory has no project library yet.
// Never overwrites existing user data; best-effort (the app works without it).
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');

const PRESETS = [
  ['archive', 'RHINE LAB · 档案库 ARCHIVE', 'terminal'],
  ['panorama', 'RHINE LAB · 全景 PANORAMA', 'immersive'],
  ['seminar', 'RHINE LAB · 研讨台 SEMINAR', 'cockpit'],
];

function readPreset(key, name, layout) {
  const file = path.join(__dirname, 'rhine-presets', key + '.json');
  const document = JSON.parse(fs.readFileSync(file, 'utf8'));
  document.name = name;
  document.settings = { ...(document.settings || {}), rhineLayout: layout };
  return document;
}

function seed(dataRoot) {
  try {
    // Only seed the desktop user-data directory, never the source tree.
    if (!dataRoot || path.resolve(dataRoot) === path.resolve(__dirname)) return;
    const themeLive = path.join(dataRoot, 'theme-live');
    const library = path.join(themeLive, 'project-library');

    let empty = true;
    try {
      empty = fs.readdirSync(library).filter((name) => name.endsWith('.json')).length === 0;
    } catch {
      empty = true;
    }

    if (empty) {
      fs.mkdirSync(library, { recursive: true });
      const now = Date.now();
      PRESETS.forEach(([key, name, layout], index) => {
        const document = readPreset(key, name, layout);
        const record = {
          format: 'control-project-record',
          id: crypto.randomUUID(),
          name,
          revision: 1,
          createdAt: now - index * 1000,
          updatedAt: now - index * 1000,
          deletedAt: null,
          creationHash: crypto
            .createHash('sha256')
            .update(JSON.stringify(document))
            .digest('hex'),
          document,
        };
        fs.writeFileSync(path.join(library, record.id + '.json'), JSON.stringify(record));
      });
    }

    const publishedFile = path.join(themeLive, 'published.json');
    if (!fs.existsSync(publishedFile)) {
      const document = readPreset('archive', 'RHINE LAB · 档案库 ARCHIVE', 'terminal');
      fs.mkdirSync(themeLive, { recursive: true });
      fs.writeFileSync(
        publishedFile,
        JSON.stringify({
          theme: {
            channel: 'theme',
            label: '直播主题',
            revision: 1,
            appliedAt: Date.now(),
            output: 'scene',
            document,
          },
        }),
      );
    }
  } catch {
    // First-run seeding is optional; a failed seed must not block startup.
  }
}

module.exports = { seed };
