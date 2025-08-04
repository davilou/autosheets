# PRD - Auto Sheets

## Visão Geral
O Auto Sheets é uma aplicação web que coleta dados de apostas enviadas em grupos do Telegram e os transfere automaticamente para planilhas do Google Sheets, facilitando o controle e análise de apostas para apostadores.

## Objetivos
- Objetivo principal: Automatizar a coleta e organização de dados de apostas do Telegram para Google Sheets
- Objetivos secundários: 
  - Interpretar e estruturar dados de apostas
  - Fornecer interface web para gerenciamento
  - Garantir segurança dos dados dos usuários

## Público-Alvo
Apostadores do ciclo social do desenvolvedor que utilizam grupos do Telegram para compartilhar apostas

## Funcionalidades Core
1. Coletar dados de grupos no Telegram
2. Interpretar e estruturar esses dados
3. Enviar dados para planilhas do Google Sheets
4. Sistema de autenticação de usuários
5. APIs públicas para integração

## Requisitos Técnicos
- Framework: Next.js 15.x com App Router
- UI: Shadcn/ui + Tailwind CSS
- Linguagem: TypeScript
- Autenticação: JWT + bcrypt
- Integrações: Telegram Bot API + Google Sheets API
- Dados: Mock data inicialmente (sem banco de dados)
- Deploy: A definir

## Requisitos de Segurança (OWASP Top 10)
1. **Broken Access Control**: Implementar RBAC e validação de permissões
2. **Cryptographic Failures**: HTTPS obrigatório, dados sensíveis criptografados
3. **Injection**: Validação e sanitização de inputs, prepared statements
4. **Insecure Design**: Threat modeling, princípio do menor privilégio
5. **Security Misconfiguration**: Headers de segurança, CORS configurado
6. **Vulnerable Components**: Auditoria regular de dependências
7. **Authentication Failures**: Rate limiting, senhas fortes, 2FA
8. **Data Integrity Failures**: Validação de serialização, CSRF tokens
9. **Security Logging**: Logs de segurança, monitoramento
10. **SSRF**: Validação de URLs, whitelist de domínios

## Métricas de Sucesso
- Performance: LCP < 2.5s, FID < 100ms
- Segurança: 0 vulnerabilidades críticas
- Funcionalidade: 100% dos dados coletados transferidos corretamente