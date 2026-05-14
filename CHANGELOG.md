# Changelog

Todas as mudanças notáveis deste projeto serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/)
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [Unreleased]

## [1.0.0] - 2026-05-13

### Adicionado
- Autenticação JWT com refresh token e logout
- Autenticação de dois fatores (TOTP) com QR code e códigos de recuperação
- Multi-tenancy completo com isolamento por tenant
- Cadastro e gestão de parceiros com soft-delete
- Geocoding automático de endereços via Nominatim com fila BullMQ
- Prioridade de geocoding para clientes do plano anual
- Log de tentativas de geocoding por parceiro (sucesso, sem resultados, erro)
- Importação de parceiros via planilha Excel com modos upsert e replace
- Exportação de parceiros em Excel
- Mapas públicos com token de embed e mapas internos
- Tipos de pin customizáveis por tenant
- Sistema de tickets de suporte com mensagens e status
- Notificações in-app (importações, falhas de geocoding, trial expirando, tickets)
- Faturamento via Stripe com planos mensal e anual
- Webhooks Stripe (checkout, atualização de assinatura, cancelamento, pagamento falho)
- Portal de gerenciamento de assinatura via Stripe Customer Portal
- Trial de 14 dias com alerta de expiração
- Subscription wall para contas canceladas/inadimplentes — login ainda funciona para regularização
- Endpoint `/auth/me` sem subscription guard para bootstrap de sessão
- Super admin: listagem de tenants, bloqueio/desbloqueio, histórico de imports, gestão de 2FA
- Templates de e-mail profissionais com CSS inline (verificação, reset, convite, trial, tickets, importação)
- Health check em `/health`
- Rate limiting global via Redis
- Sentry para captura de erros (server e worker)
- Seed de desenvolvimento com dados realistas

### Segurança
- Senhas com hash Argon2
- Tokens de verificação de e-mail e reset de senha com expiração
- Guard de assinatura em todas as rotas sensíveis
- Rate limit em `/auth/login` (10 req / 15 min)
