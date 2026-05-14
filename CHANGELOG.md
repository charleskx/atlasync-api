# Changelog

Todas as mudanças notáveis deste projeto serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/)
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [Unreleased]

## [0.1.6] - 2026-05-14

### Corrigido
- Geocoding por CEP agora usa ViaCEP para resolver o endereço completo (rua, cidade, estado) antes de consultar o Nominatim, com fallback progressivo (rua+cidade → cidade → estado)

## [0.1.5] - 2026-05-14

### Corrigido
- Geocoding por CEP agora usa o parâmetro postalcode do Nominatim com countrycodes=br, resolvendo falhas de busca com CEPs brasileiros

## [0.1.4] - 2026-05-14

### Corrigido
- Rota fix-address retornava 500 quando geocodeAddress lançava exceção em vez de retornar null; exceção agora capturada e convertida em 422

## [0.1.3] - 2026-05-14

### Adicionado
- Endpoint POST /geocoding-logs/fix-address/:partnerId para validar e corrigir endereços com falha de geocoding

### Corrigido
- Link de redefinição de senha corrigido no template de e-mail (era /auth/reset-password, agora /reset-password)
- Evento checkout.session.completed agora busca corretamente o planType da sessão Stripe
- Fluxo de trial e verificação de e-mail corrigidos (planType não tinha mais valor padrão)

## [0.1.2] - 2026-05-14

### Adicionado
- Implement SMTP email sending for production


## [0.1.1] - 2026-05-14

### Adicionado
- Add isolated super admin seed script for production
- Add healthcheck script for Redis connection verification
- Add POST /auth/resend-verification endpoint
- Configure allowed origins via CORS_ORIGIN env variable
- Priority queue for annual plan tenants
- Add Sentry error tracking to server and worker; remove admin geocoding routes
- Geocoding logs, partner filters, improved email templates and Coolify docs
- Full support ticket system
- Allow super admin to disable 2FA for any user
- Send email notification when import completes
- Add readonly flag to partner columns
- Add notes field and expose in getById/update
- 2FA recovery codes
- Replace Google Maps geocoding with Nominatim (OpenStreetMap)
- Add /dashboard/stats endpoint with real partner and import metrics
- Add pinTypeId filter and public pin-types endpoint to public map API
- Add public config endpoint to expose Maps API key for public maps
- Módulo de tipos de pin gerenciados por empresa
- Pós-MVP — SSE progresso import, import incremental e 2FA TOTP
- Sprint 6 — exportação de planilha e painel super admin
- Sprint 4 — módulo de mapas, embed e configurações do tenant
- Implementação completa das sprints 1, 2 e 3

### Corrigido
- Update Redis client implementation to use ioredis for improved connection handling
- Replace otplib with speakeasy to resolve ESM/CJS incompatibility
- Add /auth/me endpoint without subscriptionGuard
- Disable public maps when tenant is inactive or subscription expired
- Block public map creation when publicMapEnabled is false
- 2FA broken QR code and public map not respecting publicMapEnabled
- Add GET /partners/pins endpoint independent of map entities
- Include city and state in findPublicPins SELECT so client filters work
- Add explicit CORS methods and headers to allow PATCH requests
- Corrige todas as vulnerabilidades de segurança (npm audit zero)


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
