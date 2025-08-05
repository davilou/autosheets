import { Redis } from 'ioredis'

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined
}

export const redis =
  globalForRedis.redis ??
  new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
  })

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis

// Função para testar conexão Redis
export async function testRedisConnection() {
  try {
    await redis.ping()
    console.log('✅ Redis connected successfully')
    return true
  } catch (error) {
    console.error('❌ Redis connection failed:', error)
    return false
  }
}

// Utilitários Redis
export const redisUtils = {
  // Cache com TTL
  async setCache(key: string, value: any, ttlSeconds: number = 3600) {
    await redis.setex(key, ttlSeconds, JSON.stringify(value))
  },

  // Buscar cache
  async getCache<T>(key: string): Promise<T | null> {
    const cached = await redis.get(key)
    if (!cached) return null
    try {
      return JSON.parse(cached)
    } catch (error) {
      console.error('Erro ao fazer parse do cache Redis:', error.message)
      return null
    }
  },

  // Deletar cache
  async deleteCache(key: string) {
    await redis.del(key)
  },

  // Cache de sessão
  async setSession(sessionId: string, data: any, ttlSeconds: number = 86400) {
    await redis.setex(`session:${sessionId}`, ttlSeconds, JSON.stringify(data))
  },

  async getSession<T>(sessionId: string): Promise<T | null> {
    const session = await redis.get(`session:${sessionId}`)
    if (!session) return null
    try {
      return JSON.parse(session)
    } catch (error) {
      console.error('Erro ao fazer parse da sessão Redis:', error.message)
      return null
    }
  },

  async deleteSession(sessionId: string) {
    await redis.del(`session:${sessionId}`)
  }
}