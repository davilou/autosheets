// Configurações de segurança baseadas no OWASP Top 10
export const SECURITY_CONFIG = {
  // Rate limiting
  RATE_LIMIT: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo 100 requests por IP
  },
  
  // JWT Configuration
  JWT: {
    expiresIn: '24h',
    algorithm: 'HS256' as const,
  },
  
  // Password requirements
  PASSWORD: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
  },
  
  // CORS settings
  CORS: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://yourdomain.com'] 
      : ['http://localhost:3000'],
    credentials: true,
  },
  
  // Security headers
  HEADERS: {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  },
};

export const TELEGRAM_CONFIG = {
  MAX_MESSAGE_LENGTH: 4096,
  ALLOWED_CHAT_TYPES: ['group', 'supergroup'],
  RATE_LIMIT_PER_CHAT: 30, // mensagens por minuto
};

export const SHEETS_CONFIG = {
  MAX_ROWS_PER_BATCH: 1000,
  RETRY_ATTEMPTS: 3,
  TIMEOUT_MS: 30000,
};