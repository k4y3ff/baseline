#!/usr/bin/env node
// One-time script: generates resources/trayTemplate.png and resources/trayTemplate@2x.png
// macOS template images must have "Template" in the name and use white+alpha.

import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../resources')
mkdirSync(OUT, { recursive: true })

// ─── CRC32 ────────────────────────────────────────────────────────────────────
const CRC_TABLE = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let j = 0; j < 8; j++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
  CRC_TABLE[i] = c
}
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// ─── PNG builder ──────────────────────────────────────────────────────────────
function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(d.length)
  const crcVal = Buffer.alloc(4)
  crcVal.writeUInt32BE(crc32(Buffer.concat([t, d])))
  return Buffer.concat([len, t, d, crcVal])
}

function buildPNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 6  // color type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  // Filter byte 0 (None) before each scanline
  const raw = Buffer.alloc(height * (1 + width * 4), 0)
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0  // filter: None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4
      const dst = y * (1 + width * 4) + 1 + x * 4
      raw[dst]     = rgba[src]
      raw[dst + 1] = rgba[src + 1]
      raw[dst + 2] = rgba[src + 2]
      raw[dst + 3] = rgba[src + 3]
    }
  }

  const idat = deflateSync(raw)
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

// ─── "b" pixel art (16×16) ────────────────────────────────────────────────────
// 1 = white opaque, 0 = transparent
// "b" centered in 16×16: letter spans cols 4–11, rows 3–12 (equal margins on all sides)
const B = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,1,1,0,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0],
  [0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0],
  [0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0],
  [0,0,0,0,1,1,0,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
]

function pixelsToRGBA(pixels, scale = 1) {
  const rows = pixels.length
  const cols = pixels[0].length
  const h = rows * scale
  const w = cols * scale
  const buf = Buffer.alloc(w * h * 4, 0)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!pixels[y][x]) continue
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const i = ((y * scale + sy) * w + (x * scale + sx)) * 4
          buf[i] = 255; buf[i + 1] = 255; buf[i + 2] = 255; buf[i + 3] = 255
        }
      }
    }
  }
  return { buf, w, h }
}

// 1x (16×16)
const { buf: buf1, w: w1, h: h1 } = pixelsToRGBA(B, 1)
writeFileSync(join(OUT, 'trayTemplate.png'), buildPNG(w1, h1, buf1))
console.log('✓ resources/trayTemplate.png (16×16)')

// 2x (32×32)
const { buf: buf2, w: w2, h: h2 } = pixelsToRGBA(B, 2)
writeFileSync(join(OUT, 'trayTemplate@2x.png'), buildPNG(w2, h2, buf2))
console.log('✓ resources/trayTemplate@2x.png (32×32)')
