const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const multer = require('multer');

const documents = new Map();

function createUploadStorage(maxFileSize) {
  const storageDirectory = path.resolve(
    process.env.STORAGE_DIR || path.join(__dirname, '../../storage'),
  );
  const configuredStorageSize = Number(process.env.MAX_STORAGE_BYTES);
  const maxStorageSize = Number.isSafeInteger(configuredStorageSize) && configuredStorageSize > 0
    ? configuredStorageSize
    : 1024 * 1024 * 1024;
  let reservedBytes = 0;
  const storage = multer.diskStorage({
    destination(req, file, callback) {
      fs.mkdir(storageDirectory, { recursive: true })
        .then(() => callback(null, storageDirectory), callback);
    },
    filename(req, file, callback) {
      callback(null, randomUUID());
    },
  });
  return {
    _handleFile(req, file, callback) {
      reservedBytes += maxFileSize;
      const currentReservation = reservedBytes;
      fs.mkdir(storageDirectory, { recursive: true })
        .then(() => fs.readdir(storageDirectory, { withFileTypes: true }))
        .then(async (entries) => {
          let usedBytes = 0;
          for (const entry of entries) {
            if (entry.isFile()) {
              try {
                usedBytes += (await fs.stat(path.join(storageDirectory, entry.name))).size;
              } catch (error) {
                if (error.code !== 'ENOENT') throw error;
              }
            }
          }
          if (usedBytes + currentReservation > maxStorageSize) {
            throw Object.assign(new Error('Limite de armazenamento atingido.'), {
              code: 'STORAGE_FULL', status: 507,
            });
          }
        })
        .then(() => storage._handleFile(req, file, (error, info) => {
          reservedBytes -= maxFileSize;
          if (!error || !file.path) return callback(error, info);
          storage._removeFile(req, file, (cleanupError) => {
            if (cleanupError && cleanupError.code !== 'ENOENT') {
              console.error('Não foi possível remover o arquivo parcial:', cleanupError);
            }
            callback(error);
          });
        }))
        .catch((error) => {
          reservedBytes -= maxFileSize;
          callback(error);
        });
    },
    _removeFile: storage._removeFile.bind(storage),
  };
}

async function create(document, storagePath) {
  documents.set(document.id, { ...document, storagePath });
}

async function findAllByOwner(owner) {
  return Array.from(documents.values())
    .filter((document) => document.owner === owner)
    .sort((first, second) => second.uploadedAt.localeCompare(first.uploadedAt))
    .map(({ storagePath, ...document }) => document);
}

async function findByIdAndOwner(id, owner) {
  const document = documents.get(id);
  return document && document.owner === owner ? { ...document } : null;
}

async function fileExists(storagePath) {
  try {
    await fs.access(storagePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function removeFile(storagePath) {
  await fs.unlink(storagePath).catch((error) => {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  });
}

module.exports = {
  create, createUploadStorage, findAllByOwner, findByIdAndOwner, fileExists, removeFile,
};