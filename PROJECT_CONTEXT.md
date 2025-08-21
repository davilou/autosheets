# Project Context - AutoSheets

Este documento descreve a arquitetura, os componentes principais e o fluxo operacional do AutoSheets, com foco na integração Telegram/Google e no sistema de monitoramento multi-usuário.

## Sumário
- Visão Geral
- Arquitetura
- Componentes
- Fluxo de Dados
- Monitoramento (Polling)
- Segurança
- Decisões de Arquitetura

## Visão Geral

O AutoSheets automatiza a coleta de dados de apostas de grupos do Telegram e a sincronização para planilhas no Google Sheets. O sistema opera com um frontend Next.js e um conjunto de serviços backend integrados por rotas de API e bibliotecas internas, além de um processo dedicado de monitoramento.

## Arquitetura

- Frontend: Next.js (App Router) com componentes shadcn/ui
- Backend: Rotas de API Next.js com validação Zod e serviços internos
- Banco de Dados: Prisma (SQLite em dev via `provider = "sqlite"` no schema; Postgres recomendado em produção via docker-compose.prod)
- Cache/Filas: Redis para enfileiramento e desacoplamento de processamento
- Integrações: Telegram (MTProto + Bot API), Google Sheets/Drive, Gemini AI
- Monitoramento: Processo dedicado por script Node para polling do Telegram

## Componentes

- UI/Pages (src/app/...)
- Serviços de Domínio (src/lib/**)
- Orquestração de Monitoramento (src/lib/telegram/monitor-manager.ts)
- Scripts de Execução (src/scripts/start-multi-user-monitor.ts)
- APIs Públicas (src/app/api/**)
- Integrações Externas (Google, Telegram)
- Deploy/Infra: docker-compose.yml (dev DB), docker-compose.prod.yml (Postgres, Redis, App, Nginx), Dockerfile, .github/workflows/deploy.yml

## Fluxo de Dados (alto nível)

1. Usuários autenticam e conectam credenciais (Telegram/Google)
2. Configuram grupos a monitorar e planilhas de destino
3. O processo de monitoramento consome mensagens do Telegram via polling
4. Mensagens são interpretadas (IA/heurísticas) e estruturadas como apostas
5. Apostas são persistidas, enfileiradas e sincronizadas com Google Sheets
6. Dashboard consome dados via API para visualização e gestão

## Monitoramento (Polling)

O sistema migrou de webhooks para um mecanismo de polling dedicado, executado por um script Node separado do servidor Next.js.

- Script: src/scripts/start-multi-user-monitor.ts
- Contexto: O script define process.env.MONITOR_CONTEXT = 'true' no início da execução
- Guardas: O MonitorManager valida o contexto com isMonitorContext() e bloqueia operações críticas (initialize, startUserMonitoring, stopUserMonitoring, restartUserMonitoring) fora do processo de monitoramento
- Execução: npm run monitor ou npm run dev:all (junto com o web)
- Isolamento: As rotas de API podem consultar estado e acionar controle, mas não disparam processamento se o contexto não for o do monitor

Impactos principais:
- Rotas/handlers de webhook não são utilizados; webhooks não são requisito
- Variáveis de ambiente de webhook podem existir em exemplos, mas são ignoradas pelo fluxo de polling
- nginx.conf atua como reverse proxy e rate limiting genérico para a aplicação web
- Healthcheck do container de app: GET http://localhost:3000/api/health (usado no compose de produção)

## Segurança

- JWT para autenticação de rotas
- Criptografia e hashing de segredos sensíveis
- Rate limiting via Nginx (se aplicável)
- Validação de entrada com Zod
- Princípio do menor privilégio para credenciais Google/Telegram
- Isolamento de execução: monitor roda separado do servidor web

## Decisões de Arquitetura

- Substituição de webhooks por polling para simplificar deploy e reduzir acoplamento com Nginx/SSL
- Introdução de MONITOR_CONTEXT para delimitar responsabilidades de execução
- Guards no MonitorManager para prevenir inicialização acidental em ambientes dev/SSR
- APIs permanecem para consulta/controle, respeitando o contexto de execução

## Produção (Docker Compose)

- postgres (15-alpine) com healthcheck e volume persistente
- redis (7-alpine) com senha e AOF, healthcheck e volume persistente
- autosheets (Next.js) buildado a partir do Dockerfile, usando .env.production e healthcheck em /api/health
- nginx (alpine) como reverse proxy publicando HTTP na porta 8080

## Próximos Passos

- Documentar métricas e observabilidade do monitor
- Otimizar fila/Redis para picos de tráfego
- Expandir cobertura de testes E2E para cenários multi-usuário