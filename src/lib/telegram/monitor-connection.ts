import GramJSMonitor from './gramjs-monitor';

// Instância global do GramJS monitor
let gramjsMonitor: GramJSMonitor | null = null;

// Função para conectar ao monitor existente
export function setGramJSMonitor(monitor: GramJSMonitor) {
  gramjsMonitor = monitor;
  console.log('🔗 Monitor GramJS conectado ao webhook');
}

// Função para obter o monitor
export function getGramJSMonitor(): GramJSMonitor | null {
  return gramjsMonitor;
}