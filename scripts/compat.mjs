// Converte l'app in www/ perché funzioni anche sui telefoni vecchi (2016 circa: Chrome 67+, Safari 14+).
// Si usa solo durante la pubblicazione (GitHub Actions): modifica i file sul posto, il codice sorgente resta moderno.
//   node scripts/compat.mjs [cartella]   (predefinita: www)
import {readFileSync, writeFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {transformSync} from 'esbuild';
import {transform as transformCss} from 'lightningcss';

const DIR = process.argv[2] || 'www';
// BigInt (Chrome 67, Safari 14) serve alle firme dei gruppi online e non si può convertire: è il limite minimo
const JS = {target: ['chrome67', 'safari14'], supported: {bigint: true}, charset: 'utf8', legalComments: 'inline'};
const CSS_TARGETS = {chrome: 67 << 16, safari: 14 << 16};

const js = (code, name) => transformSync(code, {...JS, loader: 'js', sourcefile: name}).code;
const css = (code, name) => transformCss({filename: name, code: Buffer.from(code), targets: CSS_TARGETS, minify: true}).code.toString();

function walk(dir) {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

let n = 0;
for (const file of walk(DIR)) {
  if (file.endsWith('.js')) {
    writeFileSync(file, js(readFileSync(file, 'utf8'), file));
    n++;
  } else if (file.endsWith('.html')) {
    let html = readFileSync(file, 'utf8');
    html = html.replace(/<script>([\s\S]*?)<\/script>/g, (_, code) => `<script>${js(code, file)}</script>`);
    html = html.replace(/<style>([\s\S]*?)<\/style>/g, (_, code) => `<style>${css(code, file)}</style>`);
    writeFileSync(file, html);
    n++;
  }
}
console.log(`compat: ${n} file convertiti per Chrome 67+ e Safari 14+`);
