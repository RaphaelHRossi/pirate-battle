#!/usr/bin/env node
/**
 * Converts Starling/Sparrow XML texture atlases into the TexturePacker
 * "JSON hash" format that Pixi's Assets/Spritesheet loads natively.
 *
 * Usage: node scripts/convert-starling-atlas.mjs [atlas.xml ...]
 * Without arguments it converts public/assets/spritesheet/ships_miscellaneous_sheet*.xml.
 * Each output is written next to its input as <name>.json.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_DIR = 'public/assets/spritesheet'
const DEFAULT_PATTERN = /^ships_miscellaneous_sheet.*\.xml$/

/** Parses `key="value"` pairs from a single XML tag. */
function parseAttributes(tag) {
  const attributes = {}
  for (const [, key, value] of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    attributes[key] = value
  }
  return attributes
}

function toInt(attributes, key, fallback) {
  const raw = attributes[key]
  if (raw === undefined) {
    if (fallback !== undefined) return fallback
    throw new Error(
      `Missing attribute "${key}" on ${attributes.name ?? 'SubTexture'}`,
    )
  }
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new Error(`Invalid ${key}="${raw}"`)
  return Math.round(value)
}

/** Reads width/height from the IHDR chunk of a PNG file. */
async function readPngSize(file) {
  const buffer = await readFile(file)
  const signature = '89504e470d0a1a0a'
  if (buffer.subarray(0, 8).toString('hex') !== signature) {
    throw new Error(`${file} is not a PNG`)
  }
  return { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) }
}

async function convert(xmlPath) {
  const xml = await readFile(xmlPath, 'utf8')
  const atlasTag = /<TextureAtlas\b[^>]*>/.exec(xml)
  if (!atlasTag) throw new Error(`${xmlPath}: no <TextureAtlas> element`)
  const { imagePath } = parseAttributes(atlasTag[0])
  if (!imagePath) throw new Error(`${xmlPath}: TextureAtlas has no imagePath`)

  const size = await readPngSize(path.join(path.dirname(xmlPath), imagePath))
  const frames = {}

  for (const [tag] of xml.matchAll(/<SubTexture\b[^>]*\/?>/g)) {
    const a = parseAttributes(tag)
    if (!a.name) throw new Error(`${xmlPath}: SubTexture without name`)
    // Match ui_sheet.json, whose frame keys have no extension.
    const name = a.name.replace(/\.png$/i, '')
    if (name in frames) throw new Error(`${xmlPath}: duplicate frame "${name}"`)

    const x = toInt(a, 'x')
    const y = toInt(a, 'y')
    const w = toInt(a, 'width')
    const h = toInt(a, 'height')
    const rotated = a.rotated === 'true'
    // Rotated regions are stored 90° clockwise, so they occupy h×w in the image.
    const [regionW, regionH] = rotated ? [h, w] : [w, h]
    if (x < 0 || y < 0 || x + regionW > size.w || y + regionH > size.h) {
      throw new Error(`${xmlPath}: frame "${name}" lies outside ${imagePath}`)
    }

    // Starling trim: frameX/frameY are the (negative) offset of the trimmed
    // region inside the original sprite of size frameWidth×frameHeight.
    const sourceW = toInt(a, 'frameWidth', w)
    const sourceH = toInt(a, 'frameHeight', h)
    const offsetX = -toInt(a, 'frameX', 0)
    const offsetY = -toInt(a, 'frameY', 0)

    frames[name] = {
      frame: { x, y, w, h },
      rotated,
      trimmed: sourceW !== w || sourceH !== h || offsetX !== 0 || offsetY !== 0,
      spriteSourceSize: { x: offsetX, y: offsetY, w, h },
      sourceSize: { w: sourceW, h: sourceH },
    }
  }

  const frameCount = Object.keys(frames).length
  if (frameCount === 0) throw new Error(`${xmlPath}: no SubTexture elements`)

  const atlas = {
    frames,
    meta: {
      app: 'scripts/convert-starling-atlas.mjs',
      image: imagePath,
      format: 'RGBA8888',
      size,
      // Starling XML carries no scale. Note that the "_retina" ships sheet is
      // NOT 2x (same 1024x512 image), so scale must stay 1 for both files;
      // "2" would make Pixi render every sprite at half size.
      scale: '1',
    },
  }

  const outPath = xmlPath.replace(/\.xml$/i, '.json')
  await writeFile(outPath, `${JSON.stringify(atlas, null, 2)}\n`)
  console.log(
    `${outPath}: ${String(frameCount)} frames (${String(size.w)}x${String(size.h)})`,
  )
}

async function main() {
  let inputs = process.argv.slice(2)
  if (inputs.length === 0) {
    const files = await readdir(DEFAULT_DIR)
    inputs = files
      .filter((f) => DEFAULT_PATTERN.test(f))
      .map((f) => path.join(DEFAULT_DIR, f))
  }
  if (inputs.length === 0) throw new Error('No Starling XML atlases found')
  for (const input of inputs) await convert(input)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
