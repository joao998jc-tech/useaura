# Runbook — n8n InfinitePay Checkout (USEAURA)

Workflow: `n8n-infinitepay-useaura.json`. Roda na VPS Hostinger (Docker, n8n queue mode).
NADA aqui está ativo. Import, preencher, testar controlado, e só então o Analista de Sistemas + João decidem go-live.

## O que o workflow faz
- **Fluxo A — Criar link** (`POST /webhook/useaura-criar-link`): o navegador do site chama, o n8n **lê o catálogo autoritativo** (`config/store` no Firestore), **calcula o preço no servidor** e cria o link na InfinitePay (`POST /links`) devolvendo `{url}`. O site redireciona o cliente ao checkout.
- **Fluxo B — Callback + reconciliação** (`POST /webhook/useaura-callback`): a InfinitePay chama quando o pagamento é aprovado. O n8n **nunca** dá baixa só pelo webhook: recompõe o **total autoritativo do pedido** a partir do catálogo + `orders/{order_nsu}`, reconcilia via `POST /payment_check` e só grava `pago` se `success && paid && paid_amount === totalAutoritativo`. Idempotente por-pedido (`payments/{order_nsu}=='pago'`) e com **anti-reuso de transação** (`paid_tx/{transaction_nsu}`).

### Por que preço no servidor (mudança crítica)
O front passou a enviar cada item como `{id, quantity, description}` **sem `price`** — o preço do cliente deixou de ser confiável. A **única fonte de verdade** do preço é o catálogo da dona em `config/store` (campo `payload` = `JSON.stringify({produtos:[{id, preco, precoPix, ...}]})`). Cartão usa `preco` (à vista cheio); centavos = `Math.round(preco*100)`. Qualquer `price` vindo do browser é ignorado. Se `config/store` não existir (404) ou não tiver `produtos`, o Fluxo A responde **400 fail-safe** e não cria link.

### Defesas do Fluxo B (defense-in-depth)
1. **Idempotência por-pedido** (antes de tudo): `payments/{order_nsu}` já `pago` → responde `ja_processado`, não reprocessa.
2. **Reconciliação contra o total do pedido** (não contra `wh.amount`): recomputa `Σ catalogo[id].preco*100*qtd` sobre `orders/{order_nsu}.itens`. Bloqueia subpagamento / adulteração de valor.
3. **Anti-reuso de transação**: antes da baixa, lê `paid_tx/{transaction_nsu}`; se já existe com `order_nsu` diferente, é a mesma transação reaproveitada em outro pedido → alerta ntfy (sem PII) + `200 ack` **sem baixa**. Após a baixa, grava `paid_tx/{transaction_nsu} = {order_nsu, at}` (coleção só-SA; o catch-all das rules já nega o cliente, não precisa mudar rules).

## 1) Import
1. n8n > Workflows > Import from File > selecione `n8n-infinitepay-useaura.json`.
2. Após importar, os 2 webhooks ficam nos paths acima. As URLs públicas (via Traefik) são algo como
   `https://<seu-n8n>/webhook/useaura-criar-link` e `.../webhook/useaura-callback`.

## ⚠️ 2 BUGS DE PRODUÇÃO no 1º pagamento real (2026-08-17) — corrigidos, NÃO reintroduzir
1. **Credencial GoogleApi SEM `httpNode:true` → requests ao Firestore vão SEM autenticação** (anônimas): a função `authenticate` da credencial `googleApi` do n8n começa com `if (!credentials.httpNode) return requestOptions;` — sem esse flag, NENHUM token é anexado. Resultado: leituras públicas (config/store, payments) passam, mas `orders` (owner-only nas rules) dá **403 PERMISSION_DENIED** e os PATCH falham → `totalAutoritativo` fica 0 → nunca reconcilia. **A credencial DEVE ter `data.httpNode=true` E `data.scopes="https://www.googleapis.com/auth/datastore"`.** Ao importar por CLI, incluir os dois. (Na UI: ativar o toggle "When using the HTTP Request node" + preencher Scope.)
2. **`paid_amount` do cartão vem MAIOR que o pedido** (repasse de taxa ao cliente): num pagamento de R$1 no cartão, `/payment_check` retornou `{amount:100, paid_amount:105}` — o cliente paga R$1,05 (R$1 + taxa). A reconciliação exigia `paid_amount === total` → 105≠100 → nunca reconciliava. **Correto: reconciliar contra `amount` (=100, o valor do pedido) e aceitar `paid_amount >= amount`** (o extra é a taxa). Já aplicado no nó `Validar Reconciliacao`.

## 2) Credencial Firebase (Service Account) — SEM ela o Fluxo B não escreve
> **CRÍTICO:** o objeto da credencial precisa de `httpNode:true` + `scopes` = `https://www.googleapis.com/auth/datastore` (ver o box de bugs acima). Sem `httpNode:true` o token nem é enviado.
Todos os nós Firestore usam credencial **Google Service Account** (tipo `googleApi` no HTTP Request, "Predefined Credential Type"). São eles: `Ler Catalogo Firestore` (Fluxo A), `Ler Payment Firestore`, `Ler Catalogo Firestore (B)`, `Ler Order Firestore`, `Ler paid_tx`, `PATCH orders (pago)`, `PATCH payments (publico)`, `PATCH paid_tx`.
1. Firebase Console > projeto **useaura-34065** > Configurações > Contas de serviço > Gerar nova chave privada (JSON). Guarde o JSON com segurança (NUNCA commitar no repo).
2. n8n > Credentials > New > **Google Service Account API**:
   - Cole `client_email` e `private_key` do JSON.
   - **Scope:** `https://www.googleapis.com/auth/datastore`
3. Nos 8 nós Firestore listados acima, selecione essa credencial (no JSON o placeholder é `REPLACE_FIREBASE_SA_CRED` / nome "USEAURA Firebase Service Account"). O import pode já casar pelo nome se a credencial existir com esse nome.

> A service account escreve como admin e **bypassa as firestore.rules** — por isso o Fluxo B consegue marcar `pago` mesmo com regras restritivas de escrita pública.

## 3) Variáveis de ambiente (docker-compose do n8n / worker)
Adicione no serviço n8n **e** nos workers (queue mode) e reinicie:

| ENV | Valor | Usado em |
|-----|-------|----------|
| `INFINITEPAY_HANDLE` | `ana-laura-oug` | Fluxo A e B (auth InfinitePay) |
| `INFINITEPAY_WEBHOOK_URL` | URL pública do Fluxo B, ex. `https://<seu-n8n>/webhook/useaura-callback` | Fluxo A (campo `webhook_url` do link) |
| `NTFY_TOPIC` | tópico ntfy da dona (sem PII) | notificações |
| `CORS_ORIGIN` | origem do site, ex. `https://useaura.com.br` (**sem default** — se vazio, nenhuma origem é liberada) | Fluxo A (headers CORS) |

> Garanta que o n8n permite acesso a env em nós: **NÃO** setar `N8N_BLOCK_ENV_ACCESS_IN_NODE=true` (o default já libera). Sem isso, `$env.*` volta vazio.

## 4) CORS / preflight — **valor LITERAL (não expressão)**
⚠️ **Lição de produção:** o campo **Allowed Origins (CORS)** do nó Webhook e os headers `Access-Control-Allow-Origin` das respostas usam o **valor LITERAL** `https://joao998jc-tech.github.io` — **NÃO** `{{ $env.CORS_ORIGIN }}`. Motivo: o **preflight OPTIONS** é respondido pelo n8n ANTES de executar o workflow (nível de registro do webhook), **sem contexto de expressão** → uma expressão sai literal no header (`Access-Control-Allow-Origin: ={{ $env.CORS_ORIGIN }}`), o browser não casa com a origem real e **bloqueia o POST**. `curl` não faz preflight, então mascara o bug — **validar CORS só em navegador real**. Ao trocar de domínio (ex.: domínio próprio), editar o literal no nó Webhook e nos 4 nós de resposta. A env `CORS_ORIGIN` fica como referência mas não é lida no preflight.

## 5) Ligar no site
Em `assets/js/config.js` (bloco `infinitepay`):
- `criarLinkUrl` = URL pública do Fluxo A.
- `ativo: true` e `cartao.ativo: true` **só** após o teste controlado passar e João aprovar o repasse de taxas.

## 6) Error Workflow (Regra 71 — obrigatório antes de produção)
Este arquivo é o workflow principal. Crie um **Error Workflow dedicado** (nó `Error Trigger` → ntfy "USEAURA n8n erro em <workflow>") e associe em **Settings > Error Workflow** deste workflow (campo `errorWorkflow` está vazio no JSON de propósito). Os nós de chamada externa já têm **Retry on Fail** (3 tentativas, 2s).

## 7) Teste controlado (sem transacionar de verdade)
- **Fluxo A:** `curl` POST no path com um `items` válido e um inválido; confirme `{url}` (200) e `{error}` (400). Não precisa pagar.
- **Reconciliação:** valide o **formato real da resposta** de `/links` e `/payment_check` num pagamento de valor mínimo controlado (ou sandbox se a dona tiver). Ver "Suposições" abaixo.
- **Idempotência:** reenvie o mesmo callback 2x; o 2º deve responder `ja_processado` sem gravar/notificar de novo.

## FRETE (grátis região + fixo fora) — recompute server-side
- `config/store.frete` = `{configurado, gratisPrefixos:[...], valorFora}` (escrito só pela dona, mesma rule do catálogo). Região = por **prefixo de CEP** (determinístico, sem API externa).
- **INVARIANTE (3 cópias que DEVEM bater):** `computeFrete` no site (`app.js`) e `freteCentavos` nos 2 nós Code (`Validar e Montar Payload` + `Validar Reconciliacao`). Lógica: não-configurado→0; CEP≠8 dígitos→cobra FORA (nunca grátis por erro); prefixo casa→0; senão→FORA.
  - Front×n8n divergir → site mostra X, cobra Y. **Fluxo A×Fluxo B divergir → deadlock:** `amount≠totalAutoritativo`, pedido pago legítimo NUNCA vira 'pago'.
  - **Antes de qualquer deploy do JSON, rodar o harness `harness-frete.js` (11 casos, invariante front==n8n) + `harness-forge.js` (frete forjado ignorado).** ⚠️ ao editar regex no jsCode via CLI, cuidado com backslash comido (`/\D/g`→`/D/g`): usar Write, não `bash node -e`.
- Antifraude: o browser **nunca** envia valor de frete. Fluxo A adiciona 1 item `{description:'Frete', price}` recomputado do `body.address.cep`; Fluxo B soma `freteCentavos(orders.entrega.cep)` ao total autoritativo.

## Contrato Firestore (por que a tipagem REST importa)
- `config/store` (campo `payload`, `stringValue`): **catálogo autoritativo**. Lido em GET (SA, `neverError`+`fullResponse`) e parseado com `JSON.parse(resp.body.fields.payload.stringValue).produtos`. Cada produto tem `id`, `preco`, `precoPix`. **PREÇO ÚNICO:** Pix e cartão usam `preco` (o link InfinitePay é multi-método, valor único; `precoPix == preco`). **Cartão-InfinitePay pressupõe Firebase/Firestore ligado no site** — sem `config/store` populado, o Fluxo A responde 400 e nenhum link é criado.
- `orders/{order_nsu}`: o Fluxo B **lê** este doc para recompor o total. Cada item vive em `fields.itens.arrayValue.values[].mapValue.fields` com `id` (`stringValue`) e `qtd` (`integerValue`) — a leitura respeita essa tipagem REST. O PATCH usa `updateMask.fieldPaths` = status, updatedAt, capture_method, installments — **só** esses campos, para não zerar os irmãos do pedido. `updatedAt` como `integerValue` (millis), casando com o `Date.now()` do front. O `updateMask` fica **só na query string da URL** (`?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt&...`), **não** em `queryParameters`: o array de `queryParameters` do n8n colapsa chaves repetidas de mesmo nome (só a última sobreviveria), o que dropava `status` da máscara; na URL os parâmetros repetidos são preservados. `payments/{order_nsu}` segue o mesmo padrão (com `orderId` a mais). `paid_tx/{transaction_nsu}` é escrito **sem** `updateMask` (doc novo, gravação integral de `{order_nsu, at}`).
- `payments/{order_nsu}`: doc **público SEM PII** — `{status:'pago', orderId, updatedAt, capture_method, installments}`. É o que o navegador lê no retorno (`Cloud.watchPayment`). É também a trava de idempotência por-pedido.
- `paid_tx/{transaction_nsu}`: coleção **só-SA** (o catch-all das `firestore.rules` já nega o cliente — não precisa mexer nas rules). Guarda `{order_nsu, at}` por transação, base do anti-reuso. PATCH cria o doc na primeira baixa.

## A validar contra callback REAL antes do go-live (não confirmável sem transacionar)
> A reconciliação depende dos **nomes e da UNIDADE exatos** dos campos. Se qualquer nome divergir do assumido, a reconciliação **falha em silêncio** (nunca marca `pago`, ou — pior — compara contra `undefined`). Confirmar no 1º callback real:
>
> - **`/links` (Fluxo A):** qual é o campo da **URL** do checkout na resposta? O código extrai defensivamente de `url || data.url || link || body.*`. Confirmar o nome real.
> - **Webhook aprovado (Fluxo B):** nomes `invoice_slug`, `amount`, `paid_amount`, `installments`, `capture_method`, `transaction_nsu`, `order_nsu`, `receipt_url`, `items`.
> - **`/payment_check`:** nomes `success`, `paid`, `amount`, `paid_amount`, `installments`, `capture_method`.
> - **UNIDADE de `amount`/`paid_amount`: centavos ou reais?** O total autoritativo é calculado em **centavos** (`Math.round(preco*100)*qtd`) e comparado com `Number(check.paid_amount)` com **tolerância 0**. Se a InfinitePay devolver **reais** (ex.: `129.9`) em vez de **centavos** (`12990`), a comparação nunca bate — ajustar a escala em `Validar Reconciliacao`.
>
> **1º teste real recomendado = subpagamento deliberado:** criar um link de **R$1** para um pedido cujo total autoritativo é maior e disparar o callback. O esperado é o Fluxo B **NÃO** marcar `pago` (cai em `ntfy Alerta Nao Reconciliado` + `ack_nao_reconciliado`). Isso prova de uma vez que os itens 1 (preço no servidor) e 2 (reconciliação contra o total do pedido) estão bloqueando de fato.

## Suposições a validar por teste controlado (sem transacionar)
1. **Resposta de `/links`:** o código extrai a URL de `url || data.url || link` (defensivo). Confirmar o campo real no 1º teste.
2. **Sem HMAC/assinatura no callback** (não documentado) — por isso a reconciliação obrigatória via `/payment_check` é a única fonte de verdade. Não confiar em nenhum campo do webhook sem reconciliar.
3. **Total autoritativo:** o Fluxo B compara `check.paid_amount === Σ catalogo[id].preco*100*qtd` (centavos, tolerância 0) — **não** mais contra `webhook.amount`. Ver "A validar contra callback REAL" acima para a questão de unidade.

## Riscos conhecidos
- Sem a service account, o Fluxo B **ack-a mas não grava** → cliente paga e o site não confirma. Bloqueante para go-live.
- `/payment_check` fora do ar de forma persistente → callback responde 400 e a InfinitePay reenvia (a idempotência evita duplicar após sucesso).
- Env não propagada aos workers (queue mode) → nós executam no worker e leem `$env` vazio. Setar ENV em TODOS os serviços.
- **Catálogo indisponível/incompleto** (`config/store` 404 ou sem `produtos`) → Fluxo A responde 400 e não cria link (fail-safe intencional). Manter `config/store` sempre populado.
- **Divergência de nome/unidade de campo** da InfinitePay → reconciliação falha em silêncio. Ver a seção "A validar contra callback REAL antes do go-live".
- **`CORS_ORIGIN` não setada** → nenhuma origem liberada, o front não chama o Fluxo A (fail-closed intencional). Setar antes de ligar.

## DEPLOY REALIZADO (2026-08-17) — estado no ar e verificado
Ambiente: VPS Hostinger `n8n.srv1851560.hstgr.cloud` (n8n 2.31.5, queue mode, 1 main + 3 workers).
- **Workflows importados e ATIVOS:** `useauraPay000001` (InfinitePay Fluxo A+B) e `useauraErr000001` (Error Handler ntfy, associado via `settings.errorWorkflow`).
- **Webhooks públicos (Traefik):**
  - Fluxo A (criar link): `https://n8n.srv1851560.hstgr.cloud/webhook/useaura-criar-link`
  - Fluxo B (callback):   `https://n8n.srv1851560.hstgr.cloud/webhook/useaura-callback`
- **Credencial** Google Service Account importada (id `REPLACE_FIREBASE_SA_CRED`, scope datastore) — casada nos 8 nós Firestore.
- **ENVs** setadas nos DOIS serviços (n8n + n8n-worker) do `/docker/n8n/docker-compose.yml`: INFINITEPAY_HANDLE, INFINITEPAY_WEBHOOK_URL, NTFY_TOPIC, CORS_ORIGIN. Backup do compose em `docker-compose.yml.bak-*`.
- **`config/store`** populado (catálogo real + produto de teste `vestido-teste-x` R$1, preço único Pix=cartão).

### Testes controlados executados (SEM transacionar)
- Preflight OPTIONS Fluxo A → **204**; header `Access-Control-Allow-Origin: https://joao998jc-tech.github.io` correto.
- Fluxo A item inválido → **400** `{"error":"produto desconhecido: ..."}` (prova SA + leitura de catálogo).
- Fluxo A item válido → **502** `external_checkout_not_enabled` (ver desbloqueio abaixo — pipeline OK, falta o toggle da conta).
- Fluxo B callback forjado → **200** `{"status":"ack_nao_reconciliado"}`, e `payments/*` confirmados **ausentes** (nenhuma baixa indevida).

### DESBLOQUEIO FINAL de go-live (ação da DONA, 1 toggle)
A InfinitePay recusa criar link com `external_checkout_not_enabled`: **"External checkout is not enabled for this merchant"**. A dona (conta do handle `ana-laura-oug`) precisa ativar o External Checkout em:
`https://app.infinitepay.io/external-checkout#configuracoes?enabled=true`
Assim que ligar, o Fluxo A cria links (aí sim confirmar o campo `url` da resposta — ver "A validar contra callback REAL").

### Lições operacionais desta VPS (para não repetir)
- **`docker compose up -d` SEM `--scale n8n-worker=3` reduz os workers de 3 para 1** (o compose define 1 réplica; os 3 vêm de scale). SEMPRE subir com `docker compose up -d --scale n8n-worker=3`.
- **n8n 2.31.5 BLOQUEIA `$env` em EXPRESSÕES por padrão** → `={{ $env.CORS_ORIGIN }}` derruba o workflow ("Workflow could not be started"). Necessário `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` nos dois serviços (já setado).
