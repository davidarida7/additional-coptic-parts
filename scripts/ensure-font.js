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

function rebuildFontNameTable(fontBuf, familyName, subfamilyName, postscriptName) {
  const numTables = fontBuf.readUInt16BE(4);
  const tables = [];
  let nameTableIndex = -1;

  for (let i = 0; i < numTables; i++) {
    const recOffset = 12 + i * 16;
    const tag = fontBuf.slice(recOffset, recOffset + 4).toString('ascii');
    const checksum = fontBuf.readUInt32BE(recOffset + 4);
    const offset = fontBuf.readUInt32BE(recOffset + 8);
    const length = fontBuf.readUInt32BE(recOffset + 12);
    const data = fontBuf.slice(offset, offset + length);
    const dataCopy = Buffer.from(data);
    tables.push({ tag, checksum, offset, length, data: dataCopy });
    if (tag === 'name') nameTableIndex = i;
    if (tag === 'OS/2') {
      dataCopy.writeUInt16BE(0, 8); // remove fsType restrictions
    }
  }

  const fullName = subfamilyName === 'Regular' ? familyName : familyName + ' ' + subfamilyName;
  const uniqueID = familyName + ':' + subfamilyName;

  const records = [
    { pID: 1, eID: 0, lID: 0, nID: 1, str: familyName, isUtf16: false },
    { pID: 1, eID: 0, lID: 0, nID: 2, str: subfamilyName, isUtf16: false },
    { pID: 1, eID: 0, lID: 0, nID: 3, str: uniqueID, isUtf16: false },
    { pID: 1, eID: 0, lID: 0, nID: 4, str: fullName, isUtf16: false },
    { pID: 1, eID: 0, lID: 0, nID: 6, str: postscriptName, isUtf16: false },
    { pID: 3, eID: 1, lID: 1033, nID: 1, str: familyName, isUtf16: true },
    { pID: 3, eID: 1, lID: 1033, nID: 2, str: subfamilyName, isUtf16: true },
    { pID: 3, eID: 1, lID: 1033, nID: 3, str: uniqueID, isUtf16: true },
    { pID: 3, eID: 1, lID: 1033, nID: 4, str: fullName, isUtf16: true },
    { pID: 3, eID: 1, lID: 1033, nID: 6, str: postscriptName, isUtf16: true },
    { pID: 0, eID: 3, lID: 0, nID: 1, str: familyName, isUtf16: true },
    { pID: 0, eID: 3, lID: 0, nID: 2, str: subfamilyName, isUtf16: true },
    { pID: 0, eID: 3, lID: 0, nID: 3, str: uniqueID, isUtf16: true },
    { pID: 0, eID: 3, lID: 0, nID: 4, str: fullName, isUtf16: true },
    { pID: 0, eID: 3, lID: 0, nID: 6, str: postscriptName, isUtf16: true },
  ];

  let stringPool = Buffer.alloc(0);
  const encodedRecords = [];

  for (const r of records) {
    let strBuf;
    if (r.isUtf16) {
      strBuf = Buffer.alloc(r.str.length * 2);
      for (let i = 0; i < r.str.length; i++) {
        strBuf.writeUInt16BE(r.str.charCodeAt(i), i * 2);
      }
    } else {
      strBuf = Buffer.from(r.str, 'ascii');
    }
    const offset = stringPool.length;
    stringPool = Buffer.concat([stringPool, strBuf]);
    encodedRecords.push({
      pID: r.pID,
      eID: r.eID,
      lID: r.lID,
      nID: r.nID,
      length: strBuf.length,
      offset: offset,
    });
  }

  const nameHeaderSize = 6 + encodedRecords.length * 12;
  const nameTableBuf = Buffer.alloc(nameHeaderSize + stringPool.length);
  nameTableBuf.writeUInt16BE(0, 0);
  nameTableBuf.writeUInt16BE(encodedRecords.length, 2);
  nameTableBuf.writeUInt16BE(nameHeaderSize, 4);

  for (let i = 0; i < encodedRecords.length; i++) {
    const rec = encodedRecords[i];
    const off = 6 + i * 12;
    nameTableBuf.writeUInt16BE(rec.pID, off);
    nameTableBuf.writeUInt16BE(rec.eID, off + 2);
    nameTableBuf.writeUInt16BE(rec.lID, off + 4);
    nameTableBuf.writeUInt16BE(rec.nID, off + 6);
    nameTableBuf.writeUInt16BE(rec.length, off + 8);
    nameTableBuf.writeUInt16BE(rec.offset, off + 10);
  }
  stringPool.copy(nameTableBuf, nameHeaderSize);

  tables[nameTableIndex].data = nameTableBuf;

  // Sort tables alphabetically
  tables.sort((a, b) => a.tag.localeCompare(b.tag));

  let currentOffset = 12 + tables.length * 16;
  for (const t of tables) {
    t.offset = currentOffset;
    t.length = t.data.length;
    let sum = 0;
    const alignedLen = (t.length + 3) & ~3;
    const paddedBuf = Buffer.alloc(alignedLen, 0);
    t.data.copy(paddedBuf);
    for (let i = 0; i < alignedLen; i += 4) {
      sum = (sum + paddedBuf.readUInt32BE(i)) >>> 0;
    }
    t.checksum = sum;
    currentOffset += alignedLen;
  }

  const outBuf = Buffer.alloc(currentOffset, 0);
  fontBuf.copy(outBuf, 0, 0, 12);
  outBuf.writeUInt16BE(tables.length, 4);

  for (let i = 0; i < tables.length; i++) {
    const t = tables[i];
    const recOff = 12 + i * 16;
    outBuf.write(t.tag, recOff, 4, 'ascii');
    outBuf.writeUInt32BE(t.checksum, recOff + 4);
    outBuf.writeUInt32BE(t.offset, recOff + 8);
    outBuf.writeUInt32BE(t.length, recOff + 12);
    t.data.copy(outBuf, t.offset);
  }

  const headTable = tables.find(t => t.tag === 'head');
  if (headTable) {
    outBuf.writeUInt32BE(0, headTable.offset + 8);
    let fontSum = 0;
    for (let i = 0; i < outBuf.length; i += 4) {
      fontSum = (fontSum + outBuf.readUInt32BE(i)) >>> 0;
    }
    const checkSumAdj = (0xB1B0AFBA - fontSum) >>> 0;
    outBuf.writeUInt32BE(checkSumAdj, headTable.offset + 8);
  }

  return outBuf;
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

        let sum = 0;
        const alignedLength = (os2Length + 3) & ~3;
        for (let i = 0; i < alignedLength; i += 4) {
          if (os2Offset + i + 4 <= buf.length) {
            sum = (sum + buf.readUInt32BE(os2Offset + i)) >>> 0;
          }
        }
        buf.writeUInt32BE(sum, os2TableRecordOffset + 4);

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
        if (stats.size > 100000) {
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

  // Create uncollided ArabicTimes.ttf and ArabicTimesBold.ttf
  const dirs = [
    path.join(process.cwd(), 'public', 'fonts'),
    path.join(process.cwd(), 'src', 'assets', 'fonts'),
  ];

  for (const d of dirs) {
    const regularSrc = path.join(d, 'TimesNewRoman.ttf');
    const boldSrc = path.join(d, 'TimesNewRomanBold.ttf');
    
    if (fs.existsSync(regularSrc)) {
      const regBuf = fs.readFileSync(regularSrc);
      const rebuiltReg = rebuildFontNameTable(regBuf, 'ArabicTimes', 'Regular', 'ArabicTimes-Regular');
      const regDest = path.join(d, 'ArabicTimes.ttf');
      fs.writeFileSync(regDest, rebuiltReg);
      const regWoffDest = path.join(d, 'ArabicTimes.woff');
      fs.writeFileSync(regWoffDest, ttfToWoff(rebuiltReg));
      console.log(`[ensure-font] Generated uncollided ArabicTimes font at ${regDest} and ${regWoffDest}`);
    }

    if (fs.existsSync(boldSrc)) {
      const boldBuf = fs.readFileSync(boldSrc);
      const rebuiltBold = rebuildFontNameTable(boldBuf, 'ArabicTimes', 'Bold', 'ArabicTimes-Bold');
      const boldDest = path.join(d, 'ArabicTimesBold.ttf');
      fs.writeFileSync(boldDest, rebuiltBold);
      const boldWoffDest = path.join(d, 'ArabicTimesBold.woff');
      fs.writeFileSync(boldWoffDest, ttfToWoff(rebuiltBold));
      console.log(`[ensure-font] Generated uncollided ArabicTimesBold font at ${boldDest} and ${boldWoffDest}`);
    }
  }

  // Generate embedded base64 CSS file
  try {
    const arabicRegBuf = fs.readFileSync(path.join(process.cwd(), 'public', 'fonts', 'ArabicTimes.ttf'));
    const arabicBoldBuf = fs.readFileSync(path.join(process.cwd(), 'public', 'fonts', 'ArabicTimesBold.ttf'));
    const copticBuf = fs.readFileSync(path.join(process.cwd(), 'public', 'fonts', 'FreeSerifAvvaShenouda.ttf'));

    const b64ArabicReg = arabicRegBuf.toString('base64');
    const b64ArabicBold = arabicBoldBuf.toString('base64');
    const b64Coptic = copticBuf.toString('base64');

    const embeddedCss = `
/* Embedded uncollided fonts for 100% mobile compatibility */
@font-face {
  font-family: 'ArabicTimes';
  src: url('data:font/truetype;charset=utf-8;base64,${b64ArabicReg}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'ArabicTimes';
  src: url('data:font/truetype;charset=utf-8;base64,${b64ArabicBold}') format('truetype');
  font-weight: bold;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'TimesArabic';
  src: url('data:font/truetype;charset=utf-8;base64,${b64ArabicReg}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'TimesArabic';
  src: url('data:font/truetype;charset=utf-8;base64,${b64ArabicBold}') format('truetype');
  font-weight: bold;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'FreeSerifAvvaShenouda';
  src: url('data:font/truetype;charset=utf-8;base64,${b64Coptic}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
`;
    fs.writeFileSync(path.join(process.cwd(), 'src', 'embedded-fonts.css'), embeddedCss);
    console.log('[ensure-font] Generated embedded-fonts.css');
  } catch (err) {
    console.error('[ensure-font] Could not generate embedded-fonts.css:', err.message);
  }
}

main().catch((err) => {
  console.error('[ensure-font] Error:', err);
  process.exit(0);
});

