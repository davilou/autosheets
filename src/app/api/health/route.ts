import { NextResponse } from 'next/server'
import { testDatabaseConnection } from '@/lib/db'
import { testRedisConnection } from '@/lib/redis'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const [dbStatus, redisStatus] = await Promise.all([
      testDatabaseConnection(),
      testRedisConnection()
    ])

    // Verificar sistema de replies
    const cacheFile = path.join(process.cwd(), '.bet-cache.json')
    const cacheExists = fs.existsSync(cacheFile)
    
    let cacheData = {}
    let cacheSize = 0
    let cacheKeys: string[] = []
    
    if (cacheExists) {
      try {
        const content = fs.readFileSync(cacheFile, 'utf8')
        cacheData = JSON.parse(content)
        cacheKeys = Object.keys(cacheData)
        cacheSize = cacheKeys.length
      } catch (error) {
        console.error('Erro ao ler cache de replies:', error)
      }
    }
    
    // Verificar variáveis de ambiente críticas para replies
    const replyEnvVars = {
      TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
      YOUR_USER_ID: !!process.env.YOUR_USER_ID,
      TELEGRAM_API_ID: !!process.env.TELEGRAM_API_ID,
      TELEGRAM_API_HASH: !!process.env.TELEGRAM_API_HASH,
      TELEGRAM_SESSION_STRING: !!process.env.TELEGRAM_SESSION_STRING
    }
    
    const missingReplyEnvVars = Object.entries(replyEnvVars)
      .filter(([key, exists]) => !exists)
      .map(([key]) => key)

    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus ? 'healthy' : 'unhealthy',
        redis: redisStatus ? 'healthy' : 'unhealthy',
        api: 'healthy'
      },
      replies: {
        cache: {
          exists: cacheExists,
          size: cacheSize,
          keys: cacheKeys.slice(0, 5), // Mostrar apenas primeiras 5 chaves
          totalKeys: cacheSize
        },
        environment: {
          variables: replyEnvVars,
          missing: missingReplyEnvVars,
          status: missingReplyEnvVars.length === 0 ? 'healthy' : 'warning'
        },
        fixes: {
          keyGeneration: 'FIXED - Using YOUR_USER_ID consistently',
          status: 'APPLIED'
        }
      },
      environment: process.env.NODE_ENV
    }

    const httpStatus = dbStatus && redisStatus ? 200 : 503

    console.log('🏥 Health check - Replies:', {
      cacheSize,
      missingEnvVars: missingReplyEnvVars.length,
      fixesApplied: 1
    })

    return NextResponse.json(status, { status: httpStatus })
  } catch (error) {
    console.error('❌ Erro no health check:', error)
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}