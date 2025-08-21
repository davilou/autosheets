import { prisma } from '../db'
import { redisUtils } from '../redis'
import { Bet, User } from '@prisma/client'

export interface CreateBetData {
  userId: string
  betId: string
  jogo: string
  placar?: string
  mercado: string
  linhaDaAposta: string
  oddTipster: number
  oddReal?: number
  chatId: number
  messageId: number
}

export interface UpdateBetData {
  pegou?: boolean
  resultado?: string
  lucroPrejuizo?: number
  oddReal?: number
}

export class ApostasService {
  // Criar nova aposta
  static async createBet(data: CreateBetData): Promise<Bet> {
    const bet = await prisma.bet.create({
      data: {
        userId: data.userId,
        betId: data.betId,
        jogo: data.jogo,
        placar: data.placar,
        mercado: data.mercado,
        linhaDaAposta: data.linhaDaAposta,
        oddTipster: data.oddTipster,
        oddReal: data.oddReal,
        chatId: data.chatId,
        messageId: data.messageId,
      },
      include: {
        user: true
      }
    })

    // Invalidar cache
    await redisUtils.deleteCache(`user:${data.userId}:bets`)
    await redisUtils.deleteCache('bets:recent')

    return bet
  }

  // Buscar aposta por chat e message ID
  static async findBetByMessage(chatId: number, messageId: number): Promise<Bet | null> {
    const cacheKey = `bet:${chatId}:${messageId}`
    
    // Tentar buscar no cache primeiro
    let bet = await redisUtils.getCache<Bet>(cacheKey)
    
    if (!bet) {
      bet = await prisma.bet.findFirst({
        where: {
          chatId,
          messageId
        },
        include: {
          user: true
        }
      })
      
      if (bet) {
        await redisUtils.setCache(cacheKey, bet, 3600) // Cache por 1 hora
      }
    }
    
    return bet
  }

  // Atualizar aposta
  static async updateBet(betId: string, data: UpdateBetData): Promise<Bet> {
    const bet = await prisma.bet.update({
      where: { id: betId },
      data,
      include: {
        user: true
      }
    })

    // Invalidar caches relacionados
    await redisUtils.deleteCache(`bet:${bet.chatId}:${bet.messageId}`)
    await redisUtils.deleteCache(`user:${bet.userId}:bets`)
    await redisUtils.deleteCache('bets:recent')

    return bet
  }

  // Buscar apostas do usuário
  static async getUserBets(userId: string, limit: number = 50): Promise<Bet[]> {
    const cacheKey = `user:${userId}:bets`
    
    let bets = await redisUtils.getCache<Bet[]>(cacheKey)
    
    if (!bets) {
      bets = await prisma.bet.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          user: true
        }
      })
      
      await redisUtils.setCache(cacheKey, bets, 1800) // Cache por 30 minutos
    }
    
    return bets
  }

  // Buscar apostas recentes
  static async getRecentBets(limit: number = 20): Promise<Bet[]> {
    const cacheKey = 'bets:recent'
    
    let bets = await redisUtils.getCache<Bet[]>(cacheKey)
    
    if (!bets) {
      bets = await prisma.bet.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          user: true
        }
      })
      
      await redisUtils.setCache(cacheKey, bets, 600) // Cache por 10 minutos
    }
    
    return bets
  }

  // Estatísticas do usuário
  static async getUserStats(userId: string) {
    const cacheKey = `user:${userId}:stats`
    
    let stats = await redisUtils.getCache(cacheKey)
    
    if (!stats) {
      const [totalBets, wonBets, totalProfit] = await Promise.all([
        prisma.bet.count({ where: { userId } }),
        prisma.bet.count({ where: { userId, pegou: true } }),
        prisma.bet.aggregate({
          where: { userId },
          _sum: { lucroPrejuizo: true }
        })
      ])

      stats = {
        totalBets,
        wonBets,
        lostBets: totalBets - wonBets,
        winRate: totalBets > 0 ? (wonBets / totalBets) * 100 : 0,
        totalProfit: totalProfit._sum.lucroPrejuizo || 0
      }
      
      await redisUtils.setCache(cacheKey, stats, 3600) // Cache por 1 hora
    }
    
    return stats
  }
}