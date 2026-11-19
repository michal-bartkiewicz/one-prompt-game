import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

const distDir = path.resolve(process.cwd(), 'dist');
const assetsDir = path.join(distDir, 'assets');
const indexHtmlPath = path.join(distDir, 'index.html');
const outHtmlPath = path.resolve(process.cwd(), 'vector-interceptor.html');

if (!fs.existsSync(indexHtmlPath) || !fs.existsSync(assetsDir)) {
  console.error('Error: dist/ not found. Run "vite build" first.');
  process.exit(1);
}

const assetFiles = fs.readdirSync(assetsDir);
const cssFiles = assetFiles.filter((f) => f.endsWith('.css')).sort();
const jsFiles = assetFiles.filter((f) => f.endsWith('.js')).sort();

if (jsFiles.length === 0) {
  console.error('Error: no JS bundle found in dist/assets.');
  process.exit(1);
}

const cssContent = cssFiles
  .map((f) => fs.readFileSync(path.join(assetsDir, f), 'utf8'))
  .join('\n');

// Convert Vite's ES module bundle into a classic IIFE so browsers allow running via file://
const entryJs = path.join(assetsDir, jsFiles[0]);
const result = await esbuild.build({
  entryPoints: [entryJs],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
});

const jsContent = result.outputFiles[0].text
  // Escape closing script tags inside string literals if any exist
  .replace(/<\/script/gi, '<\\/script');

let html = fs.readFileSync(indexHtmlPath, 'utf8');

// Remove Vite's external module script, stylesheet links, and Google Font links for 100% offline use
html = html.replace(/<script\s+type="module"[^>]*><\/script>\s*/gi, '');
html = html.replace(/<link\s+rel="stylesheet"[^>]*>\s*/gi, '');
html = html.replace(/<link\s+[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\s*/gi, '');

// Inject inline CSS into <head> and inline IIFE <script> at the end of <body>
// (Use function replacers so '$&' / "$'" sequences in minified JS are never interpreted)
html = html.replace('</head>', () => `  <style>\n${cssContent}\n  </style>\n  </head>`);
html = html.replace('</body>', () => `  <script>\n${jsContent}\n  </script>\n  </body>`);

fs.writeFileSync(outHtmlPath, html, 'utf8');

const sizeKb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log(`Built standalone single-file game: vector-interceptor.html (${sizeKb} KB)`);
