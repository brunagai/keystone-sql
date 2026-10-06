import type { GeneratedChallenge } from './types.ts';
import { isChallengeTrailLevel } from './difficultyToolkit.ts';

/** JSON Schema estrito (OpenAI Structured Outputs) equivalente à interface GeneratedChallenge. */
export const GENERATED_CHALLENGE_JSON_SCHEMA = {
  name: 'generated_challenge',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'id',
      'nivel',
      'titulo',
      'tipologiaBacen',
      'badgeEnquadramento',
      'contexto',
      'objetivo',
      'dicaSql',
      'solutionQuery',
      'criteriosValidacao',
    ],
    properties: {
      id: { type: 'string' },
      nivel: { type: 'integer', enum: [0, 1, 2, 3, 4, 5] },
      titulo: { type: 'string' },
      tipologiaBacen: { type: 'string' },
      badgeEnquadramento: { type: 'string' },
      contexto: { type: 'string' },
      objetivo: { type: 'string' },
      dicaSql: { type: 'string' },
      solutionQuery: { type: 'string' },
      criteriosValidacao: {
        type: 'object',
        additionalProperties: false,
        required: ['colunasEsperadas', 'descricaoSucesso'],
        properties: {
          colunasEsperadas: { type: 'array', items: { type: 'string' } },
          descricaoSucesso: { type: 'string' },
        },
      },
    },
  },
} as const;

export class ChallengeFormatError extends Error {
  override name = 'ChallengeFormatError';
}

const STRING_FIELDS = ['titulo', 'tipologiaBacen', 'badgeEnquadramento', 'contexto', 'objetivo', 'dicaSql', 'solutionQuery'] as const;

function requireString(obj: Record<string, unknown>, field: string): string {
  const value = obj[field];
  if (typeof value !== 'string' || !value.trim()) throw new ChallengeFormatError(`Campo "${field}" ausente ou vazio.`);
  return value.trim();
}

/** Remove cercas de markdown que alguns modelos insistem em adicionar. */
function extractJson(raw: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  const body = (fenced?.[1] ?? raw).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

/** Converte a resposta textual do modelo em GeneratedChallenge, validando a estrutura em runtime. */
export function parseGeneratedChallenge(raw: string): GeneratedChallenge {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    throw new ChallengeFormatError('A resposta não é um JSON válido.');
  }
  if (typeof parsed !== 'object' || parsed === null) throw new ChallengeFormatError('O JSON raiz deve ser um objeto.');
  const obj = parsed as Record<string, unknown>;

  const [titulo, tipologiaBacen, badgeEnquadramento, contexto, objetivo, dicaSql, solutionQuery] = STRING_FIELDS.map((f) =>
    requireString(obj, f),
  ) as [string, string, string, string, string, string, string];

  const criterios = obj['criteriosValidacao'];
  if (typeof criterios !== 'object' || criterios === null) throw new ChallengeFormatError('Campo "criteriosValidacao" ausente.');
  const { colunasEsperadas, descricaoSucesso } = criterios as Record<string, unknown>;
  if (!Array.isArray(colunasEsperadas) || colunasEsperadas.length === 0 || !colunasEsperadas.every((c) => typeof c === 'string' && c.trim())) {
    throw new ChallengeFormatError('"criteriosValidacao.colunasEsperadas" deve ser uma lista não vazia de strings.');
  }
  if (typeof descricaoSucesso !== 'string' || !descricaoSucesso.trim()) {
    throw new ChallengeFormatError('"criteriosValidacao.descricaoSucesso" ausente.');
  }

  const rawNivel = obj['nivel'];
  const nivelNum = typeof rawNivel === 'number' ? rawNivel : typeof rawNivel === 'string' ? Number(rawNivel) : NaN;

  return {
    id: typeof obj['id'] === 'string' ? obj['id'] : '',
    ...(isChallengeTrailLevel(nivelNum) ? { nivel: nivelNum } : {}),
    titulo,
    tipologiaBacen,
    badgeEnquadramento,
    contexto,
    objetivo,
    dicaSql,
    solutionQuery,
    criteriosValidacao: {
      colunasEsperadas: colunasEsperadas.map((c: string) => c.trim()),
      descricaoSucesso: descricaoSucesso.trim(),
    },
  };
}
