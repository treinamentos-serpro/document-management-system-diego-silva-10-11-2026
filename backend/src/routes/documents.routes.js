const express = require('express');
const multer = require('multer');
const { rateLimit } = require('express-rate-limit');
const documentController = require('../controllers/documents.controller');
const documentRepository = require('../repositories/documents.repository');

const router = express.Router();
const configuredFileSize = Number(process.env.MAX_FILE_SIZE_BYTES);
const maxFileSize = Number.isSafeInteger(configuredFileSize) && configuredFileSize > 0
  ? configuredFileSize
  : 10 * 1024 * 1024;

const upload = multer({
  storage: documentRepository.createUploadStorage(maxFileSize),
  limits: { fileSize: maxFileSize, files: 1, fields: 0, parts: 2 },
});
const configuredUploadLimit = Number(process.env.UPLOAD_RATE_LIMIT);
const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number.isSafeInteger(configuredUploadLimit) && configuredUploadLimit > 0
    ? configuredUploadLimit
    : 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Limite de envios atingido. Tente novamente mais tarde.' } },
});

function requireMultipart(req, res, next) {
  if (!req.is('multipart/form-data')) {
    return next(Object.assign(new Error('Envie uma requisição multipart/form-data.'), {
      status: 400,
      code: 'INVALID_MULTIPART',
    }));
  }
  next();
}

router.use((req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  next();
});

router.post(
  '/upload',
  documentController.requireOwner,
  uploadRateLimit,
  requireMultipart,
  upload.single('file'),
  documentController.upload,
);
router.get('/documents', documentController.requireOwner, documentController.list);
router.get('/documents/:id/download', documentController.requireOwner, documentController.download);

module.exports = router;