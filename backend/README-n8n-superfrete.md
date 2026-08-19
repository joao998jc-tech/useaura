# Runbook — n8n SuperFrete (USEAURA)

> **BLOQUEIO DE PUBLICAÇÃO:** sem o **remetente gravado no cofre** (A1 — Fluxo 1 aceita `remetente` e grava em `secrets/superfrete.remetente`) **e** sem o **patch R1 do Fluxo A do InfinitePay** (re-cotar server-side + gravar `orders/<id>.frete` cobrado + Fluxo B ler esse `frete`), **NÃO publicar**. Os dois fecham, respectivamente, a etiqueta (remetente PII fora do config público, por LGPD) e o invariante de dinheiro cobrado==reconciliado.

Workflow: `n8n-superfrete-useaura.json` (id `useauraSF000001`). Roda na VPS Hostinger (n8n queue mode), **separado** do InfinitePay (`useauraPay000001`) — não toca nele.
NADA aqui está ativo. Import, preencher credencial/cofre, testar controlado no **sandbox**, e só então o Analista de Sistemas + João decidem go-live.
Base da API neste JSON: **`https://sandbox.superfrete.com`** (trocar para `https://api.superfrete.com` no go-live real, nos 6 nós HTTP SuperFrete — inclui o `Validar Token SuperFrete (/user)` do Fluxo 1).

## O que o workflow faz — 3 fluxos independentes (rotas próprias)

### FLUXO 1 — `POST /webhook/useaura-sf-token` (browser da DONA, CORS on)
Body: `{ idToken, token? , remetente? }` — pode vir **token E/OU remetente** (o painel da dona salva token e PII do remetente em telas separadas). `remetente` = objeto com chaves PT `{nome,cpf,cep,endereco,numero,bairro,cidade,uf,complemento}` (a dona não digita JSON; o front monta o objeto).
1. **Verifica o idToken** (ver método abaixo). Se `email != useaura@gmail.com` → **403**.
2. Se dona: o nó **`Montar Patch Cofre`** (Code) monta o PATCH **só com os campos presentes** — `token` (stringValue) e/ou `remetente` (**stringValue = `JSON.stringify(remetente)`**, escolha documentada: mais simples de ler/parsear no Fluxo 3 que mapValue), sempre `updatedAt`. O `updateMask.fieldPaths` inclui **apenas** os campos presentes → gravar só `remetente` **não apaga** o `token`, e vice-versa. Também expõe `hadToken` (boolean) na saída, consumido no passo 5. **PATCH** `secrets/superfrete` via Service Account.
3. Se o body não trouxer nem `token` nem `remetente` → `400 { ok:false, motivo:'nada para gravar' }` (nó `Tem Campo? (Token)`).
4. **Sem ecoar token nem remetente.** Se o PATCH falhar → `500 { ok:false, motivo:'falha ao gravar no cofre' }`.
5. **Validação do token gravado (só quando veio token).** Após o PATCH bem-sucedido, o nó `Tinha Token? (Token)` ramifica por `Montar Patch Cofre.hadToken`:
   - **`hadToken === false`** (salvou só remetente, sem token novo): responde `{ ok: true }` direto (nó `Responder 200 OK (Token)`), **sem** chamar a SuperFrete — não há token a validar e não pode quebrar o fluxo de salvar remetente.
   - **`hadToken === true`**: o nó `Validar Token SuperFrete (/user)` faz **`GET /api/v0/user`** com `Authorization: Bearer <token recém-salvo>` (lido de `Webhook SF Token.body.token`, nunca ecoado), `User-Agent` obrigatório e `Accept: application/json`. Usa `fullResponse + neverError` (`onError: continueRegularOutput`) para tratar 401/403 **sem derrubar** o workflow. O `Token Autentica? (Token)` decide pelo statusCode + corpo: **`statusCode === 200` E corpo com `id`/`balance` presente** → `200 { ok:true, valid:true }` (nó `Responder 200 Token Valido`); senão (401/403/sem `id` nem `balance`) → `200 { ok:false, valid:false, motivo:'codigo invalido' }` (nó `Responder 200 Token Invalido`). **HTTP sempre 200**; o front lê o campo `ok`/`valid`.
   - **Por que não validar por cotação:** a validação anterior batia em `/calculator`, que exige a **origem (CEP remetente)** — salva num passo posterior do wizard — então um token válido caía como inválido. `/api/v0/user` autentica o token isoladamente (não depende de origem/pacote), corrigindo o falso negativo.

### FLUXO 2 — `POST /webhook/useaura-sf-cotar` (browser público, CORS on)
Body: `{ to_cep, itens:[{id,qtd}] }`. Fonte única usada pelo "testar cotação" e pelo checkout.
1. **Lê o token do cofre** (SA). Ausente → `400 { ok:false, motivo:'sem token' }`.
2. **Lê `config/store`** (SA): catálogo + `FRETE.superfrete`.
3. **Monta o package server-side** (heurística abaixo). Origem = `FRETE.superfrete.origemCep`; serviços = `FRETE.superfrete.servicos` (default `"1,2,17"`).
4. **POST `/api/v0/calculator`**.
5. Responde `{ ok:true, servicos:[{id,name,price,delivery_time}] }` (entradas `has_error` filtradas). Erro de API → `502`.

### FLUXO 3 — `POST /webhook/useaura-sf-etiqueta` (browser da DONA, CORS on)
Body: `{ orderId, idToken }`.
1. **Verifica idToken** (== dona), senão **403**.
2. **Lê token + remetente do cofre** (`secrets/superfrete`, SA) — `remetente` vem como stringValue JSON, `JSON.parse` no nó `Montar Cart`.
3. **Lê `orders/<orderId>`** (SA) — cliente, entrega, itens, `frete`, `frete_servico`.
4. **Lê `config/store`** (SA) — **catálogo + categorias + servicoPadrao** (o remetente **não** vem mais daqui — migrou para o cofre por LGPD).
5. **Monta o `/cart`** com mapeamento tolerante **PT→API** do remetente (`nome→name`, `cpf→document` só dígitos, `cep→postal_code` só dígitos, `endereco→address`, `numero→number`, `bairro→district`, `cidade→city`, `uf→state_abbr`, `complemento→complement`) — aceita também as chaves já em inglês. Destinatário: `document←(cliente.cpf||cliente.document, só dígitos)`, `state_abbr←(entrega.estado||entrega.uf||entrega.state_abbr)`. `service←(order.frete_servico || FRETE.superfrete.servicoPadrao || 1)`. Se `remetente` ausente no cofre → `400 { ok:false, motivo:'remetente nao configurado' }`; se `to.document` (CPF do destinatário) ausente → `422 { ok:false, motivo:'CPF do destinatario ausente' }`.
6. **GET `/api/v0/user`** (saldo). Se `balance < precoEstimado` → `200 { ok:false, motivo:'saldo insuficiente', saldo }` (não tenta gerar).
7. **POST `/api/v0/cart`** → `{id}`.
8. **POST `/api/v0/checkout` `{orders:[id]}`** (DEBITA saldo).
9. **POST `/api/v0/tag/print` `{orders:[id]}`** → URL do PDF A4.
10. **PATCH `orders/<id>`** via SA: `etiqueta = { pdfUrl, tracking, geradaEm }` (só campo `etiqueta` no `updateMask`).
11. Responde `{ ok:true, pdfUrl }`. Cada falha de API responde `{ ok:false, motivo }` claro (502 no `/cart`|`/user`|`/print`, 502 dedicado no `/checkout`).

## Verificação do idToken — método escolhido e por quê
**Identity Toolkit `accounts:lookup`** (`POST https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=<apiKey pública do projeto>` com body `{ idToken }`).
- apiKey usada = a **pública** do projeto (`AIzaSyAUPnFq1m_jRb_LWBLgHKbWPD0Z2ZM0W-I`, a mesma de `assets/js/config.js` — não é segredo, é chave de identificação do app, não de autorização).
- Por que este e não `tokeninfo`/x509: `accounts:lookup` só retorna `users[]` se o idToken foi **assinado pelo próprio projeto** `useaura-34065` **e ainda é válido** (não expirado/revogado). Isso valida assinatura, emissor, audiência e expiração de uma vez, sem baixar/rotacionar chaves x509 manualmente. `oauth2.googleapis.com/tokeninfo` valida tokens Google genéricos, não é o caminho canônico para idToken de Firebase de um projeto específico.
- **Autorização:** `users[0].email === 'useaura@gmail.com'` **e** `localId` presente → autorizado. `emailVerified` **não** é exigido no código (mesma postura das `firestore.rules`: o hardening real é desativar cadastro público no console, deixando a conta da dona como única). Se quiser exigir e-mail verificado, trocar a condição em `Validar Dono (Token)` / `Validar Dono (Etiqueta)` para `&& emailVerified === true`.
- Os nós de verificação usam `fullResponse + neverError` — token inválido/expirado volta sem `users[]`, `ok=false` → 403. O idToken **nunca** é gravado nem ecoado.

## Heurística de empacotamento (fácil de trocar)
No nó `Montar Package (Cotar)` (e replicada em `Montar Cart` para os `volumes`):
- Pacote por item, nesta ordem de resolução: **`produto.frete`** → **`FRETE.superfrete.categorias[produto.categoria]`** → **default `{weight:0.3, height:4, width:12, length:17}`**.
- Agregação do carrinho: `weight = Σ(peso·qtd)`; `height = Σ(altura·qtd)`; `width = max(largura)`; `length = max(comprimento)`. (Empilha na altura, mantém a maior base — aproximação simples de caixa única.)
- Mínimos aplicados (Correios/SuperFrete): `weight≥0.3`, `height≥2`, `width≥11`, `length≥16`.
- **Para trocar a heurística** (ex.: cubagem real, múltiplos volumes), editar o bloco marcado `HEURISTICA DE EMPACOTAMENTO` nos dois nós Code — manter as duas cópias iguais, senão a cotação mostrada diverge do volume etiquetado.

## Estrutura esperada em `config/store` → `frete.superfrete`
O catálogo já vive em `config/store` (campo `payload` = `JSON.stringify({produtos, categorias, frete, ...})`). Adicionar sob `frete`:
```json
"superfrete": {
  "ativo": true,
  "origemCep": "18560000",
  "servicos": "1,2,17",
  "servicoPadrao": 1,
  "categorias": { "vestido": {"weight":0.35,"height":4,"width":20,"length":30} }
}
```
**O `remetente` NÃO fica mais aqui** (config/store é público → PII do remetente violaria LGPD). Ele vive **no cofre** `secrets/superfrete.remetente` (SA-only), gravado pela dona via Fluxo 1. `servicoPadrao` é o fallback do `service` quando o pedido não tem `frete_servico`.
E, opcionalmente, `produto.frete = {weight,height,width,length}` por produto (sobrepõe a categoria). `produto.categoria` liga ao mapa `categorias`. Serviços: **PAC=1, SEDEX=2, Mini Envios=17**.

## Cofre do token + remetente (crítico)
- `secrets/superfrete` (doc `{token, remetente, updatedAt}`) é lido/escrito **só pela Service Account**; `firestore.rules` nega `read,write` a qualquer cliente (inclusive a dona autenticada) — ver `firestore.rules:61-63`. A dona só grava via Fluxo 1 (browser → n8n autenticado → SA).
- `remetente` guarda a **PII do remetente** (nome, CPF, endereço) como **stringValue JSON** — fora do `config/store` público por LGPD. Nunca é ecoado em resposta HTTP (o Fluxo 3 o lê, mapeia PT→API e só o envia no body do `/cart` à SuperFrete).
- O token **nunca** entra em `config/store` (público) nem em resposta HTTP. Nos fluxos 2 e 3 os nós Code checam só a **presença** do token (booleano) e **não emitem o valor**; os nós HTTP da SuperFrete leem o token por expressão **direto do nó `Ler Token Cofre`** (`=Bearer {{ $('Ler Token Cofre ...').first().json.body.fields.token.stringValue }}`). Assim o valor do token existe apenas no output do nó de leitura do cofre (dado SA-gated na execution data) e no header — nunca numa resposta ao browser nem num nó Code de saída.

## Contrato SuperFrete (headers obrigatórios em TODOS os 6 nós HTTP SuperFrete)
- `User-Agent: AvanziaUseAura (contato@avanzia.com)` (obrigatório — a API recusa sem User-Agent identificável).
- `Authorization: Bearer <token do cofre>`.
- `Accept: application/json` (+ `Content-Type: application/json` nos POST, setado pelo `specifyBody:json`).
- Cotar: `POST /api/v0/calculator` `{from:{postal_code},to:{postal_code},services,package:{weight,height,width,length}}` → array `[{id,name,price,delivery_time,has_error}]`.
- Saldo: `GET /api/v0/user` → `{balance,...}`.
- Etiqueta: `POST /api/v0/cart` (from/to/service/products/volumes) → `{id}`; `POST /api/v0/checkout {orders:[id]}` (debita); `POST /api/v0/tag/print {orders:[id]}` → URL PDF A4.

## Achados provados por curl (a documentar para o go-live)
1. **`to.document` (CPF do destinatário) é OBRIGATÓRIO** no `/cart`. **Resolvido:** o checkout agora coleta **CPF (`cliente.cpf`, 11 dígitos)** e **UF (`entrega.estado`)** quando SuperFrete está ativo. O nó `Montar Cart` lê o CPF de `cliente.cpf` / `cliente.document` / `entrega.cpf` / `cliente.documento` (tolerante) e a UF de `entrega.estado` / `entrega.uf` / `entrega.state_abbr`. Se ainda assim faltar CPF → `422 CPF do destinatario ausente` (guarda mantida).
2. **Saldo sandbox = 0** → o `/checkout` **falha** (é ele que debita). Com saldo 0, o fluxo cai em `Responder 502 Checkout` (`falha no checkout SuperFrete (saldo insuficiente ou API)`). O guard de saldo (`/user` antes) só bloqueia quando `precoEstimado > 0` conhecido; se o pedido não tiver `frete` gravado, o guard passa e o bloqueio real acontece no `/checkout`. Para testar o caminho feliz de etiqueta no sandbox, é preciso ter saldo sandbox > 0.

## Infra (idêntica ao InfinitePay — não reinventar)
### Credencial Firebase Service Account (SEM ela os fluxos não leem/escrevem)
- Tipo **Google Service Account API** (`googleApi`), placeholder no JSON: id `REPLACE_FIREBASE_SA_CRED`, nome `USEAURA Firebase Service Account` — **o mesmo** id/nome do workflow InfinitePay, para casar no import.
- **OBRIGATÓRIO** `httpNode:true` **+** `scopes = https://www.googleapis.com/auth/datastore`. Sem `httpNode:true` a credencial `googleApi` do n8n **não anexa o token** (a função `authenticate` começa com `if (!credentials.httpNode) return requestOptions;`) → Firestore responde **403** em `secrets`/`orders` (owner/SA-only). Na UI: toggle "When using the HTTP Request node" + Scope.
- Nós que usam a SA: `Gravar Token Cofre`, `Ler Token Cofre (Cotar)`, `Ler Config Store (Cotar)`, `Ler Token Cofre (Etiqueta)`, `Ler Order (Etiqueta)`, `Ler Config Store (Etiqueta)`, `PATCH orders (etiqueta)`.

### CORS / preflight — valor LITERAL no webhook, eco por expressão nas respostas
- Os 3 nós Webhook usam `allowedOrigins` **LITERAL** = `https://joao998jc-tech.github.io,https://roupasaura.com,https://www.roupasaura.com` (lista dos 3 origins). Motivo: o **preflight OPTIONS** é respondido pelo n8n **antes** de executar o workflow, **sem contexto de expressão** — se fosse expressão sairia literal no header e o browser bloquearia o POST. `curl` não faz preflight → **validar CORS só em navegador real**.
- Todas as respostas ecoam `Access-Control-Allow-Origin` **validado por expressão** (só ecoa se a origin recebida está na allowlist, senão `https://roupasaura.com`). Espelha o Fluxo A do InfinitePay.
- Ao trocar de domínio, editar o literal nos 3 Webhooks **e** nos nós de resposta.

### Env / n8n
- n8n 2.31.5 bloqueia `$env` em expressão por padrão; este workflow **não usa `$env`** (apiKey do idToken é a chave pública do app, embutida — não é segredo). Nada a setar em env para este workflow.
- Queue mode: os nós rodam nos workers; garantir que a credencial SA está disponível a todos (é credencial n8n, replicada pelo banco — ok).

## Error Workflow (Regra 71)
`settings.errorWorkflow` = `useauraErr000001` (o mesmo Error Handler ntfy do InfinitePay). Os 12 nós de chamada externa têm **Retry on Fail** (3 tentativas, 2s).

## Teste controlado (sandbox, sem debitar de verdade)
1. **Fluxo 1:** POST com idToken **inválido** → 403; com idToken da dona → 200 e conferir `secrets/superfrete` gravado (via SA, não pelo console de cliente).
2. **Fluxo 2:** POST `{to_cep, itens}` válido → 200 com array de serviços; sem token no cofre → 400 `sem token`; cep inválido → 400 `cep destino invalido`.
3. **Fluxo 3:** pedido **sem CPF** → 422; com saldo sandbox 0 → 502 no checkout; com saldo → confirmar PDF e `orders/<id>.etiqueta` gravado.
4. **CORS:** preflight OPTIONS nos 3 paths em navegador real (curl mascara o bug).

## R1 — Patch do InfinitePay (Fluxo A) — invariante de dinheiro (cobrado == reconciliado)
> **NÃO editar `n8n-infinitepay-useaura.json` aqui.** Snippet para o Analista aplicar no nó Code `Validar e Montar Payload` (Fluxo A), mantendo o invariante antifraude (o browser manda só `frete_servico` + `frete_cep`, **nunca** o preço).

**Invariante a fechar no deploy:** o frete efetivamente **COBRADO** no Fluxo A deve ser **GRAVADO** em `orders/<id>.frete` (PATCH via SA), e o **Fluxo B (reconciliação) passa a LER esse `orders.frete`** em vez de recomputar. Assim `cobrado == reconciliado` **sempre**, com **uma** fonte de verdade — acaba o risco de 3 heurísticas divergentes (cota do browser, re-cota do Fluxo A, recomputo do Fluxo B) travarem o pedido pago em `pendente`.

Fluxo de cálculo do frete autoritativo no Fluxo A, quando `body.frete_servico` presente **E** `FRETE.superfrete.ativo === true`:
1. **RE-COTAR `/calculator` server-side** — montar o package pela **MESMA função de package do Fluxo 2** (`Montar Package (Cotar)`). **Reutilizar, não recriar uma 3ª cópia** da heurística: extrair a montagem do package para um ponto único (sub-workflow ou nó Code compartilhado) e chamá-la aqui e no Fluxo 2. Requer um nó HTTP `/calculator` a montante (`Re-Cotar SuperFrete (A)`), lendo o token do cofre igual aqui.
2. **Se a API SuperFrete FALHAR (erro/timeout/serviço sem price)** → **CAIR NO FRETE FIXO `computeFrete`** (regra de prefixo, **idêntica** à do fluxo atual). O total autoritativo **NUNCA** fica sem frete.
3. O valor de frete resultante (re-cotado OU fallback fixo) é o **COBRADO**: entra no payload do link **e** é gravado em `orders/<id>.frete` (PATCH SA) **antes/junto** de criar o link.

```js
// FRETE autoritativo (R1): SuperFrete ativo + servico escolhido -> price re-cotado server-side.
// (O browser envia so frete_servico + frete_cep; NUNCA o preco.) O no HTTP /calculator a montante
// ('Re-Cotar SuperFrete (A)') usa o MESMO package do Fluxo 2 (funcao unica reutilizada, sem 3a copia).
let freteC = 0;
const sfCfg = (freteCfg && freteCfg.superfrete) || {};
if (sfCfg.ativo === true && body.frete_servico != null) {
  const cot = $('Re-Cotar SuperFrete (A)').first().json;   // fullResponse+neverError -> nunca lanca
  const arr = Array.isArray(cot.body) ? cot.body : (Array.isArray(cot) ? cot : []);
  const alvo = arr.find(s => s && s.has_error !== true && String(s.id) === String(body.frete_servico));
  if (alvo && Number(alvo.price) > 0) {
    freteC = Math.round(Number(alvo.price) * 100);         // price em reais -> centavos
  } else {
    // API falhou/servico indisponivel -> FALLBACK frete fixo (regra de prefixo idêntica ao fluxo atual).
    // NUNCA cobrar sem frete: o total autoritativo sempre tem frete.
    const cepA = (body.address && body.address.cep) || body.frete_cep || '';
    freteC = freteCentavos(freteCfg, cepA);
  }
} else {
  const cepA = (body.address && body.address.cep) || '';
  freteC = freteCentavos(freteCfg, cepA);                  // sem SuperFrete: regra de prefixo
}
if (freteC > 0) outItems.push({ quantity: 1, price: freteC, description: 'Frete' });
// freteC (o COBRADO) tem de ser gravado em orders/<id>.frete via PATCH SA junto da criacao do link,
// para o Fluxo B LER (nao recomputar). Ver invariante acima.
```
**Fluxo B (reconciliação):** ler `orders/<id>.frete` (o valor cobrado gravado) e somá-lo ao total autoritativo — **não** recomputar por `freteCentavos` nem re-cotar. Um único valor gravado fecha `amount == totalAutoritativo`; sem isso o pedido pago legítimo nunca vira `pago`. **Detalhar/testar com harness de invariante (mesmo do frete de prefixo) antes de tocar no workflow de pagamento.**

## Riscos conhecidos (sinalizados ao Analista de Sistemas)
- **Remetente no cofre (A1) — BLOQUEIO:** a etiqueta só sai se a dona tiver gravado o `remetente` no cofre via Fluxo 1. Sem isso, Fluxo 3 responde `400 remetente nao configurado`. Verificar `secrets/superfrete.remetente` presente antes do go-live.
- **CPF do destinatário:** resolvido — checkout coleta CPF (`cliente.cpf`) e UF (`entrega.estado`) com SuperFrete ativo. Confirmar em teste que o pedido real grava esses campos; sem CPF, Fluxo 3 ainda responde `422` (por design).
- **Saldo SuperFrete:** etiqueta só sai com saldo > 0 (o `/checkout` debita). Sandbox = 0. A dona precisa ter saldo/carteira na conta real antes de gerar etiquetas.
- **Contrato de resposta não 100% confirmado:** campos `id` (do `/cart`) e a URL do `/tag/print` são extraídos defensivamente (`Extrair Cart Id`, `Extrair PDF`). Confirmar os nomes reais no 1º cart/print sandbox e ajustar se divergir. O `price` do `/calculator` é assumido em **reais** — se vier em centavos, ajustar a escala no patch do InfinitePay.
- **Base sandbox no JSON:** os 5 nós SuperFrete apontam para `sandbox.superfrete.com`. Trocar para produção só na virada, junto com o token de produção no cofre.
- **Divergência de heurística** entre `Montar Package` (cotação) e `Montar Cart` (volumes da etiqueta): mantê-las iguais, senão cota-se um volume e etiqueta-se outro.
- **Invariante frete Fluxo A×B (R1) — BLOQUEIO:** o Fluxo A deve gravar o frete COBRADO em `orders/<id>.frete` e o Fluxo B deve LER esse valor (não recomputar). Enquanto os dois não fecharem no mesmo centavo com fonte única gravada, é deadlock de pagamento (pago legítimo preso em `pendente`). Não aplicar sem harness de invariante. O re-cotar server-side deve reutilizar a função de package do Fluxo 2 (sem 3ª cópia) e cair no frete fixo `computeFrete` se a API SuperFrete falhar.

> **Não declaro pronto para produção.** A verificação final de qualidade/corretude é do Analista de Sistemas.
