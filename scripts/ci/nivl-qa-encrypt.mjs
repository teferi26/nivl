import { lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
  constants,
  createCipheriv,
  createHash,
  createPublicKey,
  publicEncrypt,
  randomBytes,
} from 'node:crypto';

const [sourceArg, keyArg, outputArg] = process.argv.slice(2);
if (!sourceArg || !keyArg || !outputArg || process.argv.length !== 5) {
  throw Error('Expected source, public key, output directories.');
}

const source = resolve(sourceArg);
const output = resolve(outputArg);
const publicKey = createPublicKey(readFileSync(keyArg));
if (
  publicKey.asymmetricKeyType !== 'rsa'
  || publicKey.asymmetricKeyDetails.modulusLength !== 4096
) {
  throw Error('RSA4096 public key required.');
}

mkdirSync(output, { recursive: true, mode: 0o700 });
let count = 0;
let total = 0;

function visit(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, item.name);
    const stat = lstatSync(file);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      visit(file);
      continue;
    }
    if (!stat.isFile() || !/\.(png|log|ips|json)$/i.test(item.name)) continue;
    if (stat.size > 20 * 1024 * 1024 || total + stat.size > 100 * 1024 * 1024) continue;

    const payload = Buffer.from(JSON.stringify({
      name: relative(source, file),
      data: readFileSync(file).toString('base64'),
    }));
    const key = randomBytes(32);
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
    const wrappedKey = publicEncrypt({
      key: publicKey,
      oaepHash: 'sha256',
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    }, key);
    const envelope = Buffer.from(JSON.stringify({
      version: 1,
      algorithm: 'AES-256-GCM',
      keyAlgorithm: 'RSA-OAEP-SHA256',
      nonce: nonce.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      wrappedKey: wrappedKey.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    }));

    key.fill(0);
    payload.fill(0);
    writeFileSync(
      join(output, `diagnostic-${String(++count).padStart(4, '0')}.json.enc`),
      envelope,
      { mode: 0o600 },
    );
    total += stat.size;
    console.log(JSON.stringify({
      fileCount: count,
      size: envelope.length,
      sha256: createHash('sha256').update(envelope).digest('hex'),
    }));
  }
}

visit(source);
console.log(JSON.stringify({ fileCount: count, size: total }));
