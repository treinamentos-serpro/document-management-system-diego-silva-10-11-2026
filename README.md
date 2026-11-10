# Document Management System com GitHub Copilot

<img src="https://octodex.github.com/images/Professortocat_v2.png" align="right" height="200px" />

Hey diegolinkk!

Mona here. I'm done preparing your exercise. Hope you enjoy! 💚

Remember, it's self-paced so feel free to take a break! ☕️

[![](https://img.shields.io/badge/Go%20to%20Exercise-%E2%86%92-1f883d?style=for-the-badge&logo=github&labelColor=197935)](https://github.com/treinamentos-serpro/document-management-system-diego-silva-10-11-2026/issues/1)

## Interface de documentos

Execute `npm install` em `backend/` e `frontend/`. Para executar localmente
com um usuário compartilhado, inicie o backend em `backend/` com
`npm run dev` e o frontend em
`frontend/` com `npm run dev`.
O servidor de desenvolvimento do Vite encaminha requisições `/api` ao backend
em `http://127.0.0.1:3000`. A interface permite enviar, listar e baixar arquivos;
após um envio, a lista é atualizada automaticamente.

O modo local não oferece autenticação nem isolamento entre usuários: qualquer
pessoa que consiga acessar a aplicação compartilhará os mesmos documentos.
Use-o apenas em desenvolvimento local, sem expor o servidor ou o proxy à rede.
Nesse modo, o backend escuta somente em `127.0.0.1` e exige
`NODE_ENV=development`, configurado automaticamente pelo comando `npm run dev`.
Fora desse comando, sem `DMS_LOCAL_USER=true`, os endpoints continuam
exigindo uma identidade confiável em `req.user.id` e respondem 401 até que
uma autenticação seja integrada.

Execute os testes com `npm test` em `backend/` e em `frontend/`.

---

&copy; 2025 GitHub &bull; [Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md) &bull; [MIT License](https://gh.io/mit)
