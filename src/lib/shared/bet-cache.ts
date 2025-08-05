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
    console.log(`🔍 [CACHE] Procurando chave: ${key}`);
    
    try {
      if (!fs.existsSync(CACHE_FILE)) {
        console.log('❌ [CACHE] Arquivo não existe');
        return null;
      }
      
      const fileContent = fs.readFileSync(CACHE_FILE, 'utf8');
      console.log(`📖 [CACHE] Conteúdo do arquivo: ${fileContent}`);
      
      const cache: CacheData = JSON.parse(fileContent) as CacheData;
      const keys = Object.keys(cache);
      const result = cache[key] || null;
      
      console.log(`📋 [CACHE] Total de apostas: ${keys.length}`);
      console.log(`📋 [CACHE] Chaves disponíveis: [${keys.join(', ')}]`);
      console.log(`🎯 [CACHE] Chave '${key}' encontrada: ${!!result}`);
      
      if (result) {
        console.log(`📊 [CACHE] Dados da aposta:`, {
          jogo: result.jogo,
          odd_tipster: result.odd_tipster,
          timestamp: result.timestamp
        });
      } else {
        console.log(`❌ [CACHE] Chave '${key}' não encontrada`);
        console.log(`💡 [CACHE] Chaves similares:`);
        keys.forEach(k => {
          const similarity = k.includes(key.split('_')[0]) || k.includes(key.split('_')[1]);
          if (similarity) {
            console.log(`   - ${k} (similar)`);
          }
        });
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
      const cache: CacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as CacheData;
      delete cache[key];
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
      console.log(`🗑️ Aposta removida do cache: ${key}`);
    } catch (error) {
      console.error('Erro ao remover do cache:', error);
    }
  }
}