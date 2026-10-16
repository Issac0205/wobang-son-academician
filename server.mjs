/**
 * 零依赖静态服务器（开发用）。
 *
 * 源码是原生 ES Module，直接双击 index.html（file://）会被浏览器的模块跨域策略拦下，
 * 所以开发期用本文件起一个本地服务。发布产物（dist/单文件 HTML）不需要它。
 *
 *   node server.mjs                     → http://127.0.0.1:5175/
 *   PORT=8080 node server.mjs           → 换端口
 *   node 评院士/server.mjs              → 从工作区根目录也能直接跑（路径按本文件位置解析）
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 文档根 = 本文件所在目录，与 cwd 无关。 */
const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.env.PORT || 5175);
const HOST = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';

    const target = resolve(join(ROOT, normalize(pathname)));
    // 目录穿越防护
    if (target !== ROOT && !target.startsWith(ROOT + sep)) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' }).end('403 Forbidden');
      return;
    }

    const info = await stat(target).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 Not Found');
      return;
    }

    const body = await readFile(target);
    res.writeHead(200, {
      'content-type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
      'content-length': body.length,
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('500 ' + err.message);
  }
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  我帮儿子评院士');
  console.log('  →  http://' + HOST + ':' + PORT + '/');
  console.log('  静态根目录：' + ROOT);
  console.log('  Ctrl+C 停止');
  console.log('');
});
