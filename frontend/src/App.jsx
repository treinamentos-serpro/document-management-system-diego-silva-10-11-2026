import { useEffect, useState } from 'react';
import DocumentList from './components/DocumentList.jsx';
import UploadComponent from './components/UploadComponent.jsx';
import { listDocuments } from './services/documents.js';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    listDocuments({ signal: controller.signal })
      .then(setDocuments)
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') {
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [version]);

  function refreshDocuments() {
    setVersion((current) => current + 1);
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Document Management System</h1>
      <UploadComponent onUpload={refreshDocuments} />
      <section aria-labelledby="documents-heading">
        <h2 id="documents-heading">Documentos</h2>
        {loading && <p role="status">Carregando documentos...</p>}
        {error && (
          <div role="alert">
            <p>Não foi possível carregar os documentos: {error}</p>
            <button type="button" onClick={refreshDocuments}>Tentar novamente</button>
          </div>
        )}
        {!loading && !error && <DocumentList documents={documents} />}
      </section>
    </main>
  );
}
