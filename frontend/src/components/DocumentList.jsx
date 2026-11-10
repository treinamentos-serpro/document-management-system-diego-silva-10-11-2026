import DownloadButton from './DownloadButton.jsx';

export default function DocumentList({ documents }) {
  if (documents.length === 0) {
    return <p>Nenhum documento encontrado.</p>;
  }

  return (
    <ul>
      {documents.map((document) => (
        <li key={document.id}>
          <span>{document.originalName}</span>{' '}
          <DownloadButton document={document} />
        </li>
      ))}
    </ul>
  );
}
