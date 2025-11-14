import { promises as fs } from 'node:fs';
import path from 'node:path';
import { resolveDataPath } from './dataPaths.js';

export async function readJsonFile(relativePath, fallback) {
  const filePath = resolveDataPath(relativePath);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      if (fallback !== undefined) {
        await writeJsonFile(relativePath, fallback);
        return fallback;
      }
      throw error;
    }
    throw error;
  }
}

export async function writeJsonFile(relativePath, data) {
  const filePath = resolveDataPath(relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  return data;
}
