const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const envFiles = ['.env.local', '.env.production', '.env'];

function loadLocalEnv() {
  const originalKeys = new Set(Object.keys(process.env));
  const loaded = [];

  for (const envFile of envFiles) {
    const envPath = path.join(root, envFile);
    if (!fs.existsSync(envPath)) continue;

    const source = fs.readFileSync(envPath, 'utf8');
    let loadedFromFile = 0;

    for (const line of source.split(/\r?\n/)) {
      const entry = parseLine(line);
      if (!entry) continue;

      const [key, value] = entry;
      if (originalKeys.has(key) || process.env[key] !== undefined) continue;

      process.env[key] = value;
      loadedFromFile += 1;
    }

    loaded.push({ file: envFile, count: loadedFromFile });
  }

  return loaded;
}

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
  const separator = normalized.indexOf('=');
  if (separator <= 0) return null;

  const key = normalized.slice(0, separator).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

  const rawValue = normalized.slice(separator + 1).trim();
  return [key, unquote(rawValue)];
}

function unquote(value) {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  return stripInlineComment(value);
}

function stripInlineComment(value) {
  const commentIndex = value.search(/\s#/);
  return (commentIndex >= 0 ? value.slice(0, commentIndex) : value).trim();
}

module.exports = {
  loadLocalEnv,
};
