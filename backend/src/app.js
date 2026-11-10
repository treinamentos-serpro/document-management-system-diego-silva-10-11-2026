const express = require('express');
const multer = require('multer');
const documentRoutes = require('./routes/documents.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/', documentRoutes);

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: {
        code: 'FILE_TOO_LARGE',
        message: 'O arquivo excede o limite de tamanho permitido.',
      },
    });
  }

  if (
    error instanceof multer.MulterError
    || error.message.startsWith('Multipart:')
    || error.message === 'Unexpected end of form'
  ) {
    return res.status(400).json({
      error: {
        code: 'INVALID_MULTIPART',
        message: 'A requisição de upload é inválida.',
      },
    });
  }

  res.status(error.status || 500).json({
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.status ? error.message : 'Ocorreu um erro interno.',
    },
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`DMS backend ouvindo na porta ${PORT}`);
  });
}

module.exports = app;
