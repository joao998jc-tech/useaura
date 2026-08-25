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
  TELEGRAM_BOT_TOKEN: '123:fake-bot-token',
  TELEGRAM_WEBHOOK_SECRET: 'whsec-test',
  INFINITEPAY_API_BASE: 'https://api.checkout.infinitepay.io',
  SUPERFRETE_API_BASE: 'https://api.superfrete.com',
  // Aviso por e-mail (Brevo) — SOMADO ao Telegram
  BREVO_API_KEY: 'xkeysib-fake',
  BREVO_SENDER_EMAIL: 'joao998jc@gmail.com',
  BREVO_SENDER_NAME: 'USE AURA',
  EMAIL_TO_DEFAULT: 'joao998jc@gmail.com',
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

// estado mutável p/ inspecionar PATCHs, mensagens Telegram e e-mails Brevo
let patches = [];
let telegramMsgs = [];
let emailSends = [];
let scenario = {};

function jsonRes(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

function installFetch() {
  patches = []; telegramMsgs = []; emailSends = [];
  globalThis.fetch = async (url, opts = {}) => {
    url = String(url);
    // OAuth2 token
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return jsonRes({ access_token: 'fake-access', expires_in: 3600 });
    }
    // Telegram Bot API
    if (url.includes('api.telegram.org')) {
      if (url.endsWith('/sendMessage')) { const b = JSON.parse(opts.body || '{}'); telegramMsgs.push({ chat_id: b.chat_id, text: b.text }); return jsonRes({ ok: true }); }
      if (url.endsWith('/getMe')) return jsonRes({ ok: true, result: { username: 'useaura_avisos_bot' } });
      if (url.endsWith('/setWebhook')) return jsonRes({ ok: true });
      return jsonRes({ ok: true });
    }
    // Brevo (aviso por e-mail) — 201 no sucesso
    if (url.includes('api.brevo.com')) {
      if (scenario.brevoFail) return jsonRes({ message: 'erro' }, 400);
      const b = JSON.parse(opts.body || '{}');
      emailSends.push({ to: (b.to && b.to[0] && b.to[0].email), subject: b.subject, apiKey: opts.headers && opts.headers['api-key'] });
      return jsonRes({ messageId: '<x@brevo>' }, 201);
    }
    // Firestore — cofre E-mail (destinatário configurável)
    if (url.includes('/documents/secrets/email')) {
      if (opts.method === 'PATCH') { patches.push({ path: 'email-cofre', url, body: opts.body }); return jsonRes({}, 200); }
      return jsonRes(scenario.emailCofre || {}, scenario.emailCofreStatus || 404);
    }
    // Firestore — cofre Telegram (chatIds + pairCode)
    if (url.includes('/documents/secrets/telegram')) {
      if (opts.method === 'PATCH') { patches.push({ path: 'tg-cofre', url, body: opts.body }); return jsonRes({}, 200); }
      return jsonRes(scenario.tgCofre || fsDoc({ chatIds: { arrayValue: { values: [{ stringValue: '555' }] } } }), scenario.tgCofreStatus || 200);
    }
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
// /tg-webhook é fail-closed: exige o header secret_token do Telegram
function reqWebhook(body, secret) {
  return new Request('https://useaura-backend.test.workers.dev/tg-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret === undefined ? 'whsec-test' : secret },
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
  ok('callback pago dispara Telegram "Venda confirmada"', telegramMsgs.some((m) => /Venda confirmada/.test(m.text)));
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
  ok('callback subpagamento alerta Telegram', telegramMsgs.some((m) => /NAO reconciliado/.test(m.text)));
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

// 11) /tg-pair (dona) -> gera código + deep-link e grava o pairCode no cofre
{
  installFetch();
  scenario = { idtRes: { users: [{ email: 'useaura@gmail.com', localId: 'dona1' }] } };
  const r = await worker.fetch(req('/tg-pair', { idToken: 'fake' }), ENV);
  const j = await r.json();
  const patchTg = patches.find((p) => p.path === 'tg-cofre');
  const code = j.deepLink && (j.deepLink.split('start=')[1] || '');
  const bodyCode = patchTg && JSON.parse(patchTg.body).fields.pairCode.stringValue;
  ok('tg-pair dona -> ok + deepLink t.me/..?start=', r.status === 200 && j.ok === true && /t\.me\/.+\?start=/.test(j.deepLink || ''), JSON.stringify(j));
  ok('tg-pair grava pairCode no cofre = código do link', !!code && code === bodyCode, 'code=' + code + ' body=' + bodyCode);
}

// 12) /tg-webhook /start <code> válido -> grava chat_id e responde "Conectado"
{
  installFetch();
  scenario = { tgCofre: fsDoc({ pairCode: { stringValue: 'CODE123' }, pairExpires: { integerValue: String(Date.now() + 60000) }, chatIds: { arrayValue: { values: [] } } }) };
  const r = await worker.fetch(reqWebhook({ message: { chat: { id: 999 }, text: '/start CODE123' } }), ENV);
  const patchTg = patches.find((p) => p.path === 'tg-cofre');
  const stored = patchTg && JSON.parse(patchTg.body).fields.chatIds.arrayValue.values.map((v) => v.stringValue);
  ok('tg-webhook /start válido -> 200', r.status === 200);
  ok('tg-webhook grava chat_id 999 no cofre', !!stored && stored.includes('999'), JSON.stringify(stored));
  ok('tg-webhook responde "Conectado" ao chat', telegramMsgs.some((m) => String(m.chat_id) === '999' && /Conectado/.test(m.text)));
}

// 13) /tg-webhook /start com código ERRADO -> NÃO grava, orienta
{
  installFetch();
  scenario = { tgCofre: fsDoc({ pairCode: { stringValue: 'CODE123' }, pairExpires: { integerValue: String(Date.now() + 60000) }, chatIds: { arrayValue: { values: [] } } }) };
  await worker.fetch(reqWebhook({ message: { chat: { id: 888 }, text: '/start ERRADO' } }), ENV);
  ok('tg-webhook código errado -> NÃO grava chat', !patches.some((p) => p.path === 'tg-cofre'));
  ok('tg-webhook código errado -> orienta via Telegram', telegramMsgs.some((m) => String(m.chat_id) === '888' && /Área da Dona/.test(m.text)));
}

// 13b) /tg-webhook SEM o secret_token correto -> 403 fail-closed (não grava nada)
{
  installFetch();
  scenario = { tgCofre: fsDoc({ pairCode: { stringValue: 'CODE123' }, pairExpires: { integerValue: String(Date.now() + 60000) }, chatIds: { arrayValue: { values: [] } } }) };
  const rBad = await worker.fetch(reqWebhook({ message: { chat: { id: 111 }, text: '/start CODE123' } }, 'errado'), ENV);
  const rNone = await worker.fetch(reqWebhook({ message: { chat: { id: 222 }, text: '/start CODE123' } }, ''), ENV);
  ok('tg-webhook secret errado -> 403', rBad.status === 403);
  ok('tg-webhook sem secret -> 403', rNone.status === 403);
  ok('tg-webhook forjado NÃO grava chat', !patches.some((p) => p.path === 'tg-cofre'));
}

// 14) /tg-test (dona) -> envia teste a todos os chats conectados
{
  installFetch();
  scenario = { idtRes: { users: [{ email: 'useaura@gmail.com', localId: 'dona1' }] }, tgCofre: fsDoc({ chatIds: { arrayValue: { values: [{ stringValue: '555' }, { stringValue: '777' }] } } }) };
  const r = await worker.fetch(req('/tg-test', { idToken: 'fake' }), ENV);
  const j = await r.json();
  ok('tg-test dona -> ok, enviados=2', r.status === 200 && j.ok === true && j.enviados === 2, JSON.stringify(j));
  ok('tg-test envia "Teste USE AURA" aos 2 chats', telegramMsgs.filter((m) => /Teste USE AURA/.test(m.text)).length === 2);
}

// 15) /tg-test e /tg-pair sem owner -> 403
{
  installFetch();
  scenario = { idtRes: { users: [{ email: 'intruso@x.com', localId: 'z' }] } };
  const rt = await worker.fetch(req('/tg-test', { idToken: 'fake' }), ENV);
  const rp = await worker.fetch(req('/tg-pair', { idToken: 'fake' }), ENV);
  ok('tg-test não-dona -> 403', rt.status === 403);
  ok('tg-pair não-dona -> 403', rp.status === 403);
}

// ===========================================================================
//  AVISO POR E-MAIL (Brevo) — SOMADO ao Telegram, mesmos 3 pontos de disparo.
// ===========================================================================
const ENV_NOEMAIL = { ...ENV, BREVO_API_KEY: '', EMAIL_TO_DEFAULT: '' };

// 16) /callback pago dispara E-MAIL "Venda confirmada" AO LADO do Telegram (não substitui)
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
    checkRes: { success: true, paid: true, amount: 11500, paid_amount: 11500, capture_method: 'credit_card', installments: 1 },
    paidTxStatus: 404,
  };
  const r = await worker.fetch(req('/callback', { order_nsu: 'e1', transaction_nsu: 'tx-e1', invoice_slug: 's1' }), ENV);
  const j = await r.json();
  ok('callback pago -> pago (e-mail somado)', r.status === 200 && j.status === 'pago', JSON.stringify(j));
  ok('callback pago dispara E-MAIL "Venda confirmada"', emailSends.some((m) => /Venda confirmada/.test(m.subject) && m.to === 'joao998jc@gmail.com'), JSON.stringify(emailSends));
  ok('e-mail e Telegram disparam JUNTOS (soma, não troca)', telegramMsgs.some((m) => /Venda confirmada/.test(m.text)) && emailSends.length === 1);
  ok('Brevo recebe api-key no header', emailSends[0] && emailSends[0].apiKey === 'xkeysib-fake');
}

// 17) e-mail usa o cofre secrets/email quando presente (destinatário trocável SEM deploy)
{
  installFetch();
  scenario = {
    paymentStatus: 404, orderStatus: 200,
    emailCofreStatus: 200, emailCofre: fsDoc({ to: { stringValue: 'dona@lojinha.com' } }),
    orderDoc: fsDoc({
      pagamento: { stringValue: 'cartao' },
      entrega: { mapValue: { fields: { cep: { stringValue: '01001000' } } } },
      itens: { arrayValue: { values: [{ mapValue: { fields: { id: { stringValue: 'p1' }, qtd: { integerValue: '1' } } } }] } },
    }),
    checkStatus: 200,
    checkRes: { success: true, paid: true, amount: 11500, paid_amount: 11500, capture_method: 'pix', installments: 1 },
    paidTxStatus: 404,
  };
  await worker.fetch(req('/callback', { order_nsu: 'e2', transaction_nsu: 'tx-e2' }), ENV);
  ok('cofre secrets/email sobrepõe o default (sem deploy)', emailSends.some((m) => m.to === 'dona@lojinha.com'), JSON.stringify(emailSends));
}

// 18) subpagamento (não reconciliado) dispara e-mail de alerta AO LADO do Telegram
{
  installFetch();
  scenario = {
    paymentStatus: 404, orderStatus: 200,
    orderDoc: fsDoc({
      pagamento: { stringValue: 'cartao' },
      entrega: { mapValue: { fields: { cep: { stringValue: '01001000' } } } },
      itens: { arrayValue: { values: [{ mapValue: { fields: { id: { stringValue: 'p1' }, qtd: { integerValue: '1' } } } }] } },
    }),
    checkStatus: 200, checkRes: { success: true, paid: true, amount: 100, paid_amount: 100 },
  };
  await worker.fetch(req('/callback', { order_nsu: 'e3', transaction_nsu: 'tx-e3' }), ENV);
  ok('subpagamento dispara E-MAIL de alerta', emailSends.some((m) => /NAO reconciliado/.test(m.subject)), JSON.stringify(emailSends));
  ok('subpagamento: Telegram e e-mail juntos', telegramMsgs.some((m) => /NAO reconciliado/.test(m.text)) && emailSends.length === 1);
}

// 18a) GUARD de segurança (achado MÉDIO): não-reconciliado com pedido INEXISTENTE
//      (order_nsu forjado passa do payment_check mas não há orders/<id>) -> NÃO manda
//      e-mail (protege a quota Brevo); Telegram (sem quota) continua disparando.
{
  installFetch();
  scenario = {
    paymentStatus: 404, orderStatus: 404, // pedido não existe no Firestore
    checkStatus: 200, checkRes: { success: true, paid: true, amount: 100, paid_amount: 100 },
  };
  await worker.fetch(req('/callback', { order_nsu: 'FORJADO', transaction_nsu: 'tx-fake' }), ENV);
  ok('não-reconciliado + pedido inexistente: NÃO manda e-mail (protege quota)', emailSends.length === 0, JSON.stringify(emailSends));
  ok('não-reconciliado + pedido inexistente: Telegram ainda dispara', telegramMsgs.some((m) => /NAO reconciliado/.test(m.text)));
}

// 18b) transação REUTILIZADA (reconciliado, mas paid_tx aponta outro pedido) dispara
//      e-mail + Telegram de alerta — cobre o 3º ponto de disparo (achado M1 do revisor).
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
    checkRes: { success: true, paid: true, amount: 11500, paid_amount: 11500, capture_method: 'pix', installments: 1 },
    paidTxStatus: 200, paidTxDoc: fsDoc({ order_nsu: { stringValue: 'OUTRO_PEDIDO' } }),
  };
  const r = await worker.fetch(req('/callback', { order_nsu: 'e3b', transaction_nsu: 'tx-reuso' }), ENV);
  const j = await r.json();
  ok('reuso -> ack_reuso_bloqueado (não grava pago)', r.status === 200 && j.status === 'ack_reuso_bloqueado' && !patches.some((p) => p.path === 'payments'), JSON.stringify(j));
  ok('reuso dispara E-MAIL de alerta', emailSends.some((m) => /reutilizada/.test(m.subject)), JSON.stringify(emailSends));
  ok('reuso: Telegram e e-mail juntos', telegramMsgs.some((m) => /reutilizada/.test(m.text)) && emailSends.length === 1);
}

// 19) FAIL-CLOSED: sem BREVO_API_KEY e sem destinatário, a venda NÃO quebra (só não manda e-mail)
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
    checkRes: { success: true, paid: true, amount: 11500, paid_amount: 11500, capture_method: 'pix', installments: 1 },
    paidTxStatus: 404,
  };
  const r = await worker.fetch(req('/callback', { order_nsu: 'e4', transaction_nsu: 'tx-e4' }), ENV_NOEMAIL);
  const j = await r.json();
  ok('sem chave/destinatário: venda ainda baixa (pago)', r.status === 200 && j.status === 'pago', JSON.stringify(j));
  ok('sem chave: nenhum e-mail enviado (inerte)', emailSends.length === 0);
  ok('sem chave: Telegram continua disparando', telegramMsgs.some((m) => /Venda confirmada/.test(m.text)));
}

// 20) falha da Brevo (HTTP 400) NÃO derruba o /callback nem a venda
{
  installFetch();
  scenario = {
    paymentStatus: 404, orderStatus: 200, brevoFail: true,
    orderDoc: fsDoc({
      pagamento: { stringValue: 'cartao' },
      entrega: { mapValue: { fields: { cep: { stringValue: '01001000' } } } },
      itens: { arrayValue: { values: [{ mapValue: { fields: { id: { stringValue: 'p1' }, qtd: { integerValue: '1' } } } }] } },
    }),
    checkStatus: 200,
    checkRes: { success: true, paid: true, amount: 11500, paid_amount: 11500, capture_method: 'pix', installments: 1 },
    paidTxStatus: 404,
  };
  const r = await worker.fetch(req('/callback', { order_nsu: 'e5', transaction_nsu: 'tx-e5' }), ENV);
  const j = await r.json();
  ok('Brevo 400 não derruba o callback (venda = pago)', r.status === 200 && j.status === 'pago', JSON.stringify(j));
}

// 21) /email-set (dona) grava o destinatário no cofre; e-mail inválido -> 400; não-dona -> 403
{
  installFetch();
  scenario = { idtRes: { users: [{ email: 'useaura@gmail.com', localId: 'dona1' }] } };
  const r = await worker.fetch(req('/email-set', { idToken: 'fake', email: 'nova@dona.com' }), ENV);
  const j = await r.json();
  const patchEmail = patches.find((p) => p.path === 'email-cofre');
  const saved = patchEmail && JSON.parse(patchEmail.body).fields.to.stringValue;
  ok('email-set dona -> ok, grava no cofre', r.status === 200 && j.ok === true && saved === 'nova@dona.com', JSON.stringify(j));

  installFetch();
  scenario = { idtRes: { users: [{ email: 'useaura@gmail.com', localId: 'dona1' }] } };
  const rBad = await worker.fetch(req('/email-set', { idToken: 'fake', email: 'sem-arroba' }), ENV);
  ok('email-set formato inválido -> 400 (não grava)', rBad.status === 400 && !patches.some((p) => p.path === 'email-cofre'));

  installFetch();
  scenario = { idtRes: { users: [{ email: 'intruso@x.com', localId: 'z' }] } };
  const rInt = await worker.fetch(req('/email-set', { idToken: 'fake', email: 'x@y.com' }), ENV);
  ok('email-set não-dona -> 403', rInt.status === 403);
}

// 22) /email-test (dona) envia ao destinatário atual; sem destinatário -> motivo claro; não-dona -> 403
{
  installFetch();
  scenario = { idtRes: { users: [{ email: 'useaura@gmail.com', localId: 'dona1' }] }, emailCofreStatus: 200, emailCofre: fsDoc({ to: { stringValue: 'dona@lojinha.com' } }) };
  const r = await worker.fetch(req('/email-test', { idToken: 'fake' }), ENV);
  const j = await r.json();
  ok('email-test dona -> ok, envia ao cofre', r.status === 200 && j.ok === true && emailSends.some((m) => m.to === 'dona@lojinha.com'), JSON.stringify(j));

  // chave/remetente presentes, mas SEM destinatário (default vazio + cofre ausente): fail-closed
  installFetch();
  scenario = { idtRes: { users: [{ email: 'useaura@gmail.com', localId: 'dona1' }] } };
  const rNo = await worker.fetch(req('/email-test', { idToken: 'fake' }), { ...ENV, EMAIL_TO_DEFAULT: '' });
  const jNo = await rNo.json();
  ok('email-test sem destinatário -> motivo "nenhum email configurado"', jNo.ok === false && jNo.motivo === 'nenhum email configurado' && emailSends.length === 0, JSON.stringify(jNo));

  // sem chave/remetente plugados -> "email nao configurado" (503), também sem enviar
  installFetch();
  scenario = { idtRes: { users: [{ email: 'useaura@gmail.com', localId: 'dona1' }] } };
  const rCfg = await worker.fetch(req('/email-test', { idToken: 'fake' }), ENV_NOEMAIL);
  const jCfg = await rCfg.json();
  ok('email-test sem chave -> 503 "email nao configurado"', rCfg.status === 503 && jCfg.motivo === 'email nao configurado' && emailSends.length === 0, JSON.stringify(jCfg));

  installFetch();
  scenario = { idtRes: { users: [{ email: 'intruso@x.com', localId: 'z' }] } };
  const rInt = await worker.fetch(req('/email-test', { idToken: 'fake' }), ENV);
  ok('email-test não-dona -> 403', rInt.status === 403);
}

console.log(fail ? ('\nRESULTADO: ' + fail + ' FALHA(S)') : '\nRESULTADO: VERDE — Worker + Telegram + E-mail consistentes');
process.exit(fail ? 1 : 0);
