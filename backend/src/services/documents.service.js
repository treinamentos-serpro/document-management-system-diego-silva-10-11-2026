const { randomUUID } = require('node:crypto');
const documentRepository = require('../repositories/documents.repository');

async function upload(file, owner) {
  const document = {
    id: randomUUID(),
    originalName: file.originalname,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    owner,
  };

  try {
    await documentRepository.create(document, file.path);
  } catch (error) {
    await documentRepository.removeFile(file.path).catch(() => {});
    throw error;
  }

  return document;
}

function list(owner) {
  return documentRepository.findAllByOwner(owner);
}

async function getDownload(id, owner) {
  const document = await documentRepository.findByIdAndOwner(id, owner);
  if (!document || !(await documentRepository.fileExists(document.storagePath))) {
    throw Object.assign(new Error('Documento não encontrado.'), {
      status: 404,
      code: 'DOCUMENT_NOT_FOUND',
    });
  }
  return document;
}

module.exports = { upload, list, getDownload };