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
        try {
          cache = JSON.parse(fileContent) as CacheData;
        } catch (parseError) {
          console.error('❌ Erro ao fazer parse do cache, reinicializando:', parseError instanceof Error ? parseError.message : String(parseError));
          cache = {};
          fs.writeFileSync(CACHE_FILE, '{}');
        }
      }
      cache[key] = betData;
      const newContent = JSON.stringify(cache, null, 2);
      fs.writeFileSync(CACHE_FILE, newContent);
      console.log(`💾 Aposta salva no cache: ${key} (total: ${Object.keys(cache).length} apostas)`);
    } catch (error) {
      console.error('❌ Erro ao salvar no cache:', error);
    }
  }

  static getBet(key: string): BetData | null {
    console.log(`🔍 [CACHE] Procurando chave: ${key}`);
    
    try {
      if (!fs.existsSync(CACHE_FILE)) {
        console.log('❌ [CACHE] Arquivo não existe');
        return null;
      }
      
      const fileContent = fs.readFileSync(CACHE_FILE, 'utf8');
      
      let cache: CacheData;
      try {
        cache = JSON.parse(fileContent) as CacheData;
      } catch (parseError) {
        console.error('❌ [CACHE] Erro ao fazer parse, retornando null:', parseError instanceof Error ? parseError.message : String(parseError));
        return null;
      }
      const keys = Object.keys(cache);
      const result = cache[key] || null;
      
      console.log(`📋 [CACHE] Total de apostas no cache: ${keys.length}`);
      console.log(`🎯 [CACHE] Chave '${key}' encontrada: ${!!result}`);
      
      if (!result) {
        // Logar até 5 chaves similares para debug, sem conteúdo
        const [p1, p2] = key.split('_');
        const similares = keys.filter(k => k.includes(p1) || (p2 && k.includes(p2))).slice(0, 5);
        if (similares.length) {
          console.log(`💡 [CACHE] Chaves similares: [${similares.join(', ')}]`);
        }
      }
      
      return result;
    } catch (error) {
      console.error('❌ [CACHE] Erro ao ler cache:', error);
      return null;
    }
  }

  static removeBet(key: string) {
    try {
      if (!fs.existsSync(CACHE_FILE)) return;
      // CORREÇÃO: Tipar explicitamente o cache
      let cache: CacheData;
      try {
        cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as CacheData;
      } catch (parseError) {
        console.error('❌ [CACHE] Erro ao fazer parse para remoção:', parseError instanceof Error ? parseError.message : String(parseError));
        return;
      }
      delete cache[key];
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
      console.log(`🗑️ Aposta removida do cache: ${key}`);
    } catch (error) {
      console.error('Erro ao remover do cache:', error);
    }
  }

  static getAllBets(): CacheData {
    try {
      if (!fs.existsSync(CACHE_FILE)) {
        return {};
      }
      
      const fileContent = fs.readFileSync(CACHE_FILE, 'utf8');
      try {
        return JSON.parse(fileContent) as CacheData;
      } catch (parseError) {
        console.error('❌ [CACHE] Erro ao fazer parse para getAllBets:', parseError instanceof Error ? parseError.message : String(parseError));
        return {};
      }
    } catch (error) {
      console.error('❌ [CACHE] Erro ao ler todas as apostas:', error);
      return {};
    }
  }
}