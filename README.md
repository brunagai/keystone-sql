# AML SQL Lab

Laboratório local para praticar **SQL analítico aplicado à Prevenção à Lavagem de Dinheiro (PLD/AML)**. Você investiga um dataset sintético de transações PIX, escreve consultas para encontrar indícios de lavagem e recebe feedback de esteira de risco — tudo no navegador, com SQLite em WebAssembly.

## Destaques

- **SQLite no navegador** (sql.js): banco em memória com 38 contas e transações PIX fictícias, com smurfing, burst, incompatibilidade patrimonial e cadastro **PEP** (`eh_pep` / `cargo_pep` em C013 e C004; C013 com escalada de originações em 27/08).
- **Trilha de 7 desafios base**: agregação, `ROW_NUMBER`, `LAG`, conta aquecida (CTE), **acúmulo móvel** (`ROWS BETWEEN`) e **escalada rápida em PEP** (escrutínio reforçado).
- **Validação semântica (esteira de risco)**: compara o *resultado* com o gabarito (aliases, ordem de colunas e ± R$ 0,01). Divergências viram auditoria (falsos negativos, ruído, fila de priorização). No acerto, o card mostra **Alertas Capturados / Falsos Positivos / Eficiência**. Window Function no `WHERE` explica a **ordem do compilador SQL**.
- **Agente Educador IA (BYOK)**: gera desafios inéditos com Groq ou OpenAI, com ferramental SQL amarrado ao nível (Iniciante sem `WITH`/janelas; Intermediário `ROW_NUMBER`/`RANK`; Avançado `LAG`/`LEAD` em CTE). Todo gabarito da IA passa por Sanity Check no SQLite. Sem chave, um gerador offline assume.
- **Experiência de estudo**: rascunho salvo por desafio, histórico das últimas execuções, gabarito comentado e exportação do dossiê em Markdown (com **parecer do analista** para COAF/arquivo) ou CSV.
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
