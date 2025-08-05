
/**
 * SOLUÇÃO PARA O PROBLEMA DE REPLIES EM PRODUÇÃO
 * 
 * PROBLEMA IDENTIFICADO:
 * - Inconsistência na geração de chaves entre webhook e monitor
 * - Monitor pode não estar conectado em produção
 * - Cache pode estar sendo perdido
 * 
 * CORREÇÕES NECESSÁRIAS:
 */

// 1. PADRONIZAR GERAÇÃO DE CHAVES
// No webhook (route.ts), linha ~85:
const betKey = `${this.yourUserId}_${repliedMessageId}`; // Usar yourUserId consistentemente

// 2. ADICIONAR VERIFICAÇÃO DE MONITOR
// No webhook, antes de processar reply:
if (!gramjsMonitor) {
  console.log('⚠️ Monitor não conectado, tentando reconectar...');
  // Lógica de reconexão
}

// 3. IMPLEMENTAR HEALTH CHECK
// Adicionar endpoint para verificar status:
app.get('/api/health', (req, res) => {
  res.json({
    monitor: !!gramjsMonitor,
    cache: fs.existsSync('.bet-cache.json'),
    pendingBets: gramjsMonitor?.getPendingBetsCount() || 0
  });
});

// 4. MELHORAR LOGS
// Adicionar logs mais detalhados em cada etapa do processo
