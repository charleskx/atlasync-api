# MappaHub API

Backend do MappaHub — plataforma SaaS multi-tenant de gestão geográfica de parceiros e pontos de venda.

## Stack

- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Fastify 5
- **Banco de dados**: PostgreSQL 15+ com PostGIS
- **ORM**: Drizzle ORM
- **Cache / Filas**: Redis + BullMQ
- **Autenticação**: JWT (access 15min) + Refresh Token opaco (30d)
- **Autorização**: CASL v6 por roles (`super_admin`, `owner`, `admin`, `employee`)
- **Pagamentos**: Stripe (checkout, portal, webhooks)
- **Exportação**: ExcelJS (.xlsx e .csv)
- **2FA**: TOTP via otplib + QR Code

## Pré-requisitos

- Node.js >= 20
- PostgreSQL >= 15 com extensão PostGIS
- Redis >= 7

## Variáveis de ambiente

Copie `.env.example` e preencha:

```bash
cp .env.example .env
```

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | ✅ | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | ✅ | `redis://host:6379` |
| `JWT_SECRET` | ✅ | String aleatória com >= 32 caracteres |
| `APP_URL` | ✅ | URL pública da API (ex.: `https://api.seudominio.com`) |
| `STRIPE_SECRET_KEY` | opcional | Chave secreta do Stripe |
| `STRIPE_WEBHOOK_SECRET` | opcional | Segredo do webhook Stripe |
| `STRIPE_PRICE_MONTHLY` | opcional | ID do price mensal no Stripe |
| `STRIPE_PRICE_ANNUAL` | opcional | ID do price anual no Stripe |
| `GOOGLE_MAPS_API_KEY` | opcional | Chave para geocoding automático |

## Instalação e desenvolvimento

```bash
# Instalar dependências
npm install

# Subir banco e redis locais (Docker)
docker compose up -d

# Aplicar schema no banco
npm run db:push

# Popular banco com dados de teste
npm run db:seed

# Iniciar API (modo watch)
npm run dev

# Iniciar worker de filas (modo watch)
npm run dev:worker
```

A API sobe em `http://localhost:3000`. Endpoint de health: `GET /health`.

## Scripts disponíveis

| Script | Descrição |
|---|---|
| `npm run dev` | API em modo desenvolvimento (tsx watch) |
| `npm run dev:worker` | Worker de filas em modo desenvolvimento |
| `npm run build` | Compila TypeScript para `dist/` |
| `npm start` | Inicia a API compilada |
| `npm run start:worker` | Inicia o worker compilado |
| `npm run db:push` | Sincroniza schema com o banco (sem migrations) |
| `npm run db:generate` | Gera arquivos de migração |
| `npm run db:migrate` | Aplica migrações pendentes |
| `npm run db:seed` | Popula o banco com dados de teste |
| `npm run db:studio` | Abre Drizzle Studio |
| `npm run check` | Lint + format com Biome |

## Módulos

| Prefixo | Descrição |
|---|---|
| `POST /auth/register` | Registro de novo tenant + owner |
| `POST /auth/login` | Login (suporta 2FA) |
| `POST /auth/2fa/setup` | Configura 2FA TOTP |
| `GET /users` | Gestão de usuários do tenant |
| `GET /partners` | CRUD de parceiros |
| `POST /import/upload` | Import de planilha (.xlsx, .csv) |
| `GET /import/:id/progress` | Progresso de import via SSE |
| `GET /maps` | CRUD de mapas internos/públicos |
| `GET /export/columns` | Colunas disponíveis para exportação |
| `POST /export/generate` | Geração de planilha (.xlsx, .csv) |
| `GET /billing/checkout` | Checkout Stripe |
| `POST /billing/webhook` | Webhook Stripe |
| `GET /tenant/settings` | Configurações do tenant |
| `GET /admin/tenants` | Painel super admin |

## Dados de teste (após seed)

```
Super Admin
  email: superadmin@mappahub.dev
  senha: superadmin@123

Tenant 1 — Distribuidora Alfa (plano ativo, 40 parceiros)
  email: owner-XXXXXX@mappahub-seed.dev
  senha: senha@123

Tenant 2 — Rede Beta (trial, 15 parceiros)
  email: owner-XXXXXX@mappahub-seed.dev
  senha: senha@123

Tenant 3 — Gama Corp (cancelado, 5 parceiros)
  email: owner-XXXXXX@mappahub-seed.dev
  senha: senha@123
```

> Os emails exatos dos owners são impressos no terminal ao rodar `npm run db:seed`.

## Arquitetura multi-tenant

- O `tenantId` é sempre extraído do JWT — nunca do body da requisição
- Cada tenant tem isolamento completo de dados no banco
- O `super_admin` opera em um tenant interno e acessa todos os outros via painel `/admin`
- Assinaturas são verificadas pelo middleware `subscriptionGuard` em todas as rotas protegidas
- Tenants bloqueados por admin recebem `403 TENANT_BLOCKED`

## Segurança

- Senhas com Argon2id
- JWT com expiração de 15 minutos; refresh tokens rotativos (30 dias) armazenados no banco
- 2FA TOTP com QR Code (otplib)
- Rate limiting global (100 req/min) com Redis; login limitado a 10 req/15min
- `npm audit` → 0 vulnerabilidades
