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
  const app = require('../src/app');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await fs.rm(storage, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const form = new FormData();
  form.append('file', new Blob(['conteúdo de teste']), 'teste.txt');
  const upload = await fetch(`${base}/upload`, {
    method: 'POST',
    body: form,
    headers: { 'x-user-id': 'outro-usuario' },
  });
  assert.equal(upload.status, 201);
  const document = await upload.json();
  assert.equal(document.owner, 'local-user');

  const list = await fetch(`${base}/documents`);
  assert.equal(list.status, 200);
  assert.deepEqual((await list.json()).documents.map((item) => item.id), [document.id]);

  const download = await fetch(`${base}/documents/${document.id}/download`);
  assert.equal(download.status, 200);
  assert.equal(await download.text(), 'conteúdo de teste');
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
