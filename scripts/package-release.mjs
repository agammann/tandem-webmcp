import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const git = (args) =>
  execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
if (resolve(git(['rev-parse', '--show-toplevel'])) !== process.cwd())
  throw new Error('Run packaging from the repository root.');
if (git(['status', '--porcelain', '--untracked-files=normal']))
  throw new Error('Source packaging requires a clean committed tree.');
const metadata = JSON.parse(readFileSync('package.json', 'utf8'));
const version = metadata.version;
if (
  !/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(version) ||
  metadata.name !== 'tandem' ||
  metadata.license !== 'MIT'
)
  throw new Error('Expected stable Tandem version and MIT metadata.');
const commit = git(['rev-parse', 'HEAD']);
if (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== commit)
  throw new Error('Checkout differs from the workflow commit.');
const directory = resolve('release-artifacts');
mkdirSync(directory, { recursive: true });
const filename = `tandem_${version}_source.zip`;
const output = resolve(directory, filename);
execFileSync(
  'git',
  [
    'archive',
    '--format=zip',
    `--prefix=tandem-${version}/`,
    `--output=${output}`,
    'HEAD',
  ],
  { windowsHide: true },
);
const checksum =
  createHash('sha256').update(readFileSync(output)).digest('hex') +
  '  ' +
  filename +
  '\n';
writeFileSync(output + '.sha256', checksum);
writeFileSync(resolve(directory, 'SHA256SUMS'), checksum);
console.log(`Packaged ${filename} from ${commit}`);
