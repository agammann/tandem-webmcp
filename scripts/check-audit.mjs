import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function requireCleanAudit(raw, status) {
  if (status !== 0) throw new Error('The complete dependency audit failed.');
  const data = JSON.parse(raw);
  const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!object(data) || !object(data.advisories) || Object.keys(data.advisories).length !== 0)
    throw new Error('The audit must contain an empty advisories object.');
  const counts = data.metadata?.vulnerabilities;
  const severities = ['info', 'low', 'moderate', 'high', 'critical'];
  if (!object(counts) || Object.keys(counts).length !== severities.length ||
      severities.some((name) => counts[name] !== 0))
    throw new Error('All five explicit severity counts must equal zero.');
  return data;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync('reports', { recursive: true });
  const audit = spawnSync('pnpm', ['audit', '--json'], {
    encoding: 'utf8', shell: process.platform === 'win32', windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  writeFileSync('reports/dependency-audit.json', audit.stdout ?? '');
  writeFileSync('reports/dependency-audit.stderr.log', audit.stderr ?? '');
  if (audit.error) throw audit.error;
  requireCleanAudit(audit.stdout, audit.status);
  console.log('Complete dependency audit passed with no advisories and all five severity counts zero.');
}
