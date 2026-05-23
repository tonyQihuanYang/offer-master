import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

export const CONFIGS_PATH = join(DATA_DIR, 'configs.json');
export const SAMPLE_OFFERS_PATH = join(DATA_DIR, 'sample-offers.json');

export async function readJson(path) {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

export async function writeJson(path, data) {
  await writeFile(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
}
