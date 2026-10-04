const fs = require('node:fs');
const crypto = require('node:crypto');
const { NtExecutable, NtExecutableResource } = require('resedit');
const ico = fs.readFileSync(require('node:path').join(__dirname, 'build/icon.ico'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const expected = [];
for (let i = 0; i < ico.readUInt16LE(4); i++) {
  const pos = 6 + i * 16;
  expected.push(hash(ico.subarray(ico.readUInt32LE(pos + 12), ico.readUInt32LE(pos + 12) + ico.readUInt32LE(pos + 8))));
}
for (const filename of process.argv.slice(2)) {
  const exe = NtExecutable.from(fs.readFileSync(filename));
  const entries = NtExecutableResource.from(exe).entries.filter(entry => entry.type === 3);
  const actual = entries.map(entry => hash(Buffer.from(entry.bin)));
  const matched = expected.filter(value => actual.includes(value)).length;
  console.log(`${filename}: ${matched}/${expected.length} icon images match`);
  if (matched !== expected.length) process.exitCode = 1;
}
