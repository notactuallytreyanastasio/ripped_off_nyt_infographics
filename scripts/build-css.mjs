// Concatenate the stylesheets into dist/styles.css (base tokens first).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
const parts = ['src/styles/base.css', 'src/styles/story.css'].map((p) => `/* ${p} */\n${readFileSync(p, 'utf8')}`);
writeFileSync('dist/styles.css', parts.join('\n'));
console.log('wrote dist/styles.css');
