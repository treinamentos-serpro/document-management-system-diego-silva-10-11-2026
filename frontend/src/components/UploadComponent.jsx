import { useState } from 'react';
import { uploadDocument } from '../services/documents.js';

export default function UploadComponent({ onUpload }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file || uploading) return;

    const form = event.currentTarget;
    setUploading(true);
    setError('');
    setSuccess('');

    try {
      await uploadDocument(file);
      form.reset();
      setFile(null);
      setSuccess('Documento enviado com sucesso.');
      onUpload();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <section aria-labelledby="upload-heading">
      <h2 id="upload-heading">Enviar documento</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="document-file">Arquivo</label>{' '}
        <input
          id="document-file"
          type="file"
          required
          disabled={uploading}
          onChange={(event) => {
            setFile(event.target.files[0] || null);
            setError('');
            setSuccess('');
          }}
        />{' '}
        <button type="submit" disabled={!file || uploading}>
          {uploading ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
      {error && <p role="alert">Não foi possível enviar o documento: {error}</p>}
      {success && <p role="status">{success}</p>}
    </section>
  );
}
