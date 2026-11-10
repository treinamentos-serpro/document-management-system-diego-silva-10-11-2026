# Especificação - Document Management System

## 1. Objetivo

Permitir que usuários enviem, listem e baixem seus documentos, mantendo os arquivos no filesystem local da aplicação e os metadados em memória.

## 2. Escopo

### Dentro do escopo

- Upload de um documento por requisição.
- Listagem dos documentos associados ao usuário solicitante.
- Download de um documento pelo identificador, somente pelo respectivo proprietário.
- Registro de metadados em memória durante a execução do processo.
- Armazenamento dos arquivos no disco local da aplicação.
- Exposição de mensagens de erro previsíveis para requisições inválidas e recursos indisponíveis.

### Fora do escopo

- Armazenamento externo, em nuvem ou em serviços de terceiros.
- Versionamento, edição, compartilhamento ou exclusão de documentos.
- Persistência durável de metadados ou recuperação automática após reinicialização.
- Cadastro de usuários, autenticação e autorização completas. A identificação do usuário deverá ser fornecida por um contexto confiável já disponível na aplicação; a escolha e implementação desse mecanismo é uma decisão pendente antes da integração.
- Busca, paginação e filtros avançados.

## 3. Requisitos funcionais

| ID | Requisito |
| --- | --- |
| RF-01 | O usuário pode enviar um único arquivo por requisição multipart/form-data, no campo `file`. |
| RF-02 | O sistema valida que o arquivo foi enviado e respeita o limite de tamanho configurado. |
| RF-03 | O sistema gera um identificador único e um nome interno seguro para o arquivo; não usa o nome original como caminho no filesystem. |
| RF-04 | Após salvar o arquivo localmente, o sistema registra e retorna seus metadados, incluindo o proprietário associado ao contexto confiável do usuário. |
| RF-05 | O usuário pode listar somente os documentos associados à sua identidade. A lista é ordenada do mais recente para o mais antigo. |
| RF-06 | O usuário pode baixar um documento pelo identificador somente quando ele existir e pertencer ao usuário solicitante. |
| RF-07 | Se o registro dos metadados falhar depois da gravação do arquivo, o arquivo recém-gravado deve ser removido para evitar resíduos sem referência. |
| RF-08 | O sistema não deve revelar se um identificador inexistente pertence a outro usuário; ambos os casos retornam o mesmo resultado de não encontrado. |

## 4. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Os arquivos são gravados exclusivamente no filesystem local, em `backend/storage` por padrão, usando `multer` com `diskStorage`. Não utilizar armazenamento externo. |
| RNF-02 | Os metadados são mantidos em memória nesta fase. Uma reinicialização do processo remove os registros e não restaura a associação dos arquivos existentes. |
| RNF-03 | A configuração operacional deve ser feita por variáveis de ambiente, seguindo o princípio 12-Factor. |
| RNF-04 | O nome interno do arquivo deve ser gerado pelo servidor e o caminho físico não deve ser exposto na API. O nome original é metadado, nunca parte do caminho de gravação. |
| RNF-05 | O limite de tamanho do upload é configurável por `MAX_FILE_SIZE_BYTES`, com padrão de 10 MiB. O middleware de upload deve rejeitar arquivos acima desse limite. |
| RNF-06 | A API deve responder em JSON para operações e erros, exceto pelo conteúdo binário de download. Mensagens voltadas ao usuário devem estar em português. |
| RNF-07 | O backend deve manter dependências direcionadas de fora para dentro: `routes -> controllers -> services -> repositories`. Camadas internas não dependem de Express ou de detalhes HTTP. |

## 5. Modelo de dados (metadados do documento)

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `id` | string | Identificador único, imprevisível, gerado pelo servidor. |
| `originalName` | string | Nome original fornecido pelo cliente, tratado como dado de exibição e não como caminho. |
| `size` | number | Tamanho do arquivo em bytes. |
| `uploadedAt` | string | Data e hora do upload em ISO 8601 (UTC). |
| `owner` | string | Identificador do usuário obtido do contexto confiável da requisição. |

O caminho interno e o nome gerado para o arquivo são detalhes de persistência do repositório e não fazem parte da resposta pública da API.

## 6. Contratos de API

As rotas abaixo são caminhos do backend. No ambiente de desenvolvimento, o frontend pode acessá-las pelo prefixo `/api` configurado no proxy do Vite (por exemplo, `/api/upload` encaminha para `/upload`). Todas as rotas de documentos dependem de uma identidade de usuário confiável no contexto da requisição.

### POST `/upload`

- Entrada: `multipart/form-data` com exatamente um arquivo no campo `file`.
- Comportamento: validar arquivo e limite; gravar no diretório local; persistir os metadados em memória; associar o proprietário do contexto da requisição.
- Sucesso: `201 Created`.
- Corpo de sucesso:

```json
{
  "id": "identificador",
  "originalName": "relatorio.pdf",
  "size": 12345,
  "uploadedAt": "2026-11-10T12:00:00.000Z",
  "owner": "usuario-123"
}
```

- Erros: `400 Bad Request` para arquivo ausente ou requisição multipart inválida; `413 Payload Too Large` para arquivo acima do limite; `500 Internal Server Error` para falha inesperada de gravação ou processamento.

### GET `/documents`

- Entrada: identidade do usuário no contexto confiável da requisição; sem corpo.
- Comportamento: retornar somente documentos cujo `owner` corresponde ao usuário solicitante, do mais recente para o mais antigo.
- Sucesso: `200 OK`.
- Corpo de sucesso:

```json
{
  "documents": [
    {
      "id": "identificador",
      "originalName": "relatorio.pdf",
      "size": 12345,
      "uploadedAt": "2026-11-10T12:00:00.000Z",
      "owner": "usuario-123"
    }
  ]
}
```

- Lista vazia: `200 OK` com `"documents": []`.
- Erro: `500 Internal Server Error` para falha inesperada.

### GET `/documents/:id/download`

- Entrada: identificador na URL e identidade do usuário no contexto confiável da requisição.
- Comportamento: localizar o registro do usuário, verificar o arquivo local e transmiti-lo como anexo. Usar o nome original somente como nome sugerido para download, devidamente tratado para cabeçalho HTTP.
- Sucesso: `200 OK`, conteúdo binário, `Content-Disposition: attachment` e tipo de conteúdo apropriado; usar `application/octet-stream` quando não for possível determiná-lo.
- Erros: `404 Not Found` tanto para documento inexistente quanto para documento de outro usuário ou arquivo local ausente; `500 Internal Server Error` para outras falhas de leitura.

### Formato de erro

Erros JSON devem seguir o formato:

```json
{
  "error": {
    "code": "FILE_REQUIRED",
    "message": "Envie um arquivo no campo file."
  }
}
```

Os códigos são estáveis para consumo por clientes. Usar, conforme o caso, `FILE_REQUIRED`, `INVALID_MULTIPART`, `FILE_TOO_LARGE`, `DOCUMENT_NOT_FOUND` e `INTERNAL_ERROR`. Detalhes internos, caminhos locais e stack traces não devem ser incluídos na resposta.

## 7. Decisões arquiteturais

- Backend em Node.js e Express, CommonJS, organizado em `routes`, `controllers`, `services` e `repositories`.
- `routes` registram os endpoints e middleware de transporte, incluindo a configuração de upload com `multer`.
- `controllers` traduzem requisições e respostas HTTP, obtêm a identidade do contexto confiável e aplicam validações de entrada próprias da borda HTTP.
- `services` concentram as regras de negócio: associação ao proprietário, ordenação, autorização de acesso e coordenação do upload/download.
- `repositories` cuidam dos metadados em memória e do acesso ao filesystem local. O nome/caminho interno gerado permanece restrito a essa camada.
- Frontend em React, com componentes e chamadas `fetch` usando o prefixo `/api` do proxy do Vite.
- Configuração do servidor por variáveis de ambiente: `PORT` (padrão `3000`), `STORAGE_DIR` (padrão `backend/storage`) e `MAX_FILE_SIZE_BYTES` (padrão `10485760`). O caminho de armazenamento deve permanecer local à aplicação.
- A autenticação e a forma de fornecer a identidade confiável do usuário são uma dependência a decidir; não aceitar um identificador arbitrário enviado pelo cliente como prova de identidade.
- Para desenvolvimento local, `DMS_LOCAL_USER=true` com `NODE_ENV=development` habilita uma identidade fixa compartilhada e restringe o servidor a `127.0.0.1`. Esse modo não autentica usuários nem fornece isolamento e não deve ser exposto à rede.
- Os metadados em memória são voláteis. A divergência entre arquivos persistidos no disco e metadados perdidos após reinicialização é uma limitação conhecida desta fase.

## 8. Plano de execução

Etapas de alto nível para uma futura implementação. Este documento não especifica nem executa alterações em arquivos de backend ou frontend.

1. Confirmar a origem confiável da identidade do usuário e as políticas operacionais de upload, incluindo limite de tamanho e comportamento para arquivos não encontrados no disco.
2. Implementar os contratos e regras da API no backend, mantendo a separação entre rotas, controllers, services e repositories e o armazenamento local com `multer`/`diskStorage`.
3. Validar o backend com testes de upload, listagem por proprietário, download autorizado, entradas inválidas, limites e falhas de filesystem.
4. Implementar no frontend os fluxos de envio, listagem, estados vazios/erro e download, consumindo a API pelo prefixo `/api`.
5. Executar validação integrada dos fluxos ponta a ponta e revisar configuração, mensagens e limites antes da entrega.
