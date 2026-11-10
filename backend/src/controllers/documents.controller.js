const documentService = require('../services/documents.service');

function requireOwner(req, res, next) {
  const owner = req.user && req.user.id;
  if (typeof owner !== 'string' || owner.trim() === '') {
    return next(Object.assign(new Error('Usuário não autenticado.'), {
      status: 401,
      code: 'UNAUTHENTICATED',
    }));
  }
  req.documentOwner = owner;
  next();
}

async function upload(req, res) {
  if (!req.file) {
    return res.status(400).json({
      error: {
        code: 'FILE_REQUIRED',
        message: 'Envie um arquivo no campo file.',
      },
    });
  }

  const document = await documentService.upload(req.file, req.documentOwner);
  res.status(201).json(document);
}

async function list(req, res) {
  const documents = await documentService.list(req.documentOwner);
  res.json({ documents });
}

async function download(req, res, next) {
  const document = await documentService.getDownload(req.params.id, req.documentOwner);
  res.download(document.storagePath, document.originalName, (error) => {
    if (error && !res.headersSent) {
      next(error);
    }
  });
}

module.exports = { requireOwner, upload, list, download };