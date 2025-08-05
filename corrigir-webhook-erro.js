/**
 * Script para corrigir erro de sintaxe no webhook
 */

const { spawn } = require('child_process');

console.log('🔧 CORRIGINDO ERRO DE SINTAXE NO WEBHOOK');
console.log('=' .repeat(60));

console.log('\n📍 PROBLEMA IDENTIFICADO:');
console.log('Linha 91 do webhook tem erro de sintaxe JSON');
console.log('Erro: SyntaxError: Unexpected token : in JSON at position 11');

console.log('\n🛠️ COMANDOS DE CORREÇÃO:');
console.log('=' .repeat(60));

const commands = [
    {
        desc: '1. Remover linha problemática (91)',
        cmd: 'ssh root@31.97.168.36 "cd /root/autosheets && docker compose -f docker-compose.prod.yml exec autosheets sed -i \'91d\' src/app/api/telegram/webhook/route.ts"'
    },
    {
        desc: '2. Remover linha problemática (92 - que agora será 91)',
        cmd: 'ssh root@31.97.168.36 "cd /root/autosheets && docker compose -f docker-compose.prod.yml exec autosheets sed -i \'91d\' src/app/api/telegram/webhook/route.ts"'
    },
    {
        desc: '3. Verificar se foi corrigido',
        cmd: 'ssh root@31.97.168.36 "cd /root/autosheets && docker compose -f docker-compose.prod.yml exec autosheets grep -n -A 3 -B 3 \'ADICIONAR\' src/app/api/telegram/webhook/route.ts"'
    },
    {
        desc: '4. Reiniciar container',
        cmd: 'ssh root@31.97.168.36 "cd /root/autosheets && docker compose -f docker-compose.prod.yml restart autosheets"'
    },
    {
        desc: '5. Testar webhook corrigido',
        cmd: 'ssh root@31.97.168.36 "cd /root/autosheets && docker compose -f docker-compose.prod.yml exec autosheets curl -X POST http://localhost:3000/api/telegram/webhook -H \'Content-Type: application/json\' -d \'{\"message\":{\"text\":\"teste\",\"message_id\":999,\"from\":{\"id\":670237902},\"chat\":{\"id\":-4975465313}}}\' -s"'
    }
];

console.log('\nExecute os comandos na ordem:');
commands.forEach((item, index) => {
    console.log(`\n${item.desc}:`);
    console.log(`${item.cmd}`);
});

console.log('\n🎯 APÓS A CORREÇÃO:');
console.log('=' .repeat(60));
console.log('1. O webhook deve parar de dar erro 500');
console.log('2. Teste um reply real no Telegram');
console.log('3. Monitore os logs para ver se o reply é processado');

console.log('\n📱 TESTE FINAL:');
console.log('Responda à mensagem ID 423 no Telegram com "1.85"');
console.log('Verifique se a aposta é removida do cache e salva no Google Sheets');