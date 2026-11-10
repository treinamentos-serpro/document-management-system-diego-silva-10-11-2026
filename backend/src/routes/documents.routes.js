const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');
const documentController = require('../controllers/documents.controller');

const router = express.Router();
const storageDirectory = path.resolve(
  process.env.STORAGE_DIR || path.join(__dirname, '../../storage'),
);
const configuredFileSize = Number(process.env.MAX_FILE_SIZE_BYTES);
const maxFileSize = Number.isSafeInteger(configuredFileSize) && configuredFileSize > 0
  ? configuredFileSize
  : 10 * 1024 * 1024;

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, callback) {
      fs.mkdir(storageDirectory, { recursive: true }, (error) => {
        callback(error, storageDirectory);
      });
    },
    filename(req, file, callback) {
      callback(null, `${require('node:crypto').randomUUID()}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: maxFileSize, files: 1 },
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

router.post(
  '/upload',
  documentController.requireOwner,
  requireMultipart,
  upload.single('file'),
  documentController.upload,
);
router.get('/documents', documentController.requireOwner, documentController.list);
router.get('/documents/:id/download', documentController.requireOwner, documentController.download);

module.exports = router;