# AutoSheets 📊

Uma aplicação web avançada que automatiza a coleta, interpretação e transferência de dados de apostas de grupos do Telegram para planilhas do Google Sheets, oferecendo uma solução completa para controle e análise de apostas.

## 🎯 Visão Geral

O AutoSheets é uma plataforma robusta desenvolvida para apostadores que buscam automatizar completamente o processo de coleta, organização e análise de dados de apostas compartilhadas em grupos do Telegram. Utilizando inteligência artificial e integração avançada com APIs, a aplicação interpreta mensagens de apostas em tempo real, estrutura os dados de forma inteligente e os transfere automaticamente para planilhas do Google Sheets.

## ✨ Funcionalidades Principais

- 🤖 **Monitoramento Multi-Usuário**: Sistema avançado de monitoramento simultâneo de múltiplos grupos do Telegram
- 📈 **Integração Google Sheets**: Transferência automática e sincronização bidirecional com planilhas
- 🧠 **IA Integrada**: Interpretação inteligente de mensagens usando Google Gemini AI
- 👤 **Sistema de Autenticação**: Gerenciamento seguro de usuários com JWT e criptografia
- 📊 **Dashboard Avançado**: Interface web completa para monitoramento em tempo real
- 🔐 **Segurança Enterprise**: Implementação completa das práticas OWASP Top 10
- 📱 **API Telegram Avançada**: Integração com MTProto e Telegram Bot API
- 🗄️ **Sistema de Filas**: Processamento assíncrono com Redis para alta performance
- 📋 **Gestão de Credenciais**: Gerenciamento seguro de múltiplas contas Telegram e Google

## 🛠️ Tecnologias Utilizadas

### Core Framework
- **Frontend**: Next.js 15.4.3 com App Router e Turbopack
- **Runtime**: React 18.3.1, TypeScript 5.x
- **UI/UX**: Shadcn/ui, Tailwind CSS 3.4.17, Radix UI Components

### Backend & Database
- **API**: Next.js API Routes com validação Zod
- **ORM**: Prisma 6.13.0 com SQLite (desenvolvimento)
- **Cache**: Redis com ioredis 5.7.0
- **Autenticação**: JWT + bcryptjs com validação de sessão

### Integrações Avançadas
- **Telegram**: 
  - MTProto Core 6.3.0 (cliente nativo)
  - Telegraf 4.16.3 (bot framework)
  - Node Telegram Bot API 0.66.0
- **Google Services**:
  - Google APIs 154.0.0 (Sheets, Drive)
  - Google Generative AI 0.24.1 (Gemini)
- **Automação**: Playwright 1.54.2 para testes E2E

### DevOps & Deploy
- **Containerização**: Docker + Docker Compose
- **Build Tools**: TSX 4.20.3, ESLint 9.x
- **Monitoramento**: Sistema customizado de logs e métricas

## 🚀 Começando

### Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Conta Google (para Google Sheets API)
- Bot do Telegram (para Telegram Bot API)

### Instalação

1. **Clone o repositório**
   ```bash
   git clone <repository-url>
   cd autosheets
   ```

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edite o arquivo `.env.local` com suas credenciais:
   - `DATABASE_URL`: URL do banco de dados
   - `JWT_SECRET`: Chave secreta para JWT
   - `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`: Credenciais da API do Google
   - `TELEGRAM_BOT_TOKEN`: Token do seu bot do Telegram
   - `GEMINI_API_KEY`: Chave da API do Google Gemini

4. **Configure o banco de dados**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Execute o servidor de desenvolvimento**
   ```bash
   npm run dev
   ```

   Abra [http://localhost:3000](http://localhost:3000) no seu navegador.

## 📋 Scripts Disponíveis

### Desenvolvimento
- `npm run dev` - Inicia o servidor de desenvolvimento com Turbopack
- `npm run build` - Cria a build otimizada de produção
- `npm run start` - Inicia o servidor de produção
- `npm run lint` - Executa o linter ESLint
- `npm run dev:all` - Inicia Next.js e o monitor de polling simultaneamente (útil no desenvolvimento)

### Monitoramento
- `npm run monitor` - Inicia o sistema de monitoramento multi-usuário (via polling)
- Dica: em desenvolvimento, use `npm run dev:all` para rodar web e monitor lado a lado

### Utilitários
- Criar um usuário de teste (email: test@example.com / senha: 123456)
  ```bash
  npx tsx src/scripts/create-test-user.ts
  ```

## 🐳 Deploy com Docker

### Desenvolvimento
```bash
docker-compose up -d
```

### Produção (Traefik + HTTPS)
Pré-requisitos:
- Registre um DNS A para o domínio autosheets.loudigital.shop apontando para o IP do servidor
- Portas 80 e 443 liberadas no firewall do servidor

Passos:
1. Copie o projeto para o servidor (ex.: /opt/autosheets) e remova qualquer versão antiga previamente implantada
2. Crie o arquivo `.env.production` a partir de `.env.production.example` e preencha as variáveis
3. Suba a stack de produção com Traefik (HTTPS automático via Let's Encrypt):
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Observações:
- O Traefik recebe o tráfego público nas portas 80/443 e encaminha para o Nginx interno
- O Nginx faz o reverse proxy para a aplicação Next.js na porta 3000
- Postgres e Redis não expõem portas para o host (acesso apenas pela rede interna do Docker)

## 🔄 Migração de dados: SQLite → PostgreSQL
Se você possui dados em SQLite (por exemplo, de uma versão inicial), faça a migração para o Postgres antes de iniciar a nova versão.

Exemplo usando pgloader (no servidor Ubuntu):
1) Garanta que o serviço Postgres da stack está rodando:
```bash
docker compose -f docker-compose.prod.yml up -d postgres
```
2) Coloque o arquivo SQLite (ex.: dev.db) em um diretório acessível (ex.: /opt/autosheets/prisma/dev.db)
3) Execute o pgloader em um container, na mesma rede do Compose:
```bash
docker run --rm \
  --network=autosheets_network \
  -v /opt/autosheets/prisma:/data \
  dimitri/pgloader:latest \
  pgloader sqlite:///data/dev.db postgresql://autosheets:senha_postgres_forte_123@postgres:5432/autosheets
```
4) Gere o client do Prisma e sincronize o schema no Postgres:
```bash
npx prisma generate
npx prisma db push
```

Dica: faça um backup antes de migrar e valide os dados após a importação.

## 🔑 Variáveis de Ambiente essenciais

- Banco de Dados (produção): usar `provider = "postgresql"` no Prisma e definir `DATABASE_URL` no `.env.production`
- Redis: configure `REDIS_HOST`, `REDIS_PORT` e `REDIS_PASSWORD`
- Telegram: `TELEGRAM_BOT_TOKEN` obrigatório (monitor roda via polling)
- Google/Gemini: preencha as chaves e credenciais

## 📁 Estrutura do Projeto

```
autosheets/
├── src/
│   ├── app/                    # App Router (Next.js 15)
│   │   ├── api/               # API Routes e endpoints
│   │   ├── login/             # Autenticação e login
│   │   ├── register/          # Registro de usuários
│   │   ├── profile/           # Perfil do usuário
│   │   ├── monitoring/        # Dashboard de monitoramento
│   │   ├── spreadsheets/      # Gerenciamento de planilhas
│   │   ├── telegram/          # Configurações Telegram
│   │   ├── forgot-password/   # Recuperação de senha
│   │   ├── reset-password/    # Reset de senha
│   │   └── verify-email/      # Verificação de email
│   ├── components/            # Componentes React reutilizáveis
│   │   ├── auth/             # Componentes de autenticação
│   │   ├── monitoring/       # Componentes de monitoramento
│   │   ├── spreadsheets/     # Componentes de planilhas
│   │   ├── telegram/         # Componentes Telegram
│   │   └── ui/              # Componentes UI base (Shadcn)
│   ├── lib/                  # Bibliotecas e utilitários
│   │   ├── ai/              # Integração com IA
│   │   ├── auth/            # Sistema de autenticação
│   │   ├── drive/           # Google Drive API
│   │   ├── gemini/          # Google Gemini AI
│   │   ├── security/        # Utilitários de segurança
│   │   ├── services/        # Serviços da aplicação
│   │   ├── sheets/          # Google Sheets API
│   │   ├── spreadsheets/    # Lógica de planilhas
│   │   ├── telegram/        # APIs do Telegram
│   │   └── shared/          # Utilitários compartilhados
│   ├── scripts/             # Scripts de automação
│   │   ├── create-test-user.ts
│   │   └── start-multi-user-monitor.ts
│   └── types/               # Definições TypeScript
│       ├── bet-data.ts
│       ├── input.d.ts
│       └── spreadsheets.ts
├── prisma/                   # Database schema e migrações
│   ├── migrations/          # Migrações do banco
│   └── schema.prisma        # Schema do Prisma
├── docs/                     # Documentação completa
│   ├── PRD.md
│   ├── MONITORING.md
│   └── context/
├── .github/workflows/        # GitHub Actions CI/CD
├── backups/                  # Backups automáticos
└── scripts/                  # Scripts de sistema
```

## 🗄️ Arquitetura do Banco de Dados

O AutoSheets utiliza uma arquitetura de banco de dados robusta e escalável:

### Modelos Principais
- **User**: Gerenciamento completo de usuários com autenticação JWT
- **Bet**: Armazenamento estruturado de dados de apostas
- **TelegramCredential**: Múltiplas credenciais Telegram por usuário
- **TelegramSession**: Sessões persistentes com backup automático
- **MonitoredGroup**: Configuração avançada de grupos monitorados
- **UserMonitorSession**: Sessões de monitoramento em tempo real
- **MonitorQueue**: Sistema de filas para processamento assíncrono
- **UserSpreadsheet**: Gerenciamento de planilhas vinculadas
- **GoogleDriveCredential**: Credenciais OAuth2 do Google

### Características Avançadas
- **Multi-tenancy**: Isolamento completo de dados por usuário
- **Soft Delete**: Preservação de dados históricos
- **Auditoria**: Timestamps automáticos em todas as entidades
- **Relacionamentos Complexos**: Foreign keys com cascade delete
- **Índices Otimizados**: Performance otimizada para consultas frequentes
- **Enums Tipados**: Status controlados para estados da aplicação

## 🔧 Configuração de Integrações

### Google Sheets API
1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative a Google Sheets API
4. Crie credenciais OAuth 2.0
5. Configure as URLs de redirecionamento

### Telegram Bot
1. Converse com [@BotFather](https://t.me/botfather) no Telegram
2. Crie um novo bot com `/newbot`
3. Copie o token fornecido
4. Configure o token no arquivo `.env.local` (`TELEGRAM_BOT_TOKEN`) e inicie o monitor por polling com `npm run monitor`

### Google Gemini AI
1. Acesse [Google AI Studio](https://makersuite.google.com/)
2. Gere uma chave de API
3. Configure a chave no arquivo `.env.local`

## 📚 Documentação

Para mais informações detalhadas, consulte a pasta `docs/`:

- [PRD.md](./docs/PRD.md) - Documento de Requisitos do Produto
- [MONITORING.md](./docs/MONITORING.md) - Documentação do sistema de monitoramento

## 📊 Status do Projeto

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-15.4.3-black.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)
![Prisma](https://img.shields.io/badge/Prisma-6.13.0-2D3748.svg)
![License](https://img.shields.io/badge/license-Private-red.svg)

## 🤝 Contribuindo

### Pré-requisitos para Desenvolvimento
- Node.js 18+ com npm/yarn
- Docker e Docker Compose
- Conhecimento em TypeScript, React e Next.js
- Familiaridade com Prisma ORM

### Processo de Contribuição
1. **Fork** o repositório
2. **Clone** seu fork localmente
3. **Instale** as dependências: `npm install`
4. **Configure** o ambiente: `cp .env.local.example .env.local`
5. **Execute** o setup do banco: `npx prisma db push`
6. **Crie** uma branch: `git checkout -b feature/nova-funcionalidade`
7. **Desenvolva** seguindo os padrões do projeto
8. **Teste** suas alterações: `npm run lint && npm run build`
9. **Commit** suas mudanças: `git commit -m 'feat: adiciona nova funcionalidade'`
10. **Push** para sua branch: `git push origin feature/nova-funcionalidade`
11. **Abra** um Pull Request detalhado

### Padrões de Código
- **ESLint**: Configuração rigorosa para qualidade de código
- **TypeScript**: Tipagem estrita obrigatória
- **Prisma**: Migrations para mudanças no banco
- **Commits**: Conventional Commits (feat, fix, docs, etc.)

## 📄 Licença

Este projeto é **privado** e destinado ao uso pessoal. Todos os direitos reservados.

## 🆘 Suporte e Documentação

### Documentação Completa
- 📋 [PRD - Requisitos do Produto](./docs/PRD.md)
- 📊 [Sistema de Monitoramento](./docs/MONITORING.md)
- 🔐 [Solução SSL/Nginx](./docs/SOLUCAO_SSL_NGINX_COMPLETA.md)

### Resolução de Problemas
1. **Consulte** a documentação na pasta `docs/`
2. **Verifique** os logs do sistema de monitoramento
3. **Execute** os scripts de diagnóstico disponíveis
4. **Entre em contato** com o desenvolvedor se necessário

---

**🚀 Desenvolvido com tecnologias de ponta para automatizar e revolucionar o controle de apostas**

*AutoSheets - Transformando dados do Telegram em insights acionáveis* 📊✨
