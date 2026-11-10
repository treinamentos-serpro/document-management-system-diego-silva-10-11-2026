const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Readable, Writable } = require('node:stream');
const repository = require('../src/repositories/documents.repository');
const service = require('../src/services/documents.service');
const controller = require('../src/controllers/documents.controller');

test('listagem e download isolam documentos por proprietário', async () => {
  const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'dms-owner-'));
  const filePath = path.join(directory, 'arquivo');
  try {
    await fsPromises.writeFile(filePath, 'conteúdo');
    const document = await service.upload({ originalname: 'teste.txt', size: 9, path: filePath }, 'dono');
    assert.equal((await service.list('dono')).some((item) => item.id === document.id), true);
    assert.equal((await service.list('outro')).some((item) => item.id === document.id), false);
    await assert.rejects(service.getDownload(document.id, 'outro'), { code: 'DOCUMENT_NOT_FOUND' });
    await assert.rejects(service.getDownload('inexistente', 'dono'), { code: 'DOCUMENT_NOT_FOUND' });
  } finally {
    await fsPromises.rm(directory, { recursive: true, force: true });
  }
});

test('arquivo removido durante abertura do download retorna erro de documento ausente', async () => {
  mock.method(service, 'getDownload', async () => ({ storagePath: '/arquivo', originalName: 'teste.txt' }));
  try {
    const response = {
      headersSent: false,
      type() {},
      removeHeader() {},
      download(filePath, name, callback) {
        callback(Object.assign(new Error('ausente'), { code: 'ENOENT' }));
      },
    };
    let receivedError;
    await controller.download({ params: { id: 'id' }, documentOwner: 'dono' }, response, (error) => {
      receivedError = error;
    });
    assert.equal(receivedError.code, 'DOCUMENT_NOT_FOUND');
    assert.equal(receivedError.status, 404);
  } finally {
    mock.restoreAll();
  }
});

test('falha de escrita remove arquivo parcial', async () => {
  const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'dms-partial-'));
  const previousDirectory = process.env.STORAGE_DIR;
  process.env.STORAGE_DIR = directory;
  mock.method(fs, 'createWriteStream', (filePath) => {
    fs.writeFileSync(filePath, 'parcial');
    return new Writable({
      write(chunk, encoding, callback) {
        callback(Object.assign(new Error('disco cheio'), { code: 'ENOSPC' }));
      },
    });
  });
  try {
    const storage = repository.createUploadStorage(10);
    const file = { stream: Readable.from(['conteúdo']) };
    const error = await new Promise((resolve) => storage._handleFile({}, file, resolve));
    assert.equal(error.code, 'ENOSPC');
    assert.deepEqual(await fsPromises.readdir(directory), []);
  } finally {
    mock.restoreAll();
    if (previousDirectory === undefined) delete process.env.STORAGE_DIR;
    else process.env.STORAGE_DIR = previousDirectory;
    await fsPromises.rm(directory, { recursive: true, force: true });
  }
});

test('cota rejeita upload quando não há espaço reservado suficiente', async () => {
  const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'dms-quota-'));
  const previousDirectory = process.env.STORAGE_DIR;
  const previousQuota = process.env.MAX_STORAGE_BYTES;
  process.env.STORAGE_DIR = directory;
  process.env.MAX_STORAGE_BYTES = '15';
  try {
    await fsPromises.writeFile(path.join(directory, 'existente'), '123456');
    const storage = repository.createUploadStorage(10);
    const file = { stream: Readable.from(['conteúdo']) };
    const error = await new Promise((resolve) => storage._handleFile({}, file, resolve));
    assert.equal(error.code, 'STORAGE_FULL');
    assert.deepEqual(await fsPromises.readdir(directory), ['existente']);
  } finally {
    if (previousDirectory === undefined) delete process.env.STORAGE_DIR;
    else process.env.STORAGE_DIR = previousDirectory;
    if (previousQuota === undefined) delete process.env.MAX_STORAGE_BYTES;
    else process.env.MAX_STORAGE_BYTES = previousQuota;
    await fsPromises.rm(directory, { recursive: true, force: true });
  }
});

test('cota considera reservas de uploads simultâneos', async () => {
  const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'dms-concurrent-'));
  const previousDirectory = process.env.STORAGE_DIR;
  const previousQuota = process.env.MAX_STORAGE_BYTES;
  process.env.STORAGE_DIR = directory;
  process.env.MAX_STORAGE_BYTES = '15';
  try {
    const storage = repository.createUploadStorage(10);
    const send = () => new Promise((resolve) => {
      storage._handleFile({}, { stream: Readable.from(['1234']) }, (error, info) => {
        resolve({ error, info });
      });
    });
    const results = await Promise.all([send(), send()]);
    assert.equal(results.filter((result) => !result.error).length, 1);
    assert.equal(results.find((result) => result.error).error.code, 'STORAGE_FULL');
    assert.equal((await fsPromises.readdir(directory)).length, 1);
  } finally {
    if (previousDirectory === undefined) delete process.env.STORAGE_DIR;
    else process.env.STORAGE_DIR = previousDirectory;
    if (previousQuota === undefined) delete process.env.MAX_STORAGE_BYTES;
    else process.env.MAX_STORAGE_BYTES = previousQuota;
    await fsPromises.rm(directory, { recursive: true, force: true });
  }
});