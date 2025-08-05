/**
 * Script para diagnosticar o problema de replies diretamente no servidor
 * via SSH e comandos docker-compose
 */

const { spawn } = require('child_process');
const readline = require('readline');

// Configurações do servidor
const SERVER_HOST = '31.97.168.36';
const SERVER_USER = 'root';
const SERVER_PASSWORD = 'Davi@22099512';

// Função para executar comando SSH
function executeSSHCommand(command, description) {
    return new Promise((resolve, reject) => {
        console.log(`\n🔍 ${description}`);
        console.log(`Executando: ${command}`);
        console.log('=' .repeat(60));
        
        const sshCommand = `ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "${command}"`;
        
        const process = spawn('ssh', [
            '-o', 'StrictHostKeyChecking=no',
            `${SERVER_USER}@${SERVER_HOST}`,
            command
        ], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let output = '';
        let errorOutput = '';
        
        process.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            console.log(text);
        });
        
        process.stderr.on('data', (data) => {
            const text = data.toString();
            errorOutput += text;
            console.error(text);
        });
        
        process.on('close', (code) => {
            if (code === 0) {
                resolve(output);
            } else {
                reject(new Error(`Comando falhou com código ${code}: ${errorOutput}`));
            }
        });
        
        // Enviar senha se necessário
        setTimeout(() => {
            if (process.stdin.writable) {
                process.stdin.write(SERVER_PASSWORD + '\n');
            }
        }, 1000);
    });
}

// Comandos de diagnóstico
const diagnosticCommands = [
    {
        command: 'cd /root/autosheets && pwd && ls -la',
        description: 'Verificar diretório do projeto'
    },
    {
        command: 'cd /root/autosheets && docker compose -f docker-compose.prod.yml ps',
        description: 'Status dos containers'
    },
    {
        command: 'cd /root/autosheets && docker compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json',
        description: 'Conteúdo atual do cache de apostas'
    },
    {
        command: 'cd /root/autosheets && docker compose -f docker-compose.prod.yml logs --tail=50 autosheets | grep -E "(reply|Reply|REPLY|betKey|670237902)"',
        description: 'Logs recentes relacionados a replies'
    },
    {
        command: 'cd /root/autosheets && docker compose -f docker-compose.prod.yml logs --tail=20 autosheets',
        description: 'Últimos 20 logs da aplicação'
    },
    {
        command: 'cd /root/autosheets && docker compose -f docker-compose.prod.yml exec autosheets env | grep -E "(MONITORED_CHAT_IDS|YOUR_USER_ID|TELEGRAM_BOT_TOKEN)"',
        description: 'Variáveis de ambiente críticas'
    }
];

// Função principal de diagnóstico
async function runDiagnostics() {
    console.log('🚀 DIAGNÓSTICO DO SERVIDOR DE PRODUÇÃO');
    console.log('=' .repeat(60));
    console.log(`Conectando em: ${SERVER_USER}@${SERVER_HOST}`);
    
    try {
        for (const { command, description } of diagnosticCommands) {
            try {
                await executeSSHCommand(command, description);
                console.log('✅ Comando executado com sucesso\n');
            } catch (error) {
                console.error(`❌ Erro no comando: ${error.message}\n`);
            }
        }
        
        console.log('\n🔍 ANÁLISE DOS RESULTADOS:');
        console.log('=' .repeat(60));
        console.log('1. Verifique se os containers estão rodando');
        console.log('2. Analise o conteúdo do cache - deve ter apostas pendentes');
        console.log('3. Procure por logs de reply nos últimos registros');
        console.log('4. Confirme se as variáveis de ambiente estão corretas');
        
        console.log('\n📋 PRÓXIMOS PASSOS:');
        console.log('=' .repeat(60));
        console.log('1. Se o cache estiver vazio, o problema é na detecção de apostas');
        console.log('2. Se o cache tiver apostas, o problema é no processamento de replies');
        console.log('3. Monitore logs em tempo real durante um teste de reply');
        
    } catch (error) {
        console.error('❌ Erro geral:', error.message);
    }
}

// Função para monitorar logs em tempo real
function monitorRealTimeLogs() {
    console.log('\n📊 COMANDOS PARA MONITORAR EM TEMPO REAL:');
    console.log('=' .repeat(60));
    
    const commands = [
        'ssh root@31.97.168.36 "cd /root/autosheets && docker compose -f docker-compose.prod.yml logs -f autosheets | grep -E \'(reply|Reply|REPLY|betKey)\'"',
        'ssh root@31.97.168.36 "cd /root/autosheets && docker compose -f docker-compose.prod.yml logs -f autosheets"',
        'ssh root@31.97.168.36 "cd /root/autosheets && watch -n 2 \'docker compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json\'"'
    ];
    
    console.log('\n1. Monitorar logs de reply:');
    console.log(commands[0]);
    
    console.log('\n2. Monitorar todos os logs:');
    console.log(commands[1]);
    
    console.log('\n3. Monitorar cache em tempo real:');
    console.log(commands[2]);
}

// Função para testar reply específico
function testSpecificReply() {
    console.log('\n🧪 TESTE DE REPLY ESPECÍFICO:');
    console.log('=' .repeat(60));
    
    console.log('1. Execute o monitoramento em tempo real em outro terminal');
    console.log('2. Identifique uma aposta no cache (ex: 670237902_423)');
    console.log('3. No Telegram, responda à mensagem correspondente com uma odd');
    console.log('4. Observe se aparecem logs de processamento');
    console.log('5. Verifique se a aposta é removida do cache');
    
    console.log('\n📱 COMANDOS PARA EXECUTAR DURANTE O TESTE:');
    console.log('ssh root@31.97.168.36 "cd /root/autosheets && docker compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json"');
}

// Executar diagnóstico
if (require.main === module) {
    runDiagnostics()
        .then(() => {
            monitorRealTimeLogs();
            testSpecificReply();
        })
        .catch(console.error);
}

module.exports = {
    executeSSHCommand,
    runDiagnostics,
    monitorRealTimeLogs,
    testSpecificReply
};