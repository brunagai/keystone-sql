# AML SQL Lab — Guia do Usuário

Bem-vinda ao **AML SQL Lab**, um laboratório para praticar **SQL analítico aplicado à Prevenção à Lavagem de Dinheiro (PLD/AML)**. Você investiga transações PIX fictícias, escreve consultas SQL para encontrar indícios de lavagem e recebe feedback de **esteira de risco** (alertas perdidos, ruído operacional, fila de priorização), como numa área de compliance de verdade.

Tudo roda **no seu navegador**: o banco de dados é criado na memória do computador, e nada do que você escreve é enviado para servidores (exceto, se você quiser, os pedidos de desafios ao provedor de IA que você configurar).

---

## Sumário

1. [Como abrir o laboratório](#1-como-abrir-o-laboratório)
2. [Conhecendo a tela](#2-conhecendo-a-tela)
3. [Resolvendo seu primeiro desafio](#3-resolvendo-seu-primeiro-desafio)
4. [Entendendo o feedback](#4-entendendo-o-feedback)
5. [Gerando novos desafios com IA](#5-gerando-novos-desafios-com-ia)
6. [Configurando a IA (Groq ou OpenAI)](#6-configurando-a-ia-groq-ou-openai)
7. [Rascunhos: seu trabalho não se perde](#7-rascunhos-seu-trabalho-não-se-perde)
8. [Histórico de execuções](#8-histórico-de-execuções)
9. [Exportando o dossiê](#9-exportando-o-dossiê)
10. [Atalhos de teclado](#10-atalhos-de-teclado)
11. [Perguntas frequentes e problemas comuns](#11-perguntas-frequentes-e-problemas-comuns)
12. [Glossário de PLD](#12-glossário-de-pld)

---

## 1. Como abrir o laboratório

Você precisa do **Node.js** instalado (versão LTS recente) e de conexão com a internet na primeira abertura (os estilos visuais são carregados de uma CDN).

No terminal, dentro da pasta do projeto:

```bash
npm install     # só na primeira vez
npm run dev
```

Depois abra **http://localhost:5173** no navegador (Chrome, Edge ou Firefox atualizados).

Quando o canto superior esquerdo mostrar **● WASM conectado** em verde, o banco está pronto. Ao lado aparecem os contadores: **38 contas** e **263 transações**.

---

## 2. Conhecendo a tela

A tela é dividida em um cabeçalho e três painéis.

### Cabeçalho

- **WASM conectado / carregando / indisponível** — estado do banco de dados.
- **contas / transações** — quantas linhas existem em cada tabela.
- **⚙ Configurar IA (Groq / OpenAI)** — conecta o agente a uma IA. A bolinha fica **verde** quando há uma chave salva e **cinza** no modo offline.
- **Resetar Banco** — recria o banco original. Use se você alterou ou apagou dados sem querer.

### Painel 1 — Dicionário de Dados (esquerda)

Mostra as duas tabelas do banco:

- **`contas`** — o cadastro dos clientes (nome, PF/PJ, ocupação, **renda mensal declarada**, banco, chave PIX, cidade, data de abertura).
- **`transacoes_pix`** — as transferências (conta de origem, conta de destino, **valor**, **data e hora**, canal: APP, INTERNET_BANKING ou API).

Dicas:

- **Clique no nome de uma coluna** para inseri-lo no editor, na posição do cursor.
- Os selos indicam: **PK** (chave primária), **FK** (chave estrangeira, com a tabela de referência) e **NN** (não pode ser vazio).
- Abra **▶ Pré-visualizar 3 primeiras linhas** para ver exemplos reais dos dados.

### Painel 2 — Editor SQL e Resultados (centro)

- No **editor**, você escreve as consultas.
- **▶ Executar Query** (ou **Ctrl+Enter**) roda a consulta inteira — ou só o trecho selecionado.
- **Testar Seleção / CTE** — selecione o miolo do `WITH` (a CTE, mesmo sem o `SELECT` externo) para inspecionar os dados intermediários antes de filtrar. O botão acende quando há texto selecionado.
- **Validar Desafio** compara seu resultado com o gabarito do desafio selecionado.
- **🕘 Histórico** mostra as últimas consultas executadas.
- **⤓ Exportar Dossiê** baixa sua evidência em Markdown ou CSV.

Valores em reais aparecem formatados como **R$ 9.850,00** e datas como **dd/mm/aaaa hh:mm:ss**.

### Painel 3 — Investigação Regulatória (direita)

- **✨ Agente Educador IA** — cria novos desafios.
- **Cenário investigativo** — escolha o caso a investigar.
- Para cada caso você vê o **enquadramento regulatório** (selo âmbar), o **Contexto da Denúncia / Dossiê**, o **Objetivo da Análise SQL** (o que sua consulta deve retornar e em que ordem) e a **Dica de Sintaxe SQL** (abra só se precisar).
- Nos níveis 3, 4 e nos desafios gerados, o card **Decomposição em 2 Fases (Esteira Analítica)** mostra o raciocínio: (1) o envelope `WITH` que carimba métricas linha a linha e (2) o `WHERE` externo que aplica o corte regulatório.
- Abaixo aparecem o **feedback da validação** (vocabulário de esteira: falsos negativos, ruído, ordem do compilador) e, depois da primeira tentativa, o **Ver Gabarito Comentado**.

---

## 3. Resolvendo seu primeiro desafio

1. No Painel 3, escolha um cenário — por exemplo, **1.1 · Smurfing para a receptora Aurora (C025)**.
2. Leia o **Objetivo da Análise SQL** com atenção: ele diz quais **colunas** retornar e qual **ordenação** usar.
3. Escreva sua consulta no editor. Use o Painel 1 para lembrar os nomes das colunas.
4. Pressione **Ctrl+Enter** para conferir o resultado enquanto escreve.
5. Quando achar que está certo, clique em **Validar Desafio**.
6. Leia o feedback. Se errar, ajuste e valide de novo — não há limite de tentativas.
7. Depois de tentar, você pode abrir **Ver Gabarito Comentado** para comparar com a solução de referência e clicar em **Abrir gabarito no editor** para estudá-la.

> **Dica:** se você selecionar um trecho do editor, apenas esse trecho é executado. Útil para testar uma subconsulta isoladamente.

### A trilha de aprendizagem

Os desafios estão organizados em **níveis progressivos**: cada nível introduz uma técnica de SQL nova, aplicada a uma tipologia de lavagem. No seletor de cenários, os desafios aparecem agrupados por nível e numerados (1.1, 1.2, 2.1…). No cartão do desafio, o selo **N1** a **N5** mostra o nível e a técnica-alvo. A sugestão é seguir a ordem.

| Nível | Técnica | Desafio | O que investigar |
| --- | --- | --- | --- |
| **1 — Fundamentos de Agregação** | `GROUP BY`, `HAVING`, `JOIN` | **1.1 Smurfing** | Remetentes que enviaram várias transferências logo abaixo de R$ 10 mil para a mesma empresa |
| | | **1.2 Incompatibilidade patrimonial** | Transferências de valor muito acima da renda declarada do titular |
| **2 — Janelas e Classificação** | `ROW_NUMBER()` | **2.1 Pico individual por conta** | O maior PIX de cada conta no dia 18/08, com quantas operações e quanto cada uma movimentou no dia (atenção ao empate!) |
| **3 — Análise Temporal** | `LAG` / `LEAD` | **3.1 Burst / alta frequência** | Transferências feitas com segundos de diferença pela mesma conta |
| **4 — Composição com CTEs** | `WITH` + janelas | **4.1 Conta "aquecida"** | Contas que fazem PIX de teste de poucos reais e, dias depois, movimentam valores dezenas de vezes maiores |
| | `ROWS BETWEEN` | **4.2 Acúmulo móvel (3 PIX)** | Soma móvel das últimas 3 originações ≥ R$ 25 mil (estruturação em janela) |
| **5 — Laboratório Aberto** | Livre | Desafios gerados pelo agente | Casos inéditos criados pela IA (ou pelo gerador offline) |

---

## 4. Entendendo o feedback (modo Investigador / esteira de risco)

O validador não exige que sua consulta seja **igual** ao gabarito: compara o **resultado**. As mensagens falam a língua de uma **esteira de monitoramento PLD** — o analista que decide o que entra na fila de alertas.

| Cor | Significado |
| --- | --- |
| 🟢 **Sucesso** | A esteira capturou os mesmos alertas do gabarito. Aparecem as entidades encontradas e, às vezes, dicas de boas práticas |
| 🟡 **Parcial** | Quase lá: por exemplo, os registros estão certos mas a **fila de priorização** (`ORDER BY`) não, ou alguma **métrica** calculada difere; também aparece se a esteira voltou **vazia** (filtros restritivos demais) |
| 🔴 **Inconsistência** | Filtro, colunas, entidades diferentes do gabarito, ou um **erro de SQL** (incluindo Window Function no lugar errado) |

O que o validador **aceita**:

- **Nomes de colunas diferentes** (aliases): se os valores conferem, está certo.
- **Colunas em outra ordem**.
- **Diferenças de arredondamento** de até **R$ 0,01**.
- **Colunas extras** (com uma sugestão de removê-las).

### Alertas perdidos e ruído operacional

Quando a **quantidade de linhas** (ou as contas/IDs) não bate:

| O que aconteceu | Como o Lab descreve | O que revisar |
| --- | --- | --- |
| Faltaram linhas do gabarito | **Falsos negativos** — a esteira capturou X transações, mas deixou escapar Y alerta(s) regulatório(s) (ex.: `C031`) | Filtros de **data**, **intervalo em segundos** ou **limiar de valor** restritivos demais (`>=` vs `>`, `BETWEEN` inclusivo) |
| Vieram linhas a mais | **Falsos positivos** — ruído de monitoramento: transações que não passam no corte do cenário | Faltou filtro no **`WHERE` externo** (depois do `WITH`) ou a **janela temporal** está larga demais |
| Faltaram e sobraram | Os dois textos juntos | O recorte pegou um conjunto diferente do gabarito |

A dica SQL específica do desafio (por exemplo, “particionar só por origem”) continua aparecendo **abaixo** dessa explicação.

### Fila de priorização

Se os **mesmos** registros estão lá, mas em outra ordem, o Lab avisa que a **fila de priorização da esteira está desalinhada**. Em PLD, a ordem importa: os casos mais graves devem aparecer primeiro. Ajuste o `ORDER BY` exatamente como o objetivo pede (incluindo o desempate).

### Ordem do compilador SQL (Window Functions)

O SQLite **não deixa** filtrar `LAG()`, `ROW_NUMBER()` ou qualquer `OVER (...)` direto no `WHERE` do mesmo `SELECT` — o `WHERE` corre **antes** de o `SELECT` calcular a janela. Se você tentar, o feedback destaca:

> **⚠️ Ordem de Execução do Compilador SQL**  
> Envelope o cálculo em `WITH envelope_metricas AS (...)` (**Fase 1**) e aplique o corte regulatório no `WHERE` **externo** (**Fase 2**).

Isso é o mesmo raciocínio do card **Decomposição em 2 Fases** nos níveis 3, 4 e nos desafios gerados. Use **Testar Seleção / CTE** para inspecionar o envelope antes do corte.

> A validação aceita apenas consultas de leitura (`SELECT` / `WITH`). Para experimentar `INSERT`, `UPDATE` ou `DELETE`, use **Executar Query** e depois **Resetar Banco**.

---

## 5. Gerando novos desafios com IA

1. No Painel 3, em **✨ Agente Educador IA**, escolha o **Foco da tipologia** (ou "Livre") e a **Dificuldade**:
   - **Iniciante** — `GROUP BY`, `HAVING` e `WHERE` (sem `WITH` e sem funções de janela).
   - **Intermediário** — `WITH` + `ROW_NUMBER()` / `RANK()` para ranquear e cortar (maior PIX, top-N). O gabarito da IA vem comentado em **Fase 1 (envelope)** e **Fase 2 (inspetor)**.
   - **Avançado** — `WITH` + `LAG()`/`LEAD()` (burst, intervalo entre PIX) e corte no `WHERE` externo, no mesmo esquema de duas fases.
2. Clique em **✨ Gerar Novo Desafio com IA**.
3. Acompanhe as mensagens: o agente analisa as tipologias do Bacen e o dataset, redige o caso e roda um **Sanity Check** — executa o gabarito no banco para garantir que ele funciona e encontra evidências.
4. Quando terminar, o desafio aparece no grupo **"Nível 5 — Laboratório Aberto (Agente IA)"** do seletor, já selecionado, e o editor recebe um **template comentado** com o título, o objetivo, as colunas esperadas e a ordenação. É só começar a escrever depois do `SELECT`.

Focos disponíveis: fracionamento/smurfing, alta frequência/burst, incompatibilidade patrimonial, conta de passagem, concentração/dispersão (fan-in/fan-out), horário e canal atípicos e valores redondos.

**Sem chave de IA?** Tudo bem: o agente usa um **gerador offline** com modelos de desafios prontos e parâmetros variados. Com uma chave, os desafios ficam inéditos e mais variados.

Outras informações:

- Você pode **Cancelar** a geração a qualquer momento.
- Se a IA falhar (sem internet, chave inválida, limite atingido), o agente avisa o motivo e usa o gerador offline.
- Desafios gerados ficam salvos no navegador (até 20). Para apagar um, selecione-o e clique em **Remover desafio**.
- Desafios gerados são validados exatamente como os casos base, inclusive com o gabarito comentado.

---

## 6. Configurando a IA (Groq ou OpenAI)

1. Clique em **⚙ Configurar IA (Groq / OpenAI)** no cabeçalho.
2. Escolha o **Provedor**:
   - **Groq** — tem plano gratuito. Crie a chave em [console.groq.com/keys](https://console.groq.com/keys). Chaves começam com `gsk_`. Modelo padrão: `llama-3.3-70b-versatile`.
   - **OpenAI** — pago por uso. Crie a chave em [platform.openai.com/api-keys](https://platform.openai.com/api-keys). Chaves começam com `sk-`. Modelo padrão: `gpt-4o-mini`.
3. Cole a **API Key** (o campo fica oculto; use **Mostrar** para conferir).
4. Clique em **Testar conexão** para verificar a chave e o modelo.
5. Clique em **Salvar**. A bolinha do botão fica verde.

Para voltar ao modo offline, abra o mesmo modal e clique em **Remover chave**.

> 🔒 **Privacidade:** a chave fica guardada **somente neste navegador** e é enviada apenas ao provedor que você escolheu. Ela não vai para nenhum servidor do AML SQL Lab. Recomendamos configurar um limite de gastos na sua conta do provedor e não usar a ferramenta em computadores compartilhados com a chave salva.

---

## 7. Rascunhos: seu trabalho não se perde

Cada desafio guarda **o seu próprio rascunho** automaticamente, enquanto você digita.

- Ao **trocar de desafio** e voltar depois, sua consulta daquele desafio é restaurada.
- Os rascunhos continuam lá mesmo se você **fechar e reabrir** o navegador.
- Se você tiver uma consulta em andamento e abrir um desafio **ainda não iniciado** (ou gerar um novo), aparece um aviso no topo do editor:

  > ⚠ Você tem uma query em andamento. Deseja carregar o template de "…"?
  > **[Substituir]** **[Manter minha query]**

  - **Substituir** — sua consulta fica guardada como rascunho do desafio anterior, e o editor recebe o template do novo desafio.
  - **Manter minha query** — sua consulta continua no editor, agora associada ao novo desafio (útil para reaproveitar uma consulta). Pressionar **Esc** no aviso tem o mesmo efeito.

Para começar um desafio do zero, apague o conteúdo do editor: o template volta na próxima vez que você abrir aquele desafio.

---

## 8. Histórico de execuções

Clique em **🕘 Histórico** na barra do editor para ver as **últimas 10 consultas** executadas nesta sessão (incluindo as validadas).

Cada item mostra o início da consulta, o horário, se deu certo (✓ e o número de linhas) ou errado (✕), o tempo e o desafio em que foi executada.

- **Clique** em um item (ou use as **setas** e **Enter**) para carregá-lo no editor.
- Mudou de ideia? **Ctrl+Z** desfaz e traz de volta o que estava antes.
- O histórico é apagado quando você recarrega a página. Os rascunhos, não.

---

## 9. Exportando o dossiê

Depois de executar ou validar uma consulta **com sucesso**, clique em **⤓ Exportar Dossiê (CSV / Markdown)** na barra de resultados e escolha o formato:

- **Markdown (.md)** — relatório legível, ótimo para guardar anotações ou compartilhar (abre no VS Code, Obsidian, GitHub, Notion…).
- **CSV (.csv)** — para abrir em planilhas (Excel, Google Sheets, LibreOffice).

O arquivo contém o **ID do caso**, o **enquadramento regulatório BACEN**, a origem do desafio, a data e hora, a **consulta SQL executada** e a **tabela com as linhas de evidência**.

> **Excel em português:** se as colunas aparecerem todas juntas numa só, abra pelo menu **Dados → De Texto/CSV** e escolha **vírgula** como separador. A célula da consulta pode começar com um apóstrofo (`'`); ele é proposital e impede que o Excel interprete o texto como fórmula.

O botão fica desabilitado enquanto não houver um resultado válido (por exemplo, logo após um erro de SQL), para que você não exporte uma evidência antiga por engano.

---

## 10. Atalhos de teclado

| Atalho | Onde | Ação |
| --- | --- | --- |
| **Ctrl+Enter** | Editor | Executa a consulta inteira, ou só o trecho selecionado (útil para inspecionar a CTE) |
| **Tab** | Editor | Indenta com 2 espaços |
| **Ctrl+Z** | Editor | Desfaz (inclusive após carregar do histórico ou o gabarito) |
| **Esc** | Histórico, exportação, aviso do editor, modal de IA | Fecha / mantém sua query |
| **↑ / ↓** e **Enter** | Histórico | Navega e escolhe uma consulta |

---

## 11. Perguntas frequentes e problemas comuns

**Aparece "WASM indisponível".**
O arquivo do banco não foi encontrado. Pare o servidor, rode `npm install` (ou `node scripts/copy-wasm.mjs`) e depois `npm run dev` de novo.

**A tela aparece sem cores/estilo.**
Os estilos vêm da internet. Verifique a conexão e recarregue a página.

**Apaguei ou alterei dados sem querer.**
Clique em **Resetar Banco**. O banco volta ao estado original (seus rascunhos são mantidos).

**Minha consulta está certa, mas a fila de priorização está desalinhada (antes: "ordenação divergente").**
Os registros batem com o gabarito; falta só o `ORDER BY` do objetivo, inclusive o desempate (por exemplo, `ORDER BY valor_total DESC, conta_origem`).

**Apareceu "falsos negativos" ou "deixou escapar alertas".**
Sua esteira filtrou demais. Confira datas inclusivas, `>=` / `<=` e se o `HAVING` ou o `WHERE` externo não está mais apertado que o enunciado. O feedback lista contas ou IDs que faltaram (ex.: `C031`).

**Apareceu "falsos positivos" ou "ruído de monitoramento".**
Sua esteira filtrou de menos. Falta um corte no `WHERE` externo (posição, intervalo, limiar) ou a janela temporal está larga. O feedback lista o que entrou a mais.

**Deu "⚠️ Ordem de Execução do Compilador SQL".**
Você tentou usar `LAG`, `ROW_NUMBER` ou `OVER (...)` no `WHERE` (ou no `HAVING`) do mesmo `SELECT`. Calcule a métrica numa CTE (`WITH envelope_metricas AS (...)`) e filtre no `SELECT` de fora. Nos níveis 3 e 4, o card **Decomposição em 2 Fases** descreve exatamente isso.

**Deu "Divergência nas métricas calculadas".**
As linhas estão certas, mas algum cálculo não. Verifique `SUM`/`COUNT`, o `ROUND(..., 2)` e se o filtro do `WHERE` está antes da agregação.

**A IA não gera o desafio.**
Use **Testar conexão** no modal. Mensagens comuns: chave recusada (confira se copiou inteira e se o provedor está certo), limite de requisições (aguarde um pouco) ou falta de internet. Em todos os casos, o agente entrega um desafio offline.

**Posso usar sem internet?**
Depois que a página estiver aberta, sim — exceto a geração com IA, que cai automaticamente no modo offline.

**Os dados são reais?**
Não. Todos os nomes, documentos e transações são **fictícios**, criados para fins educacionais.

---

## 12. Glossário de PLD

| Termo | Significado |
| --- | --- |
| **PLD/FT** | Prevenção à Lavagem de Dinheiro e ao Financiamento do Terrorismo |
| **COAF** | Conselho de Controle de Atividades Financeiras, que recebe as comunicações de operações suspeitas |
| **Circular Bacen 3.978/2020** | Norma que define a política de PLD/FT das instituições, a abordagem baseada em risco e o conhecimento do cliente |
| **Carta Circular Bacen 4.001/2020** | Lista exemplos de operações e situações que podem indicar lavagem de dinheiro |
| **KYC** | *Know Your Customer*: conhecer o cliente, incluindo renda e atividade declaradas |
| **Smurfing / fracionamento** | Dividir um valor alto em várias operações menores, logo abaixo de limites de monitoramento |
| **Burst / alta frequência** | Muitas operações em intervalo muito curto, típico de automação ou de tentativa de dispersar recursos |
| **Layering (camadas)** | Passar o dinheiro por várias contas para dificultar o rastreamento da origem |
| **Conta de passagem** | Conta que recebe e repassa quase tudo rapidamente, sem reter saldo |
| **Fan-in / fan-out** | Muitas origens concentrando em uma conta (fan-in) ou uma conta dispersando para muitas (fan-out) |
| **Incompatibilidade patrimonial** | Movimentação incompatível com a renda, o faturamento ou a ocupação declarados |
| **Laranja** | Pessoa cuja conta é usada para movimentar recursos de terceiros |
| **Esteira de risco** | Fila de monitoramento: primeiro carimbar métricas (envelope), depois cortar o que vira alerta (inspetor) |
| **Falso negativo** | Alerta legítimo que a esteira **não** capturou |
| **Falso positivo / ruído** | Transação que **não** deveria virar alerta e mesmo assim entrou na fila |
