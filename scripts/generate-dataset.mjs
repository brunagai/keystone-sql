// Gera src/data/dataset.json de forma determinística (PRNG com semente fixa).
// Uso: npm run generate:dataset
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'src', 'data', 'dataset.json');

const SEED = 20260801;
const ANO = 2026;
const MES = 8;
const ULTIMO_DIA = 31;
const LIMIAR_REGULATORIO = 10_000;

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const round2 = (n) => Math.round(n * 100) / 100;
const randDigits = (n) => Array.from({ length: n }, () => randInt(0, 9)).join('');
const randValor = (min, max) => round2(min + rand() * (max - min));
const randValorLog = (min, max) => round2(Math.exp(Math.log(min) + rand() * (Math.log(max) - Math.log(min))));

const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** Timestamp em ms tratando o horário como "parede" de Brasília (sem conversão de fuso). */
const ts = (dia, h, m, s) => Date.UTC(ANO, MES - 1, dia, h, m, s);
const fmtDataHora = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

function gerarCpf() {
  const base = Array.from({ length: 9 }, () => randInt(0, 9));
  const dv = (nums) => {
    const pesoInicial = nums.length + 1;
    const soma = nums.reduce((acc, d, i) => acc + d * (pesoInicial - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = dv(base);
  const d2 = dv([...base, d1]);
  return [...base, d1, d2].join('');
}

function gerarCnpj() {
  const base = [...Array.from({ length: 8 }, () => randInt(0, 9)), 0, 0, 0, 1];
  const dv = (nums, pesos) => {
    const resto = nums.reduce((acc, d, i) => acc + d * pesos[i], 0) % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = dv(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv([...base, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return [...base, d1, d2].join('');
}

function gerarUuidV4() {
  const hex = '0123456789abcdef';
  const chars = Array.from({ length: 32 }, () => hex[randInt(0, 15)]);
  chars[12] = '4';
  chars[16] = pick(['8', '9', 'a', 'b']);
  const s = chars.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

const ALFANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const e2eUsados = new Set();

/** E2E ID no padrão do Bacen: E + ISPB (8) + AAAAMMDDHHMM (12) + sequencial alfanumérico (11). */
function gerarE2eId(ispb, ms) {
  const d = new Date(ms).toISOString();
  const carimbo = d.slice(0, 4) + d.slice(5, 7) + d.slice(8, 10) + d.slice(11, 13) + d.slice(14, 16);
  let id;
  do {
    const sufixo = Array.from({ length: 11 }, () => ALFANUM[randInt(0, ALFANUM.length - 1)]).join('');
    id = `E${ispb}${carimbo}${sufixo}`;
  } while (e2eUsados.has(id));
  e2eUsados.add(id);
  return id;
}

// ---------------------------------------------------------------------------
// Contas
// ---------------------------------------------------------------------------

const BANCOS = {
  BB: { ispb: '00000000', nome: 'Banco do Brasil S.A.' },
  CAIXA: { ispb: '00360305', nome: 'Caixa Econômica Federal' },
  ITAU: { ispb: '60701190', nome: 'Itaú Unibanco S.A.' },
  BRADESCO: { ispb: '60746948', nome: 'Banco Bradesco S.A.' },
  SANTANDER: { ispb: '90400888', nome: 'Banco Santander (Brasil) S.A.' },
  NUBANK: { ispb: '18236120', nome: 'Nu Pagamentos S.A.' },
  INTER: { ispb: '00416968', nome: 'Banco Inter S.A.' },
  C6: { ispb: '31872495', nome: 'Banco C6 S.A.' },
  PICPAY: { ispb: '22896431', nome: 'PicPay Instituição de Pagamento S.A.' },
};
const BANCOS_DIGITAIS = new Set(['NUBANK', 'INTER', 'C6', 'PICPAY']);
const DOMINIOS_EMAIL = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.br', 'uol.com.br'];

// [id, titular, tipo, ocupação/atividade, renda/faturamento mensal, cidade, UF, chave, banco, abertura, e-mail PJ]
const DEFINICOES_CONTAS = [
  // Pessoas físicas com perfil transacional normal
  ['C001', 'Ana Beatriz Carvalho', 'PF', 'Analista de Sistemas', 9500, 'São Paulo', 'SP', 'EMAIL', 'ITAU', '2015-03-12'],
  ['C002', 'Bruno Henrique Almeida', 'PF', 'Motorista de Aplicativo', 3800, 'Rio de Janeiro', 'RJ', 'CPF', 'NUBANK', '2019-08-21'],
  ['C003', 'Camila Rodrigues Souza', 'PF', 'Enfermeira', 6200, 'Belo Horizonte', 'MG', 'ALEATORIA', 'BB', '2013-05-02'],
  ['C004', 'Daniel Ferreira Lima', 'PF', 'Professor', 5100, 'Curitiba', 'PR', 'CPF', 'CAIXA', '2011-02-14'],
  ['C005', 'Eduarda Martins Rocha', 'PF', 'Advogada', 14000, 'Porto Alegre', 'RS', 'EMAIL', 'SANTANDER', '2014-09-30'],
  ['C006', 'Felipe Augusto Barbosa', 'PF', 'Engenheiro Civil', 12500, 'Campinas', 'SP', 'CPF', 'BRADESCO', '2012-07-19'],
  ['C007', 'Gabriela Costa Ribeiro', 'PF', 'Designer Gráfica', 4700, 'Florianópolis', 'SC', 'ALEATORIA', 'INTER', '2020-01-08'],
  ['C008', 'Henrique Santos Oliveira', 'PF', 'Médico', 28000, 'Recife', 'PE', 'EMAIL', 'ITAU', '2010-11-23'],
  ['C009', 'Isabela Mendes Pereira', 'PF', 'Vendedora', 2600, 'Salvador', 'BA', 'CPF', 'CAIXA', '2018-04-17'],
  ['C010', 'João Pedro Araújo', 'PF', 'Estagiário', 1900, 'Fortaleza', 'CE', 'ALEATORIA', 'NUBANK', '2022-02-25'],
  ['C011', 'Larissa Gomes Teixeira', 'PF', 'Contadora', 8300, 'Goiânia', 'GO', 'EMAIL', 'BB', '2016-06-06'],
  ['C012', 'Lucas Moreira Cardoso', 'PF', 'Eletricista', 3400, 'Manaus', 'AM', 'CPF', 'BRADESCO', '2017-10-11'],
  ['C013', 'Mariana Dias Fernandes', 'PF', 'Servidora Pública', 11200, 'Brasília', 'DF', 'CPF', 'BB', '2009-03-03'],
  ['C014', 'Pedro Lucas Nascimento', 'PF', 'Pedreiro Autônomo', 2900, 'Belém', 'PA', 'ALEATORIA', 'CAIXA', '2021-05-28'],
  ['C015', 'Renata Alves Castro', 'PF', 'Farmacêutica', 7400, 'Vitória', 'ES', 'EMAIL', 'SANTANDER', '2015-12-01'],
  ['C016', 'Thiago Ribeiro Monteiro', 'PF', 'Gerente Comercial', 16500, 'São Paulo', 'SP', 'CPF', 'ITAU', '2013-08-15'],
  ['C017', 'Vanessa Lopes Correia', 'PF', 'Cabeleireira', 3100, 'Natal', 'RN', 'ALEATORIA', 'C6', '2021-09-09'],
  ['C018', 'Rodrigo Pires Andrade', 'PF', 'Aposentado', 4200, 'Santos', 'SP', 'CPF', 'BRADESCO', '2004-01-20'],
  // Pessoas jurídicas com perfil transacional normal
  ['C019', 'Padaria Pão Dourado Ltda', 'PJ', 'Panificação', 85000, 'São Paulo', 'SP', 'CNPJ', 'ITAU', '2014-04-10'],
  ['C020', 'Mercadinho Bom Preço ME', 'PJ', 'Varejo Alimentício', 120000, 'Rio de Janeiro', 'RJ', 'CNPJ', 'BRADESCO', '2016-11-03'],
  ['C021', 'Clínica Vida Plena Ltda', 'PJ', 'Serviços Médicos', 260000, 'Belo Horizonte', 'MG', 'CNPJ', 'SANTANDER', '2012-02-27'],
  ['C022', 'Imobiliária Horizonte Ltda', 'PJ', 'Administração de Imóveis', 180000, 'Curitiba', 'PR', 'EMAIL', 'BB', '2010-08-16', 'financeiro@imobiliariahorizonte.com.br'],
  ['C023', 'Auto Peças Rota Sul Ltda', 'PJ', 'Comércio de Autopeças', 210000, 'Porto Alegre', 'RS', 'CNPJ', 'BRADESCO', '2011-06-01'],
  ['C024', 'TechNova Sistemas Ltda', 'PJ', 'Desenvolvimento de Software', 450000, 'Campinas', 'SP', 'CNPJ', 'ITAU', '2017-03-22'],
  // Rede de fracionamento (smurfing)
  ['C025', 'Comercial Aurora Importados Ltda', 'PJ', 'Comércio de Variedades', 18000, 'São Paulo', 'SP', 'CNPJ', 'C6', '2026-06-15'],
  ['C026', 'Rafael Nogueira Brito', 'PF', 'Auxiliar Administrativo', 2400, 'Guarulhos', 'SP', 'CPF', 'NUBANK', '2026-07-02'],
  ['C027', 'Sandra Regina Moura', 'PF', 'Diarista', 1800, 'Osasco', 'SP', 'ALEATORIA', 'PICPAY', '2026-07-05'],
  ['C028', 'Wellington Cruz Batista', 'PF', 'Ajudante Geral', 2100, 'São Bernardo do Campo', 'SP', 'CPF', 'INTER', '2026-07-09'],
  ['C029', 'Kátia Fernanda Sales', 'PF', 'Atendente', 1950, 'Santo André', 'SP', 'EMAIL', 'NUBANK', '2026-07-11'],
  ['C030', 'Jefferson Luiz Prado', 'PF', 'Trabalhador Informal', 1200, 'Carapicuíba', 'SP', 'ALEATORIA', 'PICPAY', '2026-07-14'],
  // Repasses em rajada (burst)
  ['C031', 'Juliana Prado Vasconcelos', 'PF', 'Microempreendedora', 5500, 'Rio de Janeiro', 'RJ', 'EMAIL', 'INTER', '2024-03-18'],
  ['C032', 'FastPay Intermediações Digitais Ltda', 'PJ', 'Intermediação de Pagamentos', 60000, 'Barueri', 'SP', 'ALEATORIA', 'C6', '2025-11-03'],
  ['C033', 'Leandro Matos Siqueira', 'PF', 'Comerciante', 6800, 'Duque de Caxias', 'RJ', 'CPF', 'NUBANK', '2026-02-10'],
  ['C034', 'Bianca Torres Melo', 'PF', 'Promotora de Vendas', 2700, 'Nova Iguaçu', 'RJ', 'ALEATORIA', 'PICPAY', '2026-07-30'],
  // Incompatibilidade patrimonial
  ['C035', 'Diego Ramos Fontes', 'PF', 'Estudante', 1500, 'Campo Grande', 'MS', 'ALEATORIA', 'NUBANK', '2026-07-28'],
  ['C036', 'Patrícia Lemos Duarte', 'PF', 'Aposentada', 2300, 'João Pessoa', 'PB', 'CPF', 'CAIXA', '2009-10-05'],
  ['C037', 'P. A. Reformas e Reparos MEI', 'PJ', 'Reformas e Pequenos Reparos', 6500, 'Cuiabá', 'MT', 'CNPJ', 'INTER', '2026-05-20'],
  ['C038', 'Vértice Holding Participações Ltda', 'PJ', 'Holding de Instituições Não Financeiras', 35000, 'São Paulo', 'SP', 'CNPJ', 'SANTANDER', '2025-12-01'],
];

/** PEP determinístico (sem consumir o PRNG): KYC de Pessoa Exposta Politicamente. */
const CARGO_PEP = {
  C013: 'Deputado Estadual',
  C004: 'Prefeito',
};

function construirConta([id, titular, tipo, ocupacao, renda, cidade, uf, tipoChave, bancoKey, abertura, emailPj]) {
  const banco = BANCOS[bancoKey];
  const documento = tipo === 'PF' ? gerarCpf() : gerarCnpj();
  const nomes = titular.split(' ');
  const chaves = {
    CPF: documento,
    CNPJ: documento,
    ALEATORIA: gerarUuidV4(),
    EMAIL: emailPj ?? `${slug(nomes[0])}.${slug(nomes[nomes.length - 1])}@${pick(DOMINIOS_EMAIL)}`,
  };
  return {
    id_conta: id,
    titular,
    tipo_pessoa: tipo,
    documento,
    ocupacao,
    renda_mensal_declarada: renda,
    banco_ispb: banco.ispb,
    banco_nome: banco.nome,
    agencia: BANCOS_DIGITAIS.has(bancoKey) ? '0001' : randDigits(4),
    numero_conta: `${randDigits(randInt(5, 8))}-${randInt(0, 9)}`,
    tipo_chave_pix: tipoChave,
    chave_pix: chaves[tipoChave],
    cidade,
    uf,
    data_abertura: abertura,
    eh_pep: CARGO_PEP[id] ? 1 : 0,
    cargo_pep: CARGO_PEP[id] ?? null,
  };
}

const contas = DEFINICOES_CONTAS.map(construirConta);
const contaPorId = new Map(contas.map((c) => [c.id_conta, c]));

// ---------------------------------------------------------------------------
// Transações
// ---------------------------------------------------------------------------

const rascunhos = [];
const horariosPorPar = new Map();

function addTx(origem, destino, valor, ms, { descricao = null, canal = 'APP' } = {}) {
  if (!contaPorId.has(origem) || !contaPorId.has(destino)) {
    throw new Error(`Conta inexistente em ${origem} -> ${destino}`);
  }
  const par = `${origem}>${destino}`;
  if (!horariosPorPar.has(par)) horariosPorPar.set(par, []);
  horariosPorPar.get(par).push(ms);
  rascunhos.push({ origem, destino, valor: round2(valor), ms, descricao, canal, ordem: rascunhos.length });
}

/** Horário aleatório com distribuição concentrada no horário comercial. */
function horarioAleatorio(diaMin = 1, diaMax = ULTIMO_DIA) {
  const hora = pick([7, 8, 9, 10, 11, 11, 12, 12, 12, 13, 14, 15, 16, 17, 18, 18, 19, 19, 20, 20, 21, 22]);
  return ts(randInt(diaMin, diaMax), hora, randInt(0, 59), randInt(0, 59));
}

/** Evita que transações "normais" criem acidentalmente rajadas entre o mesmo par (janela de 1h). */
function addTxNormal(origem, destino, valor, opcoes, diaMin, diaMax) {
  const ocupados = horariosPorPar.get(`${origem}>${destino}`) ?? [];
  let ms;
  do {
    ms = horarioAleatorio(diaMin, diaMax);
  } while (ocupados.some((t) => Math.abs(t - ms) < 3_600_000));
  addTx(origem, destino, valor, ms, opcoes);
}

const PF_NORMAIS = contas.filter((c) => c.tipo_pessoa === 'PF' && c.id_conta <= 'C018').map((c) => c.id_conta);
const valorRedondoOuQuebrado = (min, max) => (rand() < 0.4 ? pick([20, 30, 50, 100, 150, 200, 250, 300, 500]) : randValorLog(min, max));

// --- Folha de pagamento e honorários (5º dia útil = 07/08/2026) ---
addTx('C024', 'C001', 9500, ts(7, 8, 2, 11), { descricao: 'Salário 08/2026', canal: 'INTERNET_BANKING' });
addTx('C021', 'C003', 6200, ts(7, 8, 15, 47), { descricao: 'Salário 08/2026', canal: 'INTERNET_BANKING' });
addTx('C021', 'C008', 28000, ts(7, 8, 16, 3), { descricao: 'Repasse honorários médicos jul/2026', canal: 'INTERNET_BANKING' });
addTx('C023', 'C016', 16500, ts(7, 9, 1, 29), { descricao: 'Salário 08/2026', canal: 'INTERNET_BANKING' });
addTx('C020', 'C009', 2600, ts(7, 9, 34, 52), { descricao: 'Salário 08/2026', canal: 'INTERNET_BANKING' });
addTx('C019', 'C011', 2800, ts(10, 10, 12, 8), { descricao: 'Honorários contábeis', canal: 'INTERNET_BANKING' });
addTx('C020', 'C011', 3200, ts(10, 11, 40, 36), { descricao: 'Honorários contábeis', canal: 'INTERNET_BANKING' });
addTx('C023', 'C011', 4500, ts(11, 9, 27, 14), { descricao: 'Honorários contábeis', canal: 'INTERNET_BANKING' });
addTx('C024', 'C005', 14000, ts(12, 15, 3, 55), { descricao: 'Honorários advocatícios', canal: 'INTERNET_BANKING' });
addTx('C016', 'C005', 9900, ts(19, 19, 48, 21), { descricao: 'Honorários - processo trabalhista' });
addTx('C019', 'C012', 850, ts(4, 16, 20, 2), { descricao: 'Manutenção elétrica forno' });

// --- Aluguéis ---
addTx('C001', 'C022', 3200, ts(10, 7, 41, 9), { descricao: 'Aluguel ago/2026' });
addTx('C004', 'C022', 1850, ts(10, 12, 5, 33), { descricao: 'Aluguel ago/2026' });
addTx('C007', 'C022', 2100, ts(10, 18, 52, 16), { descricao: 'Aluguel ago/2026' });
addTx('C002', 'C022', 1650, ts(11, 8, 13, 40), { descricao: 'Aluguel ago/2026' });
addTx('C022', 'C018', 2380, ts(12, 10, 0, 27), { descricao: 'Repasse aluguel ago/2026', canal: 'INTERNET_BANKING' });
addTx('C022', 'C013', 2950, ts(12, 10, 1, 4), { descricao: 'Repasse aluguel ago/2026', canal: 'INTERNET_BANKING' });
addTx('C006', 'C022', 15000, ts(17, 14, 22, 50), { descricao: 'Sinal locação sala comercial', canal: 'INTERNET_BANKING' });

// --- B2B ---
addTx('C021', 'C024', 7800, ts(5, 10, 30, 0), { descricao: 'Mensalidade sistema clínico', canal: 'INTERNET_BANKING' });
addTx('C020', 'C024', 1490, ts(5, 11, 2, 45), { descricao: 'Licença sistema PDV', canal: 'INTERNET_BANKING' });
addTx('C023', 'C024', 12800, ts(14, 16, 45, 12), { descricao: 'Licença anual ERP', canal: 'INTERNET_BANKING' });
for (const dia of [3, 10, 17, 24]) {
  addTx('C019', 'C020', randValor(1200, 4800), ts(dia, 6, randInt(10, 50), randInt(0, 59)), { descricao: 'Insumos', canal: 'INTERNET_BANKING' });
}
addTx('C008', 'C023', 4870, ts(21, 11, 9, 38), { descricao: 'Revisão completa' });

// --- Movimentação "de fachada" das contas suspeitas ---
addTx('C018', 'C035', 300, ts(3, 19, 30, 12), { descricao: 'Mesada' });
addTx('C035', 'C019', 18.5, ts(4, 8, 2, 40));
addTx('C035', 'C019', 23.9, ts(9, 8, 15, 3));
addTx('C035', 'C010', 45, ts(15, 22, 41, 19), { descricao: 'Rachar pizza' });
addTx('C036', 'C020', 132.4, ts(6, 10, 18, 7));
addTx('C036', 'C020', 87.15, ts(20, 9, 55, 31));
addTx('C036', 'C021', 280, ts(26, 14, 0, 52), { descricao: 'Consulta' });
addTx('C027', 'C020', 87.4, ts(2, 17, 44, 26));
addTx('C026', 'C019', 12.5, ts(3, 7, 22, 58));
addTx('C009', 'C025', 89.9, ts(13, 12, 31, 5));
addTx('C014', 'C025', 45, ts(16, 15, 7, 49));

// --- Tipologia 1: Smurfing / fracionamento abaixo de R$ 10.000,00 ---
const DESCRICOES_SMURF = [null, null, 'pagamento', 'mercadoria', 'pgto pedido', 'acerto'];
const smurfing = [
  ['C027', 9750, ts(5, 9, 12, 44)],
  ['C028', 9900, ts(5, 10, 3, 18)],
  ['C029', 9850, ts(5, 14, 27, 5)],
  ['C030', 9700, ts(5, 16, 48, 51)],
  // Rafael fraciona no mesmo dia para o mesmo destino
  ['C026', 9800, ts(6, 9, 5, 12)],
  ['C026', 9750, ts(6, 10, 41, 37)],
  ['C026', 9900, ts(6, 13, 22, 9)],
  ['C026', 9850, ts(6, 15, 58, 46)],
  ['C027', 9950, ts(7, 11, 16, 30)],
  ['C028', 9780, ts(7, 11, 52, 3)],
  ['C030', 9890, ts(7, 15, 9, 27)],
  ['C029', 9990, ts(8, 10, 33, 58)],
  ['C026', 9820, ts(8, 17, 20, 14)],
  ['C028', 9970, ts(10, 9, 47, 22)],
  ['C027', 9720, ts(10, 14, 5, 40)],
  ['C029', 9880, ts(10, 16, 31, 11)],
];
for (const [origem, valor, ms] of smurfing) addTx(origem, 'C025', valor, ms, { descricao: pick(DESCRICOES_SMURF) });
addTx('C025', 'C038', 150000, ts(11, 10, 22, 15), { descricao: 'Integralização de capital', canal: 'INTERNET_BANKING' });

// --- Tipologia 2: Burst / alta frequência (intervalos < 60s entre o mesmo par) ---
function rajada(origem, destino, inicioMs, quantidade, intervaloMin, intervaloMax, gerarValor) {
  let ms = inicioMs;
  for (let i = 0; i < quantidade; i++) {
    addTx(origem, destino, gerarValor(i), ms, { canal: 'API' });
    ms += randInt(intervaloMin, intervaloMax) * 1000;
  }
}
const VALORES_JULIANA = [4990, 4950, 3500, 4800, 2990, 4900, 3750, 4990, 4600];
rajada('C031', 'C032', ts(18, 23, 41, 7), 9, 8, 52, (i) => VALORES_JULIANA[i]);
rajada('C032', 'C033', ts(18, 23, 49, 30), 7, 10, 45, () => randValor(4000, 5500));
rajada('C033', 'C034', ts(25, 2, 13, 4), 6, 5, 30, () => randValor(1000, 1999));
rajada('C034', 'C033', ts(25, 2, 31, 40), 3, 15, 40, () => randValor(1400, 1600));

// --- Tipologia 3: Incompatibilidade patrimonial (valores >> renda declarada) ---
addTx('C038', 'C035', 185000, ts(12, 10, 14, 33), { descricao: 'Empréstimo', canal: 'INTERNET_BANKING' });
addTx('C035', 'C037', 92000, ts(12, 14, 37, 9), { descricao: 'Pagamento reforma' });
addTx('C035', 'C036', 78500, ts(13, 9, 2, 51));
addTx('C036', 'C038', 76000, ts(14, 11, 45, 20), { descricao: 'Devolução' });
addTx('C038', 'C037', 145000, ts(20, 15, 10, 2), { descricao: 'Contrato de obra', canal: 'INTERNET_BANKING' });
addTx('C037', 'C038', 228000, ts(22, 10, 30, 47), { descricao: 'Distribuição de lucros', canal: 'INTERNET_BANKING' });

// --- Movimentação cotidiana (perfil compatível), gerada por último para respeitar a janela anti-rajada ---
for (let i = 0; i < 48; i++) addTxNormal(pick(PF_NORMAIS), 'C019', randValor(6.5, 85), { descricao: null });
for (let i = 0; i < 42; i++) addTxNormal(pick(PF_NORMAIS), 'C020', randValorLog(18, 480), { descricao: null });
for (let i = 0; i < 12; i++) addTxNormal(pick(PF_NORMAIS), 'C023', randValorLog(60, 1400), { descricao: pick([null, 'Peças', 'Pastilha de freio', 'Bateria']) });
for (let i = 0; i < 14; i++) addTxNormal(pick(PF_NORMAIS), 'C021', pick([180, 250, 320, 450, 600]), { descricao: pick(['Consulta', 'Exame', null]) });

const DESCRICOES_P2P = [null, null, null, 'Rachando a conta', 'Presente', 'Valeu!', 'Churrasco', 'Empréstimo', 'Devolvendo', 'Uber', 'Ingresso show'];
for (let i = 0; i < 62; i++) {
  const origem = pick(PF_NORMAIS);
  let destino;
  do destino = pick(PF_NORMAIS);
  while (destino === origem);
  addTxNormal(origem, destino, valorRedondoOuQuebrado(15, 1800), { descricao: pick(DESCRICOES_P2P) });
}

// ---------------------------------------------------------------------------
// Montagem final
// ---------------------------------------------------------------------------

const transacoes = rascunhos
  .sort((a, b) => a.ms - b.ms || a.ordem - b.ordem)
  .map(({ origem, destino, valor, ms, descricao, canal }) => {
    const contaOrigem = contaPorId.get(origem);
    const contaDestino = contaPorId.get(destino);
    return {
      id_transacao: gerarE2eId(contaOrigem.banco_ispb, ms),
      id_conta_origem: origem,
      id_conta_destino: destino,
      valor,
      data_hora: fmtDataHora(ms),
      tipo_chave_destino: contaDestino.tipo_chave_pix,
      chave_pix_destino: contaDestino.chave_pix,
      descricao,
      canal,
    };
  });

const pad = (n) => String(n).padStart(2, '0');

const dataset = {
  metadata: {
    versao: '1.1.0',
    gerado_em: '2026-09-30 21:00:00',
    moeda: 'BRL',
    fuso_horario: 'America/Sao_Paulo',
    periodo: { inicio: `${ANO}-${pad(MES)}-01`, fim: `${ANO}-${pad(MES)}-${ULTIMO_DIA}` },
    limiar_regulatorio_brl: LIMIAR_REGULATORIO,
    observacao:
      'Dados 100% sintéticos para fins educacionais. CPFs/CNPJs possuem dígitos verificadores válidos, mas são gerados aleatoriamente e não pertencem a pessoas reais.',
    cenarios: [
      {
        tipologia: 'SMURFING',
        descricao:
          'Cinco contas recém-abertas (laranjas) enviam PIX entre R$ 9.700 e R$ 9.990 para uma PJ de faturamento baixo, que consolida e repassa R$ 150 mil para uma holding.',
        contas_envolvidas: ['C025', 'C026', 'C027', 'C028', 'C029', 'C030', 'C038'],
      },
      {
        tipologia: 'BURST',
        descricao:
          'Sequências de repasses via API com intervalos inferiores a 60 segundos entre o mesmo par de contas, de madrugada, formando uma cadeia de camadas (layering) com retorno parcial.',
        contas_envolvidas: ['C031', 'C032', 'C033', 'C034'],
      },
      {
        tipologia: 'INCOMPATIBILIDADE_PATRIMONIAL',
        descricao:
          'Estudante, aposentada e MEI movimentam centenas de milhares de reais, muito acima da renda/faturamento declarados, em circuito fechado com a holding.',
        contas_envolvidas: ['C035', 'C036', 'C037', 'C038'],
      },
      {
        tipologia: 'PEP',
        descricao:
          'Duas contas PF marcadas como Pessoa Exposta Politicamente (PEP) no cadastro KYC, com cargo declarado (Deputado Estadual e Prefeito), para monitoramento reforçado.',
        contas_envolvidas: ['C013', 'C004'],
      },
    ],
  },
  contas,
  transacoes_pix: transacoes,
};

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
console.log(`[generate-dataset] ${contas.length} contas e ${transacoes.length} transações gravadas em src/data/dataset.json`);
