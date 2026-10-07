# AML SQL Lab

Laboratório interativo local para praticar **SQL analítico aplicado à Prevenção à Lavagem de Dinheiro (PLD/AML)** e detecção de fraudes. Você investiga um dataset sintético de PIX, QSA, telemetria de acesso e produtos financeiros, escreve consultas para isolar indícios de crimes financeiros e recebe feedback de esteira de risco — tudo diretamente no navegador via SQLite em WebAssembly.

---

## Por que este projeto existe?

Quando comecei meus estudos em Engenharia de Dados, me deparei com uma barreira comum: a maioria dos tutoriais, cursos e plataformas de exercícios tratava o SQL de forma superficial e genérica (consultas triviais de e-commerce, somas simples e filtros básicos em brinquedos de demonstração). 

No mundo corporativo e nas instituições financeiras reais, o desafio analítico opera em outra escala:

- As esteiras lidam com **regras regulatórias rígidas do Bacen e do COAF**;
- O analista precisa identificar anomalias complexas como *smurfing*, triangulação e contas mulas;
- O ferramental exige domínio de **Window Functions** (`SUM() OVER`, `PARTITION BY`, `ROWS BETWEEN`), CTEs encadeadas e particionamento temporal.

Criei este laboratório para preencher essa lacuna: construir uma plataforma prática, orientada a regras de negócio autênticas de compliance e segurança financeira, com a qual qualquer pessoa possa sentar e exercitar a lógica analítica profunda exigida pelo mercado.

---

## O Paradigma Técnico: Desmistificando o SQL vs. Big Data

Durante a jornada de desenvolvimento desta ferramenta e das discussões sobre arquitetura analítica, emergem dúvidas técnicas frequentes que este projeto busca esclarecer por design:

1. **"SQL é lento ou ultrapassado?"** Não. SQL é uma **linguagem declarativa**, e não um motor de execução físico. A velocidade depende de onde a instrução é executada. No navegador, este lab roda via SQLite compilado em WebAssembly (sql.js) com latências de milissegundos. Em ambientes distribuídos de Big Data, a mesma sintaxe SQL é executada sobre clusters com dezenas de máquinas (via Spark SQL, BigQuery ou Databricks), operando sobre petabytes em memória RAM.
2. **"PySpark é mais rápido que SQL?"** Mito de mercado. No Apache Spark, instruções escritas em PySpark (como `.filter()` ou `.withColumn()`) e consultas escritas em SQL puro (`spark.sql(...)`) convergem para o mesmo otimizador interno (*Catalyst Optimizer*). Ambos geram a mesmíssima árvore lógica e o mesmo plano de execução em bytecode. Dominar o raciocínio em SQL analítico capacita o profissional a operar esteiras de Big Data com o mesmo nível de desempenho.
3. **Validação Posicional & Contratos de Dados (Data-First):** Muitas ferramentas de ensino punem estudantes por divergências em nomes de aliases (`qtdd_transacao` vs `total_operacoes`). Neste projeto, a validação é **semântica e posicional**: se os agrupamentos, filtros e valores numéricos baterem com o gabarito, o usuário é aprovado com sucesso. Diferenças de nomenclatura são tratadas didaticamente como **Dicas de Governança**, instruindo sobre contratos de dados sem gerar bloqueios desnecessários.

---

## Destaques do Projeto

- **Zero-Server & SQLite no navegador** (`sql.js`): Banco analítico rodando em memória RAM cliente com 5 tabelas relacionais (`contas`, `transacoes_pix`, `socios_empresas`, `acessos_digitais`, `operacoes_produtos`).
- **Trilha de 41 desafios base** (Níveis 0 a 5): Da volumetria básica e KYC até janelas móveis deslizantes, análise de dwell time, triangulação transacional, ATO (Account Takeover) e UBO (Beneficiário Efetivo).
- **Enunciados orientados a Negócio**: Briefings em linguagem executiva e regulatória. A sintaxe técnica fica reservada a dicas opcionais e guias de governança.
- **UX responsiva sem sobrecarga cognitiva**:
  - No desktop: visualização limpa com divisor ajustável (splitter) e dicionário retrátil de esquemas.
  - No celular: fluxo vertical integrado para leitura do briefing e digitação de código sem alternância forçada entre abas.
- **Validação pela matriz de dados**: Comparação direta por células e tolerância monetária (± R$ 0,01), separando acerto matemático de convenções de schema.
- **Agente Educador IA (BYOK - Bring Your Own Key)**: Assistente opcional para apoio de sintaxe e contextualização de tipologias de Carta Circular Bacen, rodando 100% no cliente sem persistência externa de chaves.
- **Dossiê Exportável**: Gera pareceres formais em Markdown (com modelo de comunicação ao COAF) e exportação em CSV dos resultados.

---

## Começando Localmente

Requer Node.js LTS (v18+).

```bash
# Instalação das dependências
npm install

# Regeneração do dataset determinístico (opcional)
npm run generate:dataset

# Inicialização do ambiente de desenvolvimento
npm run dev
```



Acesse [http://localhost:5173](http://localhost:5173).


| Script                     | Ação                                                       |
| -------------------------- | ---------------------------------------------------------- |
| `npm run dev`              | Inicia o servidor local de desenvolvimento                 |
| `npm run build`            | Validação de tipos (TypeScript strict) e build de produção |
| `npm run preview`          | Executa localmente o bundle final gerado em `dist/`        |
| `npm run typecheck`        | Checagem de tipagem estática sem emitir arquivos           |
| `npm run generate:dataset` | Gera novamente a massa de dados sintética determinística   |


---

## Documentação

- 📘 [Guia do Usuário](docs/GUIA_DO_USUARIO.md) — Navegação pelos desafios, comandos aceitos e geração de relatórios.
- 🛠️ [Documentação Técnica](docs/DOCUMENTACAO_TECNICA.md) — Arquitetura da engine WebAssembly, esteira de validação posicional e convenções de código.

---

## Stack Tecnológica

- **Linguagem & Runtime:** TypeScript (Strict Mode)
- **Build Tool:** Vite
- **Motor Analítico:** SQLite via WebAssembly (`sql.js`)
- **Estilização:** Tailwind CSS v4
- **APIs Nativas:** Web Storage API (`localStorage`), Fetch API (Zero frameworks pesados de UI)

---

## Aviso de Conformidade e Dados

Todos os dados presentes nesta aplicação são **100% fictícios e gerados sinteticamente** para fins estritamente educacionais. Nomes, documentos, razões sociais e chaves de liquidação não correspondem a nenhuma entidade, pessoa física ou operação real.