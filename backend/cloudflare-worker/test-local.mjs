/* Testes OFFLINE do Worker (sem conta Cloudflare, sem rede real).
   Importa o próprio src/worker.js e stuba global.fetch + usa uma chave RSA
   efêmera (NÃO a Service Account real) p/ exercitar o caminho WebCrypto/JWT.
   Prova: roteamento, antifraude de preço, reconciliação (repasse de taxa aceito,
   subpagamento barrado) e a invariante de frete (região grátis = prioridade).
   Rodar: node backend/cloudflare-worker/test-local.mjs  (sai 0 = verde). */
import { generateKeyPairSync } from 'node:crypto';
import worker from './src/worker.js';

let fail = 0;
function ok(name, cond, extra) {
  if (cond) console.log('  ok    ' + name);
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}

// chave RSA efêmera só p/ o teste (assinatura do JWT roda de verdade)
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const ENV = {
  PROJECT_ID: 'useaura-34065',
  OWNER_EMAIL: 'useaura@gmail.com',
  FIREBASE_API_KEY: 'fake',
  FIREBASE_SA_CLIENT_EMAIL: 'test@sa.iam.gserviceaccount.com',
  FIREBASE_SA_PRIVATE_KEY: privateKey,
  INFINITEPAY_HANDLE: 'ana-laura-oug',
  NTFY_TOPIC: 'useaura-pedidos-9f2kx7q',
  INFINITEPAY_API_BASE: 'https://api.checkout.infinitepay.io',
  SUPERFRETE_API_BASE: 'https://api.superfrete.com',
};

// catálogo autoritativo simulado (config/store.payload)
const STORE = {
  produtos: [{ id: 'p1', nome: 'Vestido', preco: 100 }],
  frete: { configurado: true, valorFora: 15, gratisPrefixos: ['18225'], superfrete: { ativo: false } },
};
function fsDoc(fields) { return { fields }; }
function storeDoc() {
  return fsDoc({ payload: { stringValue: JSON.stringify(STORE) } });
}

// estado mutável p/ inspecionar PATCHs e ntfy
let patches = [];
let ntfyMsgs = [];
let scenario = {};

function jsonRes(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

function installFetch() {
  patches = []; ntfyMsgs = [];
  globalThis.fetch = async (url, opts = {}) => {
    url = String(url);
    // OAuth2 token
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return jsonRes({ access_token: 'fake-access', expires_in: 3600 });
    }
    // ntfy
    if (url.startsWith('https://ntfy.sh/')) { ntfyMsgs.push(String(opts.body || '')); return new Response('ok'); }
    // Firestore
    if (url.includes('/documents/config/store')) return jsonRes(storeDoc());
    if (url.includes('/documents/payments/')) {
      if (opts.method === 'PATCH') { patches.push({ path: 'payments', url }); return jsonRes({}, 200); }
      return jsonRes(scenario.paymentDoc || {}, scenario.paymentStatus || 404);
    }
    if (url.includes('/documents/orders/')) {
      if (opts.method === 'PATCH') { patches.push({ path: 'orders', url, body: opts.body }); return jsonRes({}, 200); }
      return jsonRes(scenario.orderDoc || {}, scenario.orderStatus || 404);
    }
    if (url.includes('/documents/paid_tx/')) {
      if (opts.method === 'PATCH') { patches.push({ path: 'paid_tx', url }); return jsonRes({}, 200); }
      return jsonRes(scenario.paidTxDoc || {}, scenario.paidTxStatus || 404);
    }
    if (url.includes('/documents/secrets/superfrete')) {
      if (opts.method === 'PATCH') { patches.push({ path: 'secrets', url }); return jsonRes({}, 200); }
      return jsonRes(scenario.cofreDoc || {}, scenario.cofreStatus || 404);
    }
    // InfinitePay
    if (url.endsWith('/links')) return jsonRes(scenario.linksRes || { url: 'https://checkout/xyz' }, scenario.linksStatus || 200);
    if (url.endsWith('/payment_check')) return jsonRes(scenario.checkRes || {}, scenario.checkStatus || 200);
    // SuperFrete
    if (url.endsWith('/api/v0/calculator')) return jsonRes(scenario.calcRes || [], scenario.calcStatus || 200);
    if (url.endsWith('/api/v0/user')) return jsonRes(scenario.userRes || { balance: 999 }, 200);
    // identitytoolkit (owner)
    if (url.includes('identitytoolkit.googleapis.com')) return jsonRes(scenario.idtRes || { users: [] }, 200);
    return jsonRes({}, 404);
  };
}

function req(path, body) {
  return new Request('https://useaura-backend.test.workers.dev' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Origin': 'https://roupasaura.com' },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
console.log('== TESTES WORKER USE AURA (offline) ==');

// 1) CORS preflight
{
  installFetch();
  const r = await worker.fetch(new Request('https://x/criar-link', { method: 'OPTIONS', headers: { Origin: 'https://roupasaura.com' } }), ENV);
  ok('preflight OPTIONS -> 204 + ACAO literal', r.status === 204 && r.headers.get('Access-Control-Allow-Origin') === 'https://roupasaura.com');
}

// 2) /criar-link item inválido -> 400 (antifraude: catálogo é a verdade)
{
  installFetch();
  const r = await worker.fetch(req('/criar-link', { orderId: 'o1', items: [{ id: 'NAO_EXISTE', quantity: 1 }] }), ENV);
  const j = await r.json();
  ok('criar-link produto desconhecido -> 400', r.status === 400 && /produto desconhecido/.test(j.error), JSON.stringify(j));
}

// 3) /criar-link válido -> 200 {url}, preço server-side (ignora price do browser)
{
  installFetch();
  scenario = { linksRes: { url: 'https://checkout/abc' } };
  const r = await worker.fetch(req('/criar-link', {
    orderId: 'o2', items: [{ id: 'p1', quantity: 2, description: 'x', price: 1 /* deve ser ignorado */ }],
    address: { cep: '01001000' }, redirect_url: 'https://roupasaura.com/#/retorno/o2',
  }), ENV);
  const j = await r.json();
  ok('criar-link válido -> 200 {url}', r.status === 200 && j.url === 'https://checkout/abc', JSON.stringify(j));
}

// 4) /callback reconciliado com REPASSE DE TAXA no cartão (paid_amount > amount == total)
{
  installFetch();
  // pedido: 1x p1 (R$100) + CEP fora (frete R$15) = total 11500 centavos
  scenario = {
    paymentStatus: 404,
    orderStatus: 200,
    orderDoc: fsDoc({
      pagamento: { stringValue: 'cartao' },
      entrega: { mapValue: { fields: { cep: { stringValue: '01001000' } } } },
      itens: { arrayValue: { values: [{ mapValue: { fields: { id: { stringValue: 'p1' }, qtd: { integerValue: '1' } } } }] } },
    }),
    checkStatus: 200,
    checkRes: { success: true, paid: true, amount: 11500, paid_amount: 12075, capture_method: 'credit_card', installments: 1 },
    paidTxStatus: 404,
  };
  const r = await worker.fetch(req('/callback', { order_nsu: 'o2', transaction_nsu: 't1', invoice_slug: 's1' }), ENV);
  const j = await r.json();
  const pagou = patches.some((p) => p.path === 'orders') && patches.some((p) => p.path === 'payments') && patches.some((p) => p.path === 'paid_tx');
  ok('callback cartão c/ repasse de taxa -> pago', r.status === 200 && j.status === 'pago', JSON.stringify(j));
  ok('callback pago grava orders+payments+paid_tx', pagou, JSON.stringify(patches.map((p) => p.path)));
  ok('callback pago dispara ntfy confirmado', ntfyMsgs.some((m) => /Pagamento confirmado/.test(m)));
}

// 5) /callback SUBPAGAMENTO -> ack_nao_reconciliado, NÃO grava pago
{
  installFetch();
  scenario = {
    paymentStatus: 404, orderStatus: 200,
    orderDoc: fsDoc({
      pagamento: { stringValue: 'cartao' },
      entrega: { mapValue: { fields: { cep: { stringValue: '01001000' } } } },
      itens: { arrayValue: { values: [{ mapValue: { fields: { id: { stringValue: 'p1' }, qtd: { integerValue: '1' } } } }] } },
    }),
    checkStatus: 200,
    checkRes: { success: true, paid: true, amount: 100, paid_amount: 100 }, // pagou R$1, total é R$115
  };
  const r = await worker.fetch(req('/callback', { order_nsu: 'o3', transaction_nsu: 't2' }), ENV);
  const j = await r.json();
  ok('callback subpagamento -> ack_nao_reconciliado', r.status === 200 && j.status === 'ack_nao_reconciliado', JSON.stringify(j));
  ok('callback subpagamento NÃO grava pago', !patches.some((p) => p.path === 'orders'));
  ok('callback subpagamento alerta ntfy', ntfyMsgs.some((m) => /NAO reconciliado/.test(m)));
}

// 6) Idempotência: payments já pago -> ja_processado
{
  installFetch();
  scenario = { paymentStatus: 200, paymentDoc: fsDoc({ status: { stringValue: 'pago' } }) };
  const r = await worker.fetch(req('/callback', { order_nsu: 'o2', transaction_nsu: 't1' }), ENV);
  const j = await r.json();
  ok('callback idempotente -> ja_processado', j.status === 'ja_processado' && !patches.length, JSON.stringify(j));
}

// 7) Região grátis: /criar-link com CEP de Sarapuí (18225) e SF ligado -> frete 0 (prioridade absoluta)
{
  installFetch();
  const STORE_SF = JSON.parse(JSON.stringify(STORE));
  STORE_SF.frete.superfrete = { ativo: true, origemCep: '18225000', servicos: '1,2', servicoPadrao: 1 };
  scenario = { linksRes: { url: 'https://checkout/free' } };
  // sobrescreve o config/store deste caso
  const baseFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('/documents/config/store')) return jsonRes(fsDoc({ payload: { stringValue: JSON.stringify(STORE_SF) } }));
    return baseFetch(url, opts);
  };
  const capturedLinks = [];
  const f2 = globalThis.fetch;
  globalThis.fetch = async (url, opts) => { if (String(url).endsWith('/links')) capturedLinks.push(JSON.parse(opts.body)); return f2(url, opts); };
  const r = await worker.fetch(req('/criar-link', {
    orderId: 'o4', items: [{ id: 'p1', quantity: 1 }], address: { cep: '18225000' }, frete_servico: 1,
  }), ENV);
  const payload = capturedLinks[0];
  const temFrete = payload && payload.items.some((i) => i.description === 'Frete');
  ok('região grátis: sem item Frete no payload', r.status === 200 && !temFrete, JSON.stringify(payload && payload.items));
}

// 8) /sf-etiqueta sem owner -> 403
{
  installFetch();
  scenario = { idtRes: { users: [{ email: 'intruso@x.com', localId: 'z' }] } };
  const r = await worker.fetch(req('/sf-etiqueta', { orderId: 'o2', idToken: 'fake' }), ENV);
  ok('sf-etiqueta não-dona -> 403', r.status === 403);
}

// 9) invariante de frete espelhada (cross-check com backend/harness-frete.js já verde)
//    região grátis=0, fora=1500 — mesma regra freteCentavos portada no Worker.
{
  installFetch();
  const STORE_FORA = JSON.parse(JSON.stringify(STORE));
  scenario = {};
  const captured = [];
  const bf = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('/documents/config/store')) return jsonRes(fsDoc({ payload: { stringValue: JSON.stringify(STORE_FORA) } }));
    if (String(url).endsWith('/links')) { captured.push(JSON.parse(opts.body)); return jsonRes({ url: 'u' }); }
    return bf(url, opts);
  };
  await worker.fetch(req('/criar-link', { orderId: 'o5', items: [{ id: 'p1', quantity: 1 }], address: { cep: '01001000' } }), ENV);
  const freteItem = captured[0].items.find((i) => i.description === 'Frete');
  ok('CEP fora (SF off): item Frete = 1500 centavos', freteItem && freteItem.price === 1500, JSON.stringify(captured[0].items));
}

// 10) Achado #1 (revisor): frete_servico presente MAS sf.ativo=false (dona desligou SF).
//     A DEVE gravar orders.frete com o valor cobrado (prefixo) p/ o Fluxo B ler o MESMO
//     valor -> sem deadlock. Antes da correção, A não gravava e B lia SF do front.
{
  installFetch();
  const STORE_OFF = JSON.parse(JSON.stringify(STORE)); // superfrete.ativo = false
  const captured = [];
  const bf = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('/documents/config/store')) return jsonRes(fsDoc({ payload: { stringValue: JSON.stringify(STORE_OFF) } }));
    if (String(url).includes('/documents/orders/') && opts && opts.method === 'PATCH') { captured.push({ url: String(url), body: JSON.parse(opts.body) }); return jsonRes({}, 200); }
    if (String(url).endsWith('/links')) return jsonRes({ url: 'u' });
    return bf(url, opts);
  };
  await worker.fetch(req('/criar-link', {
    orderId: 'o6', items: [{ id: 'p1', quantity: 1 }], address: { cep: '01001000' }, frete_servico: 2,
  }), ENV);
  const patchFrete = captured.find((p) => /updateMask\.fieldPaths=frete/.test(p.url));
  ok('SF-off + frete_servico: A grava orders.frete = 15.00 (fecha deadlock)',
    patchFrete && Math.abs(patchFrete.body.fields.frete.doubleValue - 15) < 1e-9,
    JSON.stringify(patchFrete && patchFrete.body));
}

console.log(fail ? ('\nRESULTADO: ' + fail + ' FALHA(S)') : '\nRESULTADO: VERDE — Worker consistente com o n8n');
process.exit(fail ? 1 : 0);
