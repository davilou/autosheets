import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

/**
 * Extrai o usuário do token JWT do cabeçalho Authorization
 * @param request - NextRequest object
 * @returns Object com userId ou null se inválido
 */
export function getUserFromToken(request: NextRequest): { userId: string } | null {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET não configurado');
    }

    const decoded = jwt.verify(token, secret) as any;
    return { userId: decoded.userId };
  } catch (error) {
    return null;
  }
}

/**
 * Extrai apenas o token JWT do cabeçalho Authorization
 * @param request - NextRequest object
 * @returns Token string ou null se inválido
 */
export function getTokenFromRequest(request: NextRequest): string | null {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    return authHeader.substring(7);
  } catch (error) {
    return null;
  }
}

/**
 * Verifica se um token JWT é válido
 * @param token - JWT token string
 * @returns Decoded token data ou null se inválido
 */
export function verifyJWTToken(token: string): any | null {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET não configurado');
    }

    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
}