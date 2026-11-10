const API_PREFIX = '/api';

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${API_PREFIX}${path}`, options);
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Não foi possível conectar ao servidor.');
  }

  if (!response.ok) {
    let message = `Erro na requisição (HTTP ${response.status}).`;
    if (response.headers.get('content-type')?.includes('application/json')) {
      try {
        const body = await response.json();
        if (typeof body?.error?.message === 'string') {
          message = body.error.message;
        }
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
      }
    }
    throw new Error(message);
  }

  return response;
}

export async function listDocuments(options = {}) {
  const response = await request('/documents', options);
  const body = await response.json();
  if (!Array.isArray(body?.documents)) {
    throw new Error('Resposta inválida ao listar documentos.');
  }
  return body.documents;
}

export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await request('/upload', {
    method: 'POST',
    body: formData,
    headers: { 'X-DMS-Request': '1' },
  });
  return response.json();
}

export async function downloadDocument(id) {
  const response = await request(`/documents/${encodeURIComponent(id)}/download`);
  return response.blob();
}
