import fs from 'fs';
import path from 'path';
import https from 'https';

const FONTS_CONFIG = [
  {
    name: 'FreeSerifAvvaShenouda.ttf',
    url: 'https://st-takla.org/Dlds/fonts/webfont/FreeSerifAvvaShenouda.ttf',
    size: 987796,
  },
  {
    name: 'TimesNewRoman.ttf',
    url: 'https://raw.githubusercontent.com/justrajdeep/fonts/master/Times%20New%20Roman.ttf',
    size: 834452,
  },
  {
    name: 'TimesNewRomanBold.ttf',
    url: 'https://raw.githubusercontent.com/justrajdeep/fonts/master/Times%20New%20Roman%20Bold.ttf',
    size: 842168,
  },
];

async function downloadFont(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (u) => {
      https.get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return follow(res.headers.location);
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
      }).on('error', reject);
    };
    follow(url);
  });
}

async function main() {
  for (const font of FONTS_CONFIG) {
    const targets = [
      path.join(process.cwd(), 'public', 'fonts', font.name),
      path.join(process.cwd(), 'src', 'assets', 'fonts', font.name),
    ];

    for (const target of targets) {
      const dir = path.dirname(target);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      let isValid = false;
      if (fs.existsSync(target)) {
        const stats = fs.statSync(target);
        if (stats.size === font.size || stats.size > 500000) {
          isValid = true;
        } else {
          console.warn(`[ensure-font] Font file at ${target} has incorrect size (${stats.size} vs expected ${font.size}), refreshing...`);
        }
      }

      if (!isValid) {
        try {
          await downloadFont(font.url, target);
        } catch (err) {
          console.error(`[ensure-font] Failed to download font for ${target}:`, err.message);
        }
      } else {
        console.log(`[ensure-font] Valid binary font present at ${target} (${font.name}).`);
      }
    }
  }
}

main().catch((err) => {
  console.error('[ensure-font] Error:', err);
  process.exit(0); // Do not fail the build if network download fails, fallback to local files
});

