import { inArray } from 'drizzle-orm'
import { v4 as uuidv4, validate } from 'uuid' // Importando a biblioteca 'uuid' para validação
import { db } from '../drizzle/client'
import { schema } from '../drizzle/schema'
import { redis } from '../redis/client'

export async function getRanking() {
  // Obtendo os três melhores rankings do Redis
  const topThree = await redis.zrevrange('referral:ranking', 0, 2, 'WITHSCORES')

  // Garantindo que apenas os IDs válidos (UUIDs) sejam utilizados
  const ranking: Record<string, number> = {}

  for (let i = 0; i < topThree.length; i += 2) {
    const id = topThree[i]
    // Validação do ID antes de armazená-lo
    if (validate(id)) {
      ranking[id] = Number.parseInt(topThree[i + 1])
    }
  }

  // Verificando se há IDs válidos no ranking
  if (Object.keys(ranking).length === 0) {
    throw new Error('Nenhum ID válido encontrado no ranking do Redis.')
  }

  // Buscando os inscritos com IDs válidos no banco de dados
  const subscribersFromRanking = await db
    .select()
    .from(schema.subscriptions)
    .where(inArray(schema.subscriptions.id, Object.keys(ranking)))

  // Combinando os resultados do ranking com as informações dos inscritos
  const rankingWithScores = subscribersFromRanking
    .map(subscriber => {
      return {
        id: subscriber.id,
        name: subscriber.name,
        score: ranking[subscriber.id], // Adicionando a pontuação associada ao ID
      }
    })
    .sort((a, b) => b.score - a.score) // Ordenando os resultados do ranking

  // Retornando o ranking final
  return { rankingWithScores }
}
