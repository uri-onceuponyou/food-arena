// THROWAWAY — substitutes {URL} into a shoot.mjs batch file, because with_snapshot
// only substitutes into argv and shoot.mjs's batch lives in a file.
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const [src, base, dst] = process.argv.slice(2);
await writeFile(dst, (await readFile(src, 'utf8')).replaceAll('__BASE__', base));
const p = spawn('node', ['tools/shoot.mjs', '--batch', dst], { stdio: 'inherit' });
p.on('exit', (c) => process.exit(c ?? 1));
