const { app, BrowserWindow, protocol, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
protocol.registerSchemesAsPrivileged([{ scheme: 'garage', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true
} }]);
const testOutput = process.env.GARAGE_TEST_OUTPUT;
let win;
app.whenReady().then(async () => {
  const root = path.join(app.getAppPath(), 'game');
  protocol.handle('garage', async request => {
    const url = new URL(request.url);
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (url.host !== 'game' || !target.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
    const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.glb': 'model/gltf-binary' };
    const type = mime[path.extname(target)] || 'application/octet-stream';
    try {
      // byte ranges let the <audio> element stream and seek the long music track
      const range = request.headers.get('range');
      if (range) {
        const size = (await fs.promises.stat(target)).size;
        const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
        let start = m[1] ? parseInt(m[1], 10) : 0, end = m[2] ? parseInt(m[2], 10) : size - 1;
        if (!m[1] && m[2]) { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; }
        end = Math.min(end, size - 1);
        if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
        const fh = await fs.promises.open(target, 'r');
        try {
          const buf = Buffer.alloc(end - start + 1);
          await fh.read(buf, 0, buf.length, start);
          return new Response(buf, { status: 206, headers: { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(buf.length) } });
        } finally { await fh.close(); }
      }
      return new Response(await fs.promises.readFile(target), { headers: { 'Content-Type': type, 'Accept-Ranges': 'bytes' } });
    } catch { return new Response('Not found', { status: 404 }); }
  });
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !details.url.startsWith('garage://game/') && !details.url.startsWith('data:') && !details.url.startsWith('blob:') });
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(['pointerLock', 'fullscreen'].includes(permission));
  });
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 960, minHeight: 600,
    title: 'Гараж у Ильнура', icon: path.join(root, 'icon.png'), backgroundColor: '#000000', autoHideMenuBar: true,
    show: !testOutput,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  win.setMenu(null);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== 'garage://game/index.html') event.preventDefault();
  });
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen()); event.preventDefault();
    }
  });
  if (testOutput) {
    const errors = [];
    win.webContents.on('console-message', (_event, details) => {
      if (details.level === 'error') errors.push(details.message);
    });
    win.webContents.on('render-process-gone', (_event, details) => {
      fs.writeFileSync(testOutput + '.json', JSON.stringify({ crash: details })); app.exit(1);
    });
    await win.loadURL('garage://game/index.html');
    await new Promise(resolve => setTimeout(resolve, 12000));
    const menu = await win.webContents.executeJavaScript(`({title: document.title, ready: !document.getElementById('start').disabled, loading: document.getElementById('loading').textContent, warning: document.getElementById('warn').textContent, three: THREE.REVISION})`);
    const assets = [];
    function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) walk(file); else assets.push(path.relative(root, file).split(path.sep).join('/')); } }
    walk(path.join(root, 'assets'));
    const resources = await win.webContents.executeJavaScript(`Promise.all(${JSON.stringify(assets)}.map(async p => {try {const r = await fetch(p); const b = await r.arrayBuffer(); return {path:p,ok:r.ok,bytes:b.byteLength};} catch(e) {return {path:p,ok:false,error:String(e)};}}))`);
    await win.webContents.executeJavaScript(`document.getElementById('start').click()`);
    await new Promise(resolve => setTimeout(resolve, 6000));
    const playing = await win.webContents.executeJavaScript(`({hud: getComputedStyle(document.getElementById('hud')).display, menu: getComputedStyle(document.getElementById('menu')).display, canvas: [document.getElementById('c').width, document.getElementById('c').height]})`);
    fs.writeFileSync(testOutput + '.png', (await win.webContents.capturePage()).toPNG());
    fs.writeFileSync(testOutput + '.json', JSON.stringify({menu,playing,errors,resources}, null, 2));
    app.exit(menu.ready && playing.menu === 'none' && !errors.length && resources.every(r => r.ok && r.bytes > 0) ? 0 : 1);
  } else await win.loadURL('garage://game/index.html');
}).catch(error => { console.error(error); app.exit(1); });
app.on('window-all-closed', () => app.quit());
