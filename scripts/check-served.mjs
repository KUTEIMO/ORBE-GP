/**
 * Comprueba QUÉ está sirviendo cada puerto y si el HTML lleva el token de caché
 * nuevo. Sirve para no confundir "el CSS está arreglado" con "el navegador lo
 * está recibiendo".
 *
 * Uso: node scripts/check-served.mjs [url...]
 */
const urls = process.argv.slice(2);
if (urls.length === 0) {
  urls.push(
    'http://127.0.0.1:8080/unisimoncucuta/experienciavirtual/',
    'http://127.0.0.1:8081/unisimoncucuta/experienciavirtual/'
  );
}

const MARKERS = [
  ['cache-bust v=r3', (html) => html.includes('v=r3')],
  ['role="tree" eliminado', (html) => !/<ul[^>]*role="tree"/.test(html)],
  ['aria-expanded fuera del <nav>', (html) => !/id="sceneMenu"[^>]*aria-expanded/.test(html)],
];

for (const url of urls) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const html = await res.text();
    console.log(`\n${url}\n  HTTP ${res.status}  ${html.length} bytes`);
    for (const [name, test] of MARKERS) {
      console.log(`  ${test(html) ? 'OK  ' : 'NO  '} ${name}`);
    }
  } catch (error) {
    console.log(`\n${url}\n  ERROR ${error.message}`);
  }
}
