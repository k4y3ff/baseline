#!/usr/bin/env node
// Generates build/icon.iconset/*.png, then runs iconutil to produce build/icon.icns
// Uses the same "b" pixel art as the tray icon, scaled to each size.
// No external dependencies — pure Node.js + macOS iconutil.

import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ICONSET = join(__dirname, '../build/icon.iconset')
mkdirSync(ICONSET, { recursive: true })

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
  const len = Buffer.alloc(4); len.writeUInt32BE(d.length)
  const crcVal = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(Buffer.concat([t, d])))
  return Buffer.concat([len, t, d, crcVal])
}

function buildPNG(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6  // 8-bit RGBA
  const raw = Buffer.alloc(size * (1 + size * 4), 0)
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4
      const dst = y * (1 + size * 4) + 1 + x * 4
      raw[dst] = rgba[src]; raw[dst+1] = rgba[src+1]
      raw[dst+2] = rgba[src+2]; raw[dst+3] = rgba[src+3]
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))])
}

// ─── Same "b" pixel art as the tray icon ─────────────────────────────────────
// 1 = foreground (white), 0 = background (#0f0f0f)
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

// Squircle mask — approximates Apple's macOS icon shape (superellipse, n=5).
// Returns the fraction [0,1] of the subpixel grid that falls inside the shape.
const SQ_N = 5
const SQ_LIMIT = Math.pow(0.5, SQ_N)

function squircleCoverage(x, y, size, ss) {
  const step = 1 / ss
  let hits = 0
  for (let sy = 0; sy < ss; sy++) {
    for (let sx = 0; sx < ss; sx++) {
      const nx = (x + (sx + 0.5) * step) / size - 0.5
      const ny = (y + (sy + 0.5) * step) / size - 0.5
      if (Math.pow(Math.abs(nx), SQ_N) + Math.pow(Math.abs(ny), SQ_N) <= SQ_LIMIT) hits++
    }
  }
  return hits / (ss * ss)
}

// Scale the 16×16 pixel art to the target size using nearest-neighbour,
// centred inside a squircle-masked background (transparent corners).
// Content occupies ~75% of the icon area to match typical macOS app icon padding.
const CONTENT_SCALE = 0.75

function renderIcon(size) {
  const ROWS = B.length, COLS = B[0].length
  const scale = Math.floor(size * CONTENT_SCALE / Math.max(ROWS, COLS))
  const offX = Math.floor((size - COLS * scale) / 2)
  const offY = Math.floor((size - ROWS * scale) / 2)

  // Use more subsamples at small sizes where the curve is a larger fraction of pixels
  const ss = size <= 64 ? 8 : 4

  const rgba = Buffer.alloc(size * size * 4, 0)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const coverage = squircleCoverage(x, y, size, ss)
      if (coverage === 0) continue  // fully outside — stays transparent

      const gx = x - offX, gy = y - offY
      const col = Math.floor(gx / scale), row = Math.floor(gy / scale)
      const fg = gx >= 0 && gy >= 0 && row < ROWS && col < COLS && B[row][col] === 1

      const i = (y * size + x) * 4
      rgba[i]   = fg ? 0xff : 0x0f
      rgba[i+1] = fg ? 0xff : 0x0f
      rgba[i+2] = fg ? 0xff : 0x0f
      rgba[i+3] = Math.round(coverage * 0xff)
    }
  }
  return rgba
}

// ─── Generate iconset ─────────────────────────────────────────────────────────
const SIZES = [
  ['icon_16x16.png',        16],
  ['icon_16x16@2x.png',     32],
  ['icon_32x32.png',        32],
  ['icon_32x32@2x.png',     64],
  ['icon_128x128.png',     128],
  ['icon_128x128@2x.png',  256],
  ['icon_256x256.png',     256],
  ['icon_256x256@2x.png',  512],
  ['icon_512x512.png',     512],
  ['icon_512x512@2x.png', 1024],
]

for (const [name, size] of SIZES) {
  writeFileSync(join(ICONSET, name), buildPNG(size, renderIcon(size)))
  console.log(`  ✓ ${name} (${size}×${size})`)
}

// ─── Build .icns via iconutil ─────────────────────────────────────────────────
const icnsPath = join(__dirname, '../build/icon.icns')
execSync(`iconutil -c icns "${ICONSET}" -o "${icnsPath}"`)
console.log(`\n✓ build/icon.icns`)
