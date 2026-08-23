# USE AURA — Backend em Cloudflare Workers (migração do n8n/VPS)

Substitui os 5 webhooks n8n (VPS Hostinger cancelada) por **um único Cloudflare Worker**,
grátis e sem cartão. A lógica é porte 1:1 dos JSONs n8n em `../n8n-infinitepay-useaura.json`
e `../n8n-superfrete-useaura.json` (mesmo antifraude, mesma reconciliação, mesmo cofre).

Intactos e grátis (não mudam): loja (GitHub Pages), dados (Firestore `useaura-34065`),
fotos (Cloudinary), domínio (GoDaddy → roupasaura.com).

## Rotas (um Worker, 5 caminhos)
| Caminho | Origem do n8n | Chama-quem |
|---|---|---|
| `POST /criar-link` | InfinitePay Fluxo A | navegador (checkout) |
| `POST /callback` | InfinitePay Fluxo B | servidor InfinitePay (webhook) |
| `POST /sf-token` | SuperFrete Fluxo 1 | navegador da dona (Área da Dona) |
| `POST /sf-cotar` | SuperFrete Fluxo 2 | navegador (checkout) |
| `POST /sf-etiqueta` | SuperFrete Fluxo 3 | navegador da dona |

O `webhook_url` que a InfinitePay chama de volta é derivado automaticamente da própria
URL do Worker (`<worker>/callback`) — não precisa configurar em lugar nenhum.

---

## O QUE DEPENDE DO JOÃO (bloqueio de go-live)

### 1) Criar a conta grátis Cloudflare (sem cartão)
- Criar conta em https://dash.cloudflare.com/sign-up (plano Free, não pede cartão).
- Instalar a CLI: `npm i -g wrangler` e logar: `wrangler login`.

### 2) Plugar o único segredo (private_key da Service Account)
Dentro desta pasta (`backend/cloudflare-worker/`):
```
wrangler secret put FIREBASE_SA_PRIVATE_KEY
```
Cole o valor do campo `private_key` de `CLIENTES/SITES/USEAURA/SECRETS/firebase-service-account.json`
(o bloco inteiro, de `-----BEGIN PRIVATE KEY-----` até `-----END PRIVATE KEY-----`).
> Esse arquivo está FORA do repositório e NUNCA deve ser commitado. O Worker só precisa
> da `private_key`; o `client_email` (não sensível) já está em `wrangler.toml`.

### 3) Publicar o Worker
```
wrangler deploy
```
A saída mostra a URL pública, algo como:
`https://useaura-backend.SEU-SUBDOMINIO.workers.dev`

### 4) Ligar o front nessa URL
Editar `assets/js/config.js` (blocos `infinitepay` e `superfrete`) e trocar
`SEU-SUBDOMINIO` pelo subdomínio real que apareceu no passo 3. Depois bumpar o `?v=`
do `app.js` no `index.html` (já deixei `config.js` com URLs prontas, faltando só o
subdomínio real — ver os comentários `>>> TROCAR SEU-SUBDOMINIO <<<`).

### 4b) Push ntfy confiável (recomendado — 2 min)
O push "Pagamento confirmado" para o celular da dona sai do Worker para o ntfy.sh.
Como os Workers usam **IPs compartilhados** do Cloudflare, o ntfy.sh free responde
**429 (cota diária por IP)** e o push se perde (comprovado no teste real de 2026-08-23:
a baixa deu certo, mas o push não saiu). O pagamento/baixa NÃO dependem disso — só a
notificação. Correção grátis:
1. Criar conta grátis em ntfy.sh > gerar um **Access Token** (conta > Access tokens).
2. `wrangler secret put NTFY_TOKEN` e colar o token.
O Worker passa a enviar `Authorization: Bearer <token>` → a cota vira por-conta (não por-IP).

### 5) Já plugados (não precisa fazer nada)
Estão pré-preenchidos em `wrangler.toml` (públicos, não são segredo): `PROJECT_ID`,
`FIREBASE_API_KEY`, `FIREBASE_SA_CLIENT_EMAIL`, `INFINITEPAY_HANDLE` (`ana-laura-oug`),
`NTFY_TOPIC` (`useaura-pedidos-9f2kx7q`). Token e remetente da SuperFrete continuam no
**cofre Firestore** (`secrets/superfrete`), lidos pela Service Account — não são secrets
do Worker.

---

## Segredos: onde cada um vive (nada sensível no repo/Pages)
| Segredo | Onde | No repo? |
|---|---|---|
| Service Account (private_key) | `wrangler secret` (Worker) | NÃO |
| Token SuperFrete | cofre Firestore `secrets/superfrete` (SA lê) | NÃO |
| Remetente (PII, LGPD) | cofre Firestore `secrets/superfrete` | NÃO |
| Handle InfinitePay | público (`ana-laura-oug`) | sim (não é segredo) |
| Firebase apiKey | pública (identifica o app) | sim (não é segredo) |

## CORS
Allowlist LITERAL no Worker: `roupasaura.com`, `www.roupasaura.com`, `joao998jc-tech.github.io`.
Como o Worker responde o próprio preflight OPTIONS, o eco dinâmico a partir dessa
allowlist também vale no preflight (a armadilha do n8n — expressão não resolvida no
preflight — não existe aqui).

---

## PLANO DE TESTE (rodar assim que os secrets estiverem plugados)

### A) Fumaça sem transacionar (curl — não prova CORS, mas prova o pipeline)
```
BASE=https://useaura-backend.SEU-SUBDOMINIO.workers.dev
# item inválido -> 400 (prova SA + leitura de catálogo)
curl -s -X POST $BASE/criar-link -H 'Content-Type: application/json' \
  -d '{"orderId":"teste1","items":[{"id":"NAO_EXISTE","quantity":1}]}'
# cotação -> 200 {ok:true,servicos:[...]} (se SF token no cofre) OU 400 sem token
curl -s -X POST $BASE/sf-cotar -H 'Content-Type: application/json' \
  -d '{"to_cep":"01001000","itens":[{"id":"<id-real>","qtd":1}]}'
```

### B) CORS real (só em navegador — curl mascara)
Abrir roupasaura.com, DevTools > Network, fazer um checkout de teste; o preflight
OPTIONS de `/criar-link` deve voltar 204 com `Access-Control-Allow-Origin` = a origem real.

### C) PAGAMENTO REAL de R$1 (prova a baixa automática — obrigatório antes de divulgar)
1. Garantir em `config/store` um produto de teste de R$1 (o `vestido-teste-x` já existia no n8n).
2. Comprar 1 unidade pelo site (Pix ou cartão) e pagar de verdade R$1.
3. Confirmar as 3 provas de baixa automática:
   - **ntfy:** chega "Pagamento confirmado #<pedido>" no tópico `useaura-pedidos-9f2kx7q`.
   - **Firestore:** `payments/<pedido>.status == "pago"` e `orders/<pedido>.status == "pago"`.
   - **Tela:** o retorno `#/retorno/<pedido>` avança sozinho (o front lê `payments/<pedido>`).
4. **Subpagamento (opcional, prova o antifraude):** criar link de R$1 para um pedido cujo
   total autoritativo é maior → o callback deve responder `ack_nao_reconciliado` e NÃO marcar pago.

### D) Frete R$1 real (SF ON) — antes de a dona ativar frete pago e divulgar
Um pedido real com frete SuperFrete ponta a ponta: confirmar que o pagamento não quebra,
dá baixa, e que `cobrado == reconciliado` (o Fluxo A grava `orders.frete`, o callback lê).

> Honestidade (Regra 81): itens C e D só se provam com transação real e conta plugada.
> Até lá, ficam PENDENTES. A e B provam o pipeline e o CORS sem transacionar.

## Segurança — gates e hardening (parecer da auditoria)
Núcleo sólido: callback forjado NÃO marca pago (a defesa é o `payment_check` real);
preço e frete recomputados server-side; anti-reuso (`paid_tx`) e idempotência OK; nenhum
segredo no repo/front. Pontos que dependem de decisão/ação do João:

- **[GATE go-live — CONTA] Desativar cadastro público no Firebase Auth.** O gate de dona
  (`/sf-token`, `/sf-etiqueta`) valida `email == useaura@gmail.com` via idToken real, mas
  NÃO exige e-mail verificado (mesma postura deliberada das `firestore.rules` e do n8n, p/
  não travar a dona). A proteção real é **desativar o cadastro público** no console (Firebase
  Auth), deixando a conta da dona como única. Fazer isso antes de divulgar. (Alternativa mais
  rígida, se a conta da dona já for verificada: pedir que eu adicione `emailVerified === true`
  ao gate — é 1 linha, mas pode travar a dona se o e-mail dela não estiver verificado; decida.)
- **[SF-ON, quando ligar frete pago] `/criar-link` grava `orders.frete` sem autenticar o
  pedido.** Só afeta o ramo SuperFrete (frete_servico presente = SF ligado). Um chamador
  direto que conheça um `orderId` em trânsito pode rebaixar/alterar o frete daquele pedido;
  o backstop é a reconciliação (`amount === total`), que no pior caso NÃO dá baixa (pedido
  legítimo preso, com alerta ntfy — não vira roubo). Resolver junto do go-live do SF (validar
  estado 'novo' do pedido antes de gravar). Enquanto SF fica OFF (default), não se aplica.
- **[pós-lançamento] Rate limiting.** `/criar-link` e `/sf-cotar` são públicos (checkout
  anônimo); sem limite, dá pra abusar (queima de quota SuperFrete / spam de links). Quando
  houver volume, ligar Rate Limiting rules do Cloudflare (Free tem opção básica).
- **[recomendado] Não servir `backend/` pelo GitHub Pages.** Com `.nojekyll`, `roupasaura.com/backend/...`
  serve o código do Worker e os JSONs n8n (isso já era verdade antes desta migração). Nenhum
  segredo vaza (a private_key só existe como `wrangler secret`), mas expõe a lógica interna.
  Mover `backend/` para um repo separado (ou fora do publish root) é hardening, não bloqueio.
- **[conhecido] Callback responde 200 em falha transitória do Firestore** (fail-closed: não
  marca pago) → a InfinitePay não re-tenta e um pago legítimo pode exigir baixa manual; o
  ntfy "NAO reconciliado" alerta. Mitigação suficiente para o volume atual.

## Teste offline já executado
`node backend/cloudflare-worker/test-local.mjs` — valida a invariante de frete portada
(front == Worker A == Worker B) e a lógica de reconciliação (aceita repasse de taxa no
cartão, barra subpagamento). Verde = lógica consistente com o n8n.
