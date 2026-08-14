import fs from 'fs';
import path from 'path';
import https from 'https';

const FONT_URL = 'https://st-takla.org/Dlds/fonts/webfont/FreeSerifAvvaShenouda.ttf';
const EXPECTED_SIZE = 987796;

const targets = [
  path.join(process.cwd(), 'public', 'fonts', 'FreeSerifAvvaShenouda.ttf'),
  path.join(process.cwd(), 'src', 'assets', 'fonts', 'FreeSerifAvvaShenouda.ttf'),
];

async function downloadFont(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFont(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download font: HTTP ${res.statusCode}`));
      }
      const dir = path.dirname(dest);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          console.log(`[ensure-font] Downloaded font to ${dest} (${fs.statSync(dest).size} bytes)`);
          resolve();
        });
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  for (const target of targets) {
    const dir = path.dirname(target);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let isValid = false;
    if (fs.existsSync(target)) {
      const stats = fs.statSync(target);
      if (stats.size === EXPECTED_SIZE) {
        isValid = true;
      } else {
        console.warn(`[ensure-font] Font file at ${target} has incorrect size (${stats.size} vs expected ${EXPECTED_SIZE}), refreshing...`);
      }
    }

    if (!isValid) {
      try {
        await downloadFont(FONT_URL, target);
      } catch (err) {
        console.error(`[ensure-font] Failed to download font for ${target}:`, err.message);
      }
    } else {
      console.log(`[ensure-font] Valid binary font present at ${target} (${EXPECTED_SIZE} bytes).`);
    }
  }
}

main().catch((err) => {
  console.error('[ensure-font] Error:', err);
  process.exit(0); // Do not fail the build if network download fails, fallback to local files
});
