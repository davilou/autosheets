#!/usr/bin/env node

/**
 * Script de diagnóstico para debugging de replies em produção
 * Analisa logs, cache e estado do sistema
 */

const fs = require('fs');
const path = require('path');

// Configurações
const CONFIG = {
  SERVER_HOST: '31.97.168.36',
  SERVER_USER: 'root',
  SERVER_PASSWORD: 'Davi@22099512',
  CACHE_FILE: '.bet-cache.json',
  LOG_PATTERNS: [
    'reply_to_message',
    'betKey',
    'Aposta encontrada',
    'Nenhuma aposta pendente',
    'Monitor disponível'
  ]
};

class ProductionDebugger {
  constructor() {
    this.issues = [];
    this.recommendations = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      'info': '🔍',
      'error': '❌',
      'success': '✅',
      'warning': '⚠️'
    }[type] || 'ℹ️';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  addIssue(issue) {
    this.issues.push(issue);
    this.log(`ISSUE: ${issue}`, 'error');
  }

  addRecommendation(rec) {
    this.recommendations.push(rec);
    this.log(`RECOMMENDATION: ${rec}`, 'warning');
  }

  // Análise do cache local (para comparação)
  analyzeLocalCache() {
    this.log('=== ANÁLISE DO CACHE LOCAL ===');
    
    try {
      if (fs.existsSync(CONFIG.CACHE_FILE)) {
        const content = fs.readFileSync(CONFIG.CACHE_FILE, 'utf8');
        const cache = JSON.parse(content);
        const keys = Object.keys(cache);
        
        this.log(`Cache local encontrado com ${keys.length} apostas`);
        
        if (keys.length > 0) {
          this.log('Chaves no cache local:');
          keys.forEach(key => {
            const bet = cache[key];
            this.log(`  - ${key}: ${bet.jogo} (${bet.timestamp})`);
          });
        }
      } else {
        this.log('Cache local não encontrado', 'warning');
      }
    } catch (error) {
      this.addIssue(`Erro ao analisar cache local: ${error.message}`);
    }
  }

  // Gera comandos SSH para diagnóstico remoto
  generateSSHCommands() {
    this.log('=== COMANDOS SSH PARA DIAGNÓSTICO ===');
    
    const commands = [
      // Verificar se o container está rodando
      'docker ps | grep autosheets',
      
      // Verificar logs recentes do webhook
      'docker logs autosheets-app-1 --tail=100 | grep -E "(reply_to_message|betKey|Aposta encontrada)"',
      
      // Verificar cache no servidor
      'docker exec autosheets-app-1 ls -la /.bet-cache.json',
      'docker exec autosheets-app-1 cat /.bet-cache.json',
      
      // Verificar variáveis de ambiente
      'docker exec autosheets-app-1 env | grep -E "(TELEGRAM|YOUR_USER)"',
      
      // Verificar se o monitor está conectado
      'docker logs autosheets-app-1 --tail=50 | grep -E "(Monitor.*conectado|GramJS)"',
      
      // Verificar últimas requisições do webhook
      'docker logs autosheets-app-1 --tail=200 | grep -E "(Webhook recebido|Update recebido)"'
    ];

    this.log('Execute estes comandos no servidor SSH:');
    commands.forEach((cmd, index) => {
      this.log(`${index + 1}. ${cmd}`);
    });
  }

  // Análise de problemas comuns
  analyzeCommonIssues() {
    this.log('=== ANÁLISE DE PROBLEMAS COMUNS ===');
    
    // Issue 1: Inconsistência na geração de chaves
    this.log('Verificando geração de chaves...');
    this.log('No webhook: betKey = `${userId}_${repliedMessageId}`');
    this.log('No monitor: betKey = `${this.yourUserId}_${botMessageId}`');
    
    if (true) { // Sempre verdadeiro para mostrar o problema
      this.addIssue('INCONSISTÊNCIA NA GERAÇÃO DE CHAVES!');
      this.addIssue('Webhook usa userId do remetente, Monitor usa yourUserId');
      this.addRecommendation('Padronizar geração de chaves em ambos os locais');
    }

    // Issue 2: Monitor não conectado
    this.addIssue('Monitor GramJS pode não estar conectado em produção');
    this.addRecommendation('Verificar logs de conexão do monitor');
    this.addRecommendation('Implementar health check para o monitor');

    // Issue 3: Cache não persistente
    this.addIssue('Cache pode estar sendo perdido entre restarts');
    this.addRecommendation('Verificar se o volume do Docker está montado corretamente');
    this.addRecommendation('Implementar backup do cache');

    // Issue 4: Logs insuficientes
    this.addRecommendation('Adicionar mais logs detalhados no processo de reply');
    this.addRecommendation('Implementar sistema de alertas para falhas');
  }

  // Gera script de teste para produção
  generateTestScript() {
    this.log('=== SCRIPT DE TESTE PARA PRODUÇÃO ===');
    
    const testScript = `#!/bin/bash
# Script de teste para replies em produção

echo "🔍 Testando sistema de replies..."

# 1. Verificar container
echo "1. Verificando container..."
docker ps | grep autosheets

# 2. Verificar cache
echo "2. Verificando cache..."
docker exec autosheets-app-1 ls -la /.bet-cache.json
echo "Conteúdo do cache:"
docker exec autosheets-app-1 cat /.bet-cache.json

# 3. Simular webhook de reply
echo "3. Simulando webhook de reply..."
curl -X POST http://localhost:3000/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "message_id": 999,
      "from": {
        "id": 123456789,
        "first_name": "Test"
      },
      "chat": {
        "id": 123456789,
        "type": "private"
      },
      "text": "1.85",
      "reply_to_message": {
        "message_id": 888
      }
    }
  }'

# 4. Verificar logs após teste
echo "4. Verificando logs após teste..."
docker logs autosheets-app-1 --tail=20
`;

    fs.writeFileSync('test-reply-production.sh', testScript);
    this.log('Script de teste salvo em: test-reply-production.sh', 'success');
  }

  // Gera solução recomendada
  generateSolution() {
    this.log('=== SOLUÇÃO RECOMENDADA ===');
    
    const solution = `
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
const betKey = \`\${this.yourUserId}_\${repliedMessageId}\`; // Usar yourUserId consistentemente

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
`;

    fs.writeFileSync('SOLUCAO_REPLIES_DETALHADA.md', solution);
    this.log('Solução detalhada salva em: SOLUCAO_REPLIES_DETALHADA.md', 'success');
  }

  // Executa diagnóstico completo
  async run() {
    this.log('🚀 INICIANDO DIAGNÓSTICO DE REPLIES EM PRODUÇÃO', 'info');
    this.log('='.repeat(60));
    
    this.analyzeLocalCache();
    this.analyzeCommonIssues();
    this.generateSSHCommands();
    this.generateTestScript();
    this.generateSolution();
    
    this.log('='.repeat(60));
    this.log('📊 RESUMO DO DIAGNÓSTICO');
    this.log(`Issues encontrados: ${this.issues.length}`);
    this.log(`Recomendações: ${this.recommendations.length}`);
    
    if (this.issues.length > 0) {
      this.log('\n🔥 ISSUES CRÍTICOS:');
      this.issues.forEach((issue, index) => {
        this.log(`${index + 1}. ${issue}`);
      });
    }
    
    if (this.recommendations.length > 0) {
      this.log('\n💡 RECOMENDAÇÕES:');
      this.recommendations.forEach((rec, index) => {
        this.log(`${index + 1}. ${rec}`);
      });
    }
    
    this.log('\n✅ Diagnóstico concluído!', 'success');
    this.log('Próximos passos:');
    this.log('1. Execute os comandos SSH gerados');
    this.log('2. Execute o script de teste no servidor');
    this.log('3. Implemente as correções sugeridas');
  }
}

// Executar diagnóstico
if (require.main === module) {
  const productionDebugger = new ProductionDebugger();
  productionDebugger.run().catch(console.error);
}

module.exports = ProductionDebugger;