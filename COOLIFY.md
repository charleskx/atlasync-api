# Deploy no Coolify — Guia Passo a Passo

Este guia cobre o deploy completo da Atlasync API no Coolify, incluindo banco PostgreSQL com PostGIS, Redis, a API principal e o worker de filas.

---

## Pré-requisitos

- Servidor com Coolify instalado (VPS, Hetzner, DigitalOcean, etc.)
- Acesso ao painel Coolify (`https://seu-coolify.com`)
- Repositório da API acessível (GitHub, GitLab, Gitea)
- Domínio configurado apontando para o servidor

---

## 1. Criar um novo Project

1. No painel Coolify, clique em **Projects** → **New Project**
2. Dê o nome `atlasync` e clique em **Create**
3. Dentro do projeto, clique em **New Environment** → `production`

---

## 2. Provisionar o PostgreSQL com PostGIS

A API requer a extensão **PostGIS** para armazenar coordenadas. Use a imagem `postgis/postgis` em vez da imagem padrão do Postgres.

1. Em `production`, clique em **New Resource** → **Database** → **PostgreSQL**
2. Na tela de configuração, **troque a imagem Docker** para:
   ```
   postgis/postgis:15-3.4
   ```
3. Defina:
   - **Database Name**: `atlasync`
   - **Username**: `atlasync`
   - **Password**: (gere uma senha forte, ex.: `openssl rand -base64 32`)
4. Clique em **Save** e depois em **Start**
5. Aguarde o container ficar **Running**
6. Na aba **Connection**, copie a **Internal URL** — ela terá o formato:
   ```
   postgresql://atlasync:SENHA@postgresql-XXXXX:5432/atlasync
   ```
   Guarde essa URL, será usada como `DATABASE_URL`.

> **Importante**: use a URL **interna** (não a pública) para que a API se comunique com o banco pela rede interna do Docker, sem passar pela internet.

---

## 3. Provisionar o Redis

1. Em `production`, clique em **New Resource** → **Database** → **Redis**
2. Deixe as configurações padrão ou defina uma senha
3. Clique em **Save** e depois em **Start**
4. Copie a **Internal URL**:
   ```
   redis://default:SENHA@redis-XXXXX:6379
   ```
   Guarde essa URL como `REDIS_URL`.

---

## 4. Deploy da API (servidor principal)

### 4.1 Criar o serviço

1. Em `production`, clique em **New Resource** → **Application**
2. Selecione o provedor (GitHub, GitLab, etc.) e autorize o acesso ao repositório
3. Selecione o repositório `atlasync_api` e a branch `main`
4. Clique em **Continue**

### 4.2 Configurar o Build

Na tela de configuração do serviço:

- **Build Pack**: `Nixpacks` (detecta Node.js automaticamente)
- **Install Command**:
  ```
  npm ci
  ```
- **Build Command**:
  ```
  npm run build
  ```
- **Start Command**:
  ```
  node dist/server.js
  ```
- **Port**: `3000`

### 4.3 Configurar as variáveis de ambiente

Vá na aba **Environment Variables** e adicione todas as variáveis abaixo. Clique em **+ Add** para cada uma.

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://atlasync:SENHA@postgresql-XXXXX:5432/atlasync
REDIS_URL=redis://default:SENHA@redis-XXXXX:6379
JWT_SECRET=GERE_UMA_STRING_ALEATORIA_DE_64_CHARS
APP_URL=https://api.seudominio.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_ANNUAL=price_...
GOOGLE_MAPS_API_KEY=AIza...
```

Para gerar o `JWT_SECRET`:
```bash
openssl rand -base64 48
```

### 4.4 Configurar o domínio

1. Vá na aba **Domains**
2. Adicione o domínio: `api.seudominio.com`
3. Habilite **HTTPS** (Coolify provisiona o certificado Let's Encrypt automaticamente)

### 4.5 Configurar Health Check

Em **Advanced** → **Health Check**:

- **Path**: `/health`
- **Interval**: `30s`
- **Timeout**: `10s`
- **Retries**: `3`

### 4.6 Deploy

1. Clique em **Save** e depois em **Deploy**
2. Acompanhe os logs em tempo real na aba **Deployments**
3. Quando aparecer `Server listening at http://0.0.0.0:3000`, o serviço está no ar

---

## 5. Aplicar o schema no banco (primeira vez)

Após o primeiro deploy, você precisa criar as tabelas. Acesse o terminal do container da API:

1. No serviço da API, clique em **Terminal** (ou use a aba **Exec**)
2. Execute:
   ```bash
   node -e "require('./dist/src/db/schema')" 2>/dev/null; npx drizzle-kit push
   ```

**Alternativa mais simples**: adicione um **Pre-Deploy Command** (configuração única):

Em **Advanced** → **Pre-Deploy Command**:
```
npm run db:push
```

Isso garante que o schema é sincronizado automaticamente a cada deploy.

---

## 6. Deploy do Worker de Filas

O worker processa jobs de import e geocoding em background. Ele precisa rodar como um serviço separado.

1. Em `production`, clique em **New Resource** → **Application**
2. Selecione o **mesmo repositório** e a branch `main`
3. Configure:
   - **Build Pack**: `Nixpacks`
   - **Install Command**: `npm ci`
   - **Build Command**: `npm run build`
   - **Start Command**: `node dist/worker.js`
   - **Port**: deixe em branco (o worker não expõe porta HTTP)

4. Adicione as **mesmas variáveis de ambiente** da API (especialmente `DATABASE_URL` e `REDIS_URL`)

5. Em **Domains**, **não adicione domínio** (serviço interno)

6. Clique em **Save** e **Deploy**

> O worker e a API compartilham as filas BullMQ via Redis. Você pode escalar o worker independentemente da API.

---

## 7. Configurar o Webhook do Stripe

Para que os eventos do Stripe cheguem à API:

1. Acesse o [Dashboard do Stripe](https://dashboard.stripe.com/webhooks) → **Webhooks** → **Add endpoint**
2. **Endpoint URL**:
   ```
   https://api.seudominio.com/billing/webhook
   ```
3. **Events to listen**:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copie o **Signing Secret** (`whsec_...`) e atualize a variável `STRIPE_WEBHOOK_SECRET` no Coolify

---

## 8. Verificações finais

Após o deploy, teste os endpoints principais:

```bash
# Health check
curl https://api.seudominio.com/health

# Registro de novo tenant
curl -X POST https://api.seudominio.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"tenantName":"Minha Empresa","name":"João Silva","email":"joao@empresa.com","password":"minhasenha123"}'
```

---

## 9. Atualizações futuras

O Coolify suporta **Auto Deploy** via webhook do GitHub/GitLab:

1. No serviço da API, vá em **Settings** → **Webhooks**
2. Copie a URL do webhook do Coolify
3. No GitHub, vá em **Settings** → **Webhooks** → **Add webhook**
4. Cole a URL e selecione o evento **Push**

A partir daí, todo push na branch `main` dispara um novo deploy automaticamente.

---

## Resumo da arquitetura no Coolify

```
Coolify Project: atlasync
└── Environment: production
    ├── Database: postgis/postgis:15-3.4  ← port 5432 (interno)
    ├── Database: Redis 7                 ← port 6379 (interno)
    ├── App: atlasync-api                 ← porta 3000, domínio público
    │         node dist/server.js
    └── App: atlasync-worker              ← sem porta, sem domínio
              node dist/worker.js
```

---

## Troubleshooting

**Build falha com erro de TypeScript**
Verifique se o `NODE_ENV=production` está definido e rode `npm run build` localmente para confirmar que compila sem erros.

**`DATABASE_URL` não alcança o banco**
Certifique-se de usar a URL **interna** do Coolify (nome do container), não a URL pública. A URL interna só funciona entre serviços dentro da mesma network do Docker.

**Worker não processa jobs**
Verifique se o `REDIS_URL` no worker aponta para o mesmo Redis da API. Acesse a aba **Logs** do serviço worker para ver erros de conexão.

**Stripe webhook retorna 400**
Confirme que o `STRIPE_WEBHOOK_SECRET` no Coolify corresponde exatamente ao secret exibido no dashboard do Stripe para aquele endpoint. O `whsec_` faz parte da string.
