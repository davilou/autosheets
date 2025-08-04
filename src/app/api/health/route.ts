import { NextResponse } from 'next/server'
import { testDatabaseConnection } from '@/lib/db'
import { testRedisConnection } from '@/lib/redis'

export async function GET() {
  try {
    const [dbStatus, redisStatus] = await Promise.all([
      testDatabaseConnection(),
      testRedisConnection()
    ])

    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus ? 'healthy' : 'unhealthy',
        redis: redisStatus ? 'healthy' : 'unhealthy',
        api: 'healthy'
      },
      environment: process.env.NODE_ENV
    }

    const httpStatus = dbStatus && redisStatus ? 200 : 503

    return NextResponse.json(status, { status: httpStatus })
  } catch (error) {
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