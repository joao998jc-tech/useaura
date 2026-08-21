/* Harness da INVARIANTE de frete (Opção A "região grátis SEMPRE").
   Prova que as 3 cópias da regra batem no MESMO centavo, incluindo a PRIORIDADE
   ABSOLUTA da região grátis por prefixo sobre o SuperFrete:
     1) front  -> computeFrete + currentFrete (app.js)
     2) n8n A  -> freteCentavos + decisão freteC (nó "Validar e Montar Payload")
     3) n8n B  -> freteCentavos + decisão de soma (nó "Validar Reconciliacao")
   Rodar: node harness-frete.js  (sai 0 = verde; sai 1 = divergência/deadlock).
   Se algum caso falhar: NÃO fazer deploy do JSON (front×n8n divergem OU A×B geram
   amount≠total -> pedido pago preso em 'pendente'). */

// ---- cópia EXATA de computeFrete (front, app.js) ----
function computeFrete(cepRaw, f){
  f = f || {};
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
// ---- cópia EXATA de freteCentavos (n8n, nós A e B) ----
function freteCentavos(fc, cepRaw){
  fc = fc || {}; const vf = Number(fc.valorFora);
  if (!fc.configurado || !(vf >= 0)) return 0;
  const d = String(cepRaw==null?'':cepRaw).replace(/\D/g,'');
  if (d.length !== 8) return Math.round(vf*100);
  const prefs = Array.isArray(fc.gratisPrefixos) ? fc.gratisPrefixos : [];
  for (const pp of prefs){ const p = String(pp==null?'':pp).replace(/\D/g,''); if (p && d.indexOf(p)===0) return 0; }
  return Math.round(vf*100);
}

// ---- decisão do FRONT (currentFrete + valor cobrado em centavos) ----
// sfActive, sfChosenCents (null=não escolheu), sfFallback
function frontCents(cfg, cep, sfActive, sfChosenCents, sfFallback){
  if (sfActive){
    var frReg = computeFrete(cep, cfg);
    if (frReg.mode==='gratis') return { blocked:false, cents:0 };          // prioridade região grátis
    if (sfChosenCents!=null) return { blocked:false, cents:sfChosenCents }; // serviço SF escolhido
    if (sfFallback) return { blocked:false, cents:Math.round((computeFrete(cep,cfg).valor||0)*100) };
    return { blocked:true, cents:null };                                    // sf-pending: gate bloqueia submit
  }
  var fr = computeFrete(cep, cfg);
  return { blocked:false, cents:Math.round((fr.valor||0)*100) };
}
// ---- decisão do nó A (freteC em centavos) ----
function nodeACents(cfg, cep, sfAtivo, freteServico, sfOk, sfCents){
  const _fretePrefixo = freteCentavos(cfg, cep);
  if (_fretePrefixo === 0) return 0;                                        // prioridade região grátis
  if (freteServico && sfAtivo) return sfOk ? (Number(sfCents)||0) : _fretePrefixo;
  return _fretePrefixo;
}
// ---- decisão do nó B (centavos somados ao total autoritativo) ----
// ordersFreteReais = valor gravado por A em orders.frete (R1); usado só no ramo SF
function nodeBCents(cfg, cep, freteServico, ordersFreteReais){
  const _fretePrefixo = freteCentavos(cfg, cep);
  if (_fretePrefixo === 0) return 0;                                        // prioridade região grátis (espelho de A)
  if (freteServico!=null && freteServico!=='') return Math.round((Number(ordersFreteReais)||0)*100);
  return _fretePrefixo;
}

const CFG = { configurado:true, valorFora:15, gratisPrefixos:['18160'],
              superfrete:{ ativo:true } };
const CFG_OFF = { configurado:false, valorFora:null, gratisPrefixos:[] };

let fail = 0;
function check(name, cond, extra){ if(!cond){ fail++; console.log('  FAIL  '+name+(extra?'  -> '+extra:'')); } else console.log('  ok    '+name); }

console.log('== INVARIANTE FRETE (front == nó A == nó B) ==');

// Caso (a) CEP região grátis, SF ativo -> Grátis nos 3, sem cotação, sem bloqueio
(function(){
  const cep='18160000';
  const f = frontCents(CFG, cep, true, null, false);
  const a = nodeACents(CFG, cep, true, false, false, 0);      // sem frete_servico (não cotou): dá igual grátis
  const a2= nodeACents(CFG, cep, true, true, true, 1200);     // mesmo se viesse frete_servico+cotação: prioridade grátis
  const b = nodeBCents(CFG, cep, '18160000-serv', a/100 /*irrelevante*/);
  check('(a) front grátis sem bloqueio', f.blocked===false && f.cents===0, JSON.stringify(f));
  check('(a) nó A grátis (sem SF)', a===0);
  check('(a) nó A grátis (mesmo com frete_servico) - prioridade absoluta', a2===0, 'a2='+a2);
  check('(a) nó B grátis', b===0);
  check('(a) front==A==B', f.cents===a && a===b);
})();

// Caso (b) CEP de fora, SF ativo, serviço escolhido (SEDEX R$12) -> cobra 1200 nos 3
(function(){
  const cep='01001000';
  const f = frontCents(CFG, cep, true, 1200, false);
  const a = nodeACents(CFG, cep, true, true, true, 1200);
  const b = nodeBCents(CFG, cep, '2', a/100);                 // A gravou orders.frete = 12.00
  check('(b) front SEDEX 1200', f.blocked===false && f.cents===1200, JSON.stringify(f));
  check('(b) nó A 1200', a===1200);
  check('(b) nó B 1200 (lê orders.frete)', b===1200, 'b='+b);
  check('(b) front==A==B', f.cents===a && a===b);
})();

// Caso (c) CEP inválido/vazio -> NUNCA grátis por erro (cobra fora)
(function(){
  const cepVazio='';
  const fVazio = frontCents(CFG, cepVazio, true, null, false);
  const aVazio = nodeACents(CFG, cepVazio, true, false, false, 0);
  check('(c) CEP vazio: front NÃO grátis (sf-pending/bloqueia até cotar)', fVazio.blocked===true, JSON.stringify(fVazio));
  check('(c) CEP vazio: nó A cobra fora 1500 (nunca 0)', aVazio===1500, 'a='+aVazio);
  const cepCurto='1816';                                       // prefixo bate mas < 8 dígitos
  const aCurto = nodeACents(CFG, cepCurto, true, false, false, 0);
  check('(c) CEP curto que casa prefixo: ainda cobra fora (len!=8)', aCurto===1500, 'a='+aCurto);
})();

// Caso (d) fallback SF (cotação falhou) -> frete fixo da loja nos 3, sem deadlock
(function(){
  const cep='01001000';
  const f = frontCents(CFG, cep, true, null, true);            // sfFallback=true
  const a = nodeACents(CFG, cep, true, true, false, 0);        // frete_servico presente mas sfOk=false
  const b = nodeBCents(CFG, cep, '2', a/100);                  // A gravou orders.frete = 15.00
  check('(d) front fallback 1500', f.blocked===false && f.cents===1500, JSON.stringify(f));
  check('(d) nó A fallback 1500', a===1500);
  check('(d) nó B 1500 (lê orders.frete gravado)', b===1500, 'b='+b);
  check('(d) front==A==B', f.cents===a && a===b);
})();

// captureOrder (registro do pedido/WhatsApp/orders.frete): MESMA prioridade região grátis.
// Edge que o QA pegou: região grátis + sfChosen setado (cliente clicou "Calcular" e escolheu) ->
// tem de gravar Grátis/frete_servico=null, NÃO o serviço SF.
function captureOrderCents(cfg, cep, sfActive, sfChosenCents){
  const frReg = computeFrete(cep, cfg);
  const fr = (frReg.mode!=='gratis' && sfActive && sfChosenCents!=null)
    ? { mode:'superfrete', cents:sfChosenCents }
    : { mode:frReg.mode, cents:Math.round((frReg.valor||0)*100) };
  return { cents:fr.cents, freteServicoNull: fr.mode!=='superfrete' };
}
(function(){
  const cepG='18160000';
  const co = captureOrderCents(CFG, cepG, true, 1200);   // região grátis MAS escolheu SEDEX
  const chk = frontCents(CFG, cepG, true, 1200, false);  // checkout mostra grátis
  check('(edge) captureOrder região grátis+sfChosen -> Grátis (0)', co.cents===0, 'cents='+co.cents);
  check('(edge) captureOrder frete_servico=null na região grátis', co.freteServicoNull===true);
  check('(edge) captureOrder == checkout (sem divergência registro×cobrança)', co.cents===chk.cents);
  const cepF='01001000';
  const coF = captureOrderCents(CFG, cepF, true, 1200);   // fora + escolheu SEDEX -> SF normal
  check('(edge) captureOrder CEP-fora+sfChosen -> 1200 (SF intacto)', coF.cents===1200 && coF.freteServicoNull===false, 'cents='+coF.cents);
})();

// Extra: frete NÃO configurado -> 0 nos 3 (fallback WhatsApp, nunca cobra por engano)
(function(){
  const cep='01001000';
  const f = frontCents(CFG_OFF, cep, false, null, false);
  const a = nodeACents(CFG_OFF, cep, false, false, false, 0);
  const b = nodeBCents(CFG_OFF, cep, undefined, 0);
  check('(off) front==A==B==0', f.cents===0 && a===0 && b===0, 'f='+f.cents+' a='+a+' b='+b);
})();

console.log(fail? ('\nRESULTADO: '+fail+' FALHA(S) -> NÃO DEPLOYAR') : '\nRESULTADO: VERDE — invariante mantida');
process.exit(fail?1:0);
