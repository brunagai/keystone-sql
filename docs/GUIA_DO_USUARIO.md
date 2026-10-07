# AML SQL Lab — Guia do Usuário

Bem-vinda ao **AML SQL Lab**, um laboratório para praticar **SQL analítico aplicado à Prevenção à Lavagem de Dinheiro (PLD/AML)**. Você investiga transações PIX fictícias, escreve consultas SQL para encontrar indícios de lavagem e recebe feedback de **esteira de risco** (alertas perdidos, ruído operacional, fila de priorização), como numa área de compliance de verdade.

Tudo roda **no seu navegador**: o banco de dados é criado na memória do computador, e nada do que você escreve é enviado para servidores (exceto, se você quiser, os pedidos de desafios ao provedor de IA que você configurar).

---

## Sumário

1. [Como abrir o laboratório](#1-como-abrir-o-laboratório)
2. [Conhecendo a tela](#2-conhecendo-a-tela)
3. [Resolvendo seu primeiro desafio](#3-resolvendo-seu-primeiro-desafio)
4. [Entendendo o feedback](#4-entendendo-o-feedback-modo-investigador--esteira-de-risco)
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

Quando o canto superior esquerdo mostrar **● Online** em verde, o banco está pronto. As **cinco tabelas** e as contagens de linhas ficam no **Dicionário de Dados & Tabelas**, aberto por **📊 Consultar Tabelas Disponíveis**.

Se você atualizou o gerador (QSA, telemetria, produtos, PEP, etc.), rode **`npm run generate:dataset`** e **recarregue a página**: o SQLite vive só na memória e volta ao JSON (`versao` **1.4.0**) a cada carga.

---

## 2. Conhecendo a tela

No **desktop**, a tela é um laboratório em **duas colunas**: missão à esquerda e editor + resultados à direita. No **celular**, a página rola em um único fluxo (briefing + editor); o dossiê abre em modal e os resultados em uma gaveta inferior. O agente de IA abre em **gaveta**.

### Cabeçalho

- **● Online / Carregando / Offline** — estado do SQLite (WebAssembly) no navegador.
- **Progresso da trilha** — quantos desafios você já aprovou; **Zerar** limpa essa marca (não apaga rascunhos).
- **Filtro da trilha** — **Todos**, **Iniciante** (níveis 0–1), **Intermediário** (2–3) ou **Avançado** (4–5).
- **Seletor de caso** — o desafio ativo (na primeira carga: **Reconhecimento Cadastral: Listagem de Clientes**).
- **🤖 Agente IA** — gera novos desafios e abre a configuração da chave.
- **❓ Entenda o Laboratório** — reabre o tour guiado.

### Coluna esquerda — O que fazer

No desktop, redimensionável (arraste a faixa entre as colunas; no celular essa faixa **não aparece**). A ordem do painel é:

- o card **Sua Missão** (regra de negócio, sem cláusulas SQL);
- o **dossiê / contexto regulatório** (norma + narrativa do caso);
- o atalho **📊 Consultar Tabelas Disponíveis** (primeira ação após o dossiê);
- o **Contrato de Entrega do Relatório** (aliases esperados, sempre visíveis);
- **💡 Revelar Dica de SQL** — acordeão **fechado** por padrão (evita spoiler de sintaxe);
- nos níveis avançados, a **decomposição em 2 fases** fica dentro da dica;
- depois da primeira validação, **Ver gabarito comentado** (também recolhido).

No celular, o mesmo conteúdo abre em **📋 Ver Dossiê & Contrato de Colunas**. O título do caso fica **abaixo** da badge de nível, por extenso.

### Coluna direita — Editor e resultados

- **Editor SQL**, com esqueleto comentado do nível (sem gabarito embutido).
- **▶ Rodar Teste** — executa a consulta em **modo exploratório** (mostra a tabela e um aviso: ainda não pontua). No celular, os resultados sobem numa gaveta.
- **✓ Validar Resposta** — submete o resultado à esteira AML (compara com o gabarito).
- **↺ Restaurar Modelo Inicial** — recoloca o esqueleto SQL deste desafio.
- **🕘 Histórico** — últimas 10 execuções desta sessão (o menu começa fechado).
- **Resultados** — banner de validação ou de exploração, tabela ou card de erro (um quadro só). **Exportar** (Markdown/CSV) fica nesta barra.

Valores em reais aparecem como **R$ 9.850,00** e datas como **dd/mm/aaaa hh:mm:ss**.

### Dicionário de Dados & Tabelas

Abre no lugar da coluna **O que fazer** (no celular, em overlay em tela cheia). **← Voltar para a Missão** ou **Esc** devolve o enunciado. Clique em tabela/coluna **insere o identificador** no editor e mostra **✓ inserido**; o dicionário permanece aberto.

Há **cinco tabelas** (badges: Cadastral, Transacional, Telemetria, Investimentos):

- **`contas`** — cadastro KYC (nome, PF/PJ, ocupação, **renda mensal declarada**, banco, chave PIX, cidade, data de abertura, indicador **PEP** `eh_pep` e **`cargo_pep`**). Duas contas PEP de exemplo: **C013** (Deputado Estadual) e **C004** (Prefeito).
- **`transacoes_pix`** — transferências (origem, destino, **valor**, **data e hora**, canal: APP, INTERNET_BANKING ou API).
- **`socios_empresas`** — quadro de sócios e administradores (QSA) para rastrear **UBO** (participação e flag de administrador).
- **`acessos_digitais`** — telemetria de login (dispositivo, IP, cidade, sucesso) para **account takeover**.
- **`operacoes_produtos`** — aportes em consórcio e renda fixa, com forma de liquidação (incluindo **espécie**) e contemplação.

Use o campo **Filtrar tabela ou coluna…**. A lista compacta mostra as tabelas e o total de linhas; ao escolher uma, o **inspetor** traz só as colunas daquela tabela (tipo, selos PK/FK, descrição e exemplo). Clique no nome da tabela ou da coluna para **inserir no cursor** do editor — o painel **permanece aberto** e aparece o selo **✓ inserido**. Abra **👁 Ver 3 exemplos práticos desta tabela** para ver dados reais.

---

## 3. Resolvendo seu primeiro desafio

1. No seletor da navbar (ou deixe o caso padrão), comece por **Reconhecimento Cadastral: Listagem de Clientes**.
2. Leia **Sua Missão**. Use **📊 Consultar Tabelas Disponíveis** para o dicionário; **← Voltar para a Missão** devolve o enunciado.
3. Leia o **Contrato de Entrega do Relatório** (aliases). A **dica de SQL** só aparece se você clicar para revelá-la.
4. Complete o esqueleto no editor. **↺ Restaurar Modelo Inicial** recoloca o modelo se você se perder.
5. Clique em **▶ Rodar Teste** (ou **Ctrl+Enter**) para explorar os dados. Isso **não** pontua o desafio.
6. Quando achar que está certo, clique em **✓ Validar Resposta**. O feedback aparece em **Resultados**.
7. Se errar, ajuste e valide de novo — não há limite de tentativas. Depois de tentar, você pode abrir **Ver gabarito comentado**.

### A trilha de aprendizagem

Há **41 desafios base**, agrupados nos níveis **0 a 5** e numerados no seletor (`0.1`, `1.1`…). Use **Todos / Iniciante / Intermediário / Avançado**. Siga a ordem.

| Nível | Técnica-alvo | Casos base (títulos) |
| --- | --- | --- |
| **0 — Fundamentos de Consulta** | `SELECT`, `FROM`, `WHERE`, `ORDER BY`, `GROUP BY` | Listagem de clientes; triagem PEP; operações de alto valor; baixa renda cadastral; volumetria por remetente; capilaridade de destinatários |
| **1 — Fundamentos de Agregação** | `GROUP BY`, `HAVING`, `JOIN` | Smurfing Aurora; alta recorrência; concentração de créditos; fracionamento abaixo do limiar; matriz de criticidade; incompatibilidade patrimonial |
| **2 — Cruzamentos cadastrais** | `JOIN` / `LEFT JOIN` e cadastro duplo | Remetentes de alto valor; QSA/administração PJ; contas dormentes; volumetria PEP; fluxos intrabanco; pico diário (`ROW_NUMBER`) |
| **3 — Janelas temporais** | `strftime`, `date()`, `unixepoch`, `HAVING` sobre renda | Limiar noturno; liquidações em fim de semana; volume × renda; rajada na mesma data; telemetria ATO; burst; transferência noturna sob coação |
| **4 — Window Functions** | `ROW_NUMBER`, `LAG`, `SUM OVER`, CTE em duas fases | Sequenciamento; última movimentação; intervalo entre disparos; montante acumulado; salto atípico; conta aquecida; acúmulo móvel de 3 PIX; escalada em PEP |
| **5 — Investigações avançadas** | UBO/PEP, dwell time, telemetria, triangulação, dossiê COAF | UBO PEP; conta de passagem; vetor geográfico impossível; triangulação societária; dossiê COAF PJ; UBO Aurora; account takeover; consórcio em espécie |

Desafios gerados pelo **Agente IA** entram no nível compatível com o SQL (não ficam todos no 5).

---

## 4. Entendendo o feedback (modo Investigador / esteira de risco)

O validador não exige que sua consulta seja **igual** ao gabarito: compara o **resultado**. As mensagens falam a língua de uma **esteira de monitoramento PLD** e aparecem no painel **Resultados** (à direita), não na coluna da missão.

Em caso de **erro de SQL** ou de validação, você vê **apenas** o card de erro — a tabela vazia não fica duplicada embaixo. Conteúdos longos (dica de correção + tabela) rolam nesse painel.

| Cor | Significado |
| --- | --- |
| 🟢 **Esteira em conformidade** | A **matriz de dados** (linhas e valores) bate com o gabarito. Aliases ou ordem de colunas diferentes **não reprovam**: o card verde pode mostrar **Dica de Governança**. Há chips **Alertas / Falsos + / Eficiência** e a narrativa do caso |
| 🟡 **Quase lá** | Só quando **falta ou sobra coluna** (ex.: o relatório pedia 3 métricas e vieram 2 ou 4). Os dados certos com nome/ordem diferentes **não** caem aqui |
| 🔴 **Inconsistência** | SQL inválido, conjunto de registros diferente do gabarito, métricas que não conferem, ou esteira vazia / com ruído de volume |

O que o validador **aceita** (sucesso):

- **Nomes de colunas diferentes** (aliases): se os valores conferem, está certo; no verde pode aparecer mentoria de schema.
- **Colunas na ordem física diferente** do contrato.
- **Diferenças de arredondamento** de até **R$ 0,01**.
- **Ordem das linhas** diferente do `ORDER BY` do enunciado (não trava a trilha; pode haver nota de fila de priorização).

### Alertas perdidos e ruído operacional

Quando a **quantidade de linhas** (ou as contas/IDs) não bate:

| O que aconteceu | Como o Lab descreve | O que revisar |
| --- | --- | --- |
| Faltaram linhas do gabarito | **Falsos negativos** — a esteira capturou X transações, mas deixou escapar Y alerta(s) regulatório(s) (ex.: `C031`) | Filtros de **data**, **intervalo em segundos** ou **limiar de valor** restritivos demais (`>=` vs `>`, `BETWEEN` inclusivo) |
| Vieram linhas a mais | **Falsos positivos** — ruído de monitoramento: transações que não passam no corte do cenário | Faltou filtro no **`WHERE` externo** (depois do `WITH`) ou a **janela temporal** está larga demais |
| Faltaram e sobraram | Os dois textos juntos | O recorte pegou um conjunto diferente do gabarito |

A dica SQL específica do desafio (por exemplo, “particionar só por origem”) continua aparecendo **abaixo** dessa explicação.

### Esteira aprovada (métricas de conformidade)

Quando o resultado **bate** com o gabarito, o card verde resume a esteira como em um relatório de monitoramento:

> 🟢 Esteira Aprovada em Conformidade | Alertas Capturados: X/X (100%) | Falsos Positivos: 0 | Eficiência: 100%

- **Alertas capturados** — quantos registros do gabarito sua consulta devolveu (no sucesso, todos).
- **Falsos positivos** — linhas a mais que o corte do cenário não pedia (no sucesso, zero).
- **Eficiência** — proporção de acertos entre o que a esteira emitiu (no sucesso, 100%).

Abaixo dos chips continua a explicação do caso. Se os aliases ou a ordem das colunas diferirem do contrato, o bloco **Dica de Governança** (borda azulada) sugere o schema de produção — sem bloquear o progresso.

### Fila de priorização

Se os **mesmos** registros estão lá, mas em outra ordem de linhas, o Lab pode **mencionar** a fila de priorização no card verde. Em PLD, a ordem ajuda a olhar primeiro os casos mais graves. Ajuste o `ORDER BY` se o enunciado pedir (incluindo o desempate). Isso **não** vira “Quase lá”.

### Ordem do compilador SQL (Window Functions)

O SQLite **não deixa** filtrar `LAG()`, `ROW_NUMBER()` ou qualquer `OVER (...)` direto no `WHERE` do mesmo `SELECT` — o `WHERE` corre **antes** de o `SELECT` calcular a janela. Se você tentar, o feedback destaca:

> **⚠️ Ordem de Execução do Compilador SQL**  
> Envelope o cálculo em `WITH envelope_metricas AS (...)` (**Fase 1**) e aplique o corte regulatório no `WHERE` **externo** (**Fase 2**).

Isso é o mesmo raciocínio da **decomposição em 2 fases** (dentro da dica de SQL) nos níveis 3, 4 e nos desafios gerados.

> A validação aceita apenas consultas de leitura (`SELECT` / `WITH`). **Rodar Teste** pode alterar o banco em memória; **recarregue a página** para voltar ao dataset original.

---

## 5. Gerando novos desafios com IA

1. Clique em **🤖 Agente IA** na navbar. Escolha o **Foco da tipologia** (ou "Livre") e a **Dificuldade**:
   - **Iniciante** — `GROUP BY`, `HAVING` e `WHERE` (sem `WITH` e sem funções de janela).
   - **Intermediário** — `WITH` + `ROW_NUMBER()` / `RANK()` para ranquear e cortar (maior PIX, top-N). O gabarito da IA vem comentado em **Fase 1 (envelope)** e **Fase 2 (inspetor)**.
   - **Avançado** — `WITH` + `LAG()`/`LEAD()` (burst, intervalo entre PIX) e corte no `WHERE` externo, no mesmo esquema de duas fases.
2. Clique em **✨ Gerar Novo Desafio com IA**.
3. Acompanhe as mensagens: o agente analisa as tipologias do Bacen e o dataset, redige o caso e roda um **Sanity Check** — executa o gabarito no banco para garantir que ele funciona e encontra evidências.
4. Quando terminar, o desafio entra no **nível compatível com o SQL gerado**, já selecionado. O editor recebe o **esqueleto do nível** (comentários de estrutura, sem gabarito). Escreva a consulta a partir do `SELECT`.

Focos disponíveis: os clássicos (fracionamento, burst, incompatibilidade, conta de passagem, fan-in/fan-out, horário atípico, valores redondos) e os **quatro blocos avançados** — (A) coação física/furto/PIX forçado, (B) invasão digital e engenharia social, (C) laranjas e mulas, (D) Carta Circular 4.001 avançada. O agente escolhe **uma** das **15 tipologias** do catálogo e aplica o corte SQL correspondente (hora noturna, micro-PIX + salto, fan-out, round-tripping, etc.).

**Sem chave de IA?** Tudo bem: o agente usa um **gerador offline** com modelos dos focos clássicos. Os blocos A–D ficam mais fiéis com uma chave (Groq/OpenAI).

Outras informações:

- Você pode **Cancelar** a geração a qualquer momento.
- Se a IA falhar (sem internet, chave inválida, limite atingido), o agente avisa o motivo e usa o gerador offline.
- Desafios gerados ficam salvos no navegador (até 20). Para apagar um, selecione-o e clique em **Remover desafio**.
- Desafios gerados são validados exatamente como os casos base, inclusive com o gabarito comentado.

---

## 6. Configurando a IA (Groq ou OpenAI)

1. Clique em **🤖 Agente IA** e depois em **Configurar Chave de API** (bolinha **verde** = chave salva, **cinza** = modo offline).
2. Escolha o **Provedor**:
   - **Groq** — tem plano gratuito. Crie a chave em [console.groq.com/keys](https://console.groq.com/keys). Chaves começam com `gsk_`. Modelo padrão: `openai/gpt-oss-120b`.
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

Para começar um desafio do zero, clique em **↺ Restaurar Modelo Inicial** ou apague o editor: o template volta na próxima vez que você abrir aquele desafio (se não houver rascunho próprio).

---

## 8. Histórico de execuções

Clique em **🕘 Histórico** na barra do editor para ver as **últimas 10 consultas** executadas nesta sessão (incluindo as validadas).

Cada item mostra o início da consulta, o horário, se deu certo (✓ e o número de linhas) ou errado (✕), o tempo e o desafio em que foi executada.

- **Clique** em um item (ou use as **setas** e **Enter**) para carregá-lo no editor.
- Mudou de ideia? **Ctrl+Z** desfaz e traz de volta o que estava antes.
- O histórico é apagado quando você recarrega a página. Os rascunhos, não.

---

## 9. Exportando o dossiê

Depois de executar ou validar uma consulta **com sucesso**, clique em **Exportar** na barra de **Resultados** e escolha o formato:

- **Markdown (.md)** — relatório legível, ótimo para guardar anotações ou compartilhar (abre no VS Code, Obsidian, GitHub, Notion…). No **final** do arquivo há a seção **Parecer do Analista de Compliance**, com caixas para marcar Arquivar (falso positivo) ou Encaminhar comunicação ao COAF e um campo de justificativa técnica — preencha à mão depois de exportar.
- **CSV (.csv)** — para abrir em planilhas (Excel, Google Sheets, LibreOffice).

O arquivo contém o **ID do caso**, o **enquadramento regulatório BACEN**, a origem do desafio, a data e hora, a **consulta SQL executada** e a **tabela com as linhas de evidência**.

> **Excel em português:** se as colunas aparecerem todas juntas numa só, abra pelo menu **Dados → De Texto/CSV** e escolha **vírgula** como separador. A célula da consulta pode começar com um apóstrofo (`'`); ele é proposital e impede que o Excel interprete o texto como fórmula.

O botão fica desabilitado enquanto não houver um resultado válido (por exemplo, logo após um erro de SQL), para que você não exporte uma evidência antiga por engano.

---

## 10. Atalhos de teclado

| Atalho | Onde | Ação |
| --- | --- | --- |
| **Ctrl+Enter** | Editor | **Rodar Teste** (consulta inteira) |
| **Tab** | Editor | Indenta com 2 espaços |
| **Ctrl+Z** | Editor | Desfaz (inclusive após carregar do histórico ou o gabarito) |
| **Esc** | Histórico, exportação, aviso do editor, modal de IA, dicionário | Fecha / mantém sua query (no dicionário, volta à missão) |
| **↑ / ↓** e **Enter** | Histórico | Navega e escolhe uma consulta |

---

## 11. Perguntas frequentes e problemas comuns

**Aparece "Offline" / "WASM indisponível".**
O arquivo do banco não foi encontrado. Pare o servidor, rode `npm install` (ou `node scripts/copy-wasm.mjs`) e depois `npm run dev` de novo.

**A tela aparece sem cores/estilo.**
Os estilos vêm da internet. Verifique a conexão e recarregue a página.

**Apaguei ou alterei dados sem querer.**
**Recarregue a página.** O SQLite recomeça do dataset; os rascunhos no navegador são mantidos.

**O card verde mostrou Dica de Governança / aliases ou ordem de colunas.**
Sua matriz de dados foi aprovada. O aviso é mentoria de produção (schema Bacen / CSV rígido), não uma reprovação. A trilha já avança.

**Minha consulta está certa, mas a fila de priorização (linhas) está em outra ordem.**
Os registros batem com o gabarito. O Lab não trava por `ORDER BY`; se o enunciado prioriza a fila, aplique o `ORDER BY` pedido (incluindo o desempate).

**Apareceu "falsos negativos" ou "deixou escapar alertas".**
Sua esteira filtrou demais. Confira datas inclusivas, `>=` / `<=` e se o `HAVING` ou o `WHERE` externo não está mais apertado que o enunciado. O feedback lista contas ou IDs que faltaram (ex.: `C031`).

**Apareceu "falsos positivos" ou "ruído de monitoramento".**
Sua esteira filtrou de menos. Falta um corte no `WHERE` externo (posição, intervalo, limiar) ou a janela temporal está larga. O feedback lista o que entrou a mais.

**Deu "⚠️ Ordem de Execução do Compilador SQL".**
Você tentou usar `LAG`, `ROW_NUMBER` ou `OVER (...)` no `WHERE` (ou no `HAVING`) do mesmo `SELECT`. Calcule a métrica numa CTE (`WITH envelope_metricas AS (...)`) e filtre no `SELECT` de fora. Nos níveis 3 e 4, o card **Decomposição em 2 Fases** descreve exatamente isso.

**Deu "Divergência nas métricas calculadas".**
As linhas estão certas, mas algum cálculo não. Verifique `SUM`/`COUNT`, o `ROUND(..., 2)` e se o filtro do `WHERE` está antes da agregação.

**O card verde fala em eficiência 100%.**
Sua consulta devolveu exatamente o conjunto do gabarito (mesmos alertas, nenhum ruído). Os chips **Alertas / Falsos + / Eficiência** só aparecem nesse caso.

**A IA não gera o desafio.**
Use **Testar conexão** no modal. Mensagens comuns: chave recusada (confira se copiou inteira e se o provedor está certo), limite de requisições (aguarde um pouco) ou falta de internet. Em todos os casos, o agente entrega um desafio offline.

**Posso usar sem internet?**
Depois que a página estiver aberta, sim — exceto a geração com IA, que cai automaticamente no modo offline.

**Quantas tabelas o banco tem?**
Sempre **cinco** (`contas`, `transacoes_pix`, `socios_empresas`, `acessos_digitais`, `operacoes_produtos`), com ou sem IA. O agente só cria **desafios** novos (nível 5), não tabelas.

**O dicionário some quando eu clico numa coluna?**
Não: ele só some com **← Voltar para a Missão** ou **Esc**. Clique insere o nome no editor e mostra **✓ inserido**.

**A missão parece “incompleta” (corta em R$ 9.)?**
O recorte da primeira frase ignora pontos de milhar (`9.700`). Se ainda vir texto truncado, recarregue a página após a última atualização.

**O menu de Histórico ou Exportar ficou aberto sozinho.**
Eles devem nascer fechados. Recarregue a página. Eles só abrem ao clicar nos respectivos botões.

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
| **UBO** | *Ultimate Beneficial Owner*: beneficiário final que de fato controla a empresa (participação relevante e/ou administração) |
| **QSA** | Quadro de Sócios e Administradores (tabela `socios_empresas`) |
| **ATO / account takeover** | Invasão de conta: acesso atípico (dispositivo/cidade) imediatamente antes de transação de alto valor |
| **Laranja** | Pessoa cuja conta é usada para movimentar recursos de terceiros |
| **PEP** | Pessoa Exposta Politicamente: titular com cargo público relevante (`eh_pep = 1`, `cargo_pep`). Exige monitoramento KYC reforçado |
| **Esteira de risco** | Fila de monitoramento: primeiro carimbar métricas (envelope), depois cortar o que vira alerta (inspetor) |
| **Falso negativo** | Alerta legítimo que a esteira **não** capturou |
| **Falso positivo / ruído** | Transação que **não** deveria virar alerta e mesmo assim entrou na fila |
