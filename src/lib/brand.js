import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = dirname(dirname(dirname(__filename)));

let _brand = null;
let _theme = null;
let _features = null;

export function getFeatures() {
  if (_features) return _features;
  const p = join(ROOT, 'config', 'features.json');
  _features = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
  return _features;
}

export function getBrand() {
  if (_brand) return _brand;
  const p = join(ROOT, 'config', 'brand.json');
  _brand = existsSync(p)
    ? JSON.parse(readFileSync(p, 'utf8'))
    : { name: 'Forge', shortName: 'Forge', email: 'hello@example.com', url: 'https://example.com' };
  return _brand;
}

export function getTheme() {
  if (_theme) return _theme;
  const p = join(ROOT, 'config', 'theme.json');
  _theme = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { colors: {}, fonts: {} };
  return _theme;
}
