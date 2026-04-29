#!/usr/bin/env node
/**
 * studio-server.mjs — Local Smart Edit Studio
 *
 * One command:  npm run studio
 * Then:         open http://localhost:7777 in browser
 *
 * Endpoints:
 *   GET  /                → serve studio UI (drop.html)
 *   POST /upload          → binary stream upload → run smart-edit → SSE stream
 *   GET  /progress/:id    → SSE stream of edit progress
 *   GET  /output/:file    → serve output MP4 for preview
 *   POST /open-output     → open MP4 in QuickTime
 */

import http   from 'node:http';
import fs     from 'node:fs';
import path   from 'node:path';
import { fileURLToPath }           from 'node:url';
import { spawn, execSync }         from 'node:child_process';
import { createWriteStream }       from 'node:fs';
import { pipeline as streamPipe }  from 'node:stream/promises';

const __dir  = path.dirname(fileURLToPath(import.meta.url));
const PORT   = 7777;
const UPLOADS = path.resolve(__dir, 'output', '_uploads');
const OUTPUT  = path.resolve(__dir, 'output');

fs.mkdirSync(UPLOADS, { recursive: true });
fs.mkdirSync(OUTPUT,  { recursive: true });

/* ── SSE client registry ── */
const sseClients = new Map(); // id → res
let jobCounter = 0;

function broadcast(id, data) {
  const res = sseClients.get(id);
  if (!res) return;
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/* ── Run smart-edit pipeline ── */
async function runSmartEdit(id, inputPath) {
  const outputPath = path.resolve(OUTPUT, `smart-reel-${id}.mp4`);

  broadcast(id, { type: 'start', msg: 'Smart edit pipeline started' });

  const child = spawn('node', [
    path.resolve(__dir, 'smart-edit.mjs'),
    inputPath,
    `--output=${outputPath}`,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let stderr = '';

  child.stdout.on('data', chunk => {
    const text = chunk.toString();
    for (const line of text.split('\n').filter(Boolean)) {
      if (line.startsWith('PROGRESS:')) {
        const [, pct, ...labelParts] = line.split(':');
        broadcast(id, { type: 'progress', pct: parseInt(pct, 10), msg: labelParts.join(':') });
      } else if (line.startsWith('INFO:')) {
        broadcast(id, { type: 'info', msg: line.slice(5) });
      } else if (line.startsWith('DONE:')) {
        const outFile = line.slice(5).trim();
        const sizeMB  = (fs.statSync(outFile).size / 1024 / 1024).toFixed(1);
        broadcast(id, { type: 'done', path: outFile, file: path.basename(outFile), sizeMB });
        // Auto-open in QuickTime
        try { execSync(`open "${outFile}"`); } catch {}
        // Cleanup upload
        try { fs.rmSync(inputPath, { force: true }); } catch {}
      } else if (line.startsWith('ERROR:')) {
        broadcast(id, { type: 'error', msg: line.slice(6) });
      }
    }
  });

  child.stderr.on('data', d => { stderr += d.toString(); });

  child.on('close', code => {
    if (code !== 0) {
      broadcast(id, { type: 'error', msg: stderr.slice(-400) || `Exit code ${code}` });
    }
    // Give client 5s to read final event, then cleanup SSE
    setTimeout(() => {
      const res = sseClients.get(id);
      if (res) { try { res.end(); } catch {} sseClients.delete(id); }
    }, 5000);
  });
}

/* ── HTTP server ── */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  /* ─ CORS headers (localhost only) ─ */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Filename,X-Filesize');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  /* ─ GET / → serve studio UI ─ */
  if (req.method === 'GET' && url.pathname === '/') {
    const htmlPath = path.resolve(__dir, 'drop.html');
    if (!fs.existsSync(htmlPath)) {
      res.writeHead(404); res.end('drop.html not found');
      return;
    }
    const html = fs.readFileSync(htmlPath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  /* ─ POST /upload → binary stream ─ */
  if (req.method === 'POST' && url.pathname === '/upload') {
    const jobId   = ++jobCounter;
    const rawName = (req.headers['x-filename'] ?? `input-${jobId}.mov`)
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const tmpPath = path.resolve(UPLOADS, `${jobId}-${rawName}`);
    const fileStream = createWriteStream(tmpPath);

    try {
      await streamPipe(req, fileStream);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e) }));
      return;
    }

    const sizeMB = (fs.statSync(tmpPath).size / 1024 / 1024).toFixed(1);
    console.log(`[studio] Job ${jobId}: received ${sizeMB}MB → ${tmpPath}`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, jobId }));

    // Start pipeline async
    setImmediate(() => runSmartEdit(jobId, tmpPath).catch(console.error));
    return;
  }

  /* ─ GET /progress/:id → SSE ─ */
  if (req.method === 'GET' && url.pathname.startsWith('/progress/')) {
    const id = parseInt(url.pathname.split('/')[2], 10);
    if (!id) { res.writeHead(400); res.end('bad id'); return; }

    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 1000\n\n'); // reconnect every 1s if dropped

    sseClients.set(id, res);
    req.on('close', () => {
      sseClients.delete(id);
    });
    return;
  }

  /* ─ GET /output/:file → serve MP4 ─ */
  if (req.method === 'GET' && url.pathname.startsWith('/output/')) {
    const file    = path.basename(url.pathname);
    const filePath = path.resolve(OUTPUT, file);
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('not found'); return; }
    const stat  = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Type':   'video/mp4',
      'Content-Length': stat.size,
      'Accept-Ranges':  'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  /* ─ POST /open-output → open in QuickTime ─ */
  if (req.method === 'POST' && url.pathname === '/open-output') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { file } = JSON.parse(body);
        const p = path.resolve(OUTPUT, path.basename(file));
        if (fs.existsSync(p)) execSync(`open "${p}"`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(500); res.end('{}');
      }
    });
    return;
  }

  res.writeHead(404); res.end('not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  🎬  SMART EDIT STUDIO — ready                   ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  URL  : http://localhost:${PORT}                    ║`);
  console.log('║                                                  ║');
  console.log('║  1.  Drag & drop your gameplay recording         ║');
  console.log('║  2.  Watch smart analysis run automatically      ║');
  console.log('║  3.  MP4 opens in QuickTime when done            ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  // Open browser automatically
  try { execSync(`open http://localhost:${PORT}`); } catch {}
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is in use — kill the existing studio server first.`);
    process.exit(1);
  }
  throw err;
});

process.on('SIGINT', () => {
  console.log('\n[studio] Shutting down.');
  server.close();
  process.exit(0);
});
