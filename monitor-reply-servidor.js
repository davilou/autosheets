/**
 * Script para monitorar e testar replies no servidor de produção
 */

const { spawn } = require('child_process');

console.log('🎯 DIAGNÓSTICO COMPLETO - PROBLEMA DE REPLIES');
console.log('=' .repeat(60));

console.log('\n📊 SITUAÇÃO ATUAL IDENTIFICADA:');
console.log('✅ Containers estão rodando');
console.log('✅ Cache contém 2 apostas pendentes:');
console.log('   - 670237902_420 (GSC Liebenfels vs SGA Sirnitz)');
console.log('   - 670237902_423 (GSC Liebenfels vs SGA Sirnitz)');
console.log('❌ Replies não estão sendo processados');

console.log('\n🔍 TESTE ESPECÍFICO PARA REPLY:');
console.log('=' .repeat(60));
console.log('1. Abra outro terminal e execute o comando de monitoramento:');
console.log('   ssh root@31.97.168.36 "cd /root/autosheets && docker compose -f docker-compose.prod.yml logs -f autosheets | grep -E \'(reply|Reply|REPLY|betKey|webhook)\'"');

console.log('\n2. No Telegram, responda à mensagem ID 423 com uma odd (ex: "1.85")');

console.log('\n3. Observe se aparecem logs como:');
console.log('   - "📥 Webhook recebido"');
console.log('   - "🔍 Reply detectado"');
console.log('   - "betKey: 670237902_423"');
console.log('   - "✅ Aposta processada"');

console.log('\n4. Verifique se a aposta foi removida do cache:');
console.log('   ssh root@31.97.168.36 "cd /root/autosheets && docker compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json"');

console.log('\n🚨 POSSÍVEIS CAUSAS DO PROBLEMA:');
console.log('=' .repeat(60));
console.log('1. Webhook não está recebendo mensagens de reply');
console.log('2. Estrutura do payload de reply está diferente');
console.log('3. Geração da betKey está incorreta');
console.log('4. Cache não está sendo acessado corretamente');

console.log('\n🔧 COMANDOS DE DIAGNÓSTICO DIRETO:');
console.log('=' .repeat(60));

const commands = [
    {
        desc: 'Monitorar logs em tempo real',
        cmd: 'ssh root@31.97.168.36 "cd /root/autosheets && docker compose -f docker-compose.prod.yml logs -f autosheets"'
    },
    {
        desc: 'Verificar cache atual',
        cmd: 'ssh root@31.97.168.36 "cd /root/autosheets && docker compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json"'
    },
    {
        desc: 'Verificar variáveis de ambiente',
        cmd: 'ssh root@31.97.168.36 "cd /root/autosheets && docker compose -f docker-compose.prod.yml exec autosheets env | grep -E \'(TELEGRAM_BOT_TOKEN|YOUR_USER_ID|MONITORED_CHAT_IDS)\'"'
    },
    {
        desc: 'Testar webhook manualmente',
        cmd: 'ssh root@31.97.168.36 "cd /root/autosheets && curl -X POST https://autosheets.robertoalvesdasilva.com.br/api/webhook/telegram -H \'Content-Type: application/json\' -d \'{\"message\":{\"text\":\"teste\"}}\' -v"'
    }
];

commands.forEach((item, index) => {
    console.log(`${index + 1}. ${item.desc}:`);
    console.log(`   ${item.cmd}`);
    console.log('');
});

console.log('\n🎯 PLANO DE AÇÃO:');
console.log('=' .repeat(60));
console.log('1. Execute o monitoramento em tempo real');
console.log('2. Faça um reply no Telegram na mensagem ID 423');
console.log('3. Se não aparecer nenhum log, o problema é no webhook');
console.log('4. Se aparecer log mas não processar, o problema é na lógica de reply');
console.log('5. Verifique se a betKey está sendo gerada corretamente');

console.log('\n📱 TESTE MANUAL ESPECÍFICO:');
console.log('=' .repeat(60));
console.log('Mensagem para responder: ID 423');
console.log('Texto da resposta: "1.85"');
console.log('Chave esperada no cache: 670237902_423');
console.log('Resultado esperado: Aposta removida do cache e salva no Google Sheets');

console.log('\n🔍 MONITORAMENTO ATIVO:');
console.log('Execute este comando em outro terminal para monitorar:');
console.log('ssh root@31.97.168.36 "cd /root/autosheets && docker compose -f docker-compose.prod.yml logs -f autosheets | grep -E \'(reply|Reply|REPLY|betKey|webhook|670237902_423)\'"');