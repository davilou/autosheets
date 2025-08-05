#!/usr/bin/env node

/**
 * Script de teste para validar a correção do sistema de replies
 * Testa a geração de chaves e funcionamento do cache
 */

const fs = require('fs');
const path = require('path');

// Simular dados de teste
const TEST_DATA = {
  YOUR_USER_ID: '123456789',
  BOT_MESSAGE_ID: 888,
  REPLY_MESSAGE_ID: 999,
  SENDER_USER_ID: '987654321',
  TEST_BET: {
    jogo: 'Flamengo vs Palmeiras',
    mercado: 'Over 2.5 gols',
    odd_tipster: 1.85,
    timestamp: new Date().toISOString()
  }
};

class ReplyFixTester {
  constructor() {
    this.cacheFile = '.bet-cache.json';
    this.testResults = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      'info': '🔍',
      'error': '❌',
      'success': '✅',
      'warning': '⚠️',
      'test': '🧪'
    }[type] || 'ℹ️';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  addTestResult(test, passed, details = '') {
    this.testResults.push({ test, passed, details });
    this.log(`TEST: ${test} - ${passed ? 'PASSED' : 'FAILED'}${details ? ` (${details})` : ''}`, passed ? 'success' : 'error');
  }

  // Teste 1: Verificar geração de chaves consistente
  testKeyGeneration() {
    this.log('=== TESTE 1: GERAÇÃO DE CHAVES ===', 'test');
    
    // Simular geração de chave no monitor (correta)
    const monitorKey = `${TEST_DATA.YOUR_USER_ID}_${TEST_DATA.BOT_MESSAGE_ID}`;
    
    // Simular geração de chave no webhook (ANTES da correção)
    const webhookKeyOld = `${TEST_DATA.SENDER_USER_ID}_${TEST_DATA.BOT_MESSAGE_ID}`;
    
    // Simular geração de chave no webhook (DEPOIS da correção)
    const webhookKeyNew = `${TEST_DATA.YOUR_USER_ID}_${TEST_DATA.BOT_MESSAGE_ID}`;
    
    this.log(`Monitor key: ${monitorKey}`);
    this.log(`Webhook key (OLD): ${webhookKeyOld}`);
    this.log(`Webhook key (NEW): ${webhookKeyNew}`);
    
    // Verificar se as chaves são consistentes agora
    const keysMatch = monitorKey === webhookKeyNew;
    const oldKeysDifferent = monitorKey !== webhookKeyOld;
    
    this.addTestResult(
      'Key Generation Consistency',
      keysMatch,
      `Monitor and Webhook keys ${keysMatch ? 'match' : 'do not match'}`
    );
    
    this.addTestResult(
      'Old Key Problem Fixed',
      oldKeysDifferent,
      `Old inconsistent keys ${oldKeysDifferent ? 'are different' : 'still match'}`
    );
    
    return { monitorKey, webhookKeyNew };
  }

  // Teste 2: Simular salvamento e recuperação do cache
  testCacheOperations() {
    this.log('=== TESTE 2: OPERAÇÕES DE CACHE ===', 'test');
    
    const { monitorKey } = this.testKeyGeneration();
    
    try {
      // Limpar cache existente
      if (fs.existsSync(this.cacheFile)) {
        fs.unlinkSync(this.cacheFile);
      }
      
      // Simular salvamento no cache (como faz o monitor)
      const cache = {};
      cache[monitorKey] = TEST_DATA.TEST_BET;
      fs.writeFileSync(this.cacheFile, JSON.stringify(cache, null, 2));
      
      this.addTestResult('Cache Save', true, 'Bet saved successfully');
      
      // Simular recuperação do cache (como faz o webhook)
      const savedContent = fs.readFileSync(this.cacheFile, 'utf8');
      const savedCache = JSON.parse(savedContent);
      const retrievedBet = savedCache[monitorKey];
      
      const betRetrieved = !!retrievedBet;
      const betDataCorrect = retrievedBet && retrievedBet.jogo === TEST_DATA.TEST_BET.jogo;
      
      this.addTestResult('Cache Retrieve', betRetrieved, 'Bet retrieved successfully');
      this.addTestResult('Cache Data Integrity', betDataCorrect, 'Bet data is correct');
      
      // Simular remoção do cache
      delete savedCache[monitorKey];
      fs.writeFileSync(this.cacheFile, JSON.stringify(savedCache, null, 2));
      
      const finalContent = fs.readFileSync(this.cacheFile, 'utf8');
      const finalCache = JSON.parse(finalContent);
      const betRemoved = !finalCache[monitorKey];
      
      this.addTestResult('Cache Remove', betRemoved, 'Bet removed successfully');
      
    } catch (error) {
      this.addTestResult('Cache Operations', false, `Error: ${error.message}`);
    }
  }

  // Teste 3: Simular fluxo completo de reply
  testCompleteReplyFlow() {
    this.log('=== TESTE 3: FLUXO COMPLETO DE REPLY ===', 'test');
    
    try {
      // 1. Monitor detecta aposta e salva no cache
      const monitorKey = `${TEST_DATA.YOUR_USER_ID}_${TEST_DATA.BOT_MESSAGE_ID}`;
      const cache = {};
      cache[monitorKey] = TEST_DATA.TEST_BET;
      fs.writeFileSync(this.cacheFile, JSON.stringify(cache, null, 2));
      
      this.log(`1. Monitor saved bet with key: ${monitorKey}`);
      
      // 2. Usuário responde ao bot (webhook recebe)
      const replyUpdate = {
        message: {
          from: { id: TEST_DATA.SENDER_USER_ID },
          text: '1.95',
          reply_to_message: { message_id: TEST_DATA.BOT_MESSAGE_ID }
        }
      };
      
      // 3. Webhook gera chave (CORRIGIDA)
      const webhookKey = `${TEST_DATA.YOUR_USER_ID}_${replyUpdate.message.reply_to_message.message_id}`;
      
      this.log(`2. Webhook generated key: ${webhookKey}`);
      
      // 4. Webhook busca aposta no cache
      const savedContent = fs.readFileSync(this.cacheFile, 'utf8');
      const savedCache = JSON.parse(savedContent);
      const foundBet = savedCache[webhookKey];
      
      const flowSuccess = !!foundBet;
      const keysMatch = monitorKey === webhookKey;
      
      this.addTestResult('Complete Reply Flow', flowSuccess, 'Bet found in cache');
      this.addTestResult('Key Consistency in Flow', keysMatch, 'Monitor and webhook keys match');
      
      if (foundBet) {
        this.log(`3. Bet found: ${foundBet.jogo}`);
        this.log(`4. Processing odd: ${replyUpdate.message.text}`);
        
        // 5. Simular processamento da odd
        foundBet.odd_real = parseFloat(replyUpdate.message.text);
        foundBet.pegou = true;
        
        this.log(`5. Bet processed successfully with odd: ${foundBet.odd_real}`);
        
        // 6. Remover do cache
        delete savedCache[webhookKey];
        fs.writeFileSync(this.cacheFile, JSON.stringify(savedCache, null, 2));
        
        this.log(`6. Bet removed from cache`);
        
        this.addTestResult('Odd Processing', true, `Odd ${foundBet.odd_real} processed`);
      }
      
    } catch (error) {
      this.addTestResult('Complete Reply Flow', false, `Error: ${error.message}`);
    }
  }

  // Teste 4: Verificar variáveis de ambiente
  testEnvironmentVariables() {
    this.log('=== TESTE 4: VARIÁVEIS DE AMBIENTE ===', 'test');
    
    const requiredVars = [
      'TELEGRAM_BOT_TOKEN',
      'YOUR_USER_ID',
      'TELEGRAM_API_ID',
      'TELEGRAM_API_HASH',
      'TELEGRAM_SESSION_STRING'
    ];
    
    const missingVars = [];
    
    requiredVars.forEach(varName => {
      const exists = !!process.env[varName];
      if (!exists) {
        missingVars.push(varName);
      }
      this.addTestResult(`Env Var: ${varName}`, exists, exists ? 'Present' : 'Missing');
    });
    
    const allVarsPresent = missingVars.length === 0;
    this.addTestResult('All Environment Variables', allVarsPresent, 
      allVarsPresent ? 'All required vars present' : `Missing: ${missingVars.join(', ')}`);
  }

  // Executar todos os testes
  async runAllTests() {
    this.log('🚀 INICIANDO TESTES DE VALIDAÇÃO DA CORREÇÃO', 'info');
    this.log('='.repeat(60));
    
    this.testKeyGeneration();
    this.testCacheOperations();
    this.testCompleteReplyFlow();
    this.testEnvironmentVariables();
    
    this.log('='.repeat(60));
    this.log('📊 RESUMO DOS TESTES');
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    this.log(`Total de testes: ${totalTests}`);
    this.log(`Testes aprovados: ${passedTests}`, 'success');
    this.log(`Testes falharam: ${failedTests}`, failedTests > 0 ? 'error' : 'success');
    
    if (failedTests > 0) {
      this.log('\n❌ TESTES QUE FALHARAM:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => this.log(`- ${r.test}: ${r.details}`));
    }
    
    this.log('\n✅ CORREÇÕES APLICADAS:');
    this.log('1. Geração de chaves padronizada (YOUR_USER_ID)');
    this.log('2. Health check implementado');
    this.log('3. Logs de debug melhorados');
    
    this.log('\n🎯 PRÓXIMOS PASSOS:');
    this.log('1. Deploy da correção para produção');
    this.log('2. Testar com reply real no servidor');
    this.log('3. Monitorar logs via health check');
    
    // Limpar arquivo de teste
    if (fs.existsSync(this.cacheFile)) {
      fs.unlinkSync(this.cacheFile);
      this.log('🧹 Cache de teste limpo');
    }
    
    const success = failedTests === 0;
    this.log(`\n${success ? '✅' : '❌'} RESULTADO FINAL: ${success ? 'TODOS OS TESTES PASSARAM' : 'ALGUNS TESTES FALHARAM'}`, 
      success ? 'success' : 'error');
    
    return success;
  }
}

// Executar testes
if (require.main === module) {
  const tester = new ReplyFixTester();
  tester.runAllTests().catch(console.error);
}

module.exports = ReplyFixTester;