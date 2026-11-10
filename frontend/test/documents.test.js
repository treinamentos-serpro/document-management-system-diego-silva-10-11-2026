import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { downloadDocument, listDocuments, uploadDocument } from '../src/services/documents.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('lista documentos via /api e encaminha o sinal de cancelamento', async () => {
  const documents = [{ id: '1', originalName: 'teste.txt' }];
  const controller = new AbortController();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/documents');
    assert.equal(options.signal, controller.signal);
    return Response.json({ documents });
  };

  assert.deepEqual(await listDocuments({ signal: controller.signal }), documents);
});

test('envia arquivo no campo file sem definir o content-type manualmente', async () => {
  const file = new File(['conteúdo'], 'teste.txt', { type: 'text/plain' });
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/upload');
    assert.equal(options.method, 'POST');
    assert.equal(options.body.get('file'), file);
    assert.deepEqual(options.headers, { 'X-DMS-Request': '1' });
    return Response.json({ id: '1' }, { status: 201 });
  };

  assert.deepEqual(await uploadDocument(file), { id: '1' });
});

test('baixa o conteúdo usando o identificador codificado', async () => {
  globalThis.fetch = async (url) => {
    assert.equal(url, '/api/documents/a%2Fb/download');
    return new Response('arquivo');
  };

  assert.equal(await (await downloadDocument('a/b')).text(), 'arquivo');
});

test('apresenta a mensagem de erro do backend', async () => {
  globalThis.fetch = async () => Response.json(
    { error: { code: 'UNAUTHENTICATED', message: 'Usuário não autenticado.' } },
    { status: 401 },
  );
  await assert.rejects(listDocuments(), { message: 'Usuário não autenticado.' });
});

test('apresenta status HTTP quando a resposta de erro não contém JSON válido', async () => {
  globalThis.fetch = async () => new Response('{', {
    status: 502,
    headers: { 'content-type': 'application/json' },
  });
  await assert.rejects(listDocuments(), { message: 'Erro na requisição (HTTP 502).' });
});

test('informa falhas de conexão e preserva cancelamentos', async () => {
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(listDocuments(), { message: 'Não foi possível conectar ao servidor.' });

  const abort = new DOMException('Aborted', 'AbortError');
  globalThis.fetch = async () => { throw abort; };
  await assert.rejects(listDocuments(), (error) => error === abort);
});

test('rejeita uma resposta de listagem com formato inválido', async () => {
  globalThis.fetch = async () => Response.json({});
  await assert.rejects(listDocuments(), { message: 'Resposta inválida ao listar documentos.' });
});
