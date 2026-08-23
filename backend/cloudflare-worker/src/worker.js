/* ==========================================================================
   USE AURA — Backend transacional em Cloudflare Workers (grátis, sem VPS).
   Porta 1:1 a LÓGICA dos workflows n8n (backend/n8n-infinitepay-useaura.json e
   backend/n8n-superfrete-useaura.json). Um único Worker roteia os 5 webhooks:

     POST /criar-link   -> InfinitePay Fluxo A (cria link, preço server-side)
     POST /callback     -> InfinitePay Fluxo B (reconcilia + baixa automática)
     POST /sf-token     -> SuperFrete Fluxo 1 (grava token/remetente no cofre)
     POST /sf-cotar     -> SuperFrete Fluxo 2 (cotação server-side)
     POST /sf-etiqueta  -> SuperFrete Fluxo 3 (gera etiqueta PDF)

   ANTIFRAUDE: preço e frete SEMPRE recomputados aqui (nunca do navegador).
   SEGREDOS: só a private_key da Service Account é secret do Worker; token e
   remetente da SuperFrete vivem no cofre Firestore (secrets/superfrete, SA-only).
   Nada sensível fica no front (GitHub Pages é público).
   ========================================================================== */

// ---- CORS: allowlist LITERAL (lição n8n 2026-08-17: preflight precisa de valor
// literal; aqui o Worker responde o próprio OPTIONS, então o eco dinâmico a
// partir da allowlist literal também vale no preflight). ----
const ALLOWED_ORIGINS = [
  'https://joao998jc-tech.github.io',
  'https://roupasaura.com',
  'https://www.roupasaura.com',
];
function corsHeaders(origin) {
  const o = ALLOWED_ORIGINS.includes(origin) ? origin : 'https://roupasaura.com';
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

const SF_USER_AGENT = 'AvanziaUseAura (contato@avanzia.com)';

// ==========================================================================
//  Firebase Service Account -> OAuth2 access_token (RS256 via WebCrypto)
// ==========================================================================
let _tokenCache = { value: null, exp: 0 };

function b64url(input) {
  let bytes;
  if (typeof input === 'string') bytes = new TextEncoder().encode(input);
  else bytes = new Uint8Array(input);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function pemToPkcs8(pem) {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(clean);
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buf;
}
async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (_tokenCache.value && _tokenCache.exp - 60 > now) return _tokenCache.value;

  const clientEmail = env.FIREBASE_SA_CLIENT_EMAIL;
  // aceita private_key com \n reais OU escapados (\\n), conforme o modo de colar no secret
  const privateKey = String(env.FIREBASE_SA_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) throw new Error('SA credencial ausente');

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = header + '.' + claim;
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToPkcs8(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput)
  );
  const jwt = signingInput + '.' + b64url(sig);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + encodeURIComponent(jwt),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j || !j.access_token) throw new Error('falha ao obter access_token');
  _tokenCache = { value: j.access_token, exp: now + (Number(j.expires_in) || 3600) };
  return j.access_token;
}

// ==========================================================================
//  Firestore REST (espelha fullResponse+neverError do n8n: nunca lança;
//  devolve { statusCode, body }).
// ==========================================================================
function fsBase(env) {
  const p = env.PROJECT_ID || 'useaura-34065';
  return `https://firestore.googleapis.com/v1/projects/${p}/databases/(default)/documents`;
}
async function fsGet(env, path) {
  try {
    const tok = await getAccessToken(env);
    const r = await fetch(`${fsBase(env)}/${path}`, { headers: { Authorization: `Bearer ${tok}` } });
    return { statusCode: r.status, body: await r.json().catch(() => null) };
  } catch (e) {
    return { statusCode: 0, body: null };
  }
}
async function fsPatch(env, pathWithQuery, fields) {
  try {
    const tok = await getAccessToken(env);
    const r = await fetch(`${fsBase(env)}/${pathWithQuery}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    return { statusCode: r.status, body: await r.json().catch(() => null) };
  } catch (e) {
    return { statusCode: 0, body: null };
  }
}
// leitura de escalar tipado do Firestore REST (mesmos helpers dos Code nodes n8n)
function fsVal(v) {
  if (v == null) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return v.integerValue;
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  return undefined;
}
function fsMap(v) { return v && v.mapValue && v.mapValue.fields; }

// ==========================================================================
//  FRETE server-side — cópia EXATA de freteCentavos (n8n nós A e B / front).
//  Invariante provada por backend/harness-frete.js. NÃO alterar sem re-rodar.
// ==========================================================================
function freteCentavos(fc, cepRaw) {
  fc = fc || {};
  const vf = Number(fc.valorFora);
  if (!fc.configurado || !(vf >= 0)) return 0;
  const d = String(cepRaw == null ? '' : cepRaw).replace(/\D/g, '');
  if (d.length !== 8) return Math.round(vf * 100);
  const prefs = Array.isArray(fc.gratisPrefixos) ? fc.gratisPrefixos : [];
  for (const pp of prefs) {
    const p = String(pp == null ? '' : pp).replace(/\D/g, '');
    if (p && d.indexOf(p) === 0) return 0;
  }
  return Math.round(vf * 100);
}

async function readStore(env) {
  const catResp = await fsGet(env, 'config/store');
  let store = null;
  if (catResp.statusCode === 200 && catResp.body && catResp.body.fields
      && catResp.body.fields.payload && typeof catResp.body.fields.payload.stringValue === 'string') {
    try { store = JSON.parse(catResp.body.fields.payload.stringValue); } catch (e) { store = null; }
  }
  return store;
}

async function verifyOwnerIdToken(env, idToken) {
  const OWNER = env.OWNER_EMAIL || 'useaura@gmail.com';
  const apiKey = env.FIREBASE_API_KEY;
  if (!idToken || !apiKey) return false; // short-circuit: não gasta requisição ao Identity Toolkit com token vazio
  try {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const body = await r.json().catch(() => null);
    if (r.ok && body && Array.isArray(body.users) && body.users[0]) {
      const u = body.users[0];
      if (u.email === OWNER && u.localId) return true;
    }
  } catch (e) { /* fall through */ }
  return false;
}

// ==========================================================================
//  SuperFrete — cotação server-side (usada por /sf-cotar E internamente pelo
//  Fluxo A do InfinitePay; função única, sem 3ª cópia — Regra R1 do runbook).
//  Retorna { valid, code, motivo } OU { valid:true, servicos:[...] }.
// ==========================================================================
async function cotarLogic(env, to_cepRaw, itens) {
  const to_cep = String(to_cepRaw == null ? '' : to_cepRaw).replace(/\D/g, '');
  const itensArr = Array.isArray(itens) ? itens : [];

  const tokResp = await fsGet(env, 'secrets/superfrete');
  const token = (tokResp.statusCode === 200 && tokResp.body && tokResp.body.fields
    && tokResp.body.fields.token && tokResp.body.fields.token.stringValue) || '';
  if (!token) return { valid: false, code: 400, motivo: 'sem token' };

  const store = await readStore(env);
  const produtos = store && store.produtos;
  const frete = (store && store.frete) || {};
  const sf = frete.superfrete || {};
  if (!Array.isArray(produtos) || produtos.length === 0) return { valid: false, code: 400, motivo: 'catalogo indisponivel' };
  if (!sf.origemCep) return { valid: false, code: 400, motivo: 'origem nao configurada' };
  if (to_cep.length !== 8) return { valid: false, code: 400, motivo: 'cep destino invalido' };

  const services = String(sf.servicos || '1,2,17');
  const categorias = sf.categorias || {};
  const DEFAULT = { weight: 0.3, height: 4, width: 12, length: 17 };
  const mapa = {};
  for (const p of produtos) mapa[String(p.id)] = p;

  // HEURISTICA DE EMPACOTAMENTO (idêntica ao nó "Montar Package (Cotar)" e "Montar Cart"):
  let W = 0, H = 0, Wd = 0, L = 0, itensOk = false;
  for (const it of itensArr) {
    const prod = mapa[String(it && it.id)];
    const qtd = parseInt(it && it.qtd, 10);
    if (!prod || !Number.isInteger(qtd) || qtd <= 0) continue;
    let pk = prod.frete;
    if (!pk) { const cat = prod.categoria; pk = (cat && categorias[cat]) ? categorias[cat] : null; }
    if (!pk) pk = DEFAULT;
    const w = Number(pk.weight) || DEFAULT.weight;
    const h = Number(pk.height) || DEFAULT.height;
    const wd = Number(pk.width) || DEFAULT.width;
    const l = Number(pk.length) || DEFAULT.length;
    W += w * qtd; H += h * qtd; Wd = Math.max(Wd, wd); L = Math.max(L, l); itensOk = true;
  }
  if (!itensOk) return { valid: false, code: 400, motivo: 'itens invalidos' };
  W = Math.max(W, 0.3); H = Math.max(Math.ceil(H), 2); Wd = Math.max(Math.ceil(Wd), 11); L = Math.max(Math.ceil(L), 16);
  const pkg = { weight: Number(W.toFixed(3)), height: H, width: Wd, length: L };

  let r;
  try {
    r = await fetch(`${env.SUPERFRETE_API_BASE || 'https://api.superfrete.com'}/api/v0/calculator`, {
      method: 'POST',
      headers: {
        'User-Agent': SF_USER_AGENT,
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: { postal_code: String(sf.origemCep).replace(/\D/g, '') },
        to: { postal_code: to_cep },
        services,
        package: pkg,
      }),
    });
  } catch (e) {
    return { valid: false, code: 502, motivo: 'falha na cotacao SuperFrete' };
  }
  const arr = await r.json().catch(() => null);
  if (!r.ok || !Array.isArray(arr)) return { valid: false, code: 502, motivo: 'falha na cotacao SuperFrete' };
  const servicos = arr
    .filter((s) => s && s.has_error !== true)
    .map((s) => ({ id: s.id, name: s.name, price: s.price, delivery_time: s.delivery_time }));
  return { valid: true, servicos };
}

// ==========================================================================
//  ROTA 1 — InfinitePay Fluxo A: criar link (preço + frete server-side)
// ==========================================================================
async function handleCriarLink(request, env, origin) {
  const body = await request.json().catch(() => ({}));
  const items = body.items;
  const pagamento = body.pagamento === 'pix' ? 'pix' : 'cartao';

  const store = await readStore(env);
  const produtos = store && store.produtos;
  if (!Array.isArray(produtos) || produtos.length === 0) {
    return json({ error: 'catalogo indisponivel' }, 400, origin);
  }
  const freteCfg = (store && store.frete) || {};
  const sf = store && store.frete && store.frete.superfrete;
  const mapa = {};
  for (const p of produtos) mapa[String(p.id)] = p;

  // --- Validação dos itens contra o catálogo (preço IGNORA o browser) ---
  const errors = [];
  if (!Array.isArray(items) || items.length === 0) errors.push('items vazio');
  if (!body.orderId) errors.push('orderId ausente');
  const outItems = [];
  if (Array.isArray(items)) {
    for (const it of items) {
      if (!Number.isInteger(it.quantity) || it.quantity <= 0) { errors.push('quantity invalido'); continue; }
      const prod = mapa[String(it.id)];
      if (!prod) { errors.push('produto desconhecido: ' + it.id); continue; }
      if (prod.esgotado === true) { errors.push('produto esgotado: ' + it.id); continue; }
      const preco = Number(prod.preco);
      if (!(preco > 0)) { errors.push('preco invalido no catalogo: ' + it.id); continue; }
      const basis = preco; // PREÇO ÚNICO: Pix e cartão pagam o mesmo (checkout multi-método)
      const price = Math.round(basis * 100);
      outItems.push({ quantity: it.quantity, price, description: String(it.description || prod.nome || it.id) });
    }
  }
  if (errors.length) return json({ error: errors.join('; ') }, 400, origin);

  // --- FRETE autoritativo (R1). Região grátis por prefixo = prioridade absoluta. ---
  const cepA = (body.address && body.address.cep) || '';
  const _fretePrefixo = freteCentavos(freteCfg, cepA);
  let freteC;
  const temServico = body.frete_servico != null && body.frete_servico !== '';
  if (_fretePrefixo === 0) {
    freteC = 0; // região grátis nunca cota nem cobra SF (Opção A)
  } else if (temServico && sf && sf.ativo) {
    // RE-COTAR server-side (mesma função do /sf-cotar). Falha -> frete fixo (nunca sem frete).
    const cot = await cotarLogic(env, cepA, (items || []).map((i) => ({ id: i.id, qtd: i.quantity })));
    const servId = parseInt(body.frete_servico, 10);
    const alvo = cot.valid ? (cot.servicos || []).find((s) => parseInt(s.id, 10) === servId && s.has_error !== true) : null;
    freteC = (alvo && Number(alvo.price) >= 0) ? Math.round(Number(alvo.price) * 100) : _fretePrefixo;
  } else {
    freteC = _fretePrefixo;
  }
  // R1 (simétrico com o Fluxo B): SEMPRE que o pedido tem frete_servico e NÃO é região grátis,
  // grava em orders/<id>.frete o valor EFETIVAMENTE COBRADO (reais). O Fluxo B lê esse valor
  // (não recomputa) sempre que frete_servico está presente — mesmo que a dona desligue o
  // SuperFrete entre a criação do link e o callback (senão A cobraria prefixo e B leria SF => deadlock).
  if (temServico && _fretePrefixo !== 0 && body.orderId) {
    await fsPatch(env, `orders/${encodeURIComponent(body.orderId)}?updateMask.fieldPaths=frete`,
      { frete: { doubleValue: freteC / 100 } });
  }
  if (freteC > 0) outItems.push({ quantity: 1, price: freteC, description: 'Frete' });

  // webhook_url = este mesmo Worker, rota /callback (deriva da origin do Worker — sem config extra)
  const webhookUrl = new URL(request.url).origin + '/callback';
  const payload = {
    handle: env.INFINITEPAY_HANDLE,
    order_nsu: String(body.orderId),
    items: outItems,
    redirect_url: body.redirect_url,
    webhook_url: webhookUrl,
  };
  if (body.customer) payload.customer = body.customer;
  if (body.address) payload.address = body.address;

  // --- POST /links ---
  let r;
  try {
    r = await fetch(`${env.INFINITEPAY_API_BASE || 'https://api.checkout.infinitepay.io'}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return json({ error: 'falha ao criar link na InfinitePay' }, 502, origin);
  }
  const data = await r.json().catch(() => null);
  if (!r.ok) return json({ error: 'falha ao criar link na InfinitePay' }, 502, origin);
  const url = (data && (data.url || (data.data && data.data.url) || data.link)) || null;
  if (!url) return json({ error: 'link sem url' }, 502, origin);
  return json({ url }, 200, origin);
}

// ==========================================================================
//  ROTA 2 — InfinitePay Fluxo B: callback + reconciliação + baixa automática
//  (server-to-server; sem necessidade de CORS, mas inofensivo mantê-lo)
// ==========================================================================
async function handleCallback(request, env, origin) {
  const parsed = await request.json().catch(() => ({}));
  const wh = parsed.body || parsed; // aceita {body:{...}} ou direto
  const orderNsu = wh && wh.order_nsu;

  // --- Idempotência por-pedido: payments/<order_nsu> já 'pago' -> não reprocessa ---
  const payResp = await fsGet(env, `payments/${encodeURIComponent(orderNsu)}`);
  if (payResp.statusCode === 200 && payResp.body && payResp.body.fields
      && payResp.body.fields.status && payResp.body.fields.status.stringValue === 'pago') {
    return json({ status: 'ja_processado' }, 200, origin);
  }

  // --- Reconciliação contra o TOTAL AUTORITATIVO do pedido (não contra wh.amount) ---
  const store = await readStore(env);
  const produtos = store && store.produtos;
  const freteCfg = (store && store.frete) || {};
  const mapa = {};
  if (Array.isArray(produtos)) for (const p of produtos) mapa[String(p.id)] = p;

  const orderResp = await fsGet(env, `orders/${encodeURIComponent(orderNsu)}`);
  const fields = orderResp.body && orderResp.body.fields;

  // payment_check REAL (única fonte de verdade — webhook não é confiável sozinho)
  let check = null;
  try {
    const r = await fetch(`${env.INFINITEPAY_API_BASE || 'https://api.checkout.infinitepay.io'}/payment_check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle: env.INFINITEPAY_HANDLE,
        order_nsu: orderNsu,
        transaction_nsu: wh && wh.transaction_nsu,
        slug: wh && wh.invoice_slug,
      }),
    });
    check = await r.json().catch(() => null);
    if (!r.ok) check = null;
  } catch (e) { check = null; }
  if (!check) return json({ error: 'falha ao reconciliar' }, 400, origin);

  const pagamento = (fields && fields.pagamento && fields.pagamento.stringValue === 'pix') ? 'pix' : 'cartao';
  const itensArr = (fields && fields.itens && fields.itens.arrayValue && Array.isArray(fields.itens.arrayValue.values))
    ? fields.itens.arrayValue.values : [];
  let totalAutoritativo = 0;
  let calcOk = Array.isArray(produtos) && produtos.length > 0 && itensArr.length > 0;
  if (calcOk) {
    for (const el of itensArr) {
      const f = el && el.mapValue && el.mapValue.fields;
      if (!f) { calcOk = false; break; }
      const id = String(fsVal(f.id));
      const qtd = parseInt(fsVal(f.qtd), 10);
      const prod = mapa[id];
      if (!prod || !Number.isInteger(qtd) || qtd <= 0) { calcOk = false; break; }
      const preco = Number(prod.preco);
      if (!(preco > 0)) { calcOk = false; break; }
      const basis = preco; // preço único
      totalAutoritativo += Math.round(basis * 100) * qtd;
    }
  }
  if (calcOk) {
    const cepF = (fields && fields.entrega && fields.entrega.mapValue && fields.entrega.mapValue.fields
      && fields.entrega.mapValue.fields.cep) ? fsVal(fields.entrega.mapValue.fields.cep) : '';
    const _fretePrefixo = freteCentavos(freteCfg, cepF);
    const frServ = fields && fields.frete_servico ? fsVal(fields.frete_servico) : undefined;
    if (_fretePrefixo === 0) {
      totalAutoritativo += 0; // região grátis: prioridade absoluta (espelho do Fluxo A)
    } else if (frServ != null && frServ !== '') {
      const freteReais = Number(fsVal(fields.frete)) || 0; // R1: lê o cobrado gravado por A
      totalAutoritativo += Math.round(freteReais * 100);
    } else {
      totalAutoritativo += _fretePrefixo; // SF-OFF: regra de prefixo
    }
  }

  // amount == total (fecha subpagamento); paid_amount >= total aceita repasse de taxa no cartão
  const reconciled = !!(calcOk && check && check.success === true && check.paid === true
    && Number(check.amount) === totalAutoritativo && Number(check.paid_amount) >= totalAutoritativo);

  if (!reconciled) {
    await sendTelegram(env, 'USE AURA: pagamento NAO reconciliado #' + orderNsu + ' — confira no painel.');
    return json({ status: 'ack_nao_reconciliado' }, 200, origin);
  }

  // --- Anti-reuso de transação: paid_tx/<transaction_nsu> com order_nsu diferente ---
  const txResp = await fsGet(env, `paid_tx/${encodeURIComponent(wh.transaction_nsu)}`);
  if (txResp.statusCode === 200 && txResp.body && txResp.body.fields
      && txResp.body.fields.order_nsu && typeof txResp.body.fields.order_nsu.stringValue === 'string'
      && String(txResp.body.fields.order_nsu.stringValue) !== String(orderNsu)) {
    await sendTelegram(env, 'USE AURA: transacao reutilizada em outro pedido #' + orderNsu);
    return json({ status: 'ack_reuso_bloqueado' }, 200, origin);
  }

  // --- Baixa: orders (pago) -> payments (público) -> paid_tx -> aviso Telegram ---
  const nowMs = String(Date.now());
  const captureMethod = String((wh && wh.capture_method) || (check && check.capture_method) || '');
  const installments = String((wh && wh.installments) || (check && check.installments) || 1);

  const pOrders = await fsPatch(env,
    `orders/${encodeURIComponent(orderNsu)}?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt&updateMask.fieldPaths=capture_method&updateMask.fieldPaths=installments`,
    { status: { stringValue: 'pago' }, updatedAt: { integerValue: nowMs },
      capture_method: { stringValue: captureMethod }, installments: { integerValue: installments } });
  if (pOrders.statusCode < 200 || pOrders.statusCode >= 300) return json({ error: 'falha ao gravar no Firestore' }, 400, origin);

  const pPayments = await fsPatch(env,
    `payments/${encodeURIComponent(orderNsu)}?updateMask.fieldPaths=status&updateMask.fieldPaths=orderId&updateMask.fieldPaths=updatedAt&updateMask.fieldPaths=capture_method&updateMask.fieldPaths=installments`,
    { status: { stringValue: 'pago' }, orderId: { stringValue: String(orderNsu) }, updatedAt: { integerValue: nowMs },
      capture_method: { stringValue: captureMethod }, installments: { integerValue: installments } });
  if (pPayments.statusCode < 200 || pPayments.statusCode >= 300) return json({ error: 'falha ao gravar no Firestore' }, 400, origin);

  await fsPatch(env, `paid_tx/${encodeURIComponent(wh.transaction_nsu)}`,
    { order_nsu: { stringValue: String(orderNsu) }, at: { integerValue: nowMs } });

  await sendTelegram(env, 'Venda confirmada! Pedido #' + orderNsu + ' - ' + captureMethod + ' - ' + installments + 'x');
  return json({ status: 'pago' }, 200, origin);
}

// ==========================================================================
//  Aviso de venda via Telegram Bot API (substitui o ntfy — o ntfy.sh free
//  responde 429 a partir dos IPs compartilhados do Cloudflare; o Telegram Bot
//  API identifica por bot token, sem cap de IP → R$0 e confiável).
//  Token = secret TELEGRAM_BOT_TOKEN (nunca no repo/front). Os chat_ids (1..N)
//  e o código de pareamento vivem no cofre Firestore secrets/telegram (SA-only).
// ==========================================================================
let _botUsername = null;

async function tgReadCofre(env) {
  const r = await fsGet(env, 'secrets/telegram');
  const f = (r.statusCode === 200 && r.body && r.body.fields) || {};
  const chatIds = (f.chatIds && f.chatIds.arrayValue && Array.isArray(f.chatIds.arrayValue.values))
    ? f.chatIds.arrayValue.values.map((v) => v && v.stringValue).filter(Boolean) : [];
  const pairCode = (f.pairCode && f.pairCode.stringValue) || '';
  const pairExpires = Number((f.pairExpires && f.pairExpires.integerValue) || 0);
  return { chatIds, pairCode, pairExpires };
}
async function tgSendTo(env, chatId, text) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return r.ok;
  } catch (e) { return false; }
}
async function sendTelegram(env, msg) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return; // inerte enquanto o bot não estiver plugado (não quebra a baixa)
  const { chatIds } = await tgReadCofre(env);
  for (const chatId of chatIds) await tgSendTo(env, chatId, msg);
}
async function tgBotUsername(env) {
  if (_botUsername) return _botUsername;
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const j = await r.json().catch(() => null);
    if (j && j.ok && j.result && j.result.username) { _botUsername = j.result.username; return _botUsername; }
  } catch (e) { /* fall through */ }
  return null;
}
async function tgEnsureWebhook(env, workerOrigin) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const body = { url: workerOrigin + '/tg-webhook' };
  if (env.TELEGRAM_WEBHOOK_SECRET) body.secret_token = env.TELEGRAM_WEBHOOK_SECRET;
  try {
    await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  } catch (e) { /* best-effort */ }
}

// ROTA — /tg-pair (dona autenticada): gera código de pareamento + garante o webhook
// e devolve o deep-link t.me/<bot>?start=<code> p/ a dona dar Start (self-service).
async function handleTgPair(request, env, origin) {
  const parsed = await request.json().catch(() => ({}));
  const b = parsed.body || parsed;
  if (!(await verifyOwnerIdToken(env, b.idToken))) return json({ ok: false, motivo: 'nao autorizado' }, 403, origin);
  if (!env.TELEGRAM_BOT_TOKEN) return json({ ok: false, motivo: 'bot nao configurado' }, 503, origin);
  // sem o secret, o /tg-webhook é fail-closed e o Start nunca gravaria o chat_id → não deixa parear
  if (!env.TELEGRAM_WEBHOOK_SECRET) return json({ ok: false, motivo: 'webhook nao configurado' }, 503, origin);
  await tgEnsureWebhook(env, new URL(request.url).origin);
  const username = await tgBotUsername(env);
  if (!username) return json({ ok: false, motivo: 'bot indisponivel' }, 502, origin);
  const code = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  // grava só pairCode/pairExpires (updateMask preserva chatIds já conectados)
  const patch = await fsPatch(env, 'secrets/telegram?updateMask.fieldPaths=pairCode&updateMask.fieldPaths=pairExpires',
    { pairCode: { stringValue: code }, pairExpires: { integerValue: String(Date.now() + 10 * 60 * 1000) } });
  if (patch.statusCode < 200 || patch.statusCode >= 300) return json({ ok: false, motivo: 'falha ao preparar conexao' }, 500, origin);
  return json({ ok: true, deepLink: `https://t.me/${username}?start=${code}`, botUsername: username }, 200, origin);
}

// ROTA — /tg-webhook (chamada pelo Telegram): capta chat_id no /start <code> válido.
async function handleTgWebhook(request, env) {
  // FAIL-CLOSED: sem TELEGRAM_WEBHOOK_SECRET, o webhook é rejeitado — impede injeção de
  // chat_id forjado por quem não é o Telegram (o secret_token só o Telegram conhece).
  if (!env.TELEGRAM_WEBHOOK_SECRET) return new Response('forbidden', { status: 403 });
  if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('forbidden', { status: 403 });
  }
  const update = await request.json().catch(() => null);
  const msg = update && (update.message || update.edited_message);
  const chatId = msg && msg.chat && msg.chat.id;
  const text = (msg && msg.text) || '';
  if (chatId && text.indexOf('/start') === 0) {
    const code = (text.split(/\s+/)[1] || '').trim();
    const cofre = await tgReadCofre(env);
    const valid = code && cofre.pairCode && code === cofre.pairCode && Date.now() < cofre.pairExpires;
    if (valid) {
      const set = new Set(cofre.chatIds.map(String));
      set.add(String(chatId));
      const values = Array.from(set).map((id) => ({ stringValue: id }));
      // grava chatIds e consome o código (pairCode vazio) — updateMask não toca em pairExpires
      const patch = await fsPatch(env, 'secrets/telegram?updateMask.fieldPaths=chatIds&updateMask.fieldPaths=pairCode',
        { chatIds: { arrayValue: { values } }, pairCode: { stringValue: '' } });
      // só confirma "Conectado" se a gravação REALMENTE persistiu (senão seria conexão-fantasma)
      if (patch.statusCode >= 200 && patch.statusCode < 300) {
        await tgSendTo(env, chatId, '✅ Conectado! Você vai receber aqui um aviso a cada venda da USE AURA.');
      } else {
        await tgSendTo(env, chatId, 'Tive um problema ao salvar sua conexão. Volte à sua Área da Dona, toque em "Conectar Telegram" e tente de novo.');
      }
    } else {
      await tgSendTo(env, chatId, 'Para conectar, abra sua Área da Dona no site e toque em "Conectar Telegram" para gerar o link.');
    }
  }
  return new Response('ok', { status: 200 });
}

// ROTA — /tg-test (dona autenticada): envia um aviso de teste a todos os chats conectados.
async function handleTgTest(request, env, origin) {
  const parsed = await request.json().catch(() => ({}));
  const b = parsed.body || parsed;
  if (!(await verifyOwnerIdToken(env, b.idToken))) return json({ ok: false, motivo: 'nao autorizado' }, 403, origin);
  if (!env.TELEGRAM_BOT_TOKEN) return json({ ok: false, motivo: 'bot nao configurado' }, 503, origin);
  const { chatIds } = await tgReadCofre(env);
  if (!chatIds.length) return json({ ok: false, motivo: 'nenhum telegram conectado' }, 200, origin);
  let enviados = 0;
  for (const c of chatIds) { if (await tgSendTo(env, c, '🔔 Teste USE AURA — se você recebeu isto, seus avisos de venda estão ativos!')) enviados++; }
  return json({ ok: enviados > 0, enviados }, 200, origin);
}

// ==========================================================================
//  ROTA 3 — SuperFrete Fluxo 1: grava token/remetente no cofre (SA-only)
// ==========================================================================
async function handleSfToken(request, env, origin) {
  const parsed = await request.json().catch(() => ({}));
  const b = parsed.body || parsed;
  const idToken = b.idToken;

  const isOwner = await verifyOwnerIdToken(env, idToken);
  if (!isOwner) return json({ ok: false, motivo: 'nao autorizado' }, 403, origin);

  const hasToken = typeof b.token === 'string' && b.token.length > 0;
  const rem = b.remetente;
  const hasRem = rem && typeof rem === 'object' && !Array.isArray(rem) && Object.keys(rem).length > 0;
  if (!hasToken && !hasRem) return json({ ok: false, motivo: 'nada para gravar' }, 400, origin);

  const fields = { updatedAt: { integerValue: String(Date.now()) } };
  const masks = ['updatedAt'];
  if (hasToken) { fields.token = { stringValue: String(b.token) }; masks.push('token'); }
  if (hasRem) { fields.remetente = { stringValue: JSON.stringify(rem) }; masks.push('remetente'); }
  const query = masks.map((m) => 'updateMask.fieldPaths=' + m).join('&');

  const patch = await fsPatch(env, `secrets/superfrete?${query}`, fields);
  if (patch.statusCode < 200 || patch.statusCode >= 300) {
    return json({ ok: false, motivo: 'falha ao gravar no cofre' }, 500, origin);
  }

  if (!hasToken) return json({ ok: true }, 200, origin); // salvou só remetente: nada a validar

  // valida o token recém-salvo isoladamente via GET /user (não depende de origem/pacote)
  try {
    const r = await fetch(`${env.SUPERFRETE_API_BASE || 'https://api.superfrete.com'}/api/v0/user`, {
      headers: { 'User-Agent': SF_USER_AGENT, 'Authorization': `Bearer ${b.token}`, 'Accept': 'application/json' },
    });
    const u = await r.json().catch(() => null);
    const valid = r.status === 200 && u && (u.id != null || u.balance != null);
    if (valid) return json({ ok: true, valid: true }, 200, origin);
  } catch (e) { /* fall through */ }
  return json({ ok: false, valid: false, motivo: 'codigo invalido' }, 200, origin);
}

// ==========================================================================
//  ROTA 4 — SuperFrete Fluxo 2: cotação server-side (público)
// ==========================================================================
async function handleSfCotar(request, env, origin) {
  const parsed = await request.json().catch(() => ({}));
  const b = parsed.body || parsed;
  const res = await cotarLogic(env, b.to_cep, b.itens);
  if (!res.valid) return json({ ok: false, motivo: res.motivo }, res.code || 400, origin);
  return json({ ok: true, servicos: res.servicos }, 200, origin);
}

// ==========================================================================
//  ROTA 5 — SuperFrete Fluxo 3: gera etiqueta (dona) — cart -> checkout -> print
// ==========================================================================
async function handleSfEtiqueta(request, env, origin) {
  const parsed = await request.json().catch(() => ({}));
  const b = parsed.body || parsed;
  const orderId = b.orderId;

  const isOwner = await verifyOwnerIdToken(env, b.idToken);
  if (!isOwner) return json({ ok: false, motivo: 'nao autorizado' }, 403, origin);

  const cofre = await fsGet(env, 'secrets/superfrete');
  const token = (cofre.statusCode === 200 && cofre.body && cofre.body.fields
    && cofre.body.fields.token && cofre.body.fields.token.stringValue) || '';
  if (!token) return json({ ok: false, motivo: 'sem token' }, 400, origin);
  let rem = null;
  try {
    const rf = cofre.body.fields.remetente;
    if (rf && typeof rf.stringValue === 'string') rem = JSON.parse(rf.stringValue);
  } catch (e) { rem = null; }
  if (!rem || typeof rem !== 'object') return json({ ok: false, motivo: 'remetente nao configurado' }, 400, origin);
  const remOut = {
    name: String(rem.name || rem.nome || ''),
    document: String(rem.document || rem.cpf || '').replace(/\D/g, ''),
    address: String(rem.address || rem.endereco || ''),
    number: String(rem.number || rem.numero || ''),
    district: String(rem.district || rem.bairro || ''),
    city: String(rem.city || rem.cidade || ''),
    state_abbr: String(rem.state_abbr || rem.uf || ''),
    postal_code: String(rem.postal_code || rem.cep || '').replace(/\D/g, ''),
    complement: String(rem.complement || rem.complemento || ''),
  };
  if (!remOut.document || !remOut.postal_code) return json({ ok: false, motivo: 'remetente nao configurado' }, 400, origin);

  const oResp = await fsGet(env, `orders/${encodeURIComponent(orderId)}`);
  if (!(oResp.statusCode === 200 && oResp.body && oResp.body.fields)) {
    return json({ ok: false, motivo: 'pedido nao encontrado' }, 404, origin);
  }
  const f = oResp.body.fields;
  // GUARDA: sem frete_servico não há transportadora -> não emite etiqueta (cinto de segurança do caixa)
  const _fs = fsVal(f.frete_servico);
  if (_fs == null || String(_fs).trim() === '') {
    return json({ ok: false, motivo: 'Pedido de frete gratis/local - sem servico de transportadora; etiqueta nao se aplica.' }, 400, origin);
  }
  const cli = fsMap(f.cliente) || {};
  const ent = fsMap(f.entrega) || {};
  const cpf = String(fsVal(cli.cpf) || fsVal(cli.document) || fsVal(ent.cpf) || fsVal(cli.documento) || '').replace(/\D/g, '');
  if (cpf.length !== 11) return json({ ok: false, motivo: 'CPF do destinatario ausente' }, 422, origin);

  const store = await readStore(env);
  const sf = (store && store.frete && store.frete.superfrete) || {};
  const produtos = (store && store.produtos) || [];
  const categorias = sf.categorias || {};
  const DEFAULT = { weight: 0.3, height: 4, width: 12, length: 17 };
  const mapa = {};
  for (const p of produtos) mapa[String(p.id)] = p;
  const service = parseInt(fsVal(f.frete_servico), 10) || parseInt(sf.servicoPadrao, 10) || 1;

  const itensArr = (f.itens && f.itens.arrayValue && Array.isArray(f.itens.arrayValue.values)) ? f.itens.arrayValue.values : [];
  const products = [];
  let W = 0, H = 0, Wd = 0, L = 0;
  for (const el of itensArr) {
    const iff = el && el.mapValue && el.mapValue.fields; if (!iff) continue;
    const id = String(fsVal(iff.id));
    const qtd = parseInt(fsVal(iff.qtd), 10) || 1;
    const prod = mapa[id] || {};
    const nome = String(prod.nome || fsVal(iff.nome) || id);
    const preco = Number(prod.preco) || Number(fsVal(iff.preco)) || 0;
    products.push({ name: nome, quantity: qtd, unitary_value: preco });
    let pk = prod.frete; if (!pk) { const cat = prod.categoria; pk = (cat && categorias[cat]) ? categorias[cat] : null; } if (!pk) pk = DEFAULT;
    const w = Number(pk.weight) || DEFAULT.weight, h = Number(pk.height) || DEFAULT.height, wd = Number(pk.width) || DEFAULT.width, l = Number(pk.length) || DEFAULT.length;
    W += w * qtd; H += h * qtd; Wd = Math.max(Wd, wd); L = Math.max(L, l);
  }
  if (products.length === 0) return json({ ok: false, motivo: 'pedido sem itens' }, 400, origin);
  W = Math.max(W, 0.3); H = Math.max(Math.ceil(H), 2); Wd = Math.max(Math.ceil(Wd), 11); L = Math.max(Math.ceil(L), 16);
  const volumes = { weight: Number(W.toFixed(3)), height: H, width: Wd, length: L };
  const precoEstimado = Number(fsVal(f.frete)) || 0;
  const declaredValue = Number(products.reduce((s, p) => s + (Number(p.unitary_value) || 0) * (Number(p.quantity) || 1), 0).toFixed(2)) || 0;

  const cartBody = {
    from: { name: remOut.name, document: remOut.document, address: remOut.address, number: remOut.number, district: remOut.district, city: remOut.city, state_abbr: remOut.state_abbr, postal_code: remOut.postal_code, complement: remOut.complement },
    to: {
      name: String(fsVal(cli.nome) || fsVal(cli.name) || ''), document: cpf,
      address: String(fsVal(ent.endereco) || fsVal(ent.address) || ''), number: String(fsVal(ent.numero) || fsVal(ent.number) || ''),
      district: String(fsVal(ent.bairro) || fsVal(ent.district) || ''), city: String(fsVal(ent.cidade) || fsVal(ent.city) || ''),
      state_abbr: String(fsVal(ent.estado) || fsVal(ent.uf) || fsVal(ent.state_abbr) || ''), postal_code: String(fsVal(ent.cep) || '').replace(/\D/g, ''),
    },
    platform: 'USE AURA',
    service,
    products,
    volumes,
    options: { insurance_value: declaredValue, receipt: false, own_hand: false, non_commercial: true },
  };

  const SF_BASE = env.SUPERFRETE_API_BASE || 'https://api.superfrete.com';
  const sfHeaders = { 'User-Agent': SF_USER_AGENT, 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Content-Type': 'application/json' };

  // saldo antes de gerar (o /checkout debita)
  try {
    const ru = await fetch(`${SF_BASE}/api/v0/user`, { headers: { 'User-Agent': SF_USER_AGENT, 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } });
    const u = await ru.json().catch(() => null);
    const bal = Number(u && u.balance != null ? u.balance : NaN);
    if (Number.isFinite(bal) && precoEstimado > 0 && bal < precoEstimado) {
      return json({ ok: false, motivo: 'saldo insuficiente', saldo: bal }, 200, origin);
    }
  } catch (e) { /* segue; o /checkout barra de fato */ }

  // cart
  let cartId = null;
  try {
    const rc = await fetch(`${SF_BASE}/api/v0/cart`, { method: 'POST', headers: sfHeaders, body: JSON.stringify(cartBody) });
    const jc = await rc.json().catch(() => null);
    const cb = (jc && jc.body) || jc;
    cartId = cb && (cb.id || cb.order_id || cb.orderId) ? String(cb.id || cb.order_id || cb.orderId) : null;
    if (!rc.ok || !cartId) return json({ ok: false, motivo: 'falha no cart SuperFrete' }, 502, origin);
  } catch (e) { return json({ ok: false, motivo: 'falha no cart SuperFrete' }, 502, origin); }

  // checkout (debita)
  try {
    const rck = await fetch(`${SF_BASE}/api/v0/checkout`, { method: 'POST', headers: sfHeaders, body: JSON.stringify({ orders: [cartId] }) });
    if (!rck.ok) return json({ ok: false, motivo: 'falha no checkout SuperFrete (saldo insuficiente ou API)' }, 502, origin);
  } catch (e) { return json({ ok: false, motivo: 'falha no checkout SuperFrete (saldo insuficiente ou API)' }, 502, origin); }

  // tag/print
  let pdfUrl = null, tracking = null;
  try {
    const rp = await fetch(`${SF_BASE}/api/v0/tag/print`, { method: 'POST', headers: sfHeaders, body: JSON.stringify({ orders: [cartId] }) });
    const jp = await rp.json().catch(() => null);
    const pb = jp && jp.body != null ? jp.body : jp;
    if (typeof pb === 'string') pdfUrl = pb;
    else if (pb) { pdfUrl = pb.url || (pb[cartId] && pb[cartId].url) || pb.link || (pb.data && pb.data.url) || null; }
    if (pb && typeof pb === 'object') tracking = pb.tracking || (pb[cartId] && pb[cartId].tracking) || null;
    if (!rp.ok || !pdfUrl) return json({ ok: false, motivo: 'falha ao imprimir etiqueta' }, 502, origin);
  } catch (e) { return json({ ok: false, motivo: 'falha ao imprimir etiqueta' }, 502, origin); }

  // grava orders/<id>.etiqueta
  const patch = await fsPatch(env, `orders/${encodeURIComponent(orderId)}?updateMask.fieldPaths=etiqueta`,
    { etiqueta: { mapValue: { fields: {
      pdfUrl: { stringValue: String(pdfUrl || '') },
      tracking: { stringValue: String(tracking || '') },
      geradaEm: { integerValue: String(Date.now()) },
    } } } });
  if (patch.statusCode < 200 || patch.statusCode >= 300) {
    return json({ ok: false, motivo: 'etiqueta gerada mas falha ao gravar no pedido', pdfUrl }, 500, origin);
  }
  return json({ ok: true, pdfUrl }, 200, origin);
}

// ==========================================================================
//  Router
// ==========================================================================
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
    try {
      if (request.method === 'POST') {
        if (path === '/criar-link') return await handleCriarLink(request, env, origin);
        if (path === '/callback') return await handleCallback(request, env, origin);
        if (path === '/sf-token') return await handleSfToken(request, env, origin);
        if (path === '/sf-cotar') return await handleSfCotar(request, env, origin);
        if (path === '/sf-etiqueta') return await handleSfEtiqueta(request, env, origin);
        if (path === '/tg-pair') return await handleTgPair(request, env, origin);
        if (path === '/tg-test') return await handleTgTest(request, env, origin);
        if (path === '/tg-webhook') return await handleTgWebhook(request, env); // Telegram server->Worker (sem CORS)
      }
      if (request.method === 'GET' && path === '/') {
        return new Response('USE AURA backend Worker OK', { status: 200, headers: corsHeaders(origin) });
      }
      return json({ error: 'not found' }, 404, origin);
    } catch (e) {
      return json({ error: 'internal' }, 500, origin);
    }
  },
};
