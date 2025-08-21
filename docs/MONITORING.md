# Sistema de Monitoramento Multi-Usuário (Polling)

Este documento descreve o sistema de monitoramento personalizado de grupos do Telegram, agora operando exclusivamente via polling com um processo dedicado, isolado do servidor Next.js.

## Visão Geral

O sistema permite que múltiplos usuários configurem e monitorem grupos/canais do Telegram de forma independente, com filtros personalizados e processamento em fila. O monitoramento é executado por um script Node dedicado que realiza polling no Telegram, garantindo isolamento do servidor web.

## Componentes Principais

### 1. Modelos de Banco de Dados

- MonitoredGroup: Grupos/canais configurados para monitoramento
- UserMonitorSession: Sessões ativas de monitoramento por usuário
- MonitorQueue: Fila de processamento de mensagens

### 2. Classes de Monitoramento

- MultiUserTelegramMonitor: Monitor individual por usuário
- MonitorManager: Gerenciador global de todas as sessões, com guards de contexto

### 3. APIs REST

- /api/monitoring/groups — Gerenciamento de grupos
- /api/monitoring/sessions — Controle de sessões (listar, iniciar)
- /api/monitoring/sessions/[credentialId] — Controle de sessão específica (parar, reiniciar)
- /api/monitoring/stats — Estatísticas e métricas
- /api/telegram/search-groups — Busca de grupos

### 4. Interface Web

- /monitoring — Página principal de monitoramento
- GroupManager — Componente para gerenciar grupos

## Funcionalidades

### Gerenciamento de Grupos

- Buscar grupos/canais do Telegram
- Adicionar grupos para monitoramento
- Configurar filtros personalizados:
  - Palavras-chave obrigatórias
  - Odds mínimas e máximas
  - Usuários permitidos/bloqueados
  - Horários de funcionamento
- Ativar/desativar monitoramento por grupo
- Editar e remover grupos

### Sistema de Sessões

- Iniciar monitoramento por credencial
- Parar e reiniciar sessões
- Monitoramento de saúde (heartbeat)
- Isolamento de dados entre usuários
- Recuperação automática de sessões

### Processamento de Mensagens

- Fila de processamento com prioridades
- Aplicação de filtros personalizados
- Detecção de apostas via Gemini AI
- Persistência no banco de dados
- Tratamento de erros e retry

### Estatísticas e Monitoramento

- Métricas gerais do sistema
- Estatísticas por usuário
- Monitoramento de performance
- Logs de atividade
- Alertas de problemas

## Como Usar

### 1. Configurar Grupos

1. Acesse /monitoring
2. Na seção "Grupos Monitorados", clique em "Adicionar Grupo"
3. Busque o grupo/canal desejado
4. Configure os filtros personalizados
5. Salve a configuração

### 2. Iniciar Monitoramento

1. Na seção "Sessões de Monitoramento", clique em "Iniciar Sessão"
2. Selecione a credencial do Telegram
3. O sistema registrará a solicitação de sessão; o processo de monitor (polling) executará o trabalho

### 3. Monitorar Atividade

- Visualize estatísticas em tempo real
- Acompanhe o status das sessões
- Monitore a fila de processamento
- Verifique logs de erros

## Execução (Linha de Comando)

### Iniciar Monitor Multi-Usuário (Polling)

```bash
npm run monitor
```

Este script:
- Inicializa o sistema de monitoramento
- Recupera sessões ativas
- Configura handlers de eventos
- Exibe estatísticas periódicas
- Suporta graceful shutdown
- Opera via polling do Telegram e define MONITOR_CONTEXT automaticamente

### Contexto e Guards de Execução

- O script src/scripts/start-multi-user-monitor.ts define process.env.MONITOR_CONTEXT = 'true' antes de carregar dependências
- O MonitorManager valida o contexto com isMonitorContext() e bloqueia operações críticas (initialize, startUserMonitoring, stopUserMonitoring, restartUserMonitoring) quando executadas fora do processo de monitor
- As rotas de API podem consultar estado e solicitar controle de sessões, mas não iniciam processamento no servidor Next.js em dev/SSR

## Configuração de Filtros

### Palavras-chave
```json
{
  "keywords": ["aposta", "bet", "jogo"]
}
```

### Odds
```json
{
  "minOdds": 1.5,
  "maxOdds": 10.0
}
```

### Usuários
```json
{
  "allowedUsers": ["@usuario1", "@usuario2"],
  "blockedUsers": ["@spam", "@bot"]
}
```

### Horários
```json
{
  "workingHours": {
    "start": "08:00",
    "end": "22:00",
    "timezone": "America/Sao_Paulo"
  }
}
```

## Monitoramento de Performance

### Métricas Disponíveis

- Sessões Ativas: Número de usuários monitorando
- Grupos Monitorados: Total de grupos configurados
- Apostas Detectadas: Contagem de apostas nas últimas 24h
- Fila de Processamento: Mensagens pendentes por status
- Taxa de Erro: Percentual de falhas no processamento
- Latência Média: Tempo médio de processamento

### Alertas Automáticos

- Sessões não saudáveis (sem heartbeat)
- Fila de processamento muito grande
- Taxa de erro elevada
- Falhas de conexão com Telegram

## Troubleshooting

### Problemas Comuns

1. Sessão não inicia
   - Verifique credenciais do Telegram
   - Confirme que a conta está ativa
   - Cheque logs do monitor (npm run monitor)

2. Mensagens não são processadas
   - Verifique filtros configurados
   - Confirme que o grupo está ativo
   - Cheque a fila de processamento

3. Performance baixa
   - Reduza o número de grupos monitorados
   - Ajuste filtros para serem mais específicos
   - Verifique recursos do servidor

### Logs e Debugging

- Logs do sistema: Console do script npm run monitor
- Logs da aplicação: Terminal do npm run dev
- Banco de dados: npx prisma studio

## Segurança

- Isolamento de dados entre usuários
- Validação de autorização em todas as APIs
- Sanitização de dados de entrada
- Criptografia de credenciais sensíveis
- Rate limiting nas APIs (quando aplicável)
- Isolamento de execução: processamento só ocorre com MONITOR_CONTEXT=true

## Limitações Conhecidas

- Máximo de 10 grupos por usuário (configurável)
- Processamento sequencial por usuário
- Dependência da API do Telegram
- Requer credenciais válidas do Telegram

## Próximos Passos

- Otimizar uso de Redis para cache e filas
- Documentar métricas/observabilidade do monitor
- Expandir cobertura de testes E2E para cenários multi-usuário
- Adicionar notificações (e.g., email/Slack) para eventos críticos