const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const game = path.join(__dirname, 'game');
fs.mkdirSync(game, { recursive: true });
fs.copyFileSync(path.join(__dirname, 'build', 'icon.png'), path.join(game, 'icon.png'));
fs.cpSync(path.join(root, 'assets'), path.join(game, 'assets'), { recursive: true });
const three = path.join(__dirname, 'node_modules', 'three');
fs.cpSync(path.join(three, 'build', 'three.min.js'), path.join(game, 'three.min.js'));
fs.cpSync(path.join(three, 'examples', 'js'), path.join(game, 'three-examples'), { recursive: true });
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replaceAll('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js', 'three.min.js')
  .replaceAll('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/', 'three-examples/');
fs.writeFileSync(path.join(game, 'index.html'), html);
fs.copyFileSync(path.join(three, 'LICENSE'), path.join(game, 'THREE-LICENSE.txt'));
console.log('Offline game files prepared.');
