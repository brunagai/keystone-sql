# AML SQL Lab

Laboratório local para praticar **SQL analítico aplicado à Prevenção à Lavagem de Dinheiro (PLD/AML)**. Você investiga um dataset sintético de transações PIX, escreve consultas para encontrar indícios de lavagem e recebe feedback de esteira de risco — tudo no navegador, com SQLite em WebAssembly.

## Destaques

- **SQLite no navegador** (sql.js): banco em memória com **2 tabelas** (`contas` e `transacoes_pix`), 38 contas e PIX fictícios (smurfing, burst, incompatibilidade, PEP, coação noturna C005→C032, account takeover e valores redondos). A IA **não** cria tabelas novas.
- **Trilha de 8 desafios base**, incluindo **3.2 Transferência noturna sob coação** (`strftime` / Res. BCB 142), mais desafios gerados no nível 5.
- **Layout de estudo em duas colunas**: missão à esquerda (**O que fazer**) e editor + resultados à direita (**Mão na massa**). O dicionário abre em gaveta, sem sair do caso.
- **Validação semântica (esteira de risco)**: compara o *resultado* com o gabarito (aliases, ordem de colunas e ± R$ 0,01). Divergências viram auditoria (falsos negativos, ruído, fila de priorização). No acerto, o card mostra **Alertas Capturados / Falsos Positivos / Eficiência**. Window Function no `WHERE` explica a **ordem do compilador SQL**.
- **Agente Educador IA (BYOK)**: 15 tipologias em 4 blocos (coação/furto, invasão digital, laranjas/mulas, Carta Circular 4.001), com corte SQL por padrão e ferramental amarrado ao nível. Sem chave, gerador offline nos focos clássicos.
- **Experiência de estudo**: rascunho salvo por desafio, histórico das últimas execuções, gabarito comentado, tour de onboarding e exportação do dossiê em Markdown (com **parecer do analista** para COAF/arquivo) ou CSV.
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
