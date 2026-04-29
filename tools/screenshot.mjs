// puppeteer で kaiju-rampage のスクショ取る
import puppeteer from 'puppeteer';

const url = process.argv[2] ?? 'http://localhost:5173/?screenshot=1';
const out = process.argv[3] ?? '/tmp/shot.png';
const waitMs = parseInt(process.argv[4] ?? '2000', 10);

const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--enable-unsafe-swiftshader',     // WebGL2 を SwiftShader 経由で許可
    '--use-angle=swiftshader',         // ANGLE -> SwiftShader バックエンド
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--disable-gpu-sandbox',
  ],
});
const page = await browser.newPage();
await page.setViewport({ width: 720, height: 1160, deviceScaleFactor: 1 });
console.error(`navigating to ${url}...`);
await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
console.error(`waiting ${waitMs}ms for game render...`);
await new Promise(r => setTimeout(r, waitMs));
await page.screenshot({ path: out, fullPage: false });
console.error(`saved ${out}`);
await browser.close();
