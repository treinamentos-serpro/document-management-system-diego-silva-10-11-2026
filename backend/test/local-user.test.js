const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { once } = require('node:events');

test('modo local permite enviar, listar e baixar documentos', async () => {
  const storage = await fs.mkdtemp(path.join(os.tmpdir(), 'dms-local-test-'));
  process.env.STORAGE_DIR = storage;
  process.env.NODE_ENV = 'development';
  process.env.DMS_LOCAL_USER = 'true';
  process.env.UPLOAD_RATE_LIMIT = '4';
  process.env.MAX_FILE_SIZE_BYTES = '20';
  const app = require('../src/app');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await fs.rm(storage, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const oversizedRequest = await fetch(`${base}/upload`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ value: 'x'.repeat(110000) }),
  });
  assert.equal(oversizedRequest.status, 413);
  assert.equal((await oversizedRequest.json()).error.code, 'REQUEST_TOO_LARGE');

  const crossOriginForm = new FormData();
  crossOriginForm.append('file', new Blob(['teste']), 'teste.txt');
  const crossOriginUpload = await fetch(`${base}/upload`, {
    method: 'POST',
    body: crossOriginForm,
    headers: { origin: 'https://exemplo.invalid' },
  });
  assert.equal(crossOriginUpload.status, 403);
  const preflight = await fetch(`${base}/upload`, {
    method: 'OPTIONS',
    headers: {
      origin: 'https://exemplo.invalid',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'x-dms-request',
    },
  });
  assert.equal(preflight.headers.get('access-control-allow-origin'), null);

  const invalidForm = new FormData();
  invalidForm.append('extra', 'valor');
  invalidForm.append('file', new Blob(['teste']), 'teste.txt');
  const invalidUpload = await fetch(`${base}/upload`, { method: 'POST', body: invalidForm });
  assert.equal(invalidUpload.status, 400);
  assert.equal((await invalidUpload.json()).error.code, 'INVALID_MULTIPART');

  const form = new FormData();
  form.append('file', new Blob(['conteúdo de teste']), 'teste.txt');
  const upload = await fetch(`${base}/upload`, {
    method: 'POST',
    body: form,
    headers: {
      'x-user-id': 'outro-usuario',
      origin: 'http://localhost:5173',
      'x-dms-request': '1',
    },
  });
  assert.equal(upload.status, 201);
  const document = await upload.json();
  assert.equal(document.owner, 'local-user');
  assert.match((await fs.readdir(storage))[0], /^[0-9a-f-]{36}$/);

  const longNameForm = new FormData();
  const longName = `arquivo.${'x'.repeat(270)}`;
  longNameForm.append('file', new Blob(['ok']), longName);
  const longNameUpload = await fetch(`${base}/upload`, { method: 'POST', body: longNameForm });
  assert.equal(longNameUpload.status, 201);
  const longNameDocument = await longNameUpload.json();
  assert.equal(longNameDocument.originalName, longName);

  const largeForm = new FormData();
  largeForm.append('file', new Blob(['x'.repeat(21)]), 'grande.txt');
  const largeUpload = await fetch(`${base}/upload`, { method: 'POST', body: largeForm });
  assert.equal(largeUpload.status, 413);
  assert.equal((await largeUpload.json()).error.code, 'FILE_TOO_LARGE');
  assert.equal((await fs.readdir(storage)).length, 2);

  const limitedUpload = await fetch(`${base}/upload`, { method: 'POST', body: new FormData() });
  assert.equal(limitedUpload.status, 429);
  assert.equal((await limitedUpload.json()).error.code, 'RATE_LIMITED');

  const list = await fetch(`${base}/documents`);
  assert.equal(list.status, 200);
  assert.equal(list.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(
    new Set((await list.json()).documents.map((item) => item.id)),
    new Set([document.id, longNameDocument.id]),
  );

  const download = await fetch(`${base}/documents/${document.id}/download`);
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('cache-control'), 'private, no-store');
  assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
  assert.match(download.headers.get('content-type'), /^text\/plain/);
  assert.equal(await download.text(), 'conteúdo de teste');

  const documentRepository = require('../src/repositories/documents.repository');
  const storedDocument = await documentRepository.findByIdAndOwner(document.id, 'local-user');
  await fs.unlink(storedDocument.storagePath);
  const missingDownload = await fetch(`${base}/documents/${document.id}/download`);
  assert.equal(missingDownload.status, 404);
  assert.equal((await missingDownload.json()).error.code, 'DOCUMENT_NOT_FOUND');
});

test('modo local desabilitado mantém proteção 401', async () => {
  const script = `
    const app = require('./src/app');
    const server = app.listen(0, '127.0.0.1', async () => {
      try {
        const response = await fetch('http://127.0.0.1:' + server.address().port + '/documents');
        if (response.status !== 401) process.exitCode = 1;
      } finally {
        server.close();
      }
    });
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DMS_LOCAL_USER: 'false' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
});

test('modo local falha ao iniciar fora do ambiente de desenvolvimento', () => {
  for (const environment of ['production', 'test', '']) {
    const result = spawnSync(process.execPath, ['-e', "require('./src/app')"], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, NODE_ENV: environment, DMS_LOCAL_USER: 'true' },
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /DMS_LOCAL_USER só pode ser habilitado/);
  }
});
