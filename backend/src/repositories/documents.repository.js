const fs = require('node:fs/promises');

const documents = new Map();

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

module.exports = { create, findAllByOwner, findByIdAndOwner, fileExists, removeFile };