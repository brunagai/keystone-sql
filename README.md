# AML SQL Lab

Laboratório local para praticar **SQL analítico aplicado à Prevenção à Lavagem de Dinheiro (PLD/AML)**. Você investiga um dataset sintético de transações PIX, escreve consultas para encontrar indícios de lavagem e recebe feedback semântico imediato — tudo no navegador, com SQLite em WebAssembly.

## Destaques

- **SQLite no navegador** (sql.js): banco em memória com 38 contas e 263 transações PIX fictícias, com casos plantados de smurfing, burst e incompatibilidade patrimonial.
- **Validação semântica**: compara o *resultado* da sua consulta com o gabarito, aceitando aliases, colunas em outra ordem e arredondamentos de até R$ 0,01. Os erros de SQL são explicados em português.
- **Agente Educador IA (BYOK)**: gera desafios inéditos com Groq ou OpenAI, com enquadramento na Circular Bacen 3.978/2020 e na Carta Circular 4.001/2020. Todo gabarito passa por um Sanity Check no SQLite. Sem chave, um gerador offline assume.
- **Experiência de estudo**: rascunho salvo por desafio, histórico das últimas execuções, gabarito comentado e exportação do dossiê em Markdown ou CSV.
- **Privacidade**: sem backend. A chave de API fica só no `localStorage` do navegador.

## Começando

```bash
npm install
npm run dev
```

Abra [http://localhost:5173](http://localhost:5173). Requer Node.js LTS recente.

| Script | Ação |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Typecheck + build de produção em `dist/` |
| `npm run preview` | Serve o build localmente |
| `npm run typecheck` | Checagem de tipos |
| `npm run generate:dataset` | Regenera o dataset sintético (determinístico) |

## Documentação

- 📘 [Guia do Usuário](docs/GUIA_DO_USUARIO.md) — como usar o laboratório, resolver desafios, configurar a IA e exportar dossiês.
- 🛠️ [Documentação Técnica](docs/DOCUMENTACAO_TECNICA.md) — arquitetura, banco, motor de validação, agente de IA, persistência e convenções.

## Stack

Vite · TypeScript (strict) · Tailwind CSS v4 (CDN) · sql.js · `fetch` nativo. Sem frameworks de UI.

## Aviso

Todos os dados são **100% sintéticos** e servem apenas para fins educacionais. Nomes, documentos e transações não pertencem a pessoas ou empresas reais.
