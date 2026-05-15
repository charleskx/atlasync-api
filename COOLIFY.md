# Deploy no Coolify — Guia Passo a Passo

Este guia cobre o deploy completo da MappaHub API no Coolify, incluindo banco PostgreSQL com PostGIS, Redis, a API principal e o worker de filas — ambos configurados para reiniciar automaticamente em caso de falha.

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
APP_URL=https://api.mappahub.com.br
CORS_ORIGIN=https://app.mappahub.com.br,https://mappahub.com.br
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_ANNUAL=price_...
GOOGLE_MAPS_API_KEY=AIza...
SENTRY_DSN=https://...@sentry.io/...
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_...
SMTP_FROM=MappaHub <noreply@mappahub.com.br>
```

> **SMTP**: a API usa SMTP padrão, compatível com qualquer provedor. O exemplo acima usa o [Resend](https://resend.com) (recomendado). Para outros provedores, ajuste `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` e `SMTP_PASS` conforme a documentação do serviço. Use porta `587` com STARTTLS (padrão) ou `465` para SSL direto.

Para gerar o `JWT_SECRET`:
```bash
openssl rand -base64 48
```

> **`CORS_ORIGIN`**: lista de origens permitidas separadas por vírgula. Em desenvolvimento (sem essa variável) a API aceita qualquer origem. Em produção, restrinja sempre aos domínios reais. Se adicionar mais subdomínios no futuro, basta incluí-los na lista sem precisar de novo deploy — apenas reinicie o serviço após alterar a variável.

### 4.4 Configurar o domínio

1. Vá na aba **Domains**
2. Adicione o domínio: `api.seudominio.com`
3. Habilite **HTTPS** (Coolify provisiona o certificado Let's Encrypt automaticamente)

### 4.5 Configurar o Health Check

O health check permite que o Docker/Coolify detecte quando a API travou ou parou de responder e reinicie automaticamente o container.

Em **Advanced** → **Health Check**:

- **Path**: `/health`
- **Interval**: `30s`
- **Timeout**: `10s`
- **Retries**: `3`
- **Start Period**: `30s` _(tempo de tolerância na inicialização antes de contar falhas)_

Com essa configuração, se a API deixar de responder por 3 verificações consecutivas (90 segundos), o Docker reinicia o container automaticamente.

### 4.6 Configurar o Restart Policy (auto-restart)

Essa é a configuração que garante que a API sobe automaticamente caso o processo caia ou o servidor reinicie.

Em **Advanced** → **Restart Policy**:

- Selecione **`unless-stopped`**

> **Diferença entre as opções:**
> - `no` — nunca reinicia (padrão Docker, inadequado para produção)
> - `always` — sempre reinicia, inclusive ao reiniciar o servidor manualmente pelo Coolify
> - `unless-stopped` — reinicia sempre, exceto quando você para manualmente pelo painel **(recomendado)**
> - `on-failure` — reinicia apenas em crash (não reinicia após reboot do servidor)

### 4.7 Deploy

1. Clique em **Save** e depois em **Deploy**
2. Acompanhe os logs em tempo real na aba **Deployments**
3. Quando aparecer `Server listening at http://0.0.0.0:3000`, o serviço está no ar

---

## 5. Aplicar o schema no banco (primeira vez)

Após o primeiro deploy, você precisa criar as tabelas. A maneira mais simples é adicionar um **Pre-Deploy Command** que roda automaticamente a cada deploy:

Em **Advanced** → **Pre-Deploy Command**:
```
npm run db:push
```

Isso garante que o schema é sincronizado automaticamente a cada deploy, sem precisar acessar o terminal manualmente.

**Alternativa manual** (via terminal do container):
```bash
npx drizzle-kit push
```

### Limpar toda a base de dados (reset completo)

> ⚠️ **Irreversível.** Apaga todas as tabelas e dados. Use apenas em ambiente de testes ou quando precisar recomeçar do zero.

No terminal do container do **PostgreSQL** (Coolify → banco → Terminal), execute:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

Depois, recrie as tabelas rodando no terminal da **API**:

```bash
npm run db:push
```

---

## 6. Criar o Super Admin (primeira vez)

Após aplicar o schema, crie o usuário super admin para acessar o painel administrativo. O script lê as credenciais via variáveis de ambiente e é idempotente — se o e-mail já existir, ele não faz nada.

### No terminal do container da API (via Coolify → Terminal):

```bash
SUPER_ADMIN_EMAIL=seu@email.com SUPER_ADMIN_PASSWORD=SenhaForte123 npm run db:seed-super-admin
```

Ou, se preferir definir as variáveis separadamente:

```bash
export SUPER_ADMIN_EMAIL=seu@email.com
export SUPER_ADMIN_PASSWORD=SenhaForte123
npm run db:seed-super-admin
```

> **O script cria automaticamente:**
> - Um tenant interno `mappahub-internal` (se ainda não existir)
> - Uma assinatura anual ativa para esse tenant
> - O usuário com role `super_admin` e e-mail já verificado

Após criado, acesse o painel com as credenciais definidas. O super admin tem acesso irrestrito a todos os tenants, importações e configurações do sistema.

---

## 7. Deploy do Worker de Filas

O worker processa jobs de importação e geocoding em background. Ele precisa rodar como um **serviço separado** e, assim como a API, deve reiniciar automaticamente em caso de falha.

### 6.1 Criar o serviço

1. Em `production`, clique em **New Resource** → **Application**
2. Selecione o **mesmo repositório** e a branch `main`
3. Dê o nome `mappahub-worker` para diferenciar da API

### 6.2 Configurar o Build

- **Build Pack**: `Nixpacks`
- **Install Command**: `npm ci`
- **Build Command**: `npm run build`
- **Start Command**: `node dist/worker.js`
- **Port**: deixe **em branco** — o worker não expõe porta HTTP

### 6.3 Variáveis de ambiente

Adicione as **mesmas variáveis de ambiente** da API. No mínimo as obrigatórias para o worker:

```env
NODE_ENV=production
DATABASE_URL=postgresql://atlasync:SENHA@postgresql-XXXXX:5432/atlasync
REDIS_URL=redis://default:SENHA@redis-XXXXX:6379
```

As demais variáveis (Stripe, Google Maps, etc.) também devem ser incluídas pois o worker pode disparar e-mails e integrar com serviços externos durante o processamento de jobs.

### 6.4 Domínio

Em **Domains**, **não adicione domínio** — o worker é um serviço interno sem endpoint HTTP.

### 6.5 Configurar o Restart Policy (auto-restart)

Assim como a API, o worker deve reiniciar automaticamente.

Em **Advanced** → **Restart Policy**:

- Selecione **`unless-stopped`**

> O worker não tem health check HTTP (não expõe porta), mas o Docker monitora o processo Node.js diretamente. Se o processo encerrar com qualquer código de saída diferente de zero — crash, erro não tratado, OOM — o Docker reinicia o container automaticamente graças à restart policy.

### 6.6 Health Check do Worker

Como o worker não tem endpoint HTTP, configure um health check baseado em **comando**:

Em **Advanced** → **Health Check**:

- **Type**: `Command`
- **Command**:
  ```
  node -e "const { createClient } = require('redis'); const c = createClient({ url: process.env.REDIS_URL }); c.connect().then(() => { c.quit(); process.exit(0) }).catch(() => process.exit(1))"
  ```
- **Interval**: `60s`
- **Timeout**: `10s`
- **Retries**: `3`

Esse comando verifica se o worker consegue se conectar ao Redis (dependência crítica). Se falhar 3 vezes consecutivas, o container é reiniciado.

> **Alternativa simples**: se o Coolify não permitir health check por comando em Applications, deixe o campo em branco e confie apenas na restart policy. O Docker reiniciará o worker caso o processo encerre inesperadamente.

### 6.7 Deploy

1. Clique em **Save** e depois em **Deploy**
2. Nos logs, você deve ver:
   ```
   [worker] Import worker iniciado
   [worker] Geocoding worker iniciado
   ```
3. O worker está pronto quando não aparecerem erros de conexão com Redis ou banco

---

## 8. Verificar o Auto-restart

Para confirmar que ambos os serviços reiniciam automaticamente:

1. No painel Coolify, vá ao serviço **mappahub-api**
2. Em **Terminal**, execute:
   ```bash
   kill 1
   ```
   Isso encerra o processo principal do container
3. Aguarde 10-20 segundos e observe o container subir automaticamente na aba **Logs**
4. Repita o teste no serviço **mappahub-worker**

> O tempo de reinicialização depende do Docker e do tempo de boot do Node.js (~5-10 segundos).

---

## 9. Configurar o Webhook do Stripe

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

## 10. Deploy controlado por tag de versão (GitHub Actions)

O deploy **não acontece a cada push na `main`**. Ele é acionado somente ao criar e enviar uma tag de versão (ex: `v1.2.0`). Isso garante que você controla exatamente o que vai para produção e quando.

### 10.1 Desativar o Auto Deploy do Coolify

Por padrão o Coolify faz deploy a cada push na branch configurada. Desative isso:

1. No serviço **mappahub-api** → **Settings** → desative **"Auto Deploy"**
2. Repita no serviço **mappahub-worker**

### 10.2 Copiar os webhooks de deploy do Coolify

O GitHub Actions vai acionar o deploy chamando os webhooks do Coolify via HTTP.

1. No serviço **mappahub-api** → **Settings** → **Deploy Webhook** → copie a URL
2. No serviço **mappahub-worker** → **Settings** → **Deploy Webhook** → copie a URL

### 10.3 Adicionar os secrets no GitHub

No repositório do GitHub → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Valor |
|--------|-------|
| `COOLIFY_WEBHOOK_API` | URL do webhook do serviço `mappahub-api` |
| `COOLIFY_WEBHOOK_WORKER` | URL do webhook do serviço `mappahub-worker` |

### 10.4 Como fazer um deploy

```bash
# 1. Certifique-se de que a main está atualizada
git checkout main
git pull origin main

# 2. Atualize o CHANGELOG.md com o que mudou na versão

# 3. Atualize a versão no package.json (opcional mas recomendado)
npm version 1.2.0 --no-git-tag-version

# 4. Commit
git add CHANGELOG.md package.json
git commit -m "chore: release v1.2.0"

# 5. Crie e envie a tag
git tag v1.2.0
git push origin main
git push origin v1.2.0
```

O GitHub Actions (`.github/workflows/deploy.yml`) irá automaticamente:
1. Extrair as notas de versão do `CHANGELOG.md`
2. Criar um **GitHub Release** com o changelog da versão
3. Acionar o deploy do `mappahub-api` via webhook do Coolify
4. Acionar o deploy do `mappahub-worker` via webhook do Coolify

### 10.5 Escrever o CHANGELOG

O `CHANGELOG.md` segue o formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/). Mantenha sempre uma seção `[Unreleased]` no topo e preencha durante o desenvolvimento:

```markdown
## [Unreleased]

### Adicionado
- Nova funcionalidade X

### Corrigido
- Bug Y na rota Z

## [1.2.0] - 2026-06-01
### Adicionado
- Suporte a webhooks customizados
```

Ao criar a tag `v1.2.0`, o workflow extrai automaticamente o bloco `## [1.2.0]` e usa como corpo do GitHub Release.

> **Ordem de deploy**: o worker é acionado logo após a API. Se precisar garantir que a API está saudável antes do worker subir, use o campo **Depends On** em **Advanced** do serviço worker no Coolify.

---

## Resumo da arquitetura no Coolify

```
Coolify Project: mappahub
└── Environment: production
    ├── Database: postgis/postgis:15-3.4  ← porta 5432 (interno)
    │             restart: unless-stopped
    │
    ├── Database: Redis 7                 ← porta 6379 (interno)
    │             restart: unless-stopped
    │
    ├── App: mappahub-api                 ← porta 3000, domínio público
    │         start:   node dist/server.js
    │         restart: unless-stopped
    │         health:  GET /health (30s interval, 3 retries)
    │         pre-deploy: npm run db:push
    │
    └── App: mappahub-worker              ← sem porta, sem domínio
              start:   node dist/worker.js
              restart: unless-stopped
              health:  redis ping via command (60s interval, 3 retries)
```

---

## Troubleshooting

**Build falha com erro de TypeScript**
Verifique se o `NODE_ENV=production` está definido e rode `npm run build` localmente para confirmar que compila sem erros.

**`DATABASE_URL` não alcança o banco**
Certifique-se de usar a URL **interna** do Coolify (nome do container), não a URL pública. A URL interna só funciona entre serviços dentro da mesma network do Docker.

**Worker não processa jobs**
Verifique se o `REDIS_URL` no worker aponta para o mesmo Redis da API. Acesse a aba **Logs** do serviço worker para ver erros de conexão. Confirme também que o worker está com status **Running** (não apenas **Deployed**).

**Container não reinicia após crash**
Confirme que a **Restart Policy** está definida como `unless-stopped` e não `no`. No terminal do servidor, você pode verificar com:
```bash
docker inspect <container_id> | grep RestartPolicy
```

**Worker cai em loop (restart loop)**
Se o worker reiniciar repetidamente, há um erro na inicialização. Acesse **Logs** do serviço e procure o erro antes do shutdown. Causas comuns: `REDIS_URL` inválido, `DATABASE_URL` incorreto, ou variável de ambiente faltando.

**E-mails não são enviados em produção**
Verifique se as variáveis `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` e `SMTP_PASS` estão definidas. Em desenvolvimento, os e-mails são apenas logados no console — o envio real só acontece com `NODE_ENV=production`. Para testar o SMTP sem afetar usuários reais, use um serviço como [Mailtrap](https://mailtrap.io) apontando para o ambiente de staging.

**Stripe webhook retorna 400**
Confirme que o `STRIPE_WEBHOOK_SECRET` no Coolify corresponde exatamente ao secret exibido no dashboard do Stripe para aquele endpoint. O prefixo `whsec_` faz parte da string.

**API sobe mas retorna 502 Bad Gateway**
Aguarde o **Start Period** (30s) do health check antes de concluir que há problema. Se persistir, verifique se a porta `3000` está corretamente configurada no serviço e se o processo está escutando em `0.0.0.0` e não em `127.0.0.1`.
