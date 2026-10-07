// Builds dist/ with no dependencies: index.html plus everything in public/.
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs'

rmSync('dist', { recursive: true, force: true })
mkdirSync('dist')
cpSync('index.html', 'dist/index.html')
cpSync('public', 'dist', { recursive: true })
for (const f of ['dist/index.html', 'dist/app/dc.js', 'dist/app/main.js', 'dist/app/glossary.js', 'dist/app/explain.js', 'dist/app/keys.js', 'dist/data/robustness.json', 'dist/data/history.json', 'dist/data/site-data.json', 'dist/pages/Home.dc.html']) {
  if (!existsSync(f)) { console.error('Missing after build: ' + f); process.exit(1) }
}
console.log('Built dist/')
