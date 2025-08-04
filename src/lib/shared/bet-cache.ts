import fs from 'fs';
import path from 'path';
import { BetData } from '@/lib/telegram/parser';

const CACHE_FILE = path.join(process.cwd(), '.bet-cache.json');

// CORREÇÃO: Definir interface para o cache
interface CacheData {
  [key: string]: BetData;
}

export class SharedBetCache {
  static saveBet(key: string, betData: BetData) {
    try {
      // CORREÇÃO: Tipar explicitamente o cache
      let cache: CacheData = {};
      if (fs.existsSync(CACHE_FILE)) {
        cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as CacheData;
      }
      cache[key] = betData;
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
      console.log(`💾 Aposta salva no cache: ${key}`);
    } catch (error) {
      console.error('Erro ao salvar no cache:', error);
    }
  }

  static getBet(key: string): BetData | null {
    try {
      if (!fs.existsSync(CACHE_FILE)) return null;
      // CORREÇÃO: Tipar explicitamente o cache
      const cache: CacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as CacheData;
      return cache[key] || null;
    } catch (error) {
      console.error('Erro ao ler cache:', error);
      return null;
    }
  }

  static removeBet(key: string) {
    try {
      if (!fs.existsSync(CACHE_FILE)) return;
      // CORREÇÃO: Tipar explicitamente o cache
      const cache: CacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as CacheData;
      delete cache[key];
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
      console.log(`🗑️ Aposta removida do cache: ${key}`);
    } catch (error) {
      console.error('Erro ao remover do cache:', error);
    }
  }
}