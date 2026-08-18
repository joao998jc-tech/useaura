/* ==========================================================================
   USE AURA — loja (SPA hash-routing, vanilla JS)
   NO AR: pagamento REAL via InfinitePay (Pix/cartão, baixa por webhook). Estoque ainda não controlado.
   ========================================================================== */
'use strict';

/* --------------------------------------------------------------------------
   1) DADOS DE PRODUTO
   Array único, isolado e fácil de trocar. Campos por produto:
   id, nome, categoria, preco, precoPix, imgFrente, imgCostas, cores[],
   tamanhos[], composicao, descricao, badges[], real(bool).
   -> PRODUTOS "real:true" usam as FOTOS REAIS da cliente.
   -> PRODUTOS "// DEMO" são placeholders coerentes p/ substituir por produto real.
   Preços marcados como FICTÍCIOS (faixa fast-fashion acessível). PREÇO ÚNICO:
   Pix e cartão pagam o mesmo valor (o InfinitePay não trava método no checkout).
   -------------------------------------------------------------------------- */
var IMG = 'assets/produtos/';
var FALLBACK = 'assets/placeholder.svg'; // usado quando falta imagem (demo/erro de carga)

/* PREÇO ÚNICO (sem desconto Pix): precoPix == preco. `pixOf` virou identidade —
   mantida só p/ compatibilidade do campo precoPix (admin/catálogo). O checkout
   InfinitePay é multi-método com valor único, então não há mais 2 valores. */
function pixOf(preco){ return preco; }

var PRODUTOS = [
  /* ===== PRODUTOS REAIS (estrela do catálogo) ===== */
  {
    id:'conjunto-aura-amarelo', real:true,
    nome:'Conjunto Aura Amarelo',
    categoria:'Conjuntos',
    preco:159.90, precoPix:pixOf(159.90),
    imgFrente:IMG+'conjunto-aura-amarelo-frente.jpg',
    imgCostas:IMG+'conjunto-aura-amarelo-costas.jpg',
    cores:[{nome:'Amarelo',hex:'#FAC80A'}],
    tamanhos:['P','M','G','GG'],
    composicao:'92% poliamida, 8% elastano — malha canelada com toque suave.',
    descricao:'Cropped ombro-a-ombro de manga longa com calça flare de cintura dobrada. Um conjunto statement que marca presença — feito para brilhar do dia ao rolê da noite.',
    badges:['Novidade']
  },
  {
    id:'cropped-assimetrico-offwhite', real:true,
    nome:'Cropped Assimétrico Off-White',
    categoria:'Blusas',
    preco:79.90, precoPix:pixOf(79.90),
    imgFrente:IMG+'cropped-assimetrico-offwhite-1.jpg',
    imgCostas:IMG+'cropped-assimetrico-offwhite-2.jpg',
    cores:[{nome:'Off-White',hex:'#F3F1EC'}],
    tamanhos:['P','M','G'],
    composicao:'95% algodão, 5% elastano.',
    descricao:'Alça única com recorte cut-out lateral: sensual na medida certa. Combina com jeans de cintura baixa e um óculos statement.',
    badges:[]
  },
  {
    id:'vestido-serenity-bubble', real:true,
    nome:'Vestido Serenity Bubble',
    categoria:'Vestidos',
    preco:129.90, precoPix:pixOf(129.90),
    imgFrente:IMG+'vestido-serenity-bubble.jpg',
    imgCostas:null,
    cores:[{nome:'Azul Serenity',hex:'#A5C6E0'}],
    tamanhos:['P','M','G'],
    composicao:'100% viscose com forro — barra bufante estruturada.',
    descricao:'Halter de costas nuas com barra franzida balloon. O vestido de festa que fotografa lindo e cai perfeito. Look pede sandália metalizada.',
    badges:['Novidade']
  },
  {
    id:'blusa-costas-nuas-noir', real:true,
    nome:'Blusa Costas Nuas Noir',
    categoria:'Blusas',
    preco:89.90, precoPix:pixOf(89.90),
    imgFrente:IMG+'blusa-costas-nuas-noir-frente.jpg',
    imgCostas:IMG+'blusa-costas-nuas-noir-costas.jpg',
    // PRESSUPOSTO: a peça pode ser preto neutro OU navy near-black (não confirmado). Default: preto.
    cores:[{nome:'Preto',hex:'#14171D'}],
    tamanhos:['P','M','G','GG'],
    composicao:'88% poliamida, 12% elastano — segunda pele.',
    descricao:'Manga longa de decote boat com costas totalmente abertas (open-back). Coringa sofisticado: elegante com alfaiataria, descolado com jeans claro.',
    badges:['Best-seller']
  },

  /* ===== PRODUTOS DEMO — substituir por produto real ===== */
  // DEMO — substituir por produto real (categoria Bodies)
  { id:'body-alca-fina', real:false, nome:'Body Alça Fina Canelado', categoria:'Bodies',
    preco:59.90, precoPix:pixOf(59.90), imgFrente:FALLBACK, imgCostas:null,
    cores:[{nome:'Preto',hex:'#1C1B18'},{nome:'Off-White',hex:'#F3F1EC'}], tamanhos:['P','M','G'],
    composicao:'Malha canelada 95% viscose, 5% elastano.',
    descricao:'Body de alça fina e decote quadrado — a base curinga do guarda-roupa. (Foto real em breve.)', badges:[] },
  // DEMO — substituir por produto real (categoria Bodies)
  { id:'body-manga-longa', real:false, nome:'Body Manga Longa Gola Alta', categoria:'Bodies',
    preco:74.90, precoPix:pixOf(74.90), imgFrente:FALLBACK, imgCostas:null,
    cores:[{nome:'Preto',hex:'#1C1B18'},{nome:'Azul Serenity',hex:'#A5C6E0'}], tamanhos:['P','M','G','GG'],
    composicao:'Suplex encorpado.',
    descricao:'Body de gola alta e manga longa, caimento segunda-pele. (Foto real em breve.)', badges:[] },
  // DEMO — substituir por produto real (categoria Macacões)
  { id:'macacao-pantalona', real:false, nome:'Macacão Pantalona Amarração', categoria:'Macacões',
    preco:149.90, precoPix:pixOf(149.90), imgFrente:FALLBACK, imgCostas:null,
    cores:[{nome:'Preto',hex:'#1C1B18'}], tamanhos:['P','M','G'],
    composicao:'Viscose fluida.',
    descricao:'Macacão pantalona com amarração na cintura — elegância pronta em uma peça só. (Foto real em breve.)', badges:['Novidade'] },
  // DEMO — substituir por produto real (categoria Corsets)
  { id:'corset-bojo', real:false, nome:'Corset Bojo Estruturado', categoria:'Corsets',
    preco:99.90, precoPix:pixOf(99.90), imgFrente:FALLBACK, imgCostas:null,
    cores:[{nome:'Off-White',hex:'#F3F1EC'},{nome:'Preto',hex:'#1C1B18'}], tamanhos:['P','M','G'],
    composicao:'Sarja com barbatanas internas.',
    descricao:'Corset com bojo estruturado e barbatanas — cintura marcada e postura de rainha. (Foto real em breve.)', badges:[] },
  // DEMO — substituir por produto real (categoria Pijamas)
  { id:'pijama-cetim', real:false, nome:'Pijama Cetim Manga Curta', categoria:'Pijamas',
    preco:119.90, precoPix:pixOf(119.90), imgFrente:FALLBACK, imgCostas:null,
    cores:[{nome:'Azul Serenity',hex:'#A5C6E0'},{nome:'Off-White',hex:'#F3F1EC'}], tamanhos:['P','M','G','GG'],
    composicao:'Cetim de poliéster acetinado.',
    descricao:'Conjunto de pijama em cetim com vivo contrastante — conforto que parece luxo. (Foto real em breve.)', badges:[] },
  // DEMO — substituir por produto real (categoria Vestidos)
  { id:'vestido-midi-fenda', real:false, nome:'Vestido Midi Fenda', categoria:'Vestidos',
    preco:139.90, precoPix:pixOf(139.90), imgFrente:FALLBACK, imgCostas:null,
    cores:[{nome:'Preto',hex:'#1C1B18'}], tamanhos:['P','M','G'],
    composicao:'Malha canelada encorpada.',
    descricao:'Vestido midi justo com fenda lateral — sofisticação para eventos. (Foto real em breve.)', badges:[] },
  // DEMO — substituir por produto real (categoria Conjuntos)
  { id:'conjunto-tricot', real:false, nome:'Conjunto Tricot Alfaiataria', categoria:'Conjuntos',
    preco:169.90, precoPix:pixOf(169.90), imgFrente:FALLBACK, imgCostas:null,
    cores:[{nome:'Off-White',hex:'#F3F1EC'}], tamanhos:['P','M','G'],
    composicao:'Tricot de viscose.',
    descricao:'Conjunto de tricot leve com short alfaiataria — combinação pronta e chique. (Foto real em breve.)', badges:[] },
  // DEMO — substituir por produto real (categoria Blusas)
  { id:'blusa-gola-halter', real:false, nome:'Blusa Gola Halter Franzida', categoria:'Blusas',
    preco:69.90, precoPix:pixOf(69.90), imgFrente:FALLBACK, imgCostas:null,
    cores:[{nome:'Azul Serenity',hex:'#A5C6E0'},{nome:'Preto',hex:'#1C1B18'}], tamanhos:['P','M','G','GG'],
    composicao:'Malha suplex.',
    descricao:'Blusa gola halter com franzido frontal que valoriza o colo. (Foto real em breve.)', badges:[] }
];

/* Categorias reais da marca (ordem de exibição) */
var CATEGORIAS = ['Bodies','Blusas','Conjuntos','Vestidos','Macacões','Corsets','Pijamas'];
/* slug <-> nome */
function slugify(s){ return s.toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g,'')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
var SLUG_TO_CAT = {};
function rebuildCatMaps(){ SLUG_TO_CAT = {}; CATEGORIAS.forEach(function(c){ SLUG_TO_CAT[slugify(c)] = c; }); }
rebuildCatMaps();

/* --------------------------------------------------------------------------
   1b) STORE EDITÁVEL PELA ÁREA DA DONA (persistência em localStorage)
   PRODUTOS/CATEGORIAS/BANNER passam a poder ser sobrescritos pela dona logada.
   MODO DEMONSTRAÇÃO: salvo só neste aparelho. Em produção, plugar Firebase aqui
   (loadStore/saveStore são o único ponto a trocar). Arrays mutados IN-PLACE p/
   preservar todas as referências existentes no código.
   -------------------------------------------------------------------------- */
var STORE_KEY = 'useaura_store_v1';
var BANNER = {
  produtoId:'conjunto-aura-amarelo',   // foto do hero (se img vazio, usa a foto deste produto)
  img:'',
  posX:50, posY:28,                    // enquadramento do banner (object-position %)
  eyebrow:'Nova coleção &#9733; Aura',
  titulo:'Vista a sua <em>luz</em>',
  sub:'Peças com curadoria para quem chega e ilumina o ambiente. Do dia a dia estiloso ao look de festa.'
};
/* balão de novidade/promoção no topo (espelha o promo-banner dos cardápios) */
var PROMO = { ativo:false, produtoId:'', titulo:'Novidade da semana', desc:'Chegou peça nova — corre que é giro rápido!' };

/* FRETE — configurável na Área da Dona (Regra 74, nunca hardcodar valor). Regra do
   João: GRÁTIS na região + valor FIXO pra fora, cobrado JUNTO no checkout.
   Região = por PREFIXO de CEP (determinístico, sem API externa → o n8n recomputa
   idêntico do CEP do pedido; antifraude). `valorFora` em reais (como preco). */
var FRETE = { configurado:false, gratisPrefixos:[], valorFora:null };
/* decide o frete para um CEP. DEFAULT SEGURO: não configurado → 'wa' (a combinar);
   CEP inválido/vazio → cobra FORA (jamais grátis por erro).
   ⚠️ INVARIANTE: esta lógica é ESPELHO EXATO de `freteCentavos` nos 2 nós Code do
   workflow n8n (Validar e Montar Payload / Validar Reconciliacao). Se divergir:
   front×n8n → site mostra X e cobra Y; Fluxo A×Fluxo B → deadlock de reconciliação
   (amount≠total, pedido pago nunca vira 'pago'). Mudou aqui → mudar nos 2 nós +
   rodar o harness dos casos antes de qualquer deploy do JSON. */
function computeFrete(cepRaw){
  var f = FRETE || {};
  var vf = Number(f.valorFora);
  if (!f.configurado || !(vf >= 0)) return { mode:'wa', valor:null };
  var digits = String(cepRaw==null?'':cepRaw).replace(/\D/g,'');
  if (digits.length !== 8) return { mode:'fora', valor:vf };
  var prefs = Array.isArray(f.gratisPrefixos) ? f.gratisPrefixos : [];
  for (var i=0;i<prefs.length;i++){
    var p = String(prefs[i]==null?'':prefs[i]).replace(/\D/g,'');
    if (p && digits.indexOf(p)===0) return { mode:'gratis', valor:0 };
  }
  return { mode:'fora', valor:vf };
}
function freteLabel(fr){ return fr.mode==='wa' ? 'a combinar pelo WhatsApp' : (fr.valor>0 ? formatBRL(fr.valor) : 'Grátis'); }
/* nota informativa da regra de frete (sacola/drawer/checkout), fonte única = computeFrete.
   Não configurado → texto WhatsApp (fallback intacto); configurado → regra real sem hardcodar R$. */
function freteNote(){
  var fr = computeFrete('');   // CEP vazio: 'wa' se não configurado, senão 'fora' com valorFora
  return fr.mode==='wa'
    ? 'O frete é combinado pelo WhatsApp após o pedido.'
    : 'Frete grátis para a sua região; demais regiões '+formatBRL(fr.valor)+' — calculado no checkout pelo seu CEP.';
}

/* páginas institucionais (texto simples editável no modo dona; parágrafos por linha em branco) */
var PAGINAS_SEED = {
  sobre: { titulo:'Sobre a Aura', ordem:1, texto:
    'A USE AURA nasceu para vestir a sua luz. Somos uma marca de moda feminina jovem, com curadoria de peças que unem tendência, caimento e aquele brilho que faz você se sentir incrível — do dia a dia ao look de festa.\n\n'+
    'Cada peça é escolhida a dedo, pensando na mulher real: confiante, moderna e que ama se produzir. Trabalhamos com giro rápido de novidades, para você sempre encontrar algo novo para chamar de seu.\n\n'+
    'Atendemos Sarapuí e região com entrega local e enviamos para todo o Brasil. Seja bem-vinda à Aura — aqui, a sua beleza tem espaço para brilhar.' },
  trocas: { titulo:'Trocas e devoluções', ordem:2, texto:
    'Queremos que você ame a sua peça. Se algo não sair como esperado, a troca é simples e sem burocracia.\n\n'+
    'Prazo: você tem até 7 dias corridos após o recebimento para solicitar troca ou devolução, conforme o Código de Defesa do Consumidor.\n\n'+
    'Primeira troca de tamanho por nossa conta: cobrimos o frete da primeira troca de tamanho em Sarapuí e região.\n\n'+
    'Condições: a peça deve estar sem uso, sem sinais de lavagem ou perfume e com a etiqueta original.\n\n'+
    'Como solicitar: chame a gente no WhatsApp com o número do pedido que resolvemos rapidinho.' },
  privacidade: { titulo:'Política de privacidade', ordem:3, texto:
    'A sua privacidade é importante para nós. Esta política explica, de forma transparente, como tratamos os seus dados.\n\n'+
    'Quais dados coletamos: nome, contato, endereço de entrega e informações do pedido — apenas o necessário para processar e entregar a sua compra.\n\n'+
    'Como usamos: para concluir o pedido, combinar a entrega e enviar novidades caso você autorize. Não vendemos nem compartilhamos os seus dados com terceiros para fins de marketing.\n\n'+
    'Seus direitos: você pode solicitar a atualização ou a exclusão dos seus dados a qualquer momento — é só falar com a gente.\n\n'+
    'Ao comprar na Aura, você concorda com esta política.' },
  contato: { titulo:'Fale conosco', ordem:4, whatsapp:'5515988241672', texto:
    'Ficou com alguma dúvida ou quer ajuda para escolher a sua peça? Fale direto com a gente pelo WhatsApp — respondemos com o maior carinho.\n\n'+
    'Atendimento de segunda a sábado, das 9h às 18h.' },
  medidas: { titulo:'Guia de medidas', ordem:5, tabela:true, texto:
    'Medidas em centímetros. Na dúvida entre dois tamanhos, escolha o maior para um caimento mais confortável.\n\n'+
    'Como medir: use uma fita métrica sobre a roupa de baixo. Busto na parte mais cheia, cintura na parte mais fina e quadril na parte mais larga.\n\n'+
    'Peças com recorte ou cut-out têm caimento mais justo — vale conferir a tabela antes de escolher.' },
  prazos: { titulo:'Prazos de entrega', ordem:6, texto:
    'Entrega local (Sarapuí e região): enviamos por moto-boy, muitas vezes no mesmo dia. Combinamos o melhor horário pelo WhatsApp.\n\n'+
    'Demais cidades: enviamos para todo o Brasil pelos Correios ou transportadora. O prazo varia conforme o seu CEP e aparece no fechamento do pedido.\n\n'+
    'Assim que o pedido é postado, você recebe o código de rastreio para acompanhar tudo.' },
  pagamento: { titulo:'Formas de pagamento', ordem:7, texto:
    'Pix: à vista, o pedido é confirmado na hora — a forma mais rápida.\n\n'+
    'Cartão de crédito: parcele em até 3x no checkout seguro.\n\n'+
    'Pix e cartão pagam o mesmo valor. Você escolhe a forma no checkout seguro da InfinitePay — simples, rápido e seguro.' },
  rastreio: { titulo:'Rastrear pedido', ordem:8, texto:
    'Acompanhar o seu pedido é fácil. Assim que ele é enviado, mandamos o código de rastreio pelo WhatsApp.\n\n'+
    'Pedidos locais (moto-boy) são combinados diretamente com você, sem necessidade de código.\n\n'+
    'Qualquer dúvida sobre o andamento, chame a gente no WhatsApp com o número do pedido que verificamos na hora.' }
};
var PAGINAS = JSON.parse(JSON.stringify(PAGINAS_SEED));

/* --------------------------------------------------------------------------
   MÍDIA (fotos HQ + vídeos) em IndexedDB — o store guarda só REFERÊNCIAS.
   Imagens ficam num cache em memória (MEDIA) p/ o render continuar síncrono;
   vídeos (pesados) são buscados sob demanda na PDP.
   Ref = id de mídia ('mi…'/'mv…') OU caminho de arquivo do seed (assets/…).
   -------------------------------------------------------------------------- */
var MEDIA = {};            // id de imagem -> dataURL (memória)
var mediaDB = null;
function openMediaDB(){
  return new Promise(function(res){
    try{
      var rq = indexedDB.open('useaura_media', 1);
      rq.onupgradeneeded = function(e){ if(!e.target.result.objectStoreNames.contains('media')) e.target.result.createObjectStore('media'); };
      rq.onsuccess = function(e){ mediaDB = e.target.result; res(true); };
      rq.onerror = function(){ res(false); };
    }catch(e){ res(false); }
  });
}
function mediaPutDB(id, dataUrl){
  return new Promise(function(res){
    if(!mediaDB){ res(false); return; }
    try{ var tx=mediaDB.transaction('media','readwrite'); tx.objectStore('media').put(dataUrl, id);
      tx.oncomplete=function(){ res(true); }; tx.onerror=function(){ res(false); };
    }catch(e){ res(false); }
  });
}
function mediaGetDB(id){
  return new Promise(function(res){
    if(!mediaDB || !id){ res(null); return; }
    if(MEDIA[id]){ res(MEDIA[id]); return; }
    try{ var tx=mediaDB.transaction('media','readonly'); var rq=tx.objectStore('media').get(id);
      rq.onsuccess=function(){ res(rq.result||null); }; rq.onerror=function(){ res(null); };
    }catch(e){ res(null); }
  });
}
function mediaDelDB(id){
  return new Promise(function(res){
    delete MEDIA[id];
    if(!mediaDB || !id){ res(true); return; }
    try{ var tx=mediaDB.transaction('media','readwrite'); tx.objectStore('media').delete(id);
      tx.oncomplete=function(){ res(true); }; tx.onerror=function(){ res(true); };
    }catch(e){ res(true); }
  });
}
/* carrega SÓ as imagens (id 'mi…') para o cache; vídeos ficam sob demanda */
function loadImagesToCache(){
  return new Promise(function(res){
    if(!mediaDB){ res(); return; }
    try{
      var tx=mediaDB.transaction('media','readonly'); var cur=tx.objectStore('media').openCursor();
      cur.onsuccess=function(e){ var c=e.target.result; if(c){ if(String(c.key).indexOf('mi')===0) MEDIA[c.key]=c.value; c.continue(); } else res(); };
      cur.onerror=function(){ res(); };
    }catch(e){ res(); }
  });
}
function newMediaId(prefix){ return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function mediaSrc(ref){ if(!ref) return FALLBACK; if(MEDIA[ref]) return MEDIA[ref]; return ref; }
function firstImg(p){ return mediaSrc(p.galeria && p.galeria[0]); }
function backImg(p){ return (p.galeria && p.galeria[1]) ? mediaSrc(p.galeria[1]) : null; }

/* normaliza produto p/ o modelo novo (galeria[], videos[], parcela) sem quebrar o seed */
function normalizeProduto(p){
  if(!Array.isArray(p.galeria)){
    p.galeria = [p.imgFrente, p.imgCostas].filter(Boolean);
    if(!p.galeria.length) p.galeria = [FALLBACK];
  }
  if(!Array.isArray(p.videos)) p.videos = [];
  if(typeof p.parcela !== 'boolean') p.parcela = true;
  if(!Array.isArray(p.cores)) p.cores = [{nome:'Única',hex:'#4A3323'}];
  if(!Array.isArray(p.tamanhos) || !p.tamanhos.length) p.tamanhos = ['Único'];   // tamanhos livres: sempre ≥1
  if(typeof p.esgotado !== 'boolean') p.esgotado = false;
  return p;
}
function normalizeAll(){ PRODUTOS.forEach(normalizeProduto); }

function applyStoreData(s){
  if(!s) return;
  if (Array.isArray(s.produtos)){ PRODUTOS.length=0; s.produtos.forEach(function(p){ PRODUTOS.push(p); }); }
  if (Array.isArray(s.categorias)){ CATEGORIAS.length=0; s.categorias.forEach(function(c){ CATEGORIAS.push(c); }); }
  if (s.banner){ Object.keys(s.banner).forEach(function(k){ BANNER[k]=s.banner[k]; }); }
  if (s.promo){ Object.keys(s.promo).forEach(function(k){ PROMO[k]=s.promo[k]; }); }
  if (s.frete){ Object.keys(s.frete).forEach(function(k){ FRETE[k]=s.frete[k]; }); }
  if (s.paginas){ Object.keys(s.paginas).forEach(function(k){ if(PAGINAS[k]) Object.keys(s.paginas[k]).forEach(function(f){ PAGINAS[k][f]=s.paginas[k][f]; }); }); }
  rebuildCatMaps();
}
function storePayload(){ return {produtos:PRODUTOS,categorias:CATEGORIAS,banner:BANNER,promo:PROMO,frete:FRETE,paginas:PAGINAS}; }
function loadStore(){
  try{ var raw = localStorage.getItem(STORE_KEY); if(!raw) return; applyStoreData(JSON.parse(raw)); }catch(e){}
}
function saveStoreLocal(){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(storePayload())); return true; }
  catch(e){ if(typeof toast==='function') toast('Não foi possível salvar as configurações.'); return false; }
}
/* salva local (cache/fallback) E na nuvem quando a dona está logada (Firestore);
   o onSnapshot replica para os outros aparelhos. Sem Cloud, é só localStorage. */
function saveStore(){
  var ok = saveStoreLocal();
  if (window.Cloud && Cloud.firestoreEnabled){
    // avisa se salvou local mas NÃO sincronizou (rede/regra/token) — não deixa a dona
    // achar que sincronizou quando não sincronizou. Retorno síncrono segue = local.
    Cloud.saveStore(storePayload()).then(function(cloudOk){
      if (!cloudOk && typeof toast==='function') toast('Salvo neste aparelho, mas não sincronizou. Confira a internet.');
    });
  }
  return ok;
}
function adminSavePromo(pr){ Object.keys(pr).forEach(function(k){ PROMO[k]=pr[k]; }); return saveStore(); }
function adminSaveFrete(fr){ Object.keys(fr).forEach(function(k){ FRETE[k]=fr[k]; }); return saveStore(); }
function adminSavePagina(slug, dados){ if(!PAGINAS[slug]) return false; Object.keys(dados).forEach(function(k){ PAGINAS[slug][k]=dados[k]; }); return saveStore(); }
/* mutações usadas pela Área da Dona (admin.js) */
function adminSaveProduto(p){
  var i=-1; for(var k=0;k<PRODUTOS.length;k++){ if(PRODUTOS[k].id===p.id){ i=k; break; } }
  if(i>=0) PRODUTOS[i]=p; else PRODUTOS.push(p);
  if(p.categoria && CATEGORIAS.indexOf(p.categoria)===-1){ CATEGORIAS.push(p.categoria); rebuildCatMaps(); }
  return saveStore();
}
function adminRemoveProduto(id){ for(var k=0;k<PRODUTOS.length;k++){ if(PRODUTOS[k].id===id){ PRODUTOS.splice(k,1); return saveStore(); } } }
function adminAddCategoria(nome){ nome=(nome||'').trim(); if(nome && CATEGORIAS.indexOf(nome)===-1){ CATEGORIAS.push(nome); rebuildCatMaps(); saveStore(); return true; } return false; }
function adminRemoveCategoria(nome){ var i=CATEGORIAS.indexOf(nome); if(i>=0){ CATEGORIAS.splice(i,1); rebuildCatMaps(); saveStore(); } }
function adminSaveBanner(b){ Object.keys(b).forEach(function(k){ BANNER[k]=b[k]; }); return saveStore(); }
function adminResetStore(){ try{ localStorage.removeItem(STORE_KEY); }catch(e){} }

/* --------------------------------------------------------------------------
   2) FUNÇÕES PURAS (testáveis) — preço, carrinho, filtros
   -------------------------------------------------------------------------- */
function formatBRL(v){
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function getProduto(id){ for (var i=0;i<PRODUTOS.length;i++) if (PRODUTOS[i].id===id) return PRODUTOS[i]; return null; }
/* "em até Nx de R$ …" do CARTÃO. Vazio (nada renderiza) enquanto o cartão
   parcelado não estiver REALMENTE no ar (config.cartao.ativo=false) — não
   promete parcelamento que a loja ainda não cumpre. Nº de parcelas/juros vêm
   de config.js (Regra 74), nunca hardcoded. Base = preço cheio (cartão). */
function parcelaText(preco){
  var c = (window.USEAURA_CONFIG && window.USEAURA_CONFIG.cartao) || {};
  if (!c.ativo) return '';
  var n = Math.max(1, parseInt(c.maxParcelas, 10) || 3);
  var val = Number(preco) / n;
  if (!(val > 0)) return '';
  return 'ou em até ' + n + 'x de ' + formatBRL(val) + (c.semJuros ? ' sem juros' : '');
}

/* carrinho: itens [{id,tamanho,cor,qtd}] */
function cartSubtotal(items){
  return items.reduce(function(sum,it){
    var p = getProduto(it.id); if (!p) return sum;
    return sum + p.preco * it.qtd;
  }, 0);
}
/* PREÇO ÚNICO: o Pix paga o mesmo que o cartão. Deriva do subtotal (preco) em vez
   de somar precoPix — blinda contra `precoPix != preco` que alguém possa gravar no
   config/store: a tela nunca mostra um valor diferente do que a InfinitePay cobra
   (o n8n cobra sempre por `preco`). Mantida a assinatura p/ compatibilidade. */
function cartPixTotal(items){ return cartSubtotal(items); }
function cartCount(items){ return items.reduce(function(n,it){ return n + it.qtd; }, 0); }

/* filtros client-side sobre o array */
function applyFilters(list, f){
  f = f || {};
  var out = list.filter(function(p){
    if (f.categoria && f.categoria !== 'todos' && f.categoria !== 'novidades'){
      if (slugify(p.categoria) !== f.categoria) return false;
    }
    if (f.categoria === 'novidades'){
      if (!(p.badges||[]).some(function(b){ return b.toLowerCase()==='novidade'; })) return false;
    }
    if (f.tamanhos && f.tamanhos.length){
      if (!f.tamanhos.some(function(t){ return p.tamanhos.indexOf(t) !== -1; })) return false;
    }
    if (f.cores && f.cores.length){
      if (!p.cores.some(function(c){ return f.cores.indexOf(c.nome) !== -1; })) return false;
    }
    if (typeof f.precoMax === 'number'){
      if (p.preco > f.precoMax) return false;
    }
    if (f.busca){
      var q = f.busca.toLowerCase();
      if ((p.nome+' '+p.categoria).toLowerCase().indexOf(q) === -1) return false;
    }
    return true;
  });
  if (f.ordenar === 'preco-asc') out.sort(function(a,b){ return a.preco-b.preco; });
  else if (f.ordenar === 'preco-desc') out.sort(function(a,b){ return b.preco-a.preco; });
  else if (f.ordenar === 'nome') out.sort(function(a,b){ return a.nome.localeCompare(b.nome); });
  // 'destaque' (default): reais primeiro
  else out.sort(function(a,b){ return (b.real?1:0)-(a.real?1:0); });
  return out;
}

/* --------------------------------------------------------------------------
   3) ESTADO + PERSISTÊNCIA (localStorage)
   -------------------------------------------------------------------------- */
var CART_KEY = 'useaura_cart_v1';
var cart = [];
function loadCart(){
  try { var raw = localStorage.getItem(CART_KEY); cart = raw ? JSON.parse(raw) : []; }
  catch(e){ cart = []; }
  if (!Array.isArray(cart)) cart = [];
}
function saveCart(){ try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch(e){} }
/* remove do cart itens cujo produto não existe mais no catálogo (deletado pela dona).
   ⚠️ Só chamar DEPOIS do catálogo hidratar (callback do watchStore); cedo demais apagaria
   carrinho legítimo durante o boot assíncrono. Sem-op se nada mudou. */
function reconciliarCarrinho(){
  if (!cart.length) return;
  var antes = cart.length;
  cart = cart.filter(function(it){ return !!getProduto(it.id); });
  if (cart.length !== antes){ saveCart(); updateCartBadge(); }
}
function cartLineKey(id,tam,cor){ return id+'__'+tam+'__'+cor; }
function addToCart(id, tamanho, cor, qtd){
  qtd = qtd||1;
  var p = getProduto(id); if (!p) return false;
  if (p.esgotado){ toast('Peça esgotada — encomende com a loja pelo WhatsApp.'); return false; }   // bloqueio real (não só esconder o botão)
  var key = cartLineKey(id,tamanho,cor);
  var existing = null;
  for (var i=0;i<cart.length;i++){ if (cartLineKey(cart[i].id,cart[i].tamanho,cart[i].cor)===key){ existing=cart[i]; break; } }
  if (existing) existing.qtd += qtd;
  else cart.push({ id:id, tamanho:tamanho, cor:cor, qtd:qtd });
  saveCart();
  return true;
}
function updateQty(index, delta){
  if (!cart[index]) return;
  if (delta>0){ var pe=getProduto(cart[index].id); if(pe && pe.esgotado){ toast('Peça esgotada — remova da sacola.'); return; } }
  cart[index].qtd += delta;
  if (cart[index].qtd < 1) cart.splice(index,1);
  saveCart();
}
function removeLine(index){ cart.splice(index,1); saveCart(); }
/* link de ENCOMENDA (produto esgotado) — mesmo padrão da msg de pedido; nº via config (Regra 74).
   Inclui tam/cor só quando houver seleção. */
function encomendaWaUrl(nome, tam, cor){
  var det = tam ? (' — Tam. '+tam+(cor?' · '+cor:'')) : (cor ? (' — '+cor) : '');
  var msg = '*ENCOMENDA - USE AURA*\n\nOlá! Quero encomendar esta peça (está esgotada no site):\n\n• '+nome+det+'\n\nPode me ajudar? ❤';
  return 'https://wa.me/'+PAGINAS.contato.whatsapp+'?text='+encodeURIComponent(msg);
}

/* --------------------------------------------------------------------------
   4) HELPERS DOM
   -------------------------------------------------------------------------- */
function $(sel, ctx){ return (ctx||document).querySelector(sel); }
function $all(sel, ctx){ return Array.prototype.slice.call((ctx||document).querySelectorAll(sel)); }
function el(tag, cls, html){ var e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e; }
function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

/* imagem com fallback caso a foto real falhe ao carregar */
function imgTag(src, alt, cls){
  var safeAlt = esc(alt||'');
  var s = src || FALLBACK;
  return '<img class="'+(cls||'')+'" src="'+s+'" alt="'+safeAlt+'" loading="lazy" '+
         'onerror="this.onerror=null;this.src=\''+FALLBACK+'\'">';
}

function toast(msg){
  var t = $('#toast');
  t.textContent = msg; t.hidden = false;
  requestAnimationFrame(function(){ t.classList.add('show'); });
  clearTimeout(toast._t);
  toast._t = setTimeout(function(){ t.classList.remove('show'); setTimeout(function(){ t.hidden=true; }, 260); }, 2200);
}

/* --------------------------------------------------------------------------
   5) COMPONENTES DE RENDER
   -------------------------------------------------------------------------- */
function badgeHtml(b){
  var cls = 'badge';
  var low = b.toLowerCase();
  if (low==='esgotado') cls='badge badge-soldout';
  else if (low==='promo' || low.indexOf('%')>=0 || low==='oferta') cls='badge badge-promo';
  else if (low==='novidade' || low==='best-seller') cls='badge badge-soft';
  return '<span class="'+cls+'">'+esc(b)+'</span>';
}
/* lista de badges de um produto (ESGOTADO na frente, depois os badges normais) */
function productBadges(p){ return (p.esgotado ? ['ESGOTADO'] : []).concat(p.badges||[]); }
function swatchHtml(cores){
  return '<div class="swatch-row">' + cores.map(function(c){
    return '<span class="swatch" style="background:'+esc(c.hex||'#4A3323')+'" title="'+esc(c.nome)+'"></span>';
  }).join('') + '</div>';
}
function productCard(p){
  var b = backImg(p);
  var back = b ? '<img class="img-back" src="'+b+'" alt="'+esc(p.nome)+' — vista de costas" loading="lazy">' : '';
  var bl = productBadges(p);
  var badges = bl.length ? '<div class="product-badges">'+bl.map(badgeHtml).join('')+'</div>' : '';
  return '<a class="product-card" href="#/produto/'+p.id+'">' +
    '<div class="product-card-media'+(p.esgotado?' is-soldout':'')+'">' + badges +
      imgTag(firstImg(p), p.nome+' — vista de frente', 'img-front') + back +
    '</div>' +
    '<div class="product-card-info">' +
      '<div class="product-card-cat">'+esc(p.categoria)+'</div>' +
      '<h3 class="product-card-name">'+esc(p.nome)+'</h3>' +
      '<div class="product-card-price"><span class="price">'+formatBRL(p.preco)+'</span></div>' +
      swatchHtml(p.cores) +
    '</div>' +
  '</a>';
}
function productGrid(list){
  if (!list.length){
    return '<div class="empty-state"><div class="empty-mark">&#9733;</div>' +
      '<h3>Nada por aqui… ainda</h3><p>Nenhuma peça encontrada com esses filtros. Que tal limpar e ver tudo?</p>' +
      '<a class="btn btn-ghost" href="#/categoria/todos" style="margin-top:18px">Ver tudo</a></div>';
  }
  return '<div class="product-grid">' + list.map(productCard).join('') + '</div>';
}

/* --------------------------------------------------------------------------
   6) VIEWS (retornam HTML string)
   -------------------------------------------------------------------------- */
function viewHome(){
  var bp = getProduto(BANNER.produtoId);
  var heroImg = BANNER.img ? mediaSrc(BANNER.img) : (bp ? firstImg(bp) : FALLBACK);
  var heroPos = (BANNER.posX==null?50:BANNER.posX)+'% '+(BANNER.posY==null?28:BANNER.posY)+'%';
  var novidades = applyFilters(PRODUTOS, { ordenar:'destaque' }).slice(0,6);
  var lookMain = getProduto('vestido-serenity-bubble');
  // filter(Boolean): catálogo real da dona pode não ter estes ids fixos → sem nulls, sem crash
  var lookItems = [getProduto('vestido-serenity-bubble'), getProduto('blusa-costas-nuas-noir'), getProduto('cropped-assimetrico-offwhite')].filter(Boolean);
  var feed = [
    getProduto('conjunto-aura-amarelo'),
    getProduto('cropped-assimetrico-offwhite'),
    getProduto('blusa-costas-nuas-noir'),
    getProduto('vestido-serenity-bubble'),
    getProduto('conjunto-aura-amarelo'),
    getProduto('blusa-costas-nuas-noir')
  ].filter(Boolean);

  return '' +
  // HERO
  '<section class="hero" id="heroBanner">' +
    '<img class="hero-img" id="heroImg" src="'+heroImg+'" alt="Banner da loja USE AURA" fetchpriority="high" decoding="async" style="object-position:'+heroPos+'">' +
    '<div class="hero-scrim"></div>' +
    '<div class="hero-content">' +
      '<span class="eyebrow">'+BANNER.eyebrow+'</span>' +
      '<h1>'+BANNER.titulo+'</h1>' +
      '<p>'+esc(BANNER.sub)+'</p>' +
      '<div class="hero-cta">' +
        '<a class="btn btn-primary" href="#/categoria/novidades">Ver novidades</a>' +
        '<a class="btn btn-ghost" href="#/categoria/todos">Explorar tudo</a>' +
      '</div>' +
    '</div>' +
  '</section>' +

  // FAIXA DE CATEGORIAS
  '<div class="cat-strip"><div class="cat-strip-track">' +
    CATEGORIAS.map(function(c){
      var initial = c.charAt(0);
      return '<a class="cat-chip" href="#/categoria/'+slugify(c)+'">' +
        '<span class="cat-chip-thumb">'+initial+'</span><span>'+esc(c)+'</span></a>';
    }).join('') +
  '</div></div>' +

  // NOVIDADES
  '<section class="section reveal"><div class="section-inner">' +
    '<div class="section-head"><span class="eyebrow">Recém-chegadas</span><h2>Novidades da semana</h2>' +
      '<p>As peças que acabaram de entrar — giro rápido, quem vê, leva.</p></div>' +
    productGrid(novidades) +
    '<div style="text-align:center;margin-top:34px"><a class="btn btn-ghost" href="#/categoria/todos">Ver todas as peças</a></div>' +
  '</div></section>' +

  // COMPRE O LOOK (só com produto de referência; oculta se catálogo vazio)
  (lookMain ? ('<section class="section look-section reveal"><div class="section-inner">' +
    '<div class="section-head"><span class="eyebrow">Editorial</span><h2>Compre o look</h2>' +
      '<p>Clique nos pontos e leve a combinação inteira.</p></div>' +
    '<div class="look-wrap">' +
      '<figure class="look-figure">' +
        imgTag(firstImg(lookMain), 'Look Serenity montado com o Vestido Serenity Bubble') +
        '<a class="look-dot" href="#/produto/'+lookMain.id+'" style="left:52%;top:46%" title="Ver '+esc(lookMain.nome)+'" aria-label="Ver '+esc(lookMain.nome)+'">+</a>' +
      '</figure>' +
      '<div class="look-items">' +
        lookItems.map(function(p){
          return '<a class="look-item" href="#/produto/'+p.id+'">' +
            imgTag(firstImg(p), p.nome) +
            '<div class="look-item-info"><h4>'+esc(p.nome)+'</h4>' +
              '<span class="price">'+formatBRL(p.preco)+'</span></div>' +
            '<span class="label">Ver &rarr;</span></a>';
        }).join('') +
      '</div>' +
    '</div>' +
  '</div></section>') : '') +

  // BENEFÍCIOS
  '<section class="section benefits"><div class="benefits-grid">' +
    benefit('&#9733;','Entrega Brasil','Enviamos para todo o país + moto-boy local em Sarapuí-SP.') +
    benefit('&#10022;','Pix ou cartão','Pague à vista no Pix ou parcele no cartão, na hora.') +
    benefit('&#8635;','Troca fácil','Primeira troca de tamanho por nossa conta em até 7 dias.') +
    benefit('&#9829;','Curadoria','Peças escolhidas a dedo, giro rápido e sempre novidade.') +
  '</div></section>' +

  // PROVA SOCIAL (feed) — oculta se catálogo vazio
  (feed.length ? ('<section class="section reveal"><div class="section-inner">' +
    '<div class="section-head"><span class="eyebrow">@useaura &#9733;</span><h2>Elas já usam Aura</h2>' +
      '<p>Marque #useaura e apareça por aqui.</p></div>' +
    '<div class="feed-grid">' +
      feed.map(function(p){
        return '<a class="feed-item" href="#/produto/'+p.id+'">' + imgTag(firstImg(p), 'Cliente usando '+p.nome) +
          '<span class="feed-tag">&#9733; '+esc(p.categoria)+'</span></a>';
      }).join('') +
    '</div>' +
  '</div></section>') : '') +

  // CTA FINAL
  '<section class="section cta-final reveal"><div class="section-inner">' +
    '<h2>Sua próxima peça favorita está aqui</h2>' +
    '<p>Entre para a lista da Aura e ganhe 10% na primeira compra + acesso antecipado às novidades.</p>' +
    '<a class="btn btn-primary" href="#/categoria/todos">Começar a comprar</a>' +
  '</div></section>';
}
function benefit(ic, title, desc){
  return '<div class="benefit"><div class="benefit-ic">'+ic+'</div><h4>'+title+'</h4><p>'+desc+'</p></div>';
}

/* estado de filtro atual da tela de catálogo */
var catalogState = { categoria:'todos', tamanhos:[], cores:[], precoMax:200, ordenar:'destaque', busca:'' };

function viewCatalog(catSlug){
  catalogState.categoria = catSlug || 'todos';
  // teto do slider derivado do catálogo REAL (arredonda p/ cima em 10). Piso 200
  // p/ não encolher a régua em catálogo barato; sobe sozinho se a dona cadastrar
  // peça > R$200 (senão o filtro escondia a peça cara — bug).
  var precoTeto = 200;
  PRODUTOS.forEach(function(p){ if (p.preco > precoTeto) precoTeto = Math.ceil(p.preco/10)*10; });
  catalogState.precoTeto = precoTeto;
  catalogState.tamanhos = []; catalogState.cores = []; catalogState.precoMax = precoTeto;
  catalogState.ordenar = 'destaque'; catalogState.busca = '';

  var titulo, sub;
  if (catSlug==='todos'){ titulo='Todas as peças'; sub='O acervo completo da Aura.'; }
  else if (catSlug==='novidades'){ titulo='Novidades'; sub='Acabaram de chegar.'; }
  else { titulo = SLUG_TO_CAT[catSlug] || 'Categoria'; sub='Peças da categoria '+titulo+'.'; }

  var allColors = [];
  PRODUTOS.forEach(function(p){ p.cores.forEach(function(c){ if(!allColors.some(function(x){return x.nome===c.nome;})) allColors.push(c); }); });
  // tamanhos do filtro derivados do universo REAL (tamanhos livres) — não mais fixos P/M/G/GG
  var allSizes = [];
  PRODUTOS.forEach(function(p){ (p.tamanhos||[]).forEach(function(t){ if(t && allSizes.indexOf(t)<0) allSizes.push(t); }); });

  return '' +
  '<div class="catalog-head">' +
    '<nav class="breadcrumb"><a href="#/home">Início</a> / <span>'+esc(titulo)+'</span></nav>' +
    '<h1 class="catalog-title">'+esc(titulo)+'</h1>' +
    '<p class="catalog-sub">'+esc(sub)+'</p>' +
  '</div>' +
  '<div class="catalog-body">' +
    '<div class="catalog-toolbar">' +
      '<button class="filter-toggle" id="filterToggle" aria-expanded="false" aria-controls="filtersPanel">' +
        '&#9776; Filtros</button>' +
      '<span class="result-count" id="resultCount"></span>' +
      '<select class="sort-select" id="sortSelect" aria-label="Ordenar">' +
        '<option value="destaque">Ordenar: Destaque</option>' +
        '<option value="preco-asc">Menor preço</option>' +
        '<option value="preco-desc">Maior preço</option>' +
        '<option value="nome">Nome (A-Z)</option>' +
      '</select>' +
    '</div>' +
    '<div class="catalog-layout">' +
      '<aside class="filters-panel" id="filtersPanel" hidden>' +
        '<div class="filter-group"><h4>Categoria</h4><div class="chip-row" id="filterCats">' +
          '<button class="chip" data-cat="todos" aria-pressed="'+(catSlug==='todos')+'">Todos</button>' +
          CATEGORIAS.map(function(c){ var s=slugify(c);
            return '<button class="chip" data-cat="'+s+'" aria-pressed="'+(catSlug===s)+'">'+esc(c)+'</button>'; }).join('') +
        '</div></div>' +
        (allSizes.length ? '<div class="filter-group"><h4>Tamanho</h4><div class="chip-row" id="filterSizes">' +
          allSizes.map(function(t){ return '<button class="chip chip-size" data-size="'+esc(t)+'" aria-pressed="false">'+esc(t)+'</button>'; }).join('') +
        '</div></div>' : '') +
        '<div class="filter-group"><h4>Cor</h4><div class="chip-row" id="filterColors">' +
          allColors.map(function(c){ return '<button class="chip chip-color" data-color="'+esc(c.nome)+'" aria-pressed="false">' +
            '<span class="swatch" style="background:'+esc(c.hex||'#4A3323')+'"></span>'+esc(c.nome)+'</button>'; }).join('') +
        '</div></div>' +
        '<div class="filter-group"><h4>Preço até</h4><div class="price-range">' +
          '<input type="range" id="priceRange" min="40" max="'+precoTeto+'" step="10" value="'+precoTeto+'" aria-label="Preço máximo">' +
          '<output id="priceOut">'+formatBRL(precoTeto)+'</output></div></div>' +
        '<div class="filters-actions">' +
          '<button class="btn btn-light btn-block" id="clearFilters">Limpar filtros</button></div>' +
      '</aside>' +
      '<div id="catalogResults"></div>' +
    '</div>' +
  '</div>';
}

function viewProduct(id){
  var p = getProduto(id);
  if (!p){
    return '<div class="empty-state" style="padding-top:90px"><div class="empty-mark">&#9733;</div>' +
      '<h3>Produto não encontrado</h3><p>Essa peça pode ter esgotado ou saído do ar.</p>' +
      '<a class="btn btn-ghost" href="#/categoria/todos" style="margin-top:18px">Voltar ao catálogo</a></div>';
  }
  var imgSlides = (p.galeria&&p.galeria.length ? p.galeria : [FALLBACK]).map(function(ref){ return {type:'img', src:mediaSrc(ref)}; });
  var vidSlides = (p.videos||[]).map(function(ref){ return {type:'video', ref:ref}; });
  var slides = imgSlides.concat(vidSlides);

  var relacionados = PRODUTOS.filter(function(x){ return x.categoria===p.categoria && x.id!==p.id; });
  if (relacionados.length < 4){
    PRODUTOS.forEach(function(x){ if (x.id!==p.id && relacionados.indexOf(x)===-1 && relacionados.length<4) relacionados.push(x); });
  }
  relacionados = relacionados.slice(0,3);

  var bl = productBadges(p);
  var badges = bl.length ? '<div class="pdp-badges">'+bl.map(badgeHtml).join('')+'</div>' : '';
  var precoOld = ''; // espaço p/ preço "de/por" quando houver promo real
  var pDesc = (p.descricao||'').trim();   // campos opcionais: omitir se vazios (nunca "undefined")
  var pCompo = (p.composicao||'').trim();

  return '<div class="pdp"><nav class="breadcrumb"><a href="#/home">Início</a> / ' +
      '<a href="#/categoria/'+slugify(p.categoria)+'">'+esc(p.categoria)+'</a> / <span>'+esc(p.nome)+'</span></nav>' +
    '<div class="pdp-layout">' +
      // GALERIA (N fotos + vídeos)
      '<div class="pdp-gallery'+(p.esgotado?' is-soldout':'')+'">' +
        '<div class="pdp-main-img" id="pdpMainImg" role="button" tabindex="0" aria-label="Ampliar imagem">' +
          imgTag(imgSlides[0].src, p.nome, 'pdp-main') +
          '<video class="pdp-main-video" id="pdpMainVideo" controls playsinline preload="metadata" style="display:none"></video>' +
        '</div>' +
        (slides.length>1 ? '<div class="pdp-thumbs" id="pdpThumbs">' + slides.map(function(s,i){
          if(s.type==='img') return '<button class="pdp-thumb" data-type="img" data-src="'+s.src+'" aria-pressed="'+(i===0)+'" aria-label="Foto '+(i+1)+'"><img src="'+s.src+'" alt=""></button>';
          return '<button class="pdp-thumb pdp-thumb-video" data-type="video" data-ref="'+s.ref+'" aria-pressed="false" aria-label="Vídeo do produto"><span class="pdp-playic" aria-hidden="true">&#9658;</span></button>';
        }).join('') + '</div>' : '') +
      '</div>' +
      // INFO
      '<div class="pdp-info">' + badges +
        '<div class="pdp-cat">'+esc(p.categoria)+'</div>' +
        '<h1 class="pdp-title">'+esc(p.nome)+'</h1>' +
        '<div class="pdp-price-row"><span class="pdp-price">'+formatBRL(p.preco)+'</span>'+precoOld+'</div>' +
        (p.parcela && parcelaText(p.preco) ? '<div class="pdp-installments">'+parcelaText(p.preco)+'</div>' : '') +

        (p.cores.length>1 ?
        '<div class="pdp-block"><div class="pdp-block-head"><span class="label">Cor</span></div>' +
          '<div class="selector-row" id="colorSelector">' + p.cores.map(function(c,i){
            return '<button class="color-btn" data-cor="'+esc(c.nome)+'" aria-pressed="'+(i===0)+'">' +
              '<span class="swatch" style="background:'+esc(c.hex||'#4A3323')+'"></span>'+esc(c.nome)+'</button>';
          }).join('') + '</div></div>'
        : '<input type="hidden" id="singleColor" value="'+esc(p.cores[0].nome)+'">') +

        '<div class="pdp-block"><div class="pdp-block-head"><span class="label">Tamanho</span>' +
          '<button class="size-guide-link" id="openSizeGuide">Guia de medidas</button></div>' +
          '<div class="selector-row" id="sizeSelector">' + p.tamanhos.map(function(t){
            return '<button class="size-btn" data-size="'+esc(t)+'" aria-pressed="false">'+esc(t)+'</button>';
          }).join('') + '</div>' +
          '<div class="size-hint" id="sizeHint" role="alert"></div>' +
        '</div>' +

        '<div class="pdp-block"><div class="pdp-block-head"><span class="label">Quantidade</span></div>' +
          '<div class="qty-stepper" id="qtyStepper">' +
            '<button type="button" data-delta="-1" aria-label="Diminuir quantidade">&minus;</button>' +
            '<output id="qtyOut">1</output>' +
            '<button type="button" data-delta="1" aria-label="Aumentar quantidade">+</button>' +
          '</div>' +
        '</div>' +

        '<div class="pdp-add-row">' +
          (p.esgotado
            ? '<button type="button" class="btn btn-primary" id="encomendarBtn">Quero encomendar com a loja</button>'
            : '<button class="btn btn-primary" id="addToBag">Adicionar à sacola</button>') +
        '</div>' +

        (pDesc ? '<p class="pdp-desc">'+esc(pDesc)+'</p>' : '') +
        (pCompo ? '<p class="pdp-compo"><strong>Composição:</strong> '+esc(pCompo)+'</p>' : '') +

        '<div class="pdp-block">' +
          accordion('Trocas e devoluções','Primeira troca de tamanho gratuita em até 7 dias após o recebimento. A peça deve estar sem uso, com etiqueta.') +
          accordion('Envio e prazos','Sarapuí-SP e região: moto-boy no mesmo dia. Demais localidades: envio para todo o Brasil via Correios/transportadora, prazo conforme CEP.') +
          accordion('Sobre o caimento','Modelagem feminina jovem. Peças com recorte/cut-out têm caimento mais justo — consulte o guia de medidas.') +
        '</div>' +
      '</div>' +
    '</div>' +

    // ===== PÁGINA DE VENDAS DO PRODUTO (abaixo da compra) =====
    pdpSales(p) +

    // VOCÊ TAMBÉM PODE GOSTAR
    '<section class="section reveal" style="padding-left:0;padding-right:0"><div class="section-inner">' +
      '<div class="section-head"><span class="eyebrow">Combina com</span><h2>Você também pode gostar</h2></div>' +
      '<div class="product-grid">'+relacionados.map(productCard).join('')+'</div>' +
    '</div></section>' +
  '</div>';
}

/* ---- Página de vendas do produto: destaques, editorial, prova social, garantias.
   Conteúdo tecido a partir dos dados reais da peça (composição, categoria, cor). ---- */
function pdpSales(p){
  var corNome = (p.cores[0] && p.cores[0].nome) || '';
  var imgEditorial = mediaSrc((p.galeria&&(p.galeria[1]||p.galeria[0])) || FALLBACK);

  var compo = (p.composicao||'').trim();   // campos opcionais podem vir vazios/undefined
  var descFrase = (p.descricao||'').trim().split('.')[0].trim();
  var destaques = [
    { ic:'&#9733;', t:'Caimento que valoriza', d:'Modelagem feminina jovem, pensada para vestir bem de verdade — do corpo real ao espelho.' }
  ];
  if (compo) destaques.push({ ic:'&#10022;', t:'Tecido premium', d:esc(compo) });   // sem composição → omite o card
  destaques.push({ ic:'&#9829;', t:'Pronta pro look', d:(descFrase ? esc(descFrase)+'. ' : '')+'Uma peça que rende post e elogio.' });

  // barrinha de estrelas cheia (prova social visual)
  function stars(n){ var s=''; for(var i=0;i<5;i++){ s += '<span class="star'+(i<n?' on':'')+'">&#9733;</span>'; } return s; }
  var reviews = [
    { nome:'Jéssica R.', txt:'Chegou rapidinho e a qualidade é melhor do que na foto. Já é minha peça favorita!', nota:5 },
    { nome:'Larissa M.', txt:'Amei o caimento, veste super bem. Recebi vários elogios usando.', nota:5 },
    { nome:'Bianca T.', txt:'Tecido gostoso e não amassa. Vou comprar em outra cor com certeza.', nota:5 }
  ];

  return '' +
  // FAIXA DE DESTAQUES
  '<section class="section pdp-sales-highlights reveal" style="padding-left:0;padding-right:0">' +
    '<div class="section-head"><span class="eyebrow">Por que amar</span>' +
      '<h2>Feita para ser sua próxima favorita</h2></div>' +
    '<div class="highlight-grid">' +
      destaques.map(function(h){
        return '<div class="highlight-card"><div class="highlight-ic">'+h.ic+'</div>' +
          '<h4>'+h.t+'</h4><p>'+h.d+'</p></div>';
      }).join('') +
  '</div></section>' +

  // BLOCO EDITORIAL (imagem grande + copy de venda)
  '<section class="pdp-editorial reveal">' +
    '<div class="pdp-editorial-media">' + imgTag(imgEditorial, p.nome+' — detalhe') + '</div>' +
    '<div class="pdp-editorial-copy">' +
      '<span class="eyebrow">'+esc(p.categoria)+' &#9733; '+esc(corNome)+'</span>' +
      '<h3>Cada detalhe pensado para te iluminar</h3>' +
      ((p.descricao||'').trim() ? '<p>'+esc((p.descricao||'').trim())+'</p>' : '') +
      '<ul class="pdp-selllist">' +
        (compo ? '<li>'+esc(compo)+'</li>' : '') +
        '<li>Disponível nos tamanhos '+p.tamanhos.join(', ')+'</li>' +
        '<li>Pague à vista no Pix ou parcele no cartão</li>' +
      '</ul>' +
      '<button type="button" class="btn btn-primary" id="editorialBuy">Escolher meu tamanho</button>' +
    '</div>' +
  '</section>' +

  // PROVA SOCIAL / AVALIAÇÕES
  '<section class="section pdp-reviews reveal"><div class="section-inner">' +
    '<div class="section-head"><span class="eyebrow">Quem comprou aprova</span>' +
      '<h2>Avaliações da comunidade Aura</h2>' +
      '<div class="reviews-score"><span class="reviews-num">5,0</span>' +
        '<span class="reviews-stars">'+stars(5)+'</span>' +
        '<span class="reviews-count">Baseado em avaliações de clientes</span></div>' +
    '</div>' +
    '<div class="reviews-grid">' +
      reviews.map(function(r){
        return '<figure class="review-card"><div class="review-stars">'+stars(r.nota)+'</div>' +
          '<blockquote>&ldquo;'+esc(r.txt)+'&rdquo;</blockquote>' +
          '<figcaption>'+esc(r.nome)+' <span>&#10003; Compra verificada</span></figcaption></figure>';
      }).join('') +
  '</div></section>' +

  // GARANTIAS
  '<section class="pdp-guarantees reveal"><div class="section-inner guarantees-row">' +
    '<div class="guarantee"><span>&#8635;</span><div><strong>Troca fácil</strong>1ª troca de tamanho por nossa conta em 7 dias.</div></div>' +
    '<div class="guarantee"><span>&#9733;</span><div><strong>Entrega Brasil</strong>Envio nacional + moto-boy local em Sarapuí-SP.</div></div>' +
    '<div class="guarantee"><span>&#10022;</span><div><strong>Pagamento seguro</strong>Pix à vista ou cartão parcelado, no checkout InfinitePay.</div></div>' +
  '</div></section>';
}
function accordion(title, body){
  return '<div class="accordion-item">' +
    '<button class="accordion-trigger" aria-expanded="false">'+esc(title)+'<span class="plus">+</span></button>' +
    '<div class="accordion-panel"><div class="accordion-panel-inner">'+esc(body)+'</div></div></div>';
}

function viewCartPage(){
  if (!cart.length){
    return '<div class="pdp"><div class="cart-empty" style="padding:90px 16px">' +
      '<div class="empty-mark">&#9733;</div><h3>Sua sacola está vazia</h3>' +
      '<p>Que tal descobrir sua próxima peça favorita?</p>' +
      '<a class="btn btn-primary" href="#/categoria/todos" style="margin-top:20px">Explorar peças</a></div></div>';
  }
  var sub = cartSubtotal(cart);
  return '<div class="checkout"><h1 class="checkout-title">Sua sacola</h1>' +
    '<p class="checkout-note">'+esc(freteNote())+'</p>' +
    '<div class="checkout-layout">' +
      '<div>' + cart.map(function(it,i){ return cartLineHtml(it,i); }).join('') + '</div>' +
      '<div class="order-summary">' +
        '<h3>Resumo</h3>' +
        '<div class="cart-summary-row"><span>Subtotal</span><span class="val">'+formatBRL(sub)+'</span></div>' +
        '<div class="cart-summary-row total"><span>Total</span><span class="val">'+formatBRL(sub)+'</span></div>' +
        '<a class="btn btn-primary btn-block" href="#/checkout" style="margin-top:18px">Finalizar compra</a>' +
        '<a class="btn btn-light btn-block" href="#/categoria/todos" style="margin-top:10px">Continuar comprando</a>' +
      '</div>' +
    '</div></div>';
}
function cartLineHtml(it, i){
  var p = getProduto(it.id); if (!p) return '';
  return '<div class="cart-line" data-index="'+i+'">' +
    imgTag(firstImg(p), p.nome, 'cart-line-img') +
    '<div class="cart-line-body"><h4>'+esc(p.nome)+'</h4>' +
      '<div class="cart-line-meta">Tam. '+esc(it.tamanho)+' &middot; '+esc(it.cor)+'</div>' +
      (p.esgotado ? '<div class="cart-line-soldout">&#9888; Esgotada — remova para finalizar (ou encomende pela loja)</div>' : '') +
      '<div class="cart-line-foot">' +
        '<div class="mini-stepper"><button data-act="dec" aria-label="Diminuir">&minus;</button>' +
          '<output>'+it.qtd+'</output><button data-act="inc" aria-label="Aumentar">+</button></div>' +
        '<span class="cart-line-price">'+formatBRL(p.preco*it.qtd)+'</span>' +
      '</div>' +
      '<button class="cart-line-remove" data-act="remove">Remover</button>' +
    '</div></div>';
}

function viewCheckout(){
  if (!cart.length){ location.hash = '#/carrinho'; return ''; }
  var sub = cartSubtotal(cart);
  return '<div class="checkout"><h1 class="checkout-title">Finalizar compra</h1>' +
    '<p class="checkout-note">Pagamento seguro pelo checkout InfinitePay (Pix ou cartão). '+esc(freteNote())+'</p>' +
    '<div class="checkout-layout">' +
      '<form class="checkout-form" id="checkoutForm" novalidate>' +
        '<fieldset><legend>Seus dados</legend>' +
          field('nome','Nome completo','text','Nome e sobrenome') +
          '<div class="field-row">' +
            field('email','E-mail','email','voce@email.com') +
            field('tel','Celular / WhatsApp','tel','(15) 90000-0000') +
          '</div>' +
        '</fieldset>' +
        '<fieldset><legend>Entrega</legend>' +
          '<div class="field-row">' +
            field('cep','CEP','text','00000-000') +
            field('numero','Número','text','123') +
          '</div>' +
          field('endereco','Endereço','text','Rua, avenida...') +
          '<div class="field-row">' +
            field('bairro','Bairro','text','Bairro') +
            field('cidade','Cidade','text','Cidade') +
          '</div>' +
        '</fieldset>' +
        '<fieldset><legend>Pagamento</legend>' +
          '<div class="pay-methods">' +
            '<label class="pay-method"><input type="radio" name="pay" value="pix" checked>' +
              '<span>Pix</span><span class="pay-tag">aprovação na hora</span></label>' +
            '<label class="pay-method"><input type="radio" name="pay" value="cartao">' +
              '<span>Cartão de crédito</span><span class="pay-tag">em até 3x</span></label>' +
          '</div>' +
          '<div class="pay-detail" id="payDetail"></div>' +
        '</fieldset>' +
        '<button class="btn btn-primary btn-block" type="submit" style="margin-top:6px">Confirmar pedido</button>' +
      '</form>' +
      '<div class="order-summary">' +
        '<h3>Seu pedido</h3>' +
        cart.map(function(it){ var p=getProduto(it.id); if(!p) return ''; return '<div class="order-line">' +
          imgTag(firstImg(p),p.nome) + '<div class="order-line-info">'+esc(p.nome) +
          '<div class="m">Tam. '+esc(it.tamanho)+' &middot; '+esc(it.cor)+' &middot; x'+it.qtd+'</div></div>' +
          '<span class="p">'+formatBRL(p.preco*it.qtd)+'</span></div>'; }).join('') +
        '<div class="cart-summary-row" style="margin-top:14px"><span>Subtotal</span><span class="val">'+formatBRL(sub)+'</span></div>' +
        '<div class="cart-summary-row"><span>Frete</span><span class="val" id="checkoutFrete">calcule com o CEP</span></div>' +
        '<div class="cart-summary-row total"><span>Total</span><span class="val" id="checkoutTotal">'+formatBRL(sub)+'</span></div>' +
      '</div>' +
    '</div></div>';
}
function field(id,label,type,ph){
  return '<div class="field"><label for="f_'+id+'">'+label+'</label>' +
    '<input id="f_'+id+'" name="'+id+'" type="'+type+'" placeholder="'+ph+'" autocomplete="on">' +
    '<span class="err" data-err="'+id+'"></span></div>';
}

/* snapshot do último pedido para montar a mensagem do WhatsApp na tela de
   confirmado — necessário porque initCheckout esvazia o cart ANTES de navegar */
var lastOrder = null;
/* snapshot da etapa de pagamento SIMULADO (forma + totais + orderId). Só em
   memória: em reload/acesso direto some e a viewPayment redireciona, evitando
   tela órfã (mesmo espírito defensivo do viewConfirm). */
var payState = null;

function captureOrder(form, orderId){
  var v = function(n){ var el = form.querySelector('[name="'+n+'"]'); return (el&&el.value||'').trim(); };
  var pay = (form.querySelector('input[name="pay"]:checked')||{}).value || 'pix';
  var sub = cartSubtotal(cart);     // preço único: Pix e cartão pagam o mesmo
  var fr = computeFrete(v('cep'));  // display/registro; o n8n recomputa do CEP (antifraude)
  var frete = fr.valor || 0;
  var total = sub + frete;
  var itens = cart.map(function(it){
    var p = getProduto(it.id); if(!p) return '';
    return '• '+p.nome+' — Tam. '+it.tamanho+' · '+it.cor+' · x'+it.qtd+' — '+formatBRL(p.preco*it.qtd);
  }).filter(Boolean).join('\n');
  var msg =
    '*NOVO PEDIDO - USE AURA*\n\n' +
    '*Pedido:* #'+orderId+'\n\n' +
    '*Itens:*\n'+itens+'\n\n' +
    '*Cliente:*\n' +
    'Nome: '+v('nome')+'\n' +
    'E-mail: '+v('email')+'\n' +
    'Telefone: '+v('tel')+'\n\n' +
    '*Entrega:*\n' +
    v('endereco')+', nº '+v('numero')+'\n' +
    v('bairro')+' - '+v('cidade')+'\n' +
    'CEP: '+v('cep')+'\n\n' +
    '*Pagamento:* '+(pay==='pix'?'Pix':'Cartão')+'\n' +
    '*Frete:* '+freteLabel(fr)+'\n' +
    '*Total:* '+formatBRL(total);
  lastOrder = {
    orderId: orderId,
    waUrl: 'https://wa.me/'+PAGINAS.contato.whatsapp+'?text='+encodeURIComponent(msg),
    // pedido estruturado p/ Firestore (leitura só da dona — PODE ter PII, ≠ do ntfy)
    data: {
      orderId: orderId,
      createdAt: Date.now(),
      status: 'novo',
      pagamento: pay,
      total: total,
      frete: frete,
      cliente: { nome:v('nome'), email:v('email'), tel:v('tel') },
      entrega: { endereco:v('endereco'), numero:v('numero'), bairro:v('bairro'), cidade:v('cidade'), cep:v('cep') },
      itens: cart.map(function(it){ var p=getProduto(it.id); return { id:it.id, nome:p?p.nome:it.id, tamanho:it.tamanho, cor:it.cor, qtd:it.qtd, preco:p?p.preco:0 }; })
    }
  };
}

function viewConfirm(orderId){
  // só oferece o WhatsApp quando há pedido salvo desta sessão (evita botão órfão em reload/acesso direto)
  var wa = (lastOrder && lastOrder.orderId===orderId) ?
    '<a class="btn btn-primary confirm-wa" href="'+lastOrder.waUrl+'" target="_blank" rel="noopener">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="margin-right:2px"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.2-.7-2.7-1.1-4.4-3.8-4.5-4-.2-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.2c.2-.2.5-.3.6-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.5c-.2.2-.3.4-.1.7.2.3.9 1.4 1.9 2.2 1.3 1 2 .9 2.3.9.2 0 .4-.2.5-.4l.5-.9c.2-.3.4-.2.6-.1l1.9.9c.2.1.4.2.4.3.1.2.1.7-.1 1.1Z"/></svg>' +
      'Enviar pedido no WhatsApp</a>' : '';
  return '<div class="confirm">' +
    '<div class="confirm-check"><svg viewBox="0 0 24 24" width="34" height="34"><path d="m5 13 4 4L19 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
    '<h1>Pedido confirmado!</h1>' +
    '<p>Obrigada por comprar na Aura &#9733;</p>' +
    '<p>Seu número de pedido é <span class="confirm-order-id">#'+esc(orderId)+'</span>.</p>' +
    '<p style="font-size:12.5px;margin-top:14px">Assim que confirmarmos o seu pagamento, começamos a preparar o seu pedido. Envie o comprovante e tire dúvidas pelo WhatsApp.</p>' +
    wa +
    '<a class="btn '+(wa?'btn-light':'btn-primary')+'" href="#/home"'+(wa?' style="margin-top:10px"':'')+'>Voltar à loja</a>' +
  '</div>';
}

/* ==========================================================================
   MÓDULO DE PAGAMENTO (TROCÁVEL) + NOTIFICAÇÃO REAL DE PEDIDO
   --------------------------------------------------------------------------
   O provider ativo é PixRealPayment: gera o BR Code Pix real (copia-e-cola + QR)
   100% no navegador, sem gateway/backend/custo — o valor cai direto na conta da
   chave (config.js > pix). Como não há backend, a confirmação do pagamento é
   feita pela dona (avisada por ntfy + WhatsApp); onApproved() dispara quando o
   cliente declara ter pago. Trocar `PAYMENT` por outro provider (ex.: gateway
   com webhook que confirma automaticamente) só exige a MESMA interface:

     PAYMENT.render(order)        -> string HTML do miolo da tela de pagamento.
     PAYMENT.init(order, onApproved)
                                  -> liga os eventos da tela e chama onApproved()
                                     UMA vez quando o pagamento é confirmado.

   `order` = payState = { orderId, pay:'pix'|'cartao', pixTotal, fullTotal,
                          total, itemCount }.
   REGRA DE OURO: nenhum dado de cartão real trafega pelo front — o provider
   real usa redirect/QR do gateway. Nunca coletar cartão na demo.
   ========================================================================== */

/* --- Notificação REAL de novo pedido (ntfy, SEM PII) ---------------------
   Push grátis sem backend para o celular da dona. NÃO envia nome/telefone/
   endereço — só nº do pedido, qtd de itens, total e forma de pagamento.
   Fire-and-forget: qualquer falha de rede é engolida e nunca trava o
   comprador. `prodMode:false` rotula "(DEMO)" enquanto a loja não abriu. */
var NOTIFY = {
  enabled: true,
  endpoint: 'https://ntfy.sh',
  topic: 'useaura-pedidos-9f2kx7q',
  prodMode: true            // loja no ar: aviso real, sem rótulo (DEMO)
};
function notifyNewOrder(order){
  if (!NOTIFY.enabled || !NOTIFY.topic || typeof fetch !== 'function') return;
  try{
    var tag = NOTIFY.prodMode ? '' : ' (DEMO)';
    var body = 'Novo pedido #'+order.orderId+tag+'\n' +
               order.itemCount+' item(ns) - '+formatBRL(order.total)+' - '+
               (order.pay==='pix'?'Pix':'Cartao');
    // headers do ntfy só aceitam latin-1: Title/Tags ASCII; corpo pode ter acento/UTF-8
    fetch(NOTIFY.endpoint+'/'+encodeURIComponent(NOTIFY.topic), {
      method:'POST', body:body,
      headers:{ 'Title':'USE AURA - novo pedido', 'Priority':'high', 'Tags':'shopping_bags' }
    }).catch(function(){});
  }catch(e){}
}

/* Convergência do pós-pagamento (ponto único chamado quando o pagamento é
   aprovado). Metade B: persistir o pedido no Firestore acontece AQUI, antes de
   notificar. Hoje: avisa a dona por push real, esvazia a sacola e confirma. */
function finalizeOrder(order){
  // persiste o pedido na nuvem (só se configurada) → aparece na aba "Pedidos" da dona
  if (window.Cloud && Cloud.firestoreEnabled && lastOrder && lastOrder.data && lastOrder.orderId===order.orderId){
    Cloud.createOrder(lastOrder.data);
  }
  notifyNewOrder(order);
  cart = []; saveCart(); updateCartBadge();     // snapshot p/ WhatsApp já foi capturado em captureOrder
  location.hash = '#/confirmado/' + order.orderId;
}

/* --------------------------------------------------------------------------
   PROVIDER PIX REAL (100% client-side, sem gateway/backend/custo).
   Gera o BR Code (payload EMV, padrão Banco Central) — copia-e-cola + QR.
   O dinheiro cai DIRETO na conta da chave configurada (config.js > pix.chave);
   a Avanzia não intermedia o valor.
   -------------------------------------------------------------------------- */
/* chave/nome/cidade vêm de config (Regra 74 — nada hardcoded que devia ser dado).
   Fallback só p/ não quebrar se a config sumir. */
function pixCfg(){
  var c = (window.USEAURA_CONFIG && window.USEAURA_CONFIG.pix) || {};
  return {
    chave:  c.chave  || '+5515988241672',
    nome:   c.nome   || 'USE AURA',
    cidade: c.cidade || 'SARAPUI'
  };
}
/* CRC16-CCITT (poly 0x1021, init 0xFFFF) — campo 63 do BR Code, 4 hex maiúsculos */
function pixCrc16(str){
  var crc = 0xFFFF;
  for (var i=0;i<str.length;i++){
    crc ^= (str.charCodeAt(i) & 0xFF) << 8;
    for (var j=0;j<8;j++){
      crc = (crc & 0x8000) ? (((crc<<1) ^ 0x1021) & 0xFFFF) : ((crc<<1) & 0xFFFF);
    }
  }
  return crc.toString(16).toUpperCase().padStart(4,'0');
}
/* saneia texto p/ campos EMV: ASCII imprimível, sem acento, maiúsculas, tamanho máx */
function pixSanitize(s, max){
  return String(s||'')
    .normalize('NFD').replace(/[̀-ͯ]/g,'')    // remove acentos
    .replace(/[^\x20-\x7E]/g,'')                        // só ASCII imprimível
    .toUpperCase().replace(/\s+/g,' ').trim().slice(0, max);
}
/* monta o payload EMV/BR Code Pix (a string do "copia e cola"). */
function buildPixPayload(opts){
  function f(id, v){ v = String(v); return id + String(v.length).padStart(2,'0') + v; }
  var valor = Math.round((Number(opts.valor)||0)*100)/100;          // evita erro de float (centavos)
  var mai   = f('00','BR.GOV.BCB.PIX') + f('01', opts.chave);       // conta do recebedor
  var txid  = pixSanitize(opts.txid,25).replace(/[^A-Z0-9]/g,'') || '***';
  var body  =
    f('00','01') +                                                  // payload format indicator
    f('26', mai) +                                                  // merchant account info (Pix)
    f('52','0000') +                                                // merchant category code
    f('53','986') +                                                 // moeda = BRL
    (valor>0 ? f('54', valor.toFixed(2)) : '') +                    // valor (omitido se 0)
    f('58','BR') +                                                  // país
    f('59', pixSanitize(opts.nome,25)   || 'RECEBEDOR') +           // merchant name (cosmético)
    f('60', pixSanitize(opts.cidade,15) || 'BRASIL') +              // merchant city (cosmético)
    f('62', f('05', txid));                                         // additional data (txid)
  body += '6304';                                                   // id+len do CRC antes de calcular
  return body + pixCrc16(body);
}
/* QR real do payload via lib vendorizada (qrcode.js, MIT, offline). Se a lib
   faltar, retorna '' e a tela mostra só o copia-e-cola (degradação graciosa). */
function pixQrSvg(text){
  if (typeof qrcode === 'undefined') return '';
  try{
    var qr = qrcode(0, 'M'); qr.addData(text); qr.make();
    var n = qr.getModuleCount(), quiet = 4, cell = 8;
    var size = (n + quiet*2) * cell, rects = '';
    for (var r=0;r<n;r++) for (var c=0;c<n;c++){
      if (qr.isDark(r,c)) rects += '<rect x="'+((c+quiet)*cell)+'" y="'+((r+quiet)*cell)+'" width="'+cell+'" height="'+cell+'"/>';
    }
    return '<svg class="paysim-qr" viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'" role="img" aria-label="QR Code Pix do pedido">' +
      '<rect width="'+size+'" height="'+size+'" fill="#fff"/><g fill="#000">'+rects+'</g></svg>';
  }catch(e){ return ''; }
}
/* carrega o gerador de QR (qrcode.js, 56KB) SOB DEMANDA — só quando a tela de Pix
   client-side aparece. Tira o peso do 1º load de ~100% dos acessos. O copia-e-cola
   funciona sempre, com ou sem a lib (degradação graciosa via pixQrSvg). */
function loadQrcodeLib(cb){
  if (typeof qrcode !== 'undefined'){ if(cb) cb(); return; }
  if (!loadQrcodeLib._p){
    loadQrcodeLib._p = new Promise(function(res){
      var s = document.createElement('script');
      s.src = 'assets/js/qrcode.js?v=10';
      s.onload = function(){ res(); };
      s.onerror = function(){ res(); };   // falhou → segue sem QR (copia-e-cola cobre)
      document.head.appendChild(s);
    });
  }
  loadQrcodeLib._p.then(function(){ if(cb) cb(); }, function(){ if(cb) cb(); });
}
/* copia texto com clipboard API + fallback execCommand; nunca quebra se indisponível */
function copyText(text, btn){
  function done(){ if(btn){ var o=btn.getAttribute('data-label')||btn.textContent; btn.textContent='Copiado!';
    setTimeout(function(){ btn.textContent=o; }, 1500); } }
  function fallback(){
    try{ var ta=document.createElement('textarea'); ta.value=text; ta.setAttribute('readonly','');
      ta.style.position='fixed'; ta.style.top='-1000px'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); done();
    }catch(e){ toast('Copie o código Pix manualmente.'); }
  }
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();
  }catch(e){ fallback(); }
}

var PixRealPayment = {
  /* loja real: sem selo de simulação (o dinheiro é de verdade) */
  stamp: '',
  note: function(order){ return 'Pedido <span class="confirm-order-id">#'+esc(order.orderId)+'</span> &middot; pague com Pix e confirme para finalizar.'; },
  /* miolo da tela de pagamento */
  render: function(order){
    if (order.pay==='pix'){
      var cfg  = pixCfg();
      var pTot = (order.total!=null) ? order.total : order.pixTotal;   // peça + frete (BR Code = valor cobrado)
      var code = buildPixPayload({ chave:cfg.chave, nome:cfg.nome, cidade:cfg.cidade,
                                   valor:pTot, txid:order.orderId });
      // wrap sempre presente (reserva 180x180 no CSS → sem CLS quando o QR chega).
      // Pré-preenchido se a lib já estiver carregada; senão o init a carrega sob demanda.
      return '<div class="paysim-card">' +
        '<h2 class="paysim-h">Pague com Pix</h2>' +
        '<div class="paysim-amount">'+formatBRL(pTot)+'</div>' +
        '<div class="paysim-qr-wrap" id="pixQrWrap" data-code="'+esc(code)+'">'+pixQrSvg(code)+'</div>' +
        '<label class="paysim-copy-label" for="pixCode">Pix copia e cola</label>' +
        '<div class="paysim-copy-row">' +
          '<input id="pixCode" class="paysim-copy-input" type="text" readonly value="'+esc(code)+'" aria-label="Código Pix copia e cola">' +
          '<button type="button" class="btn btn-light" id="pixCopyBtn" data-label="Copiar" data-code="'+esc(code)+'">Copiar</button>' +
        '</div>' +
        '<p class="paysim-warn">Escaneie o QR ou copie o código no app do seu banco. O valor cai direto na conta da USE AURA. Depois de pagar, toque no botão abaixo.</p>' +
        '<button type="button" class="btn btn-primary btn-block" id="simPay">Já fiz o Pix — confirmar pedido</button>' +
      '</div>';
    }
    /* Cartão: sem gateway de cartão (loja 100% estática, sem backend/custo) →
       o pedido é registrado e o pagamento no cartão é combinado pelo WhatsApp
       (link de pagamento ou maquininha na entrega). Nada de PAN/CVV neste JS. */
    var cTot = (order.total!=null) ? order.total : order.fullTotal;   // peça + frete (espelha a branch pix)
    var cFreteNote = (order.frete && order.frete.valor>0) ? '<span>Inclui frete '+formatBRL(order.frete.valor)+'</span>' : '';
    return '<div class="paysim-card">' +
      '<h2 class="paysim-h">Pagamento no cartão</h2>' +
      '<div class="paysim-amount">'+formatBRL(cTot)+cFreteNote+'</div>' +
      '<p class="paysim-warn">Para pagar no cartão, confirme o pedido e combine o pagamento pelo WhatsApp com a loja (link de pagamento ou maquininha na entrega). Você recebe o contato na próxima tela.</p>' +
      '<button type="button" class="btn btn-primary btn-block" id="simPay">Confirmar pedido</button>' +
    '</div>';
  },
  /* liga os eventos da tela e chama onApproved() 1x quando o cliente confirma */
  init: function(order, onApproved){
    var copyBtn = $('#pixCopyBtn');
    if (copyBtn) copyBtn.addEventListener('click', function(){ copyText(copyBtn.getAttribute('data-code')||'', copyBtn); });

    // QR sob demanda: se o wrap existe e ainda está vazio, carrega a lib e injeta.
    // Se a lib falhar, remove o wrap (não deixa quadrado branco). Copia-e-cola já cobre.
    var qrWrap = $('#pixQrWrap');
    if (qrWrap && !qrWrap.firstChild){
      var pixCode = qrWrap.getAttribute('data-code') || '';
      loadQrcodeLib(function(){
        if (!qrWrap.parentNode) return;                  // usuário navegou: nó órfão
        var svg = pixQrSvg(pixCode);
        if (svg) qrWrap.innerHTML = svg;
        else qrWrap.parentNode.removeChild(qrWrap);
      });
    }

    var simBtn = $('#simPay'), area = $('#paymentArea');
    if (!simBtn || !area) return;
    var done = false;                                   // trava reentrância (clique-duplo)
    simBtn.addEventListener('click', function(){
      if (done) return; done = true; simBtn.disabled = true;
      area.innerHTML = '<div class="paysim-processing"><span class="paysim-spinner" aria-hidden="true"></span>' +
        '<p>Registrando seu pedido...</p></div>';
      setTimeout(function(){
        area.innerHTML = '<div class="paysim-approved">' +
          '<div class="confirm-check paysim-approved-ic"><svg viewBox="0 0 24 24" width="34" height="34"><path d="m5 13 4 4L19 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
          '<h2 class="paysim-approved-h">&#10003; Pedido registrado!</h2>' +
          '<p class="paysim-approved-sub">A loja foi avisada na hora e vai confirmar o seu pagamento.</p>' +
          '<button type="button" class="btn btn-primary btn-block" id="paysimSeeOrder">Ver meu pedido</button>' +
        '</div>';
        var seeBtn = $('#paysimSeeOrder'), navDone = false;   // trava reentrância: finaliza 1x só
        if (!seeBtn) return;                                   // usuário navegou durante o "registrando": nó órfão
        seeBtn.addEventListener('click', function(){
          if (navDone) return; navDone = true; seeBtn.disabled = true;
          onApproved();
        });
      }, 1000);
    });
  }
};

/* --------------------------------------------------------------------------
   PROVIDER INFINITEPAY (cartão real via checkout hospedado).
   Regra de ouro: NENHUM dado de cartão trafega pelo front. O navegador só pede
   ao n8n (VPS) para criar o link (POST /links, feito server-side) e redireciona
   ao checkout seguro da InfinitePay. A CONFIRMAÇÃO não vem do botão "já paguei":
   vem do doc público Firestore payments/<orderId>, gravado pelo n8n SÓ depois de
   reconciliar via /payment_check. Por isso o onApproved "de verdade" mora na
   rota de retorno (#/retorno/<orderId>), não aqui.
   Config em config.js > infinitepay (Regra 74 — nada hardcoded). Inerte por
   padrão: só entra em cena via providerFor() quando ativo:true + criarLinkUrl.
   -------------------------------------------------------------------------- */
function ipCfg(){ return (window.USEAURA_CONFIG && window.USEAURA_CONFIG.infinitepay) || {}; }
/* base absoluta do site p/ montar o redirect_url do checkout. Usa a config se
   houver; senão deriva do endereço atual (origin + caminho até o index), o que
   funciona tanto em domínio próprio quanto em GitHub Pages (subpasta). */
function ipRedirectBase(){
  var b = ipCfg().redirectBase;
  if (b) return String(b).replace(/#.*$/,'').replace(/\/?$/,'/');
  return location.origin + location.pathname.replace(/[^/]*$/,'');
}
/* cadeado inline (reforço de confiança, sem imagem externa) */
function lockSvg(sz){ return '<svg viewBox="0 0 24 24" width="'+sz+'" height="'+sz+'" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10.5" rx="2.2"/><path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5"/></svg>'; }
var InfinitePayPayment = {
  stamp: '',
  note: function(order){
    var forma = order.pay==='pix' ? 'no Pix' : 'no cartão';
    return 'Pedido <span class="confirm-order-id">#'+esc(order.orderId)+'</span> &middot; pague '+forma+' em ambiente seguro (InfinitePay).';
  },
  render: function(order){
    var isPix = order.pay==='pix';
    var parc = (window.USEAURA_CONFIG && window.USEAURA_CONFIG.cartao) || {};
    var maxP = parseInt(parc.maxParcelas,10); if(!(maxP>=1)) maxP = 3;  // default alinhado ao parcelaText da PDP
    // parcela só no cartão e só se cartao.ativo (mesmo gate honesto da PDP/parcelaText)
    var parcTxt = (!isPix && parc.ativo && maxP>1) ? ('Parcele em até '+maxP+'x'+(parc.semJuros?' sem juros':'')+'.') : '';
    var fr = order.frete || { mode:'wa', valor:null };
    var frete = fr.valor || 0;
    var total = (order.total!=null) ? order.total : (order.fullTotal + frete);   // peça + frete
    var freteNote = fr.mode==='wa' ? 'Frete a combinar pelo WhatsApp'
                  : (frete>0 ? 'Inclui frete '+formatBRL(frete) : 'Frete grátis');
    return '<div class="paysim-card">' +
      '<h2 class="paysim-h">Pagamento '+(isPix?'no Pix':'no cartão')+'</h2>' +
      '<div class="paysim-amount">'+formatBRL(total)+'<span>'+freteNote+'</span></div>' +   // preço único (Pix = cartão) + frete
      '<div class="ip-secure">'+lockSvg(15)+'<span>Pagamento protegido &middot; você volta ao site após pagar</span></div>' +
      (parcTxt ? '<p class="paysim-warn">'+parcTxt+'</p>' : '') +
      '<p class="paysim-warn">Você finaliza no checkout seguro da InfinitePay ('+(isPix?'Pix':'cartão')+'). Nenhum dado de pagamento passa por esta loja &mdash; e assim que pagar, a gente te traz de volta automaticamente para confirmar o pedido.</p>' +
      '<button type="button" class="btn btn-primary btn-block" id="ipPay">Ir para o pagamento seguro</button>' +
      '<p class="paysim-msg" id="ipMsg" style="min-height:1em"></p>' +
      // overlay de transição (aparece ao clicar; some no erro) — evita "sumir seco" pro checkout
      '<div class="ip-redirect" id="ipRedirect" hidden>' +
        '<span class="ip-lock">'+lockSvg(26)+'</span>' +
        '<p class="ip-redirect-msg">Te levando ao <strong>ambiente seguro de pagamento</strong> (InfinitePay).<br>É rápido &mdash; e você volta automaticamente.</p>' +
        '<span class="paysim-spinner"></span>' +
      '</div>' +
    '</div>';
  },
  /* onApproved é aceito para respeitar a interface, mas NÃO é usado aqui: a
     aprovação real acontece no retorno (Firestore), não neste page-load. */
  init: function(order, onApproved){
    var btn = $('#ipPay'), msg = $('#ipMsg');
    if (!btn) return;
    var cfg = ipCfg();
    var going = false;                                   // trava clique-duplo
    function overlay(show){ var ov = $('#ipRedirect'); if (ov) ov.hidden = !show; }
    function fail(t){ overlay(false); if(msg) msg.textContent = t || 'Não foi possível iniciar o pagamento. Tente novamente ou finalize pelo WhatsApp.'; btn.disabled = false; going = false; }
    btn.addEventListener('click', function(){
      if (going) return; going = true; btn.disabled = true;
      if (msg) msg.textContent = '';
      overlay(true);                                     // transição branded imediata (cobre gerar-link + redirect, sem pulo)
      if (!cfg.criarLinkUrl){ fail('Pagamento indisponível no momento. Finalize pelo WhatsApp.'); return; }

      // ANTIFRAUDE (CRÍTICO-1): o preço NÃO é enviado pelo navegador — o n8n
      // recomputa cada item pelo catálogo server-side (config/store, escrito só
      // pela dona), por `id`. Aqui só mandamos id + quantidade + descrição.
      var items = cart.map(function(it){
        var p = getProduto(it.id);
        return { id: it.id, quantity: it.qtd,
                 description: (p?p.nome:it.id)+' - Tam '+it.tamanho+' '+it.cor };
      }).filter(function(x){ return x.id && x.quantity>0; });
      if (!items.length){ fail('Sacola vazia. Volte e adicione um item.'); return; }

      var d = (lastOrder && lastOrder.orderId===order.orderId && lastOrder.data) ? lastOrder.data : null;
      var body = {
        orderId: order.orderId,
        pagamento: order.pay,                            // n8n usa preço único do catálogo (Pix e cartão iguais)
        items: items,
        redirect_url: ipRedirectBase() + '#/retorno/' + order.orderId,
        customer: d ? { name:d.cliente.nome, email:d.cliente.email, phone_number:d.cliente.tel } : undefined,
        address: d ? { cep:d.entrega.cep, street:d.entrega.endereco, neighborhood:d.entrega.bairro,
                       number:d.entrega.numero, complement:'' } : undefined
      };

      // persiste o pedido ANTES de sair (status 'novo') p/ a dona ver e o n8n dar baixa
      var persist = (d && window.Cloud && Cloud.firestoreEnabled)
        ? Cloud.createOrderWithId(order.orderId, d) : Promise.resolve(null);

      persist.then(function(){
        return fetch(cfg.criarLinkUrl, {
          method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)
        });
      }).then(function(r){
        if (!r.ok) throw new Error('http '+r.status);
        return r.json();
      }).then(function(j){
        var url = j && (j.url || (j.data && j.data.url) || j.link);
        if (!url) throw new Error('sem url');
        try{ sessionStorage.setItem('ip_await', String(order.orderId)); }catch(e){}
        location.href = url;                              // vai ao checkout InfinitePay
      }).catch(function(){ fail(); });
    });
  }
};

/* >>> PONTO ÚNICO DE TROCA DO PAGAMENTO <<<
   Provider padrão: Pix real (BR Code client-side). providerFor() escolhe o
   provider por pedido: cartão + InfinitePay ativo/configurado → InfinitePay;
   caso contrário → Pix (que também cobre o cartão-via-WhatsApp). Todos falam a
   MESMA interface stamp/note/render/init. */
var PAYMENT = PixRealPayment;
function providerFor(order){
  var ic = ipCfg();
  // Com InfinitePay ativo, Pix E cartão passam pelo gateway (baixa automática por
  // webhook→reconciliação). Exige Firestore ligado: a confirmação do retorno vem
  // do doc payments/<id> e o pedido precisa persistir p/ o n8n dar baixa. Sem
  // nuvem OU inativo → cai no Pix client-side/WhatsApp (evita pedido-fantasma).
  if (order && (order.pay==='pix' || order.pay==='cartao') && ic.ativo && ic.criarLinkUrl
      && window.Cloud && Cloud.firestoreEnabled) return InfinitePayPayment;
  return PixRealPayment;
}

function viewPayment(orderId){
  // defesas: sem itens → volta pra sacola; sem snapshot desta sessão → volta pro checkout
  if (!cart.length){ location.hash = '#/carrinho'; return ''; }
  if (!payState || payState.orderId !== orderId){ location.hash = '#/checkout'; return ''; }

  // shell provider-agnóstico: selo/nota vêm do provider (prov.stamp/note)
  var prov = providerFor(payState);
  return '<div class="checkout paysim">' +
    (prov.stamp || '') +
    '<h1 class="checkout-title">Pagamento</h1>' +
    '<p class="checkout-note">' + prov.note(payState) + '</p>' +
    '<div id="paymentArea">' + prov.render(payState) + '</div>' +
  '</div>';
}

function initPayment(){
  var order = payState;
  if (!order) return;                                  // sem snapshot: viewPayment já redirecionou
  providerFor(order).init(order, function(){ finalizeOrder(order); });
}

/* --------------------------------------------------------------------------
   RETORNO DO CHECKOUT DE CARTÃO (InfinitePay) — #/retorno/<orderId>
   Página auto-suficiente (sobrevive a reload/novo page-load após o redirect):
   NÃO depende de payState/lastOrder. Mostra "aguardando confirmação" e observa
   o doc público payments/<orderId>. Quando o n8n grava status:'pago' (após
   reconciliar), navega para #/confirmado. Nunca confirma pelo simples retorno
   da URL — só pela confirmação real no Firestore.
   -------------------------------------------------------------------------- */
function cleanOrderId(raw){ return String(raw||'').split('?')[0].split('&')[0]; }

function viewRetorno(orderId){
  orderId = cleanOrderId(orderId);
  var cloudOn = !!(window.Cloud && Cloud.firestoreEnabled);
  return '<div class="confirm" id="retornoBox">' +
    (cloudOn
      ? '<div class="ip-return-lock">'+lockSvg(30)+'</div>' +
        '<div class="paysim-processing" style="padding:8px 16px 0"><span class="paysim-spinner" aria-hidden="true"></span>' +
          '<p id="retornoMsg">Confirmando o seu pagamento&hellip; já estamos quase lá.</p></div>'
      : '<div class="confirm-check"><svg viewBox="0 0 24 24" width="30" height="30"><path d="m5 13 4 4L19 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>') +
    '<p>Pedido <span class="confirm-order-id">#'+esc(orderId)+'</span>.</p>' +
    (cloudOn
      ? '<p style="font-size:12.5px;margin-top:10px">Pagamento em ambiente seguro. Assim que for aprovado, esta tela avança sozinha &mdash; pode levar alguns instantes, pode deixar aberto.</p>'
      : '<p style="font-size:12.5px;margin-top:10px">Se você concluiu o pagamento, envie o comprovante pelo WhatsApp para confirmarmos o seu pedido.</p>') +
    '<a class="btn btn-light" id="retornoHome" href="#/home" style="margin-top:14px">Voltar à loja</a>' +
  '</div>';
}

function initRetorno(orderId){
  orderId = cleanOrderId(orderId);
  if (!orderId) return;
  var done = false, unsub = null;
  function onHash(){ if (cleanOrderId((parseHash()[1]||''))!==orderId) stop(); }
  function stop(){
    if (typeof unsub==='function'){ try{ unsub(); }catch(e){} unsub=null; }
    window.removeEventListener('hashchange', onHash);   // remove sempre (inclui ir p/ #/confirmado do mesmo id)
  }
  function confirmed(){
    if (done) return; done = true; stop();
    try{ sessionStorage.removeItem('ip_await'); }catch(e){}
    cart = []; saveCart(); updateCartBadge();           // esvazia a sacola no sucesso
    location.hash = '#/confirmado/' + orderId;
  }
  if (window.Cloud && Cloud.firestoreEnabled){
    unsub = Cloud.watchPayment(orderId, function(data){
      if (data && data.status==='pago') confirmed();
    });
    window.addEventListener('hashchange', onHash);      // encerra o listener se o cliente sair da rota
    // demora longa: orienta o caminho manual sem prometer nada (re-busca o nó: pode ter saído do DOM)
    setTimeout(function(){ var m = document.getElementById('retornoMsg');
      if (!done && m) m.textContent = 'Está demorando mais que o normal. Se você já pagou, aguarde mais um pouco ou fale com a loja no WhatsApp.'; }, 90000);
  }
}

/* tabela de medidas reutilizável (guia de medidas — página e modal) */
function sizeTableHtml(){
  return '<table class="size-table"><thead><tr><th>Tam.</th><th>Busto</th><th>Cintura</th><th>Quadril</th></tr></thead>' +
    '<tbody>' +
      '<tr><td>P</td><td>84–88</td><td>64–68</td><td>90–94</td></tr>' +
      '<tr><td>M</td><td>89–93</td><td>69–73</td><td>95–99</td></tr>' +
      '<tr><td>G</td><td>94–98</td><td>74–78</td><td>100–104</td></tr>' +
      '<tr><td>GG</td><td>99–104</td><td>79–84</td><td>105–110</td></tr>' +
    '</tbody></table>';
}

/* página institucional (texto editável no modo dona) */
function viewPagina(slug){
  var pg = PAGINAS[slug];
  if (!pg){
    return '<div class="empty-state" style="padding-top:90px"><div class="empty-mark">&#9733;</div>' +
      '<h3>Página não encontrada</h3><a class="btn btn-ghost" href="#/home" style="margin-top:18px">Voltar ao início</a></div>';
  }
  var paras = String(pg.texto||'').split(/\n{2,}/).map(function(t){
    return '<p>'+esc(t).replace(/\n/g,'<br>')+'</p>';
  }).join('');
  var extra = '';
  if (pg.whatsapp){
    extra += '<a class="btn btn-primary pagina-wa" href="https://wa.me/'+esc(pg.whatsapp)+'" target="_blank" rel="noopener">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="margin-right:2px"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.2-.7-2.7-1.1-4.4-3.8-4.5-4-.2-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.2c.2-.2.5-.3.6-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.5c-.2.2-.3.4-.1.7.2.3.9 1.4 1.9 2.2 1.3 1 2 .9 2.3.9.2 0 .4-.2.5-.4l.5-.9c.2-.3.4-.2.6-.1l1.9.9c.2.1.4.2.4.3.1.2.1.7-.1 1.1Z"/></svg>' +
      'Falar no WhatsApp</a>';
  }
  if (pg.tabela) extra += '<div class="pagina-tabela">'+sizeTableHtml()+'</div>';

  return '<article class="pagina"><nav class="breadcrumb"><a href="#/home">Início</a> / <span>'+esc(pg.titulo)+'</span></nav>' +
    '<h1 class="pagina-title">'+esc(pg.titulo)+'</h1>' +
    '<div class="pagina-body">'+paras+extra+'</div>' +
  '</article>';
}

/* --------------------------------------------------------------------------
   7) ROUTER
   -------------------------------------------------------------------------- */
function parseHash(){
  var h = location.hash.replace(/^#\/?/,'');
  var parts = h.split('/').filter(Boolean);
  return parts;
}
function render(){
  var app = $('#app');
  var parts = parseHash();
  var view = parts[0] || 'home';
  var html;

  if (view==='home' || view===''){ html = viewHome(); }
  else if (view==='categoria'){ html = viewCatalog(parts[1] || 'todos'); }
  else if (view==='produto'){ html = viewProduct(parts[1]); }
  else if (view==='carrinho'){ html = viewCartPage(); }
  else if (view==='checkout'){ html = viewCheckout(); }
  else if (view==='pagamento'){ html = viewPayment(parts[1]||'000000'); }
  else if (view==='retorno'){ html = viewRetorno(parts[1]||'000000'); }
  else if (view==='confirmado'){ html = viewConfirm(parts[1]||'000000'); }
  else if (view==='pagina'){ html = viewPagina(parts[1]); }
  else { html = viewHome(); }

  app.innerHTML = html;
  window.scrollTo(0,0);
  app.focus({preventScroll:true});

  // transição de entrada da nova página (retriggerada a cada rota)
  app.classList.remove('view-enter');
  void app.offsetWidth;               // força reflow p/ reiniciar a animação
  app.classList.add('view-enter');
  syncHeaderScroll();                 // reavalia o header no topo da nova página

  // hooks pós-render por view
  if (view==='categoria') initCatalog();
  if (view==='produto') initProduct();
  if (view==='checkout') initCheckout();
  if (view==='pagamento') initPayment();
  if (view==='retorno') initRetorno(parts[1]||'');
  initReveal();
  initAccordions();
  closeAllOverlays();

  // Área da Dona: re-injeta os controles de edição a cada troca de página
  if (window.AdminUI) window.AdminUI.decorate(view, parts);
}

/* --------------------------------------------------------------------------
   8) INTERAÇÕES POR VIEW
   -------------------------------------------------------------------------- */
function renderCatalogResults(){
  var results = $('#catalogResults'); if (!results) return;
  var list = applyFilters(PRODUTOS, catalogState);
  results.innerHTML = productGrid(list);
  var rc = $('#resultCount');
  if (rc) rc.textContent = list.length + (list.length===1?' peça':' peças');
}
function initCatalog(){
  renderCatalogResults();

  var toggle = $('#filterToggle'), panel = $('#filtersPanel');
  if (toggle){
    toggle.addEventListener('click', function(){
      var open = panel.hasAttribute('hidden');
      if (open){ panel.removeAttribute('hidden'); toggle.setAttribute('aria-expanded','true'); }
      else { panel.setAttribute('hidden',''); toggle.setAttribute('aria-expanded','false'); }
    });
  }
  // categoria chips
  $all('#filterCats .chip').forEach(function(b){
    b.addEventListener('click', function(){
      $all('#filterCats .chip').forEach(function(x){ x.setAttribute('aria-pressed','false'); });
      b.setAttribute('aria-pressed','true');
      catalogState.categoria = b.dataset.cat;
      renderCatalogResults();
    });
  });
  // tamanho (multi)
  $all('#filterSizes .chip').forEach(function(b){
    b.addEventListener('click', function(){
      var on = b.getAttribute('aria-pressed')==='true';
      b.setAttribute('aria-pressed', on?'false':'true');
      var t = b.dataset.size;
      if (on) catalogState.tamanhos = catalogState.tamanhos.filter(function(x){return x!==t;});
      else catalogState.tamanhos.push(t);
      renderCatalogResults();
    });
  });
  // cor (multi)
  $all('#filterColors .chip').forEach(function(b){
    b.addEventListener('click', function(){
      var on = b.getAttribute('aria-pressed')==='true';
      b.setAttribute('aria-pressed', on?'false':'true');
      var c = b.dataset.color;
      if (on) catalogState.cores = catalogState.cores.filter(function(x){return x!==c;});
      else catalogState.cores.push(c);
      renderCatalogResults();
    });
  });
  // preço
  var range = $('#priceRange'), out = $('#priceOut');
  if (range){
    range.addEventListener('input', function(){
      catalogState.precoMax = Number(range.value);
      out.textContent = formatBRL(catalogState.precoMax);
      renderCatalogResults();
    });
  }
  // ordenar
  var sort = $('#sortSelect');
  if (sort) sort.addEventListener('change', function(){ catalogState.ordenar = sort.value; renderCatalogResults(); });
  // limpar
  var clear = $('#clearFilters');
  if (clear) clear.addEventListener('click', function(){
    catalogState.categoria='todos'; catalogState.tamanhos=[]; catalogState.cores=[];
    catalogState.precoMax=catalogState.precoTeto; catalogState.busca='';
    $all('#filterCats .chip').forEach(function(x){ x.setAttribute('aria-pressed', x.dataset.cat==='todos'?'true':'false'); });
    $all('#filterSizes .chip, #filterColors .chip').forEach(function(x){ x.setAttribute('aria-pressed','false'); });
    if (range){ range.value=catalogState.precoTeto; out.textContent=formatBRL(catalogState.precoTeto); }
    renderCatalogResults();
  });
}

var pdpSel = { size:null, cor:null, qtd:1 };
function initProduct(){
  pdpSel = { size:null, cor:null, qtd:1 };
  var single = $('#singleColor'); if (single) pdpSel.cor = single.value;
  var firstColor = $('#colorSelector .color-btn[aria-pressed="true"]');
  if (firstColor) pdpSel.cor = firstColor.dataset.cor;

  // galeria: thumbs trocam imagem principal OU tocam vídeo
  var mainWrap = $('#pdpMainImg'), mainImg = mainWrap && mainWrap.querySelector('img');
  var mainVideo = $('#pdpMainVideo');
  var videoActive = false;
  function showImage(src){
    videoActive = false;
    if (mainVideo){ try{ mainVideo.pause(); }catch(e){} mainVideo.style.display='none'; mainVideo.removeAttribute('src'); }
    if (mainImg){ mainImg.style.display=''; if(src){ mainImg.src = src; } }
  }
  function showVideo(ref){
    if (!mainVideo) return;
    if (mainImg) mainImg.style.display='none';
    if (mainWrap) mainWrap.classList.remove('zoomed');
    mainVideo.style.display='block';
    videoActive = true;
    // ref pode ser URL (Cloudinary/produção), dataURL, ou id de mídia local (IndexedDB)
    if (/^https?:|^data:/.test(ref)){ mainVideo.src = ref; mainVideo.play().catch(function(){}); }
    else mediaGetDB(ref).then(function(data){ if(data){ mainVideo.src=data; mainVideo.play().catch(function(){}); } });
  }
  $all('#pdpThumbs .pdp-thumb').forEach(function(b){
    b.addEventListener('click', function(){
      $all('#pdpThumbs .pdp-thumb').forEach(function(x){ x.setAttribute('aria-pressed','false'); });
      b.setAttribute('aria-pressed','true');
      if (b.dataset.type==='video') showVideo(b.dataset.ref);
      else showImage(b.dataset.src);
    });
  });
  // zoom só vale para imagem (não quando o vídeo está ativo)
  if (mainWrap){
    mainWrap.addEventListener('click', function(e){
      if (videoActive || (mainVideo && mainVideo.contains(e.target))) return;
      mainWrap.classList.toggle('zoomed');
    });
    mainWrap.addEventListener('keydown', function(e){ if(!videoActive && (e.key==='Enter'||e.key===' ')){ e.preventDefault(); mainWrap.classList.toggle('zoomed'); } });
  }
  // cor
  $all('#colorSelector .color-btn').forEach(function(b){
    b.addEventListener('click', function(){
      $all('#colorSelector .color-btn').forEach(function(x){ x.setAttribute('aria-pressed','false'); });
      b.setAttribute('aria-pressed','true'); pdpSel.cor = b.dataset.cor;
    });
  });
  // tamanho
  $all('#sizeSelector .size-btn').forEach(function(b){
    b.addEventListener('click', function(){
      $all('#sizeSelector .size-btn').forEach(function(x){ x.setAttribute('aria-pressed','false'); });
      b.setAttribute('aria-pressed','true'); pdpSel.size = b.dataset.size;
      var hint = $('#sizeHint'); if (hint) hint.textContent='';
    });
  });
  // quantidade
  $all('#qtyStepper button').forEach(function(b){
    b.addEventListener('click', function(){
      var delta = Number(b.dataset.delta);
      pdpSel.qtd = Math.max(1, pdpSel.qtd + delta);
      $('#qtyOut').textContent = pdpSel.qtd;
    });
  });
  // guia de medidas
  var gm = $('#openSizeGuide'); if (gm) gm.addEventListener('click', openSizeModal);

  // CTA do bloco editorial → rola até a seleção de tamanho e destaca
  var editBuy = $('#editorialBuy');
  if (editBuy) editBuy.addEventListener('click', function(){
    var sel = $('#sizeSelector');
    if (sel){
      sel.scrollIntoView({behavior:'smooth',block:'center'});
      sel.classList.add('flash');
      setTimeout(function(){ sel.classList.remove('flash'); }, 1200);
    }
  });

  // adicionar à sacola (com trava anti clique-duplo)
  var addBtn = $('#addToBag');
  if (addBtn){
    addBtn.addEventListener('click', function(){
      if (!pdpSel.size){
        var hint = $('#sizeHint'); if (hint) hint.textContent = 'Selecione um tamanho antes de adicionar.';
        var sel = $('#sizeSelector'); if (sel) sel.scrollIntoView({behavior:'smooth',block:'center'});
        return;
      }
      if (addBtn.disabled) return;
      addBtn.disabled = true;                       // trava clique-duplo
      var id = location.hash.split('/')[2];
      addToCart(id, pdpSel.size, pdpSel.cor || 'Única', pdpSel.qtd);
      updateCartBadge();
      renderCartDrawer();
      openCartDrawer();
      toast('Adicionado à sacola &#9733;'.replace('&#9733;','★'));
      setTimeout(function(){ addBtn.disabled = false; }, 700);
    });
  }

  // esgotado: botão de encomenda pelo WhatsApp (inclui tam/cor se a cliente selecionou)
  var encBtn = $('#encomendarBtn');
  if (encBtn){
    encBtn.addEventListener('click', function(){
      if (encBtn.disabled) return; encBtn.disabled = true;   // trava clique-duplo (senão abre 2 abas do WhatsApp)
      setTimeout(function(){ encBtn.disabled = false; }, 900);
      var id = location.hash.split('/')[2];
      var p = getProduto(id); if (!p) return;
      var cor = pdpSel.cor || (p.cores.length===1 ? p.cores[0].nome : '');
      var a = document.createElement('a');
      a.href = encomendaWaUrl(p.nome, pdpSel.size, cor);
      a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();   // âncora real (mais robusto que window.open em webview antigo)
    });
  }
}

function initCheckout(){
  var payDetail = $('#payDetail');
  function currentFrete(){ var el = document.querySelector('[name="cep"]'); return computeFrete(el?el.value:''); }
  // atualiza linha Frete + Total (frete = display; o valor cobrado é recomputado no servidor)
  function update(){
    var full = cartSubtotal(cart);
    var fr = currentFrete();
    var total = full + (fr.valor||0);
    var fEl = $('#checkoutFrete'); if (fEl) fEl.textContent = freteLabel(fr);
    var ct = $('#checkoutTotal'); if (ct) ct.textContent = formatBRL(total);
    if (!payDetail) return;
    var v = (document.querySelector('input[name="pay"]:checked')||{}).value || 'pix';
    var freteTxt = fr.mode==='wa' ? ' O frete é combinado pelo WhatsApp.'
                 : (fr.valor>0 ? (' Frete '+formatBRL(fr.valor)+' incluído.') : ' Frete grátis para a sua região.');
    payDetail.innerHTML = (v==='pix')
      ? 'Ao confirmar, você vai para o <strong>checkout seguro (Pix)</strong> de '+formatBRL(total)+'.'+freteTxt
      : 'Total <strong>'+formatBRL(total)+'</strong> no cartão, em até 3x no checkout seguro.'+freteTxt;
  }
  $all('input[name="pay"]').forEach(function(r){ r.addEventListener('change', update); });
  var cepEl = document.querySelector('[name="cep"]'); if (cepEl) cepEl.addEventListener('input', update);
  update();

  var form = $('#checkoutForm');
  if (form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      // peça que esgotou depois de entrar na sacola: bloqueia finalizar (a linha da sacola já sinaliza qual)
      if (cart.some(function(it){ var p=getProduto(it.id); return p && p.esgotado; })){
        toast('Há uma peça esgotada na sacola. Remova para finalizar.'); return;
      }
      if (validateCheckout(form)){
        var orderId = String(Math.floor(100000 + Math.random()*900000));
        captureOrder(form, orderId);   // monta a mensagem com o cart AINDA cheio (esvaziamento só após "pagamento aprovado")
        var pay = (form.querySelector('input[name="pay"]:checked')||{}).value || 'pix';
        var full = cartSubtotal(cart);
        var fr = currentFrete();       // display; o n8n recomputa o frete do CEP do pedido (antifraude)
        payState = { orderId:orderId, pay:pay, pixTotal:cartPixTotal(cart), fullTotal:full,
                     frete:fr, total: full + (fr.valor||0), itemCount:cartCount(cart) };
        location.hash = '#/pagamento/'+orderId;   // etapa de pagamento (InfinitePay real) ANTES da confirmação
      }
    });
  }
}
function validateCheckout(form){
  var ok = true;
  var required = ['nome','email','tel','cep','numero','endereco','bairro','cidade'];
  required.forEach(function(name){
    var input = form.querySelector('[name="'+name+'"]');
    var errEl = form.querySelector('[data-err="'+name+'"]');
    var val = (input.value||'').trim();
    var msg = '';
    if (!val) msg = 'Campo obrigatório.';
    else if (name==='email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) msg = 'E-mail inválido.';
    else if (name==='cep' && val.replace(/\D/g,'').length!==8) msg = 'CEP deve ter 8 dígitos.';
    else if (name==='tel' && val.replace(/\D/g,'').length<10) msg = 'Telefone inválido.';
    if (msg){ ok=false; input.classList.add('invalid'); if(errEl) errEl.textContent=msg; }
    else { input.classList.remove('invalid'); if(errEl) errEl.textContent=''; }
  });
  if (!ok){ var first = form.querySelector('.invalid'); if(first) first.focus(); }
  return ok;
}

/* --------------------------------------------------------------------------
   9) CART DRAWER + BADGE
   -------------------------------------------------------------------------- */
function updateCartBadge(){
  var n = cartCount(cart);
  var badge = $('#cartCount');
  badge.textContent = n;
  badge.setAttribute('data-empty', n===0 ? 'true':'false');
  if (n>0){ badge.classList.add('bump'); setTimeout(function(){ badge.classList.remove('bump'); }, 260); }
}
function renderCartDrawer(){
  var body = $('#cartDrawerBody'), foot = $('#cartDrawerFoot');
  if (!cart.length){
    body.innerHTML = '<div class="cart-empty"><div class="empty-mark">&#9733;</div>' +
      '<h3>Sacola vazia</h3><p>Adicione peças para vê-las aqui.</p></div>';
    foot.innerHTML = '<a class="btn btn-light btn-block" href="#/categoria/todos">Explorar peças</a>';
    return;
  }
  body.innerHTML = cart.map(function(it,i){ return cartLineHtml(it,i); }).join('');
  var sub = cartSubtotal(cart);
  foot.innerHTML =
    '<div class="cart-cep"><input type="text" id="cepInput" placeholder="Calcular frete (CEP)" aria-label="CEP para frete" inputmode="numeric">' +
      '<button class="btn btn-light" id="cepBtn">OK</button></div>' +
    '<div class="cart-freight-msg" id="freightMsg">'+esc(freteNote())+'</div>' +
    '<div class="cart-summary-row"><span>Subtotal</span><span class="val">'+formatBRL(sub)+'</span></div>' +
    '<div class="cart-summary-row total"><span>Total</span><span class="val" id="drawerTotal">'+formatBRL(sub)+'</span></div>' +
    '<a class="btn btn-primary btn-block" href="#/checkout" id="goCheckout" style="margin-top:12px">Finalizar compra</a>' +
    '<a class="btn btn-light btn-block" href="#/carrinho" style="margin-top:10px">Ver sacola completa</a>';

  // frete real via computeFrete (fonte única, espelho do n8n); Total só ganha frete com CEP válido calculado
  var cepBtn = $('#cepBtn');
  if (cepBtn) cepBtn.addEventListener('click', function(){
    var el = $('#cepInput'); var digits = String((el&&el.value)||'').replace(/\D/g,'');
    var m = $('#freightMsg'); if (!m) return;
    if (digits.length !== 8){ m.textContent = 'Digite um CEP válido (8 dígitos).'; return; }
    var fr = computeFrete(digits);
    m.textContent = 'Frete: '+freteLabel(fr);
    var tEl = $('#drawerTotal'); if (tEl) tEl.textContent = formatBRL(sub + (fr.valor||0));
  });
}
/* delegação de cliques dentro das cart-lines (drawer e página) */
function handleCartLineClick(e){
  var line = e.target.closest('.cart-line'); if (!line) return;
  var index = Number(line.dataset.index);
  var act = e.target.dataset.act;
  if (!act) return;
  if (act==='inc') updateQty(index, 1);
  else if (act==='dec') updateQty(index, -1);
  else if (act==='remove') removeLine(index);
  updateCartBadge();
  // re-render conforme o contexto
  if (e.target.closest('#cartDrawerBody')) renderCartDrawer();
  else if (location.hash.indexOf('carrinho')>=0) render();
}

/* --------------------------------------------------------------------------
   10) OVERLAYS (drawer, mobile nav, busca, modal)
   -------------------------------------------------------------------------- */
function openCartDrawer(){
  renderCartDrawer();
  $('#cartOverlay').hidden = false; $('#cartDrawer').classList.add('open');
  $('#cartDrawer').setAttribute('aria-hidden','false');
  void $('#cartOverlay').offsetWidth; $('#cartOverlay').classList.add('open');   // reflow (não depende de rAF)
  document.body.classList.add('no-scroll');
}
function closeCartDrawer(){
  $('#cartDrawer').classList.remove('open'); $('#cartOverlay').classList.remove('open');
  $('#cartDrawer').setAttribute('aria-hidden','true');
  setTimeout(function(){ $('#cartOverlay').hidden = true; }, 320);
  document.body.classList.remove('no-scroll');
}
function openMobileNav(){
  var o = $('#mobileNav'); o.hidden = false;
  void o.offsetWidth; o.classList.add('open');   // reflow (não depende de rAF)
  $('#navToggle').setAttribute('aria-expanded','true');
  document.body.classList.add('no-scroll');
}
function closeMobileNav(){
  var o = $('#mobileNav'); o.classList.remove('open');
  $('#navToggle').setAttribute('aria-expanded','false');
  setTimeout(function(){ o.hidden = true; }, 320);
  document.body.classList.remove('no-scroll');
}
function openSizeModal(){
  var m = $('#sizeModal'); m.hidden = false;
  void m.offsetWidth; m.classList.add('open');   // reflow (não depende de rAF)
  document.body.classList.add('no-scroll');
  $('#sizeModalClose').focus();
}
function closeSizeModal(){
  var m = $('#sizeModal'); m.classList.remove('open');
  setTimeout(function(){ m.hidden = true; }, 260);
  document.body.classList.remove('no-scroll');
}
function openSearch(){ $('#searchBar').hidden = false; $('#searchInput').focus(); }
function closeSearch(){ $('#searchBar').hidden = true; }
function closeAllOverlays(){
  // ao navegar, fecha drawers abertos (mas mantém estado do carrinho)
  if ($('#cartDrawer').classList.contains('open')) closeCartDrawer();
  if ($('#mobileNav').classList.contains('open')) closeMobileNav();
}

/* --------------------------------------------------------------------------
   11) EFEITOS: reveal on scroll + acordeões
   -------------------------------------------------------------------------- */
/* balão de novidade/promoção no topo (clicável → produto). Espelha o promo-banner dos cardápios. */
function renderPromo(){
  var host = document.getElementById('promoBanner');
  var prod = (PROMO.ativo && PROMO.produtoId) ? getProduto(PROMO.produtoId) : null;
  if(!prod){ if(host) host.remove(); return; }
  if(!host){
    host = document.createElement('div');
    host.id='promoBanner'; host.className='promo-banner';
    var ref = document.querySelector('.site-header');
    ref.parentNode.insertBefore(host, ref);
  }
  host.innerHTML =
    '<a class="promo-inner" href="#/produto/'+prod.id+'" aria-label="Ver a novidade: '+esc(PROMO.titulo||prod.nome)+'">' +
      '<span class="promo-tag" aria-hidden="true">&#10022;<span>Novidade</span></span>' +
      '<span class="promo-copy"><strong>'+esc(PROMO.titulo||prod.nome)+'</strong>' +
        (PROMO.desc?'<em>'+esc(PROMO.desc)+'</em>':'') + '</span>' +
      '<span class="promo-cta">Ver agora &rarr;</span>' +
    '</a>';
}

function initReveal(){
  var items = $all('.reveal');
  if (!('IntersectionObserver' in window)){ items.forEach(function(i){ i.classList.add('in'); }); return; }
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){ if (en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold:0.12 });
  items.forEach(function(i){ io.observe(i); });
}
function initAccordions(){
  $all('.accordion-trigger').forEach(function(btn){
    btn.addEventListener('click', function(){
      var open = btn.getAttribute('aria-expanded')==='true';
      btn.setAttribute('aria-expanded', open?'false':'true');
      var panel = btn.nextElementSibling;
      panel.style.maxHeight = open ? '0px' : (panel.scrollHeight + 'px');
    });
  });
}

/* --------------------------------------------------------------------------
   12) BOOTSTRAP
   -------------------------------------------------------------------------- */
/* header reage ao scroll: encolhe + ganha profundidade (movimento no cabeçalho) */
function syncHeaderScroll(){
  var h = $('#siteHeader'); if (!h) return;
  if (window.scrollY > 12) h.classList.add('is-scrolled');
  else h.classList.remove('is-scrolled');
}

function bindGlobal(){
  var headerTick = false;
  window.addEventListener('scroll', function(){
    if (headerTick) return;
    headerTick = true;
    requestAnimationFrame(function(){ syncHeaderScroll(); headerTick = false; });
  }, { passive:true });

  $('#cartBtn').addEventListener('click', openCartDrawer);
  $('#cartClose').addEventListener('click', closeCartDrawer);
  $('#cartOverlay').addEventListener('click', closeCartDrawer);
  $('#cartDrawerBody').addEventListener('click', handleCartLineClick);
  document.addEventListener('click', function(e){
    // cliques nas cart-lines da PÁGINA do carrinho (delegação global)
    if (e.target.closest('#app .cart-line')) handleCartLineClick(e);
  });

  $('#navToggle').addEventListener('click', openMobileNav);
  $('#mobileNavClose').addEventListener('click', closeMobileNav);
  $('#mobileNav').addEventListener('click', function(e){ if (e.target===$('#mobileNav')) closeMobileNav(); });
  $all('#mobileNav a').forEach(function(a){ a.addEventListener('click', closeMobileNav); });

  $('#searchBtn').addEventListener('click', openSearch);
  $('#searchClose').addEventListener('click', closeSearch);
  $('#searchInput').addEventListener('keydown', function(e){
    if (e.key==='Enter'){ var q=e.target.value.trim(); closeSearch(); if(q){ location.hash='#/categoria/todos'; setTimeout(function(){ catalogState.busca=q; catalogState.categoria='todos'; renderCatalogResults(); var rc=$('#resultCount'); }, 60); } }
  });

  $('#sizeModalClose').addEventListener('click', closeSizeModal);
  $('#sizeModal').addEventListener('click', function(e){ if (e.target===$('#sizeModal')) closeSizeModal(); });

  document.addEventListener('keydown', function(e){
    if (e.key==='Escape'){ closeCartDrawer(); closeMobileNav(); closeSizeModal(); closeSearch(); }
  });

  $('#newsletterForm').addEventListener('submit', function(e){ e.preventDefault(); e.target.reset(); toast('Pronto! Você entrou na lista da Aura.'); });

  window.addEventListener('hashchange', render);
}

/* aparelho de entrada → alivia efeitos contínuos caros (blur/scroll), sem perder o essencial */
function detectPerf(){
  var coarse = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
  var mobile = coarse || window.innerWidth < 760 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  var low = mobile && ((navigator.hardwareConcurrency||8) <= 4 || (navigator.deviceMemory||8) <= 4);
  if (low) document.body.classList.add('perf-lite');
}

function boot(){
  detectPerf();
  loadStore();          // aplica o que a dona salvou (produtos/categorias/banner/promo)
  normalizeAll();       // modelo novo (galeria/videos/parcela) sem quebrar o seed
  loadCart();
  bindGlobal();
  updateCartBadge();
  renderPromo();
  render();
  // mídia (fotos HQ da dona) vem do IndexedDB: quando pronto, re-renderiza
  openMediaDB().then(function(){ return loadImagesToCache(); }).then(function(){
    if (Object.keys(MEDIA).length){ renderPromo(); render(); }
  });
  // NUVEM: quando configurada, o Firestore vira a fonte da verdade e sincroniza
  // entre aparelhos (onSnapshot). Sem config, isto fica inerte (modo local).
  if (window.Cloud && Cloud.ready){
    Cloud.ready.then(function(){
      if (!Cloud.firestoreEnabled) return;
      Cloud.watchStore(function(store){
        applyStoreData(store); normalizeAll(); saveStoreLocal();
        reconciliarCarrinho();   // catálogo já hidratou: descarta itens de produto deletado
        renderPromo(); render();
        if (window.AdminUI) window.AdminUI.decorate();
      });
    });
  }
}

if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

/* --------------------------------------------------------------------------
   13) EXPOSIÇÃO P/ TESTE (não afeta runtime do site)
   -------------------------------------------------------------------------- */
if (typeof window !== 'undefined'){
  window.__USEAURA = {
    PRODUTOS: PRODUTOS, getProduto: getProduto, formatBRL: formatBRL,
    applyFilters: applyFilters, cartSubtotal: cartSubtotal, cartPixTotal: cartPixTotal,
    cartCount: cartCount,
    addToCart: addToCart, removeLine: removeLine, updateQty: updateQty,
    getCart: function(){ return cart; }, setCart: function(c){ cart=c; }, slugify: slugify,
    pixCrc16: pixCrc16, buildPixPayload: buildPixPayload, pixSanitize: pixSanitize, pixCfg: pixCfg
  };
}
