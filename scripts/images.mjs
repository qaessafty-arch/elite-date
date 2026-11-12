// Converts the Higgsfield PNG masters in assets-src/ into web-sized JPEGs in public/images/.
import { readdirSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const SRC = 'assets-src';
const OUT = 'public/images';
const WIDTH = { campaign: 2400, collections: 1400, products: 1400 };

for (const group of Object.keys(WIDTH)) {
  const dir = join(SRC, group);
  if (!existsSync(dir)) continue;
  mkdirSync(join(OUT, group), { recursive: true });
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.png'))) {
    const out = join(OUT, group, file.replace(/\.png$/, '.jpg'));
    if (existsSync(out) && statSync(out).mtimeMs > statSync(join(dir, file)).mtimeMs) continue;
    await sharp(join(dir, file))
      .resize({ width: WIDTH[group], withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(out);
    console.log('wrote', out);
  }
}
