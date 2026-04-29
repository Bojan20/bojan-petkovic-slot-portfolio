import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, basename } from 'node:path'

const input = process.argv[2]
if (!input) { console.error('Usage: node auto-edit.mjs <video.mp4>'); process.exit(1) }

const outDir = resolve('out', basename(input, '.mp4'))
mkdirSync(outDir, { recursive: true })

const sh = (cmd, args) => new Promise((res, rej) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = '', err = ''
  p.stdout.on('data', d => out += d)
  p.stderr.on('data', d => err += d)
  p.on('close', c => c === 0 ? res({ out, err }) : rej(new Error(err)))
})

// 1. OČI — scene detection (ffmpeg select filter)
console.log('👁  Scanning scenes...')
const { err: sceneErr } = await sh('ffmpeg', [
  '-i', input, '-filter:v', "select='gt(scene,0.4)',showinfo",
  '-f', 'null', '-'
])
const scenes = [...sceneErr.matchAll(/pts_time:([\d.]+)/g)].map(m => +m[1])

// 2. UŠI — loudness peaks (audio energy → "big win" detection)
console.log('👂 Analyzing audio energy...')
const { err: audErr } = await sh('ffmpeg', [
  '-i', input, '-af', 'astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level',
  '-f', 'null', '-'
])
const peaks = [...audErr.matchAll(/pts_time:([\d.]+)[\s\S]*?RMS_level=(-?[\d.]+)/g)]
  .map(m => ({ t: +m[1], db: +m[2] }))
  .filter(p => p.db > -18)

// 3. MOZAK — odluči segmente
const segments = scenes.map((start, i) => {
  const end = scenes[i + 1] ?? start + 5
  const energy = peaks.filter(p => p.t >= start && p.t <= end).length
  const type = energy > 8 ? 'BIG_WIN' : energy > 3 ? 'FEATURE' : 'BASE'
  return { start, end, type, energy }
}).filter(s => s.end - s.start >= 1.5)

writeFileSync(resolve(outDir, 'edl.json'), JSON.stringify(segments, null, 2))
console.log(`🧠 Found ${segments.length} segments:`)
segments.forEach(s => console.log(`   ${s.type.padEnd(8)} ${s.start.toFixed(1)}s → ${s.end.toFixed(1)}s`))

// 4. RUKE — render sa fade prelazom prema tipu
const fadeFor = t => t === 'BIG_WIN' ? 'fade=t=in:d=0.3,fade=t=out:d=0.5'
                    : t === 'FEATURE' ? 'fade=t=in:d=0.2,fade=t=out:d=0.3'
                    : 'fade=t=in:d=0.15,fade=t=out:d=0.2'

const filterComplex = segments.map((s, i) =>
  `[0:v]trim=${s.start}:${s.end},setpts=PTS-STARTPTS,${fadeFor(s.type)}[v${i}];` +
  `[0:a]atrim=${s.start}:${s.end},asetpts=PTS-STARTPTS,afade=t=in:d=0.2,afade=t=out:st=${(s.end-s.start-0.3).toFixed(2)}:d=0.3[a${i}];`
).join('') + segments.map((_, i) => `[v${i}][a${i}]`).join('') +
  `concat=n=${segments.length}:v=1:a=1[v][a]`

console.log('✋ Rendering reel...')
await sh('ffmpeg', [
  '-y', '-i', input, '-filter_complex', filterComplex,
  '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-crf', '18',
  '-preset', 'slow', '-movflags', '+faststart',
  resolve(outDir, 'reel.mp4')
])

console.log(`✅ ${outDir}/reel.mp4`)