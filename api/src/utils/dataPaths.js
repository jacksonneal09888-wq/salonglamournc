import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(moduleDir, '../..');
export const dataDir = path.join(repoRoot, 'data');

export function resolveDataPath(relativePath) {
  return path.join(dataDir, relativePath);
}
