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
      let cache: CacheData = {};
      if (fs.existsSync(CACHE_FILE)) {
        const fileContent = fs.readFileSync(CACHE_FILE, 'utf8');
        console.log(`📖 Conteúdo atual do cache: ${fileContent}`);
        cache = JSON.parse(fileContent) as CacheData;
      }
      cache[key] = betData;
      const newContent = JSON.stringify(cache, null, 2);
      fs.writeFileSync(CACHE_FILE, newContent);
      console.log(`💾 Aposta salva no cache: ${key}`);
      console.log(`💾 Cache agora contém ${Object.keys(cache).length} apostas`);
    } catch (error) {
      console.error('❌ Erro ao salvar no cache:', error);
    }
  }

  static getBet(key: string): BetData | null {
    try {
      if (!fs.existsSync(CACHE_FILE)) {
        console.log('📁 Arquivo de cache não existe');
        return null;
      }
      const fileContent = fs.readFileSync(CACHE_FILE, 'utf8');
      console.log(`📖 Lendo cache: ${fileContent}`);
      const cache: CacheData = JSON.parse(fileContent) as CacheData;
      const result = cache[key] || null;
      console.log(`🔍 Procurando chave '${key}': ${!!result}`);
      console.log(`🔍 Chaves disponíveis: ${Object.keys(cache).join(', ')}`);
      return result;
    } catch (error) {
      console.error('❌ Erro ao ler cache:', error);
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