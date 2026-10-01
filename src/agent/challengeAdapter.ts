import type { InvestigationScenario } from '../challenges/scenarios.ts';
import { extractOrderBy } from '../database/safeQuery.ts';
import type { GeneratedChallenge, GenerationSource } from './types.ts';

const MAX_SUCCESS_ENTITIES = 8;

export interface StoredChallenge {
  challenge: GeneratedChallenge;
  source: GenerationSource;
  model?: string;
  createdAt: string;
}

/** Converte um desafio gerado (IA/offline) no formato consumido pelo validador e pelo Painel 3. */
export function toScenario({ challenge: ch, source, model }: StoredChallenge): InvestigationScenario {
  const colunas = ch.criteriosValidacao.colunasEsperadas;
  const ordenacao = extractOrderBy(ch.solutionQuery) ?? 'a ordenação descrita no objetivo';
  const colunasTexto = `\`${colunas.join(', ')}\``;

  return {
    id: ch.id,
    origem: source,
    ...(model ? { modelo: model } : {}),
    titulo: ch.titulo,
    enquadramento: ch.badgeEnquadramento,
    dossie: ch.contexto,
    objetivo: ch.objetivo,
    colunasEsperadas: colunas,
    ordenacao,
    dicaTexto: `Tipologia: ${ch.tipologiaBacen}. Colunas esperadas: ${colunas.join(', ')}.`,
    dicaSql: ch.dicaSql,
    gabaritoSql: ch.solutionQuery,
    colunaChave: colunas[0] ?? '',
    rotuloEntidade: { singular: 'registro', plural: 'registros' },
    dicasDivergencia: {
      excesso: 'Há registros a mais: revise os filtros do `WHERE`, os limiares e as condições do `HAVING` descritas no objetivo.',
      falta: 'Faltam registros: confira se os limites são inclusivos (`>=`, `<=`, `BETWEEN`) e se algum filtro ficou restritivo demais.',
      valores: `Os registros estão certos, mas há métricas divergentes. Confira o cálculo e o arredondamento das colunas ${colunasTexto}.`,
      ordenacao: `Os dados estão corretos, mas a ordem não. Ordene por \`${ordenacao}\`.`,
    },
    resumirSucesso(gabarito) {
      const entities = [...new Set(gabarito.values.map((row) => String(row[0])))];
      return {
        message: ch.criteriosValidacao.descricaoSucesso,
        entities: entities.slice(0, MAX_SUCCESS_ENTITIES).concat(
          entities.length > MAX_SUCCESS_ENTITIES ? [`+${entities.length - MAX_SUCCESS_ENTITIES}`] : [],
        ),
      };
    },
  };
}
