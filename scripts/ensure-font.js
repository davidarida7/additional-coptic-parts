import fs from 'fs';
import path from 'path';
import https from 'https';
import zlib from 'zlib';

function ttfToWoff(ttfBuf) {
  const numTables = ttfBuf.readUInt16BE(4);
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const recOffset = 12 + i * 16;
    const tag = ttfBuf.slice(recOffset, recOffset + 4).toString('ascii');
    const checksum = ttfBuf.readUInt32BE(recOffset + 4);
    const offset = ttfBuf.readUInt32BE(recOffset + 8);
    const length = ttfBuf.readUInt32BE(recOffset + 12);
    const tableData = ttfBuf.slice(offset, offset + length);
    const compData = zlib.deflateSync(tableData);
    const useComp = compData.length < tableData.length;
    tables.push({
      tag,
      checksum,
      origLength: length,
      compLength: useComp ? compData.length : length,
      data: useComp ? compData : tableData
    });
  }

  const headerSize = 44;
  const dirSize = numTables * 20;
  let currentOffset = headerSize + dirSize;

  const dirBuffers = [];
  const dataBuffers = [];

  for (const t of tables) {
    const dirBuf = Buffer.alloc(20);
    dirBuf.write(t.tag, 0, 4, 'ascii');
    dirBuf.writeUInt32BE(currentOffset, 4);
    dirBuf.writeUInt32BE(t.compLength, 8);
    dirBuf.writeUInt32BE(t.origLength, 12);
    dirBuf.writeUInt32BE(t.checksum, 16);
    dirBuffers.push(dirBuf);

    dataBuffers.push(t.data);
    const pad = (4 - (t.compLength % 4)) % 4;
    if (pad > 0) {
      dataBuffers.push(Buffer.alloc(pad, 0));
      currentOffset += t.compLength + pad;
    } else {
      currentOffset += t.compLength;
    }
  }

  const totalWoffSize = currentOffset;
  const headerBuf = Buffer.alloc(44);
  headerBuf.write('wOFF', 0, 4, 'ascii');
  headerBuf.writeUInt32BE(0x00010000, 4);
  headerBuf.writeUInt32BE(totalWoffSize, 8);
  headerBuf.writeUInt16BE(numTables, 12);
  headerBuf.writeUInt16BE(0, 14);
  headerBuf.writeUInt32BE(ttfBuf.length, 16);
  headerBuf.writeUInt16BE(1, 20);
  headerBuf.writeUInt16BE(0, 22);
  headerBuf.writeUInt32BE(0, 24);
  headerBuf.writeUInt32BE(0, 28);
  headerBuf.writeUInt32BE(0, 32);
  headerBuf.writeUInt32BE(0, 36);
  headerBuf.writeUInt32BE(0, 40);

  return Buffer.concat([headerBuf, ...dirBuffers, ...dataBuffers]);
}

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

function stripFontRestrictions(filePath) {
  try {
    const buf = Buffer.from(fs.readFileSync(filePath));
    const numTables = buf.readUInt16BE(4);
    let os2Offset = 0;
    let os2Length = 0;
    let os2TableRecordOffset = 0;
    let headOffset = 0;

    for (let i = 0; i < numTables; i++) {
      const tag = buf.slice(12 + i * 16, 16 + i * 16).toString('ascii');
      if (tag === 'OS/2') {
        os2TableRecordOffset = 12 + i * 16;
        os2Offset = buf.readUInt32BE(os2TableRecordOffset + 8);
        os2Length = buf.readUInt32BE(os2TableRecordOffset + 12);
      } else if (tag === 'head') {
        headOffset = buf.readUInt32BE(12 + i * 16 + 8);
      }
    }

    if (os2Offset > 0) {
      const fsType = buf.readUInt16BE(os2Offset + 8);
      if (fsType !== 0) {
        buf.writeUInt16BE(0, os2Offset + 8); // Remove embedding restriction

        // Recalculate OS/2 table checksum
        let sum = 0;
        const alignedLength = (os2Length + 3) & ~3;
        for (let i = 0; i < alignedLength; i += 4) {
          if (os2Offset + i + 4 <= buf.length) {
            sum = (sum + buf.readUInt32BE(os2Offset + i)) >>> 0;
          }
        }
        buf.writeUInt32BE(sum, os2TableRecordOffset + 4);

        // Recalculate checkSumAdjustment in 'head'
        if (headOffset > 0) {
          buf.writeUInt32BE(0, headOffset + 8);
          let fontSum = 0;
          const alignedFontLength = (buf.length + 3) & ~3;
          for (let i = 0; i < alignedFontLength; i += 4) {
            if (i + 4 <= buf.length) {
              fontSum = (fontSum + buf.readUInt32BE(i)) >>> 0;
            }
          }
          const checkSumAdjustment = (0xB1B0AFBA - fontSum) >>> 0;
          buf.writeUInt32BE(checkSumAdjustment, headOffset + 8);
        }
        fs.writeFileSync(filePath, buf);
        console.log(`[ensure-font] Removed DRM/fsType restriction from ${filePath}`);
      }
    }
  } catch (err) {
    console.error(`[ensure-font] Could not strip restrictions from ${filePath}:`, err.message);
  }
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
        if (stats.size === font.size) {
          try {
            const fd = fs.openSync(target, 'r');
            const buffer = Buffer.alloc(4);
            fs.readSync(fd, buffer, 0, 4, 0);
            fs.closeSync(fd);
            const magic = buffer.toString('hex');
            if (magic === '00010000' || magic === '4f54544f') {
              isValid = true;
            }
          } catch (e) {
            isValid = false;
          }
        }
        if (!isValid) {
          console.warn(`[ensure-font] Font file at ${target} has incorrect size/header (${stats.size} vs expected ${font.size}), replacing with fresh binary...`);
          try { fs.unlinkSync(target); } catch (e) {}
        }
      }

      if (!isValid) {
        try {
          await downloadFont(font.url, target);
          stripFontRestrictions(target);
        } catch (err) {
          console.error(`[ensure-font] Failed to download font for ${target}:`, err.message);
        }
      } else {
        stripFontRestrictions(target);
        console.log(`[ensure-font] Valid binary font present at ${target} (${font.name}).`);
      }

      // Generate WOFF version
      try {
        const woffTarget = target.replace(/\.ttf$/i, '.woff');
        if (fs.existsSync(target)) {
          const ttfData = fs.readFileSync(target);
          const woffData = ttfToWoff(ttfData);
          fs.writeFileSync(woffTarget, woffData);
          console.log(`[ensure-font] Generated WOFF at ${woffTarget} (${woffData.length} bytes)`);
        }
      } catch (err) {
        console.error(`[ensure-font] Could not generate WOFF for ${target}:`, err.message);
      }
    }
  }
}

main().catch((err) => {
  console.error('[ensure-font] Error:', err);
  process.exit(0); // Do not fail the build if network download fails, fallback to local files
});

