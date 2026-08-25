/* ==========================================================================
   USE AURA — ÁREA DA DONA (modo de edição do site)
   MODO DEMONSTRAÇÃO: login em localStorage; produtos/config em localStorage;
   fotos HQ e vídeos em IndexedDB (via app.js). Compartilha o escopo global
   com app.js (PRODUTOS, CATEGORIAS, BANNER, PROMO, render, adminSave*, mídia…).
   ========================================================================== */
'use strict';
(function(){
  var CRED_EMAIL = 'useaura@gmail.com';
  var CRED_SENHA = 'Aura2026';
  var AUTH_KEY   = 'useaura_admin_v1';
  var TAMANHOS_PADRAO = ['P','M','G','GG'];
  var IMG_MAXW = 1600, IMG_QUALITY = 0.9;         // fotos de alta qualidade
  var VIDEO_MAX_MB = 45;                           // limite prático p/ demo

  function isLogged(){ if(window.Cloud && Cloud.authEnabled) return !!Cloud._owner; try{ return localStorage.getItem(AUTH_KEY)==='1'; }catch(e){ return false; } }
  function setLogged(v){ try{ v? localStorage.setItem(AUTH_KEY,'1') : localStorage.removeItem(AUTH_KEY); }catch(e){} }

  function ce(tag, cls, html){ var e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e; }
  function q(s,c){ return (c||document).querySelector(s); }
  function qa(s,c){ return Array.prototype.slice.call((c||document).querySelectorAll(s)); }
  function escAttr(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

  /* ---------- mídia: imagem (reduz p/ HQ) e vídeo (bruto) → IndexedDB ---------- */
  function imgToDataURL(file, cb){
    var reader=new FileReader();
    reader.onload=function(){
      var img=new Image();
      img.onload=function(){
        var scale=Math.min(1, IMG_MAXW/img.width);
        var w=Math.round(img.width*scale), h=Math.round(img.height*scale);
        var c=document.createElement('canvas'); c.width=w; c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);
        try{ cb(c.toDataURL('image/jpeg',IMG_QUALITY)); }catch(e){ cb(reader.result); }
      };
      img.onerror=function(){ cb(reader.result); };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  }
  function fileToDataURL(file, cb){ var r=new FileReader(); r.onload=function(){ cb(r.result); }; r.readAsDataURL(file); }
  function _idbImage(dataUrl){ return new Promise(function(res){ var id=newMediaId('mi'); MEDIA[id]=dataUrl; mediaPutDB(id,dataUrl).then(function(){ res(id); }); }); }
  function _idbVideo(dataUrl){ return new Promise(function(res){ var id=newMediaId('mv'); mediaPutDB(id,dataUrl).then(function(ok){ res(ok?id:null); }); }); }
  // PRODUÇÃO (Cloudinary ligado): sobe e guarda a URL (sincroniza entre aparelhos).
  // Se o upload FALHAR, devolve null e avisa — NÃO cai em id local do IndexedDB, que
  // vazaria pro store sincronizado e quebraria a mídia no outro aparelho (parecer QA).
  // DEMONSTRAÇÃO (sem Cloudinary): usa IndexedDB local, como antes.
  function addImageMedia(dataUrl){
    if(window.Cloud && Cloud.cloudinaryEnabled()) return Cloud.uploadMedia(dataUrl,'image').then(function(url){ if(!url) toast('Não foi possível enviar a foto. Tente de novo.'); return url; });
    return _idbImage(dataUrl);
  }
  function addVideoMedia(dataUrl){
    if(window.Cloud && Cloud.cloudinaryEnabled()) return Cloud.uploadMedia(dataUrl,'video').then(function(url){ if(!url) toast('Não foi possível enviar o vídeo. Tente de novo.'); return url; });
    return _idbVideo(dataUrl);
  }

  /* ====================================================================
     LOGIN (segurar a logo por 3s)
     ==================================================================== */
  function openLogin(){
    if(isLogged()){ enableAdmin(); toast('Você já está no modo dona. ★'); return; }
    if(q('#admLogin')) return;
    var ov = ce('div','adm-overlay','' +
      '<div class="adm-dialog adm-login" role="dialog" aria-modal="true" aria-label="Entrar na área da dona">' +
        '<button class="adm-x" data-adm="close" aria-label="Fechar">&times;</button>' +
        '<div class="adm-login-mark">USE&nbsp;AURA <span>&#9733;</span></div>' +
        '<h2>Área da Dona</h2>' +
        '<p class="adm-login-sub">Entre para gerenciar seu site.</p>' +
        '<label class="adm-field"><span>E-mail</span><input type="email" id="admEmail" autocomplete="username" placeholder="voce@email.com"></label>' +
        '<label class="adm-field"><span>Senha</span><input type="password" id="admPass" autocomplete="current-password" placeholder="Sua senha"></label>' +
        '<div class="adm-login-err" id="admErr"></div>' +
        '<button class="adm-btn adm-btn-primary adm-block" data-adm="do-login">Entrar</button>' +
        '<p class="adm-login-note">Suas mudanças sincronizam na nuvem com segurança.</p>' +
      '</div>');
    ov.id='admLogin';
    document.body.appendChild(ov);
    requestAnimationFrame(function(){ ov.classList.add('open'); });
    q('#admEmail').focus();
    ov.addEventListener('click', function(e){
      var act=e.target.getAttribute&&e.target.getAttribute('data-adm');
      if(e.target===ov || act==='close') closeLogin();
      else if(act==='do-login') tryLogin();
    });
    ov.addEventListener('keydown', function(e){ if(e.key==='Enter') tryLogin(); if(e.key==='Escape') closeLogin(); });
  }
  function closeLogin(){ var ov=q('#admLogin'); if(!ov) return; ov.classList.remove('open'); setTimeout(function(){ ov.remove(); }, 220); }
  function tryLogin(){
    var email=(q('#admEmail').value||'').trim().toLowerCase();
    var pass=(q('#admPass').value||'');
    function fail(){ var err=q('#admErr'); if(err) err.textContent='E-mail ou senha incorretos.'; var p=q('#admPass'); if(p){ p.value=''; p.focus(); } }
    // PRODUÇÃO: login real via Firebase Auth (o onOwnerChange liga o modo dona)
    if(window.Cloud && Cloud.authEnabled){
      Cloud.signIn(email, pass).then(function(){ closeLogin(); toast('Bem-vinda! Modo dona ativado. ★'); }).catch(fail);
      return;
    }
    // DEMONSTRAÇÃO (fallback sem nuvem): credencial client-side
    if(email===CRED_EMAIL && pass===CRED_SENHA){
      setLogged(true); closeLogin(); enableAdmin(); toast('Bem-vinda! Modo dona ativado. ★');
    } else { fail(); }
  }

  /* ====================================================================
     LIGAR / DESLIGAR MODO DONA
     ==================================================================== */
  function enableAdmin(){ document.body.classList.add('admin-mode'); buildBar(); buildTopAdd(); decorate(); }
  function disableAdmin(){
    setLogged(false);
    document.body.classList.remove('admin-mode');
    var bar=q('#admBar'); if(bar) bar.remove();
    var top=q('#admTopAdd'); if(top) top.remove();
    // limpa a editabilidade inline dos elementos ESTÁTICOS (footer/header/sacola/modal);
    // os do #app somem no render() abaixo. Sem isto, o visitante herdaria contenteditable.
    qa('[data-tk]').forEach(function(el){
      el.removeAttribute('contenteditable'); el.removeAttribute('spellcheck');
      el.classList.remove('adm-editable'); el.removeAttribute('title'); el.removeAttribute('data-tk-orig');
    });
    if(typeof render==='function') render();
    toast('Você saiu do modo dona.');
  }
  function buildBar(){
    if(q('#admBar')) return;
    var bar=ce('div','adm-bar','' +
      '<span class="adm-bar-tag">&#9733; Modo Dona</span>' +
      '<div class="adm-bar-actions">' +
        '<button class="adm-btn adm-btn-primary" data-adm="novapeca">+ Peça</button>' +
        '<button class="adm-btn" data-adm="pedidos">&#128230; Pedidos</button>' +
        '<button class="adm-btn" data-adm="promo">Balão novidade</button>' +
        '<button class="adm-btn" data-adm="cats">Categorias</button>' +
        '<button class="adm-btn" data-adm="banner">Banner</button>' +
        '<button class="adm-btn" data-adm="frete">&#128230; Frete</button>' +
        '<button class="adm-btn" data-adm="integracao">&#128666; Integração</button>' +
        '<button class="adm-btn" data-adm="avisos">&#128276; Avisos de venda</button>' +
        '<button class="adm-btn" data-adm="avisos-email">&#9993; Avisos por e-mail</button>' +
        '<button class="adm-btn adm-btn-ghost" data-adm="reset">Restaurar</button>' +
        '<button class="adm-btn adm-btn-ghost" data-adm="logout">Sair</button>' +
      '</div>' +
      '<span class="adm-bar-note">Salvo na nuvem com segurança</span>');
    bar.id='admBar';
    document.body.appendChild(bar);
    bar.addEventListener('click', function(e){
      var act=e.target.getAttribute&&e.target.getAttribute('data-adm');
      if(act==='logout'){ if(window.Cloud && Cloud.authEnabled) Cloud.signOut().catch(function(){ disableAdmin(); }); else disableAdmin(); }
      else if(act==='novapeca') openProduto(null);
      else if(act==='pedidos') openPedidos();
      else if(act==='promo') openPromo();
      else if(act==='cats') openCategorias();
      else if(act==='banner') openBanner();
      else if(act==='frete') openFrete();
      else if(act==='integracao') openIntegracao();
      else if(act==='avisos') openAvisos();
      else if(act==='avisos-email') openAvisosEmail();
      else if(act==='reset') doReset();
    });
  }
  function buildTopAdd(){
    if(q('#admTopAdd')) return;
    var b=ce('button','adm-topadd','<span>+</span> Nova peça'); b.id='admTopAdd'; b.type='button';
    b.addEventListener('click', function(){ openProduto(null); });
    document.body.appendChild(b);
  }
  function doReset(){
    openConfirm('Restaurar o site para o conteúdo original? Tudo que você adicionou ou editou será apagado.', function(){
      adminResetStore(); location.reload();
    });
  }

  /* ====================================================================
     DECORAÇÃO por render
     ==================================================================== */
  function decorate(view){
    if(!isLogged()) return;
    document.body.classList.add('admin-mode');
    qa('.product-grid').forEach(function(grid){
      if(!q('.adm-addcard', grid)){
        var add=ce('button','adm-addcard','<span class="adm-plus">+</span><span>Adicionar peça</span>'); add.type='button';
        add.addEventListener('click', function(){ openProduto(null); });
        grid.appendChild(add);
      }
      qa('.product-card', grid).forEach(addCardControls);
    });
    var hero=q('#heroBanner');
    if(hero && !q('.adm-hero-tools', hero)){
      var tools=ce('div','adm-hero-tools','' +
        '<button class="adm-hero-btn" data-adm="banner">&#9998; Editar banner</button>' +
        '<button class="adm-hero-btn" data-adm="mover">&#10021; Mover</button>');
      hero.appendChild(tools);
      tools.addEventListener('click', function(e){
        e.preventDefault(); var act=e.target.getAttribute('data-adm');
        if(act==='banner') openBanner(); else if(act==='mover') enterReposition();
      });
    }
    var strip=q('.cat-strip-track');
    if(strip && !q('.adm-addcat', strip)){
      var ac=ce('button','adm-addcat cat-chip','<span class="cat-chip-thumb">+</span><span>Categoria</span>'); ac.type='button';
      ac.addEventListener('click', function(){ openCategorias(); });
      strip.appendChild(ac);
    }
    // TEXTOS INLINE: todo [data-tk] (títulos, subtítulos, rótulos, footer, sacola…)
    // vira editável clicando. Os handlers são delegados (bind único em init), gated
    // por admin-mode → aqui só ligamos contenteditable + a marca visual.
    qa('[data-tk]').forEach(function(el){
      el.setAttribute('contenteditable','true');
      el.setAttribute('spellcheck','false');
      if(!el.classList.contains('adm-editable')){ el.classList.add('adm-editable'); el.setAttribute('title','Clique para editar este texto'); }
    });

    // página institucional → botão "Editar este texto"
    var pageArt=q('.pagina');
    if(pageArt && !q('.adm-page-edit', pageArt)){
      var slug=(location.hash.split('/pagina/')[1]||'').split('/')[0];
      if(slug && PAGINAS[slug]){
        var eb=ce('button','adm-page-edit','&#9998; Editar este texto'); eb.type='button';
        eb.addEventListener('click', function(){ openPagina(slug); });
        pageArt.insertBefore(eb, q('.pagina-body', pageArt));
      }
    }
  }
  function addCardControls(card){
    if(q('.adm-ctl', card)) return;
    var id=(card.getAttribute('href')||'').split('/produto/')[1];
    if(!id) return;
    var ctl=ce('div','adm-ctl','' +
      '<button class="adm-ic" data-adm="edit" title="Editar" aria-label="Editar peça">&#9998;</button>' +
      '<button class="adm-ic adm-ic-del" data-adm="del" title="Excluir" aria-label="Excluir peça">&#128465;</button>');
    ctl.addEventListener('click', function(e){
      e.preventDefault(); e.stopPropagation();
      var act=e.target.getAttribute('data-adm');
      if(act==='edit') openProduto(id); else if(act==='del') delProduto(id);
    });
    card.appendChild(ctl);
  }
  function delProduto(id){
    var p=getProduto(id); if(!p) return;
    openConfirm('Excluir a peça "'+p.nome+'"?', function(){ adminRemoveProduto(id); render(); toast('Peça excluída.'); });
  }

  /* ====================================================================
     FORM DE PRODUTO (múltiplas fotos, vídeos, cores; novidade; parcela)
     ==================================================================== */
  var pf = null;   // estado de edição em curso
  function openProduto(id){
    var edit = id ? getProduto(id) : null;
    pf = {
      galeria:  edit ? (edit.galeria||[]).slice() : [],
      videos:   edit ? (edit.videos||[]).slice()  : [],
      cores:    edit ? edit.cores.map(function(c){return {nome:c.nome,hex:c.hex};}) : [{nome:'',hex:'#4A3323'}],
      tamanhos: edit ? (edit.tamanhos||[]).slice() : TAMANHOS_PADRAO.slice()   // livre/editável (espelha cores)
    };
    var isNov = edit && (edit.badges||[]).some(function(b){return b.toLowerCase()==='novidade';});
    var isBest= edit && (edit.badges||[]).some(function(b){return b.toLowerCase()==='best-seller';});
    var parcela = edit ? edit.parcela!==false : true;
    var esgotado = !!(edit && edit.esgotado);

    var catOpts = CATEGORIAS.map(function(c){ return '<option value="'+escAttr(c)+'"'+(edit&&edit.categoria===c?' selected':'')+'>'+escAttr(c)+'</option>'; }).join('')
      + '<option value="__nova">+ Nova categoria…</option>';

    openModal((edit?'Editar peça':'Nova peça'), '' +
      '<label class="adm-field"><span>Nome da peça *</span><input id="pf_nome" type="text" value="'+escAttr(edit?edit.nome:'')+'" placeholder="Ex: Vestido Midi Fenda"></label>' +
      '<div class="adm-row">' +
        '<label class="adm-field"><span>Categoria *</span><select id="pf_cat">'+catOpts+'</select></label>' +
        '<label class="adm-field adm-newcat" id="pf_newcatWrap" style="display:none"><span>Nome da nova categoria</span><input id="pf_newcat" type="text" placeholder="Ex: Saias"></label>' +
      '</div>' +
      '<div class="adm-toggles">' +
        '<label class="adm-toggle"><input type="checkbox" id="pf_nov"'+(isNov?' checked':'')+'> &#9733; Novidade da semana</label>' +
        '<label class="adm-toggle"><input type="checkbox" id="pf_best"'+(isBest?' checked':'')+'> Best-seller</label>' +
        '<label class="adm-toggle"><input type="checkbox" id="pf_parc"'+(parcela?' checked':'')+'> Parcela em até 3x</label>' +
        '<label class="adm-toggle"><input type="checkbox" id="pf_esgotado"'+(esgotado?' checked':'')+'> &#9888; Esgotado</label>' +
      '</div>' +
      '<label class="adm-field"><span>Preço (R$) *</span><input id="pf_preco" type="number" min="0" step="0.01" value="'+(edit?edit.preco:'')+'" placeholder="99.90"></label>' +
      '<div class="adm-field"><span>Tamanhos <small class="adm-hint" style="display:inline">— livres: P, M, 38, Único…</small></span><div id="pf_tamanhos"></div></div>' +
      '<div class="adm-field"><span>Cores</span><div id="pf_cores"></div></div>' +
      '<label class="adm-field"><span>Descrição</span><textarea id="pf_desc" rows="3" placeholder="Fale sobre a peça...">'+escAttr(edit?edit.descricao:'')+'</textarea></label>' +
      '<label class="adm-field"><span>Composição / tecido</span><input id="pf_compo" type="text" value="'+escAttr(edit?edit.composicao:'')+'" placeholder="Ex: 95% viscose, 5% elastano"></label>' +
      '<div class="adm-field"><span>Frete <small class="adm-hint" style="display:inline">&mdash; peso e dimensões (opcional; vazio usa o padrão da categoria)</small></span>' +
        '<div class="adm-row sf-prodfrete">' +
          '<input id="pf_fw" type="number" min="0" step="0.01" value="'+escAttr(edit&&edit.frete?edit.frete.weight:'')+'" placeholder="peso kg" aria-label="Peso em kg">' +
          '<input id="pf_fh" type="number" min="0" step="1" value="'+escAttr(edit&&edit.frete?edit.frete.height:'')+'" placeholder="alt cm" aria-label="Altura em cm">' +
          '<input id="pf_fwd" type="number" min="0" step="1" value="'+escAttr(edit&&edit.frete?edit.frete.width:'')+'" placeholder="larg cm" aria-label="Largura em cm">' +
          '<input id="pf_fl" type="number" min="0" step="1" value="'+escAttr(edit&&edit.frete?edit.frete.length:'')+'" placeholder="comp cm" aria-label="Comprimento em cm">' +
        '</div></div>' +
      '<div class="adm-field"><span>Fotos (quantas quiser · alta qualidade)</span><div class="adm-media-grid" id="pf_fotos"></div><input type="file" accept="image/*" multiple id="pf_fileFoto" class="adm-file"></div>' +
      '<div class="adm-field"><span>Vídeos do produto (opcional)</span><div class="adm-media-grid" id="pf_videos"></div><input type="file" accept="video/*" id="pf_fileVideo" class="adm-file"></div>',
      [
        edit ? {label:'Excluir', cls:'adm-btn-del', act:function(){ closeModal(); delProduto(id); }} : null,
        {label:'Salvar peça', cls:'adm-btn-primary', act:function(){ saveProduto(edit); }}
      ].filter(Boolean)
    );

    var catSel=q('#pf_cat'), newWrap=q('#pf_newcatWrap');
    catSel.addEventListener('change', function(){ newWrap.style.display = catSel.value==='__nova'?'block':'none'; });

    renderTamanhos(); renderCores(); renderFotos(); renderVideos();
    q('#pf_fileFoto').addEventListener('change', onAddFotos);
    q('#pf_fileVideo').addEventListener('change', onAddVideo);
  }

  /* tamanhos LIVRES — espelha renderCores (reusa as classes .adm-cor-* = zero CSS novo) */
  function renderTamanhos(){
    var box=q('#pf_tamanhos'); if(!box) return;
    box.innerHTML = pf.tamanhos.map(function(t,i){
      return '<div class="adm-cor-row adm-tam-row" data-i="'+i+'">' +
        '<input type="text" class="adm-cor-nome adm-tam-nome" value="'+escAttr(t)+'" placeholder="Ex: P, M, 38, Único">' +
        (pf.tamanhos.length>1?'<button type="button" class="adm-ic adm-ic-del adm-tam-del" aria-label="Remover tamanho">&times;</button>':'') +
      '</div>';
    }).join('') + '<button type="button" class="adm-linkbtn" id="pf_addTam">+ adicionar tamanho</button>';
    qa('.adm-tam-row', box).forEach(function(row){
      var i=+row.getAttribute('data-i');
      row.querySelector('.adm-tam-nome').addEventListener('input', function(e){ pf.tamanhos[i]=e.target.value; });
      var del=row.querySelector('.adm-tam-del'); if(del) del.addEventListener('click', function(){ pf.tamanhos.splice(i,1); renderTamanhos(); });
    });
    q('#pf_addTam').addEventListener('click', function(){ pf.tamanhos.push(''); renderTamanhos(); });
  }

  function renderCores(){
    var box=q('#pf_cores'); if(!box) return;
    box.innerHTML = pf.cores.map(function(c,i){
      return '<div class="adm-cor-row" data-i="'+i+'">' +
        '<input type="color" class="adm-cor-hex" value="'+escAttr(c.hex||'#4A3323')+'">' +
        '<input type="text" class="adm-cor-nome" value="'+escAttr(c.nome)+'" placeholder="Nome da cor (ex: Preto)">' +
        (pf.cores.length>1?'<button type="button" class="adm-ic adm-ic-del adm-cor-del" aria-label="Remover cor">&times;</button>':'') +
      '</div>';
    }).join('') + '<button type="button" class="adm-linkbtn" id="pf_addCor">+ adicionar cor</button>';
    qa('.adm-cor-row', box).forEach(function(row){
      var i=+row.getAttribute('data-i');
      row.querySelector('.adm-cor-hex').addEventListener('input', function(e){ pf.cores[i].hex=e.target.value; });
      row.querySelector('.adm-cor-nome').addEventListener('input', function(e){ pf.cores[i].nome=e.target.value; });
      var del=row.querySelector('.adm-cor-del'); if(del) del.addEventListener('click', function(){ pf.cores.splice(i,1); renderCores(); });
    });
    q('#pf_addCor').addEventListener('click', function(){ pf.cores.push({nome:'',hex:'#4A3323'}); renderCores(); });
  }
  function renderFotos(){
    var box=q('#pf_fotos'); if(!box) return;
    var html = pf.galeria.map(function(ref,i){
      return '<div class="adm-media-item'+(i===0?' is-cover':'')+'">' +
        '<img src="'+mediaSrc(ref)+'" alt="">' +
        (i===0?'<span class="adm-cover-tag">Capa</span>':'<button type="button" class="adm-media-cover" data-i="'+i+'" title="Tornar capa">&#9733;</button>') +
        '<button type="button" class="adm-media-del" data-i="'+i+'" aria-label="Remover foto">&times;</button>' +
      '</div>';
    }).join('');
    box.innerHTML = html + '<button type="button" class="adm-media-add" id="pf_addFoto"><span>+</span>Foto</button>';
    qa('.adm-media-del', box).forEach(function(b){ b.addEventListener('click', function(){ pf.galeria.splice(+b.getAttribute('data-i'),1); renderFotos(); }); });
    qa('.adm-media-cover', box).forEach(function(b){ b.addEventListener('click', function(){ var i=+b.getAttribute('data-i'); var r=pf.galeria.splice(i,1)[0]; pf.galeria.unshift(r); renderFotos(); }); });
    q('#pf_addFoto').addEventListener('click', function(){ q('#pf_fileFoto').click(); });
  }
  function renderVideos(){
    var box=q('#pf_videos'); if(!box) return;
    box.innerHTML = pf.videos.map(function(ref,i){
      return '<div class="adm-media-item adm-media-vid"><span class="adm-vid-ic">&#9658;</span>' +
        '<button type="button" class="adm-media-del" data-i="'+i+'" aria-label="Remover vídeo">&times;</button></div>';
    }).join('') + '<button type="button" class="adm-media-add" id="pf_addVideo"><span>+</span>Vídeo</button>';
    qa('.adm-media-del', box).forEach(function(b){ b.addEventListener('click', function(){ pf.videos.splice(+b.getAttribute('data-i'),1); renderVideos(); }); });
    q('#pf_addVideo').addEventListener('click', function(){ q('#pf_fileVideo').click(); });
  }
  function onAddFotos(e){
    var files=Array.prototype.slice.call(e.target.files||[]); if(!files.length) return;
    var pend=files.length;
    files.forEach(function(f){
      imgToDataURL(f, function(data){ addImageMedia(data).then(function(id){ if(id) pf.galeria.push(id); pend--; if(pend<=0){ renderFotos(); } }); });
    });
    e.target.value='';
    toast('Processando foto(s)…');
  }
  function onAddVideo(e){
    var f=e.target.files&&e.target.files[0]; e.target.value=''; if(!f) return;
    if(f.size > VIDEO_MAX_MB*1024*1024){ toast('Vídeo muito grande (máx. '+VIDEO_MAX_MB+'MB). Use um clipe curto.'); return; }
    toast('Processando vídeo…');
    fileToDataURL(f, function(data){ addVideoMedia(data).then(function(id){ if(id){ pf.videos.push(id); renderVideos(); toast('Vídeo adicionado. ★'); } else toast('Não foi possível salvar o vídeo.'); }); });
  }
  function uniqueId(base){ base=base||('peca-'+Date.now().toString(36)); var id=base,n=2; while(getProduto(id)){ id=base+'-'+n; n++; } return id; }
  function saveProduto(edit){
    var nome=(q('#pf_nome').value||'').trim();
    if(!nome){ toast('Dê um nome para a peça.'); q('#pf_nome').focus(); return; }
    var preco=parseFloat(q('#pf_preco').value);
    if(!(preco>0)){ toast('Informe um preço válido.'); q('#pf_preco').focus(); return; }
    var cat=q('#pf_cat').value;
    if(cat==='__nova'){ cat=(q('#pf_newcat').value||'').trim(); if(!cat){ toast('Dê um nome para a nova categoria.'); q('#pf_newcat').focus(); return; } }
    var tamanhos=pf.tamanhos.map(function(t){return String(t||'').trim();}).filter(Boolean); if(!tamanhos.length) tamanhos=['Único'];
    var cores=pf.cores.map(function(c){ return {nome:(c.nome||'').trim()||'Única', hex:c.hex||'#4A3323'}; });
    if(!cores.length) cores=[{nome:'Única',hex:'#4A3323'}];
    var badges=[]; if(q('#pf_nov').checked) badges.push('Novidade'); if(q('#pf_best').checked) badges.push('Best-seller');
    var galeria = pf.galeria.length ? pf.galeria.slice() : [FALLBACK];

    var p = {
      id: edit ? edit.id : uniqueId(slugify(nome)),
      real: pf.galeria.length>0,
      nome: nome, categoria: cat, preco: preco, precoPix: pixOf(preco),
      parcela: q('#pf_parc').checked,
      esgotado: q('#pf_esgotado').checked,
      cores: cores, tamanhos: tamanhos,
      composicao: (q('#pf_compo').value||'').trim()||'Composição a informar.',
      descricao: (q('#pf_desc').value||'').trim()||'Peça da coleção USE AURA.',
      badges: badges,
      galeria: galeria, videos: pf.videos.slice()
    };
    // Frete opcional: só define p.frete se ALGUM dos 4 campos veio preenchido
    // (vazio → sem chave → cai no padrão da categoria; não migra os produtos antigos).
    var fw=parseFloat(q('#pf_fw').value), fh=parseFloat(q('#pf_fh').value), fwd=parseFloat(q('#pf_fwd').value), fl=parseFloat(q('#pf_fl').value);
    if([fw,fh,fwd,fl].some(function(n){ return !isNaN(n); })){
      p.frete = { weight:fw>=0?fw:0, height:fh>=0?fh:0, width:fwd>=0?fwd:0, length:fl>=0?fl:0 };
    }
    normalizeProduto(p);
    if(adminSaveProduto(p)===false) return;
    closeModal(); render(); toast(edit?'Peça atualizada. ★':'Peça adicionada. ★');
  }

  /* ====================================================================
     CATEGORIAS
     ==================================================================== */
  function openCategorias(){
    function rows(){
      return CATEGORIAS.map(function(c){
        var n=PRODUTOS.filter(function(p){return p.categoria===c;}).length;
        return '<li class="adm-catrow"><span>'+escAttr(c)+' <em>('+n+')</em></span>' +
          '<button class="adm-ic adm-ic-del" data-del="'+escAttr(c)+'" aria-label="Excluir categoria">&#128465;</button></li>';
      }).join('') || '<li class="adm-empty">Nenhuma categoria ainda.</li>';
    }
    openModal('Categorias', '<ul class="adm-catlist" id="admCatList">'+rows()+'</ul>' +
      '<div class="adm-row adm-addrow"><input id="admNewCat" type="text" placeholder="Nome da nova categoria">' +
      '<button class="adm-btn adm-btn-primary" id="admAddCat">Adicionar</button></div>', []);
    var list=q('#admCatList');
    list.addEventListener('click', function(e){
      var del=e.target.getAttribute&&e.target.getAttribute('data-del'); if(!del) return;
      var n=PRODUTOS.filter(function(p){return p.categoria===del;}).length;
      var msg=n>0?('A categoria "'+del+'" tem '+n+' peça(s). Elas continuam no site, sem essa categoria. Excluir?'):('Excluir a categoria "'+del+'"?');
      openConfirm(msg, function(){ adminRemoveCategoria(del); list.innerHTML=rows(); render(); toast('Categoria excluída.'); });
    });
    q('#admAddCat').addEventListener('click', function(){
      var inp=q('#admNewCat'), v=(inp.value||'').trim();
      if(adminAddCategoria(v)){ inp.value=''; list.innerHTML=rows(); render(); toast('Categoria adicionada. ★'); }
      else toast('Categoria inválida ou já existe.');
    });
  }

  /* ====================================================================
     BALÃO DE NOVIDADE (promo no topo)
     ==================================================================== */
  function openPromo(){
    var opts='<option value="">— escolha uma peça —</option>' + PRODUTOS.map(function(p){
      return '<option value="'+escAttr(p.id)+'"'+(PROMO.produtoId===p.id?' selected':'')+'>'+escAttr(p.nome)+'</option>';
    }).join('');
    openModal('Balão de novidade', '' +
      '<label class="adm-toggle adm-toggle-big"><input type="checkbox" id="promo_on"'+(PROMO.ativo?' checked':'')+'> Mostrar o balão no topo do site</label>' +
      '<label class="adm-field"><span>Peça em destaque (o balão leva até ela)</span><select id="promo_prod">'+opts+'</select></label>' +
      '<label class="adm-field"><span>Título do balão</span><input id="promo_titulo" type="text" value="'+escAttr(PROMO.titulo)+'" placeholder="Ex: Novidade da semana"></label>' +
      '<label class="adm-field"><span>Descrição curta</span><input id="promo_desc" type="text" value="'+escAttr(PROMO.desc)+'" placeholder="Ex: Chegou peça nova!"></label>',
      [{label:'Salvar balão', cls:'adm-btn-primary', act:savePromo}]);
  }
  function savePromo(){
    var on=q('#promo_on').checked, prod=q('#promo_prod').value;
    if(on && !prod){ toast('Escolha a peça em destaque.'); return; }
    adminSavePromo({ ativo:on, produtoId:prod, titulo:(q('#promo_titulo').value||'').trim()||'Novidade', desc:(q('#promo_desc').value||'').trim() });
    closeModal(); renderPromo(); toast(on?'Balão publicado no topo. ★':'Balão desativado.');
  }

  /* ====================================================================
     FRETE (grátis na região por prefixo de CEP + valor fixo pra fora)
     Persistido em config/store (sync tempo real). O n8n recomputa o frete
     do CEP do pedido pela MESMA regra — o browser nunca dita o valor cobrado.
     ==================================================================== */
  function openFrete(){
    var on = !!FRETE.configurado;
    var valor = (FRETE.valorFora!=null) ? FRETE.valorFora : '';
    var prefs = (FRETE.gratisPrefixos||[]).join(', ');
    openModal('Frete', '' +
      '<label class="adm-toggle adm-toggle-big"><input type="checkbox" id="frete_on"'+(on?' checked':'')+'> Cobrar o frete no checkout</label>' +
      '<p class="adm-hint">Desligado: o frete aparece como &ldquo;a combinar pelo WhatsApp&rdquo; e nada é somado ao total.</p>' +
      '<label class="adm-field"><span>Valor do frete pra FORA da região (R$)</span><input id="frete_valor" type="number" min="0" step="0.01" value="'+escAttr(valor)+'" placeholder="Ex: 25.00"></label>' +
      '<label class="adm-field"><span>CEPs com frete GRÁTIS (sua região)</span><textarea id="frete_prefs" rows="3" placeholder="Ex: 18190, 18195">'+escAttr(prefs)+'</textarea>' +
        '<small class="adm-hint">Digite os INÍCIOS de CEP da sua região, separados por vírgula. Ex: <b>18190</b> cobre todo CEP que começa com 18190 (Sarapuí-SP). Vazio = todo mundo paga o valor de fora.</small></label>',
      [{label:'Salvar frete', cls:'adm-btn-primary', act:saveFrete}]);
  }
  function saveFrete(){
    var on = q('#frete_on').checked;
    var valor = parseFloat(String(q('#frete_valor').value||'').replace(',','.'));
    if(valor>=0) valor = Math.round(valor*100)/100;   // quantiza a centavos (evita 25.999 divergir front×n8n)
    var prefs = String(q('#frete_prefs').value||'').split(/[^0-9]+/)
      .map(function(s){ return s.trim(); }).filter(function(s){ return s.length>=2 && s.length<=8; });
    if(on && !(valor>=0)){ toast('Informe o valor do frete pra fora da região.'); return; }
    adminSaveFrete({ configurado:on, valorFora: on ? valor : null, gratisPrefixos: prefs });
    closeModal();
    if(location.hash.indexOf('checkout')>=0 || location.hash.indexOf('carrinho')>=0) render();
    toast(on ? 'Frete configurado. ★' : 'Frete desativado (a combinar).');
  }

  /* ====================================================================
     INTEGRAÇÃO SuperFrete (frete real self-service) — wizard em um modal.
     O TOKEN e o REMETENTE (PII da dona) nunca ficam no config/store: vão
     autenticados (idToken) ao n8n, que grava no cofre server-side (secrets/
     superfrete). Aqui só persistimos FLAGS/config não-secretos (tokenConfigurado,
     remetenteConfigurado, ativo, dimensões) via adminSaveFrete.
     ==================================================================== */
  // Durante testes internos o token vem de sandbox.superfrete.com; a dona usa superfrete.com.
  // Este link é o SITE que a dona abre para se cadastrar e pegar o código — não é o endpoint
  // de cotação/salvamento (esses vêm de USEAURA_CONFIG.superfrete: cotarUrl/salvarTokenUrl, n8n).
  var SF_SITE = 'https://superfrete.com';
  function openIntegracao(){
    var cfg = (window.USEAURA_CONFIG && window.USEAURA_CONFIG.superfrete) || {};
    if(!FRETE.superfrete) FRETE.superfrete = { ativo:false, tokenConfigurado:false, remetenteConfigurado:false, categorias:{} };
    // PII da dona vive no cofre (secrets/superfrete), nunca em config/store público
    // (LGPD). Por isso os campos de remetente NÃO são pré-preenchidos: começam vazios
    // (o cofre é write-only pelo browser); só o FLAG remetenteConfigurado é público.
    var sf = FRETE.superfrete, rem = {}, cats = sf.categorias||{};
    var pkg0 = (typeof sfDefaultPkg==='function') ? sfDefaultPkg() : { weight:0.3, height:4, width:12, length:17 };
    function rv(v){ return escAttr(v==null?'':v); }

    var dimsHtml = CATEGORIAS.map(function(c,i){
      var d = cats[c] || {};
      return '<div class="sf-dimrow"><span class="sf-dimcat">'+escAttr(c)+'</span>' +
        '<input type="number" min="0" step="0.01" id="sfd_w_'+i+'" value="'+rv(d.weight!=null?d.weight:pkg0.weight)+'" placeholder="peso kg" aria-label="Peso (kg) de '+escAttr(c)+'">' +
        '<input type="number" min="0" step="1" id="sfd_h_'+i+'" value="'+rv(d.height!=null?d.height:pkg0.height)+'" placeholder="alt cm" aria-label="Altura (cm) de '+escAttr(c)+'">' +
        '<input type="number" min="0" step="1" id="sfd_wd_'+i+'" value="'+rv(d.width!=null?d.width:pkg0.width)+'" placeholder="larg cm" aria-label="Largura (cm) de '+escAttr(c)+'">' +
        '<input type="number" min="0" step="1" id="sfd_ln_'+i+'" value="'+rv(d.length!=null?d.length:pkg0.length)+'" placeholder="comp cm" aria-label="Comprimento (cm) de '+escAttr(c)+'">' +
      '</div>';
    }).join('') || '<p class="adm-hint">Crie categorias primeiro para definir dimensões por tipo de peça.</p>';

    // Onboarding GUIADO passo-a-passo (linguagem de leiga). 7 telas, uma por vez:
    // (0) abertura · (1) criar conta · (2) código de conexão · (3) remetente ·
    // (4) peso das peças · (5) teste · (6) ativar. A barra conta 6 passos (a
    // abertura não numera). Cada "Próximo" só avança quando o passo está ok.
    openModal('Frete automático', '' +
      '<div class="sf-wiz-bar" id="sfWizBar"><div class="sf-wiz-track"><div class="sf-wiz-fill" id="sfWizFill"></div></div><span class="sf-wiz-label" id="sfWizLabel">Passo 1 de 6</span></div>' +

      '<div class="sf-wstep is-active">' +
        '<h3>Ative o frete automático da sua loja</h3>' +
        '<p class="adm-hint">Leva uns 5 minutos e é grátis. Você vai criar uma conta na SuperFrete (uma transportadora online) e conectar aqui. Seus clientes passam a ver o valor real do frete pelo CEP.</p>' +
      '</div>' +

      '<div class="sf-wstep">' +
        '<h3>Crie sua conta</h3>' +
        '<p class="adm-hint">Clique no botão, cadastre-se como <b>Pessoa Física</b> (é grátis) e volte aqui.</p>' +
        '<a class="adm-linkbtn" href="'+escAttr(SF_SITE)+'" target="_blank" rel="noopener">Abrir site da SuperFrete &#8599;</a>' +
      '</div>' +

      '<div class="sf-wstep">' +
        '<h3>Pegue seu código de conexão</h3>' +
        '<p class="adm-hint">É um código que liga sua loja à transportadora. Para pegar o seu:</p>' +
        '<ol class="sf-steps-num">' +
          '<li>No site da SuperFrete, entre em <b>Integrações</b>.</li>' +
          '<li>Escolha <b>API</b>.</li>' +
          '<li>Preencha os dados da sua loja.</li>' +
          '<li>Clique em <b>Criar token</b>.</li>' +
          '<li>Copie o código que aparecer e cole abaixo.</li>' +
        '</ol>' +
        '<label class="adm-field"><span>Código de conexão</span><input type="password" id="sfToken" autocomplete="off" placeholder="Cole aqui o código"></label>' +
        '<button type="button" class="adm-btn adm-btn-primary" id="sfValidar">Validar código</button>' +
        '<p class="sf-flag'+(sf.tokenConfigurado?' sf-ok':'')+'" id="sfTokenMsg">'+(sf.tokenConfigurado?'Código validado! &#10003;':'')+'</p>' +
      '</div>' +

      '<div class="sf-wstep">' +
        '<h3>Quem envia os pedidos</h3>' +
        '<p class="adm-hint">Esses dados vão na etiqueta de envio e ficam guardados com segurança (não aparecem no site).</p>' +
        '<div class="adm-row"><label class="adm-field"><span>Nome</span><input type="text" id="sfr_nome" value="'+rv(rem.nome)+'"></label>' +
        '<label class="adm-field"><span>CPF</span><input type="text" id="sfr_cpf" inputmode="numeric" value="'+rv(rem.cpf)+'" placeholder="Só números"></label></div>' +
        '<div class="adm-row"><label class="adm-field"><span>CEP de origem</span><input type="text" id="sfr_cep" inputmode="numeric" value="'+rv(rem.cep||'18160000')+'" placeholder="18160000"></label>' +
        '<label class="adm-field"><span>Cidade</span><input type="text" id="sfr_cidade" value="'+rv(rem.cidade||'Sarapuí')+'"></label></div>' +
        '<div class="adm-row"><label class="adm-field"><span>Endereço</span><input type="text" id="sfr_end" value="'+rv(rem.endereco)+'"></label>' +
        '<label class="adm-field"><span>Número</span><input type="text" id="sfr_num" value="'+rv(rem.numero)+'"></label></div>' +
        '<div class="adm-row"><label class="adm-field"><span>Bairro</span><input type="text" id="sfr_bairro" value="'+rv(rem.bairro)+'"></label>' +
        '<label class="adm-field"><span>UF (sigla do estado)</span><input type="text" id="sfr_uf" value="'+rv(rem.uf||'SP')+'" maxlength="2" placeholder="SP"></label></div>' +
        '<label class="adm-field"><span>Complemento</span><input type="text" id="sfr_comp" value="'+rv(rem.complemento)+'"></label>' +
        '<p class="sf-flag'+(sf.remetenteConfigurado?' sf-ok':'')+'" id="sfRemMsg">'+(sf.remetenteConfigurado?'Dados de envio salvos &#10003;':'')+'</p>' +
      '</div>' +

      '<div class="sf-wstep">' +
        '<h3>Peso das suas peças</h3>' +
        '<p class="adm-hint">Já deixamos um padrão. Ajuste só se quiser. (peso em kg; altura, largura e comprimento em cm)</p>' +
        '<div class="sf-dims">'+dimsHtml+'</div>' +
      '</div>' +

      '<div class="sf-wstep">' +
        '<h3>Teste</h3>' +
        '<p class="adm-hint">É assim que seu cliente vai ver o frete.</p>' +
        '<div class="adm-row"><label class="adm-field"><span>CEP de exemplo</span><input type="text" id="sfTestCep" inputmode="numeric" value="01310000" placeholder="01310000"></label>' +
        '<button type="button" class="adm-btn" id="sfTestBtn" style="align-self:flex-end;margin-bottom:2px">Testar cotação</button></div>' +
        '<div class="sf-quotes" id="sfTestOut"></div>' +
      '</div>' +

      '<div class="sf-wstep">' +
        '<h3>Ativar o frete automático</h3>' +
        '<label class="adm-toggle adm-toggle-big"><input type="checkbox" id="sfAtivar"'+(sf.ativo?' checked':'')+'> Ativar o frete automático no meu site</label>' +
        '<p class="adm-hint" id="sfActNote" style="display:none">Para ativar, volte e conclua o código de conexão e os dados de envio.</p>' +
        '<p class="adm-hint">Seu frete fixo continua funcionando como reserva: se a transportadora estiver fora do ar, a loja usa o frete fixo automaticamente e a venda não se perde.</p>' +
      '</div>' +

      // etapa 7 (conclusão) — só é alcançada quando a dona LIGA o frete (toggle ON).
      '<div class="sf-wstep sf-done">' +
        '<h3>&#127881; Tudo pronto!</h3>' +
        '<p class="adm-hint">A partir de agora, na sua loja:</p>' +
        '<ul class="sf-done-list">' +
          '<li>&#128722; <b>O frete é automático</b> — quando o cliente digita o CEP, o site já mostra o valor certo (Correios) e soma no total. Você não faz nada.</li>' +
          '<li>&#127991;&#65039; <b>Etiqueta em 1 clique</b> — pedido pago? Vá em &ldquo;Pedidos&rdquo;, toque em &ldquo;Gerar etiqueta&rdquo;, imprima e leve nos Correios. Já vem tudo preenchido.</li>' +
          '<li>&#128176; <b>Não sai do seu bolso</b> — o cliente paga o frete junto com a compra, e esse valor cobre a etiqueta. Sem mensalidade.</li>' +
          '<li>&#128703;&#65039; <b>Nunca trava a venda</b> — se a transportadora sair do ar, a loja usa seu frete fixo sozinha.</li>' +
          '<li>&#9881;&#65039; <b>Você no controle</b> — pode mudar o peso das peças, os dados de envio ou desligar o frete automático aqui nesta aba quando quiser.</li>' +
        '</ul>' +
      '</div>' +

      '<div class="sf-wiz-nav"><button type="button" class="adm-btn adm-btn-ghost" id="sfBack" style="display:none">Voltar</button>' +
        '<button type="button" class="adm-btn adm-btn-primary" id="sfNext">Começar</button></div>',
      []);

    function val(id){ var el=q('#'+id); return (el&&el.value||'').trim(); }

    /* --------- navegação do wizard --------- */
    var TOTAL=6, current=0;
    var navLabels=['Começar','Já criei, próximo','Próximo','Salvar e continuar','Salvar e continuar','Próximo','Concluir','Concluir'];
    function setStep(n){
      current=n;
      qa('#admModal .sf-wstep').forEach(function(el,i){ el.classList.toggle('is-active', i===n); });
      var bar=q('#sfWizBar');
      if(bar){ if(n===0 || n===7){ bar.style.display='none'; } else { bar.style.display=''; q('#sfWizFill').style.width=(n/TOTAL*100)+'%'; q('#sfWizLabel').textContent='Passo '+n+' de '+TOTAL; } }
      var back=q('#sfBack'), next=q('#sfNext');
      if(back) back.style.display = (n===0 || n===7) ? 'none' : '';
      if(next){ next.textContent=navLabels[n]; next.disabled = (n===2 && !FRETE.superfrete.tokenConfigurado); }
      if(n===6){
        var ok=FRETE.superfrete.tokenConfigurado && FRETE.superfrete.remetenteConfigurado;
        var tgl=q('#sfAtivar'); if(tgl) tgl.disabled=!ok;
        var nt=q('#sfActNote'); if(nt) nt.style.display=ok?'none':'';
      }
      var dlg=q('#admModal .adm-dialog-body'); if(dlg) dlg.scrollTop=0;
    }

    q('#sfNext').addEventListener('click', function(){
      var n=current;
      if(n===7){ closeModal(); return; }
      if(n===6){ if(FRETE.superfrete.ativo){ setStep(7); } else { closeModal(); } return; }
      if(n===2){ if(!FRETE.superfrete.tokenConfigurado){ toast('Valide o código de conexão para continuar.'); return; } setStep(3); return; }
      if(n===3){ var self=this; self.disabled=true; doSaveRem(function(ok){ self.disabled=false; if(ok) setStep(4); }); return; }
      if(n===4){ saveDims(); setStep(5); return; }
      setStep(n+1);
    });
    q('#sfBack').addEventListener('click', function(){ if(current>0) setStep(current-1); });

    /* --------- passo 2: validar o código de conexão --------- */
    // Valida o código pela AUTENTICAÇÃO na transportadora: o sf-token grava no cofre e
    // confere via GET /user, devolvendo {valid:true/false}. NÃO depende de origem/itens
    // (que só são preenchidos nos passos 3-4) — por isso o passo 2 não cota mais.
    q('#sfValidar').addEventListener('click', function(){
      var tok=(q('#sfToken').value||'').trim();
      var msg=q('#sfTokenMsg');
      if(!tok){ toast('Cole o código de conexão.'); return; }
      var user = window.Cloud && Cloud._auth && Cloud._auth.currentUser;
      if(!user){ toast('Entre novamente para salvar com segurança.'); return; }
      var btn=this; btn.disabled=true;
      if(msg){ msg.className='sf-flag'; msg.textContent='Validando…'; }
      user.getIdToken().then(function(idToken){
        return fetch(cfg.salvarTokenUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ idToken:idToken, token:tok }) });
      }).then(function(r){ if(!r.ok) throw new Error('rede'); return r.json(); })
        .then(function(j){
          btn.disabled=false;
          if(!j || j.valid!==true){   // o código não autenticou na transportadora (≠ erro de rede)
            if(msg){ msg.className='sf-quote-err'; msg.textContent='Esse código não funcionou. Confira se copiou o código inteiro e tente de novo.'; }
            return;
          }
          FRETE.superfrete.tokenConfigurado=true;
          adminSaveFrete({ superfrete:FRETE.superfrete });   // grava só o FLAG, nunca o código
          q('#sfToken').value='';
          if(msg){ msg.className='sf-flag sf-ok'; msg.innerHTML='Código validado! &#10003;'; }
          var next=q('#sfNext'); if(next && current===2) next.disabled=false;
          toast('Código validado. ★');
        }).catch(function(){ btn.disabled=false; if(msg){ msg.className='sf-quote-err'; msg.textContent='Não conseguimos validar agora. Confira sua internet e tente de novo.'; } });
    });

    /* --------- passo 3: salvar remetente (PII → cofre) --------- */
    function doSaveRem(done){
      var nome=val('sfr_nome');
      var cpf=val('sfr_cpf').replace(/\D/g,'');
      var cep=(val('sfr_cep')||'18160000').replace(/\D/g,'');
      var uf=(val('sfr_uf')||'').toUpperCase();
      if(!nome){ toast('Preencha o nome de quem envia.'); done(false); return; }
      if(cpf.length!==11){ toast('O CPF precisa ter 11 números.'); done(false); return; }
      if(cep.length!==8){ toast('O CEP precisa ter 8 números.'); done(false); return; }
      if(uf.length!==2){ toast('A UF é a sigla do estado, com 2 letras (ex.: SP).'); done(false); return; }
      // PII da dona vive no cofre (secrets/superfrete), nunca em config/store público
      // (LGPD). Mesmo endpoint/padrão do código: idToken autenticado → n8n grava via SA.
      var remet = {
        nome:nome, cpf:cpf, cep:cep,
        endereco:val('sfr_end'), numero:val('sfr_num'), bairro:val('sfr_bairro'),
        cidade:val('sfr_cidade')||'Sarapuí', uf:uf, complemento:val('sfr_comp')
      };
      var user = window.Cloud && Cloud._auth && Cloud._auth.currentUser;
      if(!user){ toast('Entre novamente para salvar com segurança.'); done(false); return; }
      user.getIdToken().then(function(idToken){
        return fetch(cfg.salvarTokenUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ idToken:idToken, remetente:remet }) });
      }).then(function(r){ if(!r.ok) throw 0; return r.json().catch(function(){ return {ok:true}; }); })
        .then(function(j){
          if(j && j.ok===false) throw 0;
          FRETE.superfrete.remetenteConfigurado=true;
          adminSaveFrete({ superfrete:FRETE.superfrete });   // grava só o FLAG booleano público, NUNCA o CPF/endereço
          var fl=q('#sfRemMsg'); if(fl){ fl.className='sf-flag sf-ok'; fl.innerHTML='Dados de envio salvos &#10003;'; }
          toast('Dados de envio salvos com segurança. ★');
          done(true);
        }).catch(function(){ toast('Não foi possível salvar. Tente de novo.'); done(false); });
    }

    /* --------- passo 4: peso/dimensões por categoria --------- */
    function saveDims(){
      if(!CATEGORIAS.length) return;
      var out={};
      CATEGORIAS.forEach(function(c,i){
        var w=parseFloat(val('sfd_w_'+i)), h=parseFloat(val('sfd_h_'+i)), wd=parseFloat(val('sfd_wd_'+i)), ln=parseFloat(val('sfd_ln_'+i));
        out[c]={ weight:w>=0?w:pkg0.weight, height:h>=0?h:pkg0.height, width:wd>=0?wd:pkg0.width, length:ln>=0?ln:pkg0.length };
      });
      FRETE.superfrete.categorias=out; adminSaveFrete({ superfrete:FRETE.superfrete });
    }

    /* --------- passo 5: testar cotação --------- */
    q('#sfTestBtn').addEventListener('click', function(){
      var cep=(q('#sfTestCep').value||'').replace(/\D/g,'')||'01310000';
      var out=q('#sfTestOut'); if(!out) return;
      out.innerHTML='<p class="adm-hint">Calculando o frete…</p>';
      var btn=this; btn.disabled=true;
      var brl=(typeof formatBRL==='function')?formatBRL:function(v){ return 'R$ '+Number(v||0).toFixed(2); };
      cotarFreteSFRaw(cep, function(err, servicos){
        btn.disabled=false;
        if(err||!servicos||!servicos.length){ out.innerHTML='<p class="sf-quote-err">Não foi possível calcular agora. Confira o CEP e sua internet, depois toque em <b>Testar cotação</b> de novo.</p>'; return; }
        out.innerHTML=servicos.map(function(s){
          var meta = s.has_error ? 'indisponível' : (brl(Number(s.price))+(s.delivery_time!=null&&s.delivery_time!==''?(' · '+escAttr(String(s.delivery_time))+' dias'):''));
          return '<div class="sf-quote-item"><span class="sf-quote-name">'+escAttr(String(s.name||''))+'</span><span class="sf-quote-meta">'+meta+'</span></div>';
        }).join('');
      });
    });

    /* --------- passo 6: ativar (gate: token + remetente) --------- */
    q('#sfAtivar').addEventListener('change', function(){
      if(this.checked && !(FRETE.superfrete.tokenConfigurado && FRETE.superfrete.remetenteConfigurado)){ this.checked=false; toast('Conclua o código de conexão E os dados de envio antes de ativar.'); return; }
      FRETE.superfrete.ativo=this.checked; adminSaveFrete({ superfrete:FRETE.superfrete });
      toast(this.checked?'Frete automático ATIVADO no site. ★':'Frete automático desativado.');
      if(this.checked) setStep(7);   // ligou → tela final "Tudo pronto!" (etapa 7)
    });

    setStep(0);
  }

  /* ====================================================================
     AVISOS DE VENDA (Telegram) — onboarding guiado p/ a dona RECEBER no celular
     um aviso a cada venda. O disparo é 100% SERVER-SIDE (Cloudflare Worker ->
     Telegram Bot API, no pagamento confirmado) — o token do bot NUNCA fica no
     front. Aqui a dona só CONECTA o Telegram dela: toca em "Conectar", o Worker
     (/tg-pair, autenticado pelo idToken da dona) gera um link t.me/<bot>?start=
     <código>, ela dá Start, e o Worker grava o chat_id no cofre. Depois um teste.
     ==================================================================== */
  function openAvisos(){
    var tgCfg = (window.USEAURA_CONFIG && window.USEAURA_CONFIG.telegram) || {};

    openModal('Avisos de venda', '' +
      '<div class="sf-wiz-bar" id="avWizBar"><div class="sf-wiz-track"><div class="sf-wiz-fill" id="avWizFill"></div></div><span class="sf-wiz-label" id="avWizLabel">Passo 1 de 2</span></div>' +

      '<div class="sf-wstep is-active">' +
        '<h3>Receba um aviso no seu celular toda vez que vender</h3>' +
        '<p class="adm-hint">Em 2 passinhos você conecta o <b>Telegram</b> (app grátis) e ele te avisa na hora que alguém compra na sua loja. Sem mensalidade. Se ainda não tem o Telegram, baixe pela sua loja de aplicativos e crie a conta (é rápido).</p>' +
      '</div>' +

      '<div class="sf-wstep">' +
        '<h3>Conecte o seu Telegram</h3>' +
        '<p class="adm-hint">Toque no botão abaixo. Ele abre o Telegram já no nosso robô de avisos — é só tocar em <b>Iniciar</b> (Start) lá dentro.</p>' +
        '<button type="button" class="adm-btn adm-btn-primary" id="tgConnect">Conectar meu Telegram</button>' +
        '<div class="sf-quotes" id="tgConnOut"></div>' +
        '<p class="adm-hint">Deu <b>Iniciar</b> no Telegram? Toque em <b>Próximo</b> para testar.</p>' +
      '</div>' +

      '<div class="sf-wstep">' +
        '<h3>Teste</h3>' +
        '<p class="adm-hint">Vamos mandar um aviso de mentira pro seu Telegram pra ver se chega.</p>' +
        '<button type="button" class="adm-btn adm-btn-primary" id="tgTestBtn">Enviar teste</button>' +
        '<div class="sf-quotes" id="tgTestOut"></div>' +
      '</div>' +

      '<div class="sf-wstep sf-done">' +
        '<h3>&#127881; Pronto!</h3>' +
        '<p class="adm-hint">Cada venda vai te avisar na hora, direto no seu Telegram. Voc&ecirc; n&atilde;o precisa deixar o site aberto.</p>' +
      '</div>' +

      '<div class="sf-wiz-nav"><button type="button" class="adm-btn adm-btn-ghost" id="avBack" style="display:none">Voltar</button>' +
        '<button type="button" class="adm-btn adm-btn-primary" id="avNext">Come&ccedil;ar</button></div>',
      []);

    /* --------- navegação do wizard (4 telas: intro, conectar, testar, pronto) --------- */
    var TOTAL=2, current=0;
    var navLabels=['Começar','Próximo','Próximo','Concluir'];
    function setStep(n){
      current=n;
      qa('#admModal .sf-wstep').forEach(function(el,i){ el.classList.toggle('is-active', i===n); });
      var bar=q('#avWizBar');
      if(bar){ if(n===0 || n===3){ bar.style.display='none'; } else { bar.style.display=''; q('#avWizFill').style.width=(n/TOTAL*100)+'%'; q('#avWizLabel').textContent='Passo '+n+' de '+TOTAL; } }
      var back=q('#avBack'), next=q('#avNext');
      if(back) back.style.display = (n===0 || n===3) ? 'none' : '';
      // na tela de teste (2) esconde "Próximo": só se avança para "Pronto!" com um teste que realmente saiu (E1)
      if(next){ next.textContent=navLabels[n]; next.style.display=(n===2)?'none':''; }
      var dlg=q('#admModal .adm-dialog-body'); if(dlg) dlg.scrollTop=0;
    }
    q('#avNext').addEventListener('click', function(){ if(current===3){ closeModal(); return; } setStep(current+1); });
    q('#avBack').addEventListener('click', function(){ if(current>0) setStep(current-1); });

    /* helper: idToken da dona (o Worker exige p/ autorizar /tg-pair e /tg-test).
       O 2º arg de .then só captura falha do getIdToken (auth) — falha de rede do
       fetch dentro do cb é tratada pelo .catch do próprio cb (rede ≠ sessão). */
    function withIdToken(cb, onAuthErr){
      var user = window.Cloud && Cloud._auth && Cloud._auth.currentUser;
      if(!user){ toast('Entre novamente para conectar com segurança.'); if(onAuthErr) onAuthErr(); return; }
      user.getIdToken().then(cb, function(){ if(onAuthErr) onAuthErr(); });
    }

    /* --------- passo "Conectar": /tg-pair -> abre o deep-link do bot --------- */
    q('#tgConnect').addEventListener('click', function(){
      var btn=this; if(btn.disabled) return;
      var out=q('#tgConnOut');
      if(!tgCfg.pairUrl){ if(out) out.innerHTML='<p class="sf-quote-err">Integração de avisos não configurada. Fale com a Avanzia.</p>'; return; }
      if(typeof fetch!=='function'){ if(out) out.innerHTML='<p class="sf-quote-err">Seu navegador não permite conectar. Tente por outro navegador.</p>'; return; }
      btn.disabled=true; if(out) out.innerHTML='<p class="adm-hint">Preparando sua conexão…</p>';
      withIdToken(function(idToken){
        return fetch(tgCfg.pairUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ idToken:idToken }) })
          .then(function(r){ return r.json().catch(function(){ return {}; }); })
          .then(function(j){
            btn.disabled=false;
            if(!j || j.ok!==true || !j.deepLink){
              var cfgProblem = j && (j.motivo==='bot nao configurado' || j.motivo==='webhook nao configurado');
              if(out) out.innerHTML='<p class="sf-quote-err">'+(cfgProblem
                ? 'Os avisos ainda não foram ativados aqui. Fale com a Avanzia.'
                : 'Não consegui preparar a conexão agora. Tente de novo em instantes.')+'</p>';
              return;
            }
            // tenta abrir o Telegram automaticamente (pode ser bloqueado por popup no celular);
            // o botão/link abaixo é a ação GARANTIDA (gesto direto da dona) — E2.
            try{ window.open(j.deepLink, '_blank', 'noopener'); }catch(e){}
            if(out) out.innerHTML=''+
              '<a class="adm-btn adm-btn-primary" href="'+escAttr(j.deepLink)+'" target="_blank" rel="noopener">Abrir o Telegram e dar Iniciar &#8599;</a>'+
              '<p class="adm-hint">Toque no botão acima: o Telegram abre no nosso robô de avisos — lá dentro, toque em <b>Iniciar</b> (Start). Não abriu nada? Instale o app <b>Telegram</b>, crie sua conta e toque de novo.</p>';
          })
          .catch(function(){ btn.disabled=false; if(out) out.innerHTML='<p class="sf-quote-err">Sem conexão com a internet. Confira e toque de novo.</p>'; });
      }, function(){ btn.disabled=false; if(out) out.innerHTML='<p class="sf-quote-err">Sua sessão expirou. Entre novamente e tente outra vez.</p>'; });
    });

    /* --------- passo "Teste": /tg-test envia aviso a todos os chats conectados.
       Só avança para "Pronto!" quando o teste REALMENTE sai (E1). --------- */
    q('#tgTestBtn').addEventListener('click', function(){
      var btn=this; if(btn.disabled) return;
      var out=q('#tgTestOut');
      if(!tgCfg.testUrl){ if(out) out.innerHTML='<p class="sf-quote-err">Integração de avisos não configurada. Fale com a Avanzia.</p>'; return; }
      if(typeof fetch!=='function'){ if(out) out.innerHTML='<p class="sf-quote-err">Seu navegador não permite enviar o teste. Faça uma venda de verdade para conferir.</p>'; return; }
      btn.disabled=true; if(out) out.innerHTML='<p class="adm-hint">Enviando…</p>';
      withIdToken(function(idToken){
        return fetch(tgCfg.testUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ idToken:idToken }) })
          .then(function(r){ return r.json().catch(function(){ return {}; }); })
          .then(function(j){
            btn.disabled=false;
            if(j && j.ok===true){
              if(out) out.innerHTML='<p class="adm-hint"><b>Enviamos!</b> Veja o aviso no seu Telegram. &#10003;</p>';
              toast('Telegram conectado! ★');
              setStep(3);   // teste saiu de fato -> pode declarar "Pronto!"
            } else if(j && j.motivo==='nenhum telegram conectado'){
              if(out) out.innerHTML='<p class="sf-quote-err">Você ainda não conectou o Telegram. Volte um passo, toque em <b>Conectar meu Telegram</b> e dê <b>Iniciar</b> no app.</p>';
            } else if(j && j.motivo==='bot nao configurado'){
              if(out) out.innerHTML='<p class="sf-quote-err">Os avisos ainda não foram ativados aqui. Fale com a Avanzia.</p>';
            } else {
              if(out) out.innerHTML='<p class="sf-quote-err">Não consegui enviar (o app pode ter bloqueado o robô). Volte um passo, toque em <b>Conectar meu Telegram</b> de novo e teste outra vez.</p>';
            }
          })
          .catch(function(){ btn.disabled=false; if(out) out.innerHTML='<p class="sf-quote-err">Sem conexão com a internet. Confira e toque de novo.</p>'; });
      }, function(){ btn.disabled=false; if(out) out.innerHTML='<p class="sf-quote-err">Sua sessão expirou. Entre novamente e tente outra vez.</p>'; });
    });

    setStep(0);
  }

  /* ====================================================================
     AVISOS DE VENDA (E-MAIL) — canal PRINCIPAL: a dona informa o e-mail que
     recebe um aviso a cada venda. Independe do aparelho dela e não exige app
     nem conta nova (o atrito do Telegram era exigir instalar/cadastrar). O
     disparo é 100% SERVER-SIDE (Worker -> Brevo, no pagamento confirmado); a
     chave da Brevo nunca fica no front. Aqui a dona só INFORMA o e-mail
     (/email-set, autenticado pelo idToken) e testa (/email-test). SOMADO ao
     Telegram — não o substitui. Espelha fielmente o wizard de openAvisos.
     ==================================================================== */
  function openAvisosEmail(){
    var emCfg = (window.USEAURA_CONFIG && window.USEAURA_CONFIG.email) || {};

    openModal('Avisos por e-mail', '' +
      '<div class="sf-wiz-bar" id="emWizBar"><div class="sf-wiz-track"><div class="sf-wiz-fill" id="emWizFill"></div></div><span class="sf-wiz-label" id="emWizLabel">Passo 1 de 2</span></div>' +

      '<div class="sf-wstep is-active">' +
        '<h3>Receba um aviso no seu e-mail toda vez que vender</h3>' +
        '<p class="adm-hint">Em 2 passinhos você informa o seu <b>e-mail</b> e passa a receber um aviso na hora que algu&eacute;m compra na sua loja. Sem instalar nada e sem criar conta nova — chega direto na sua caixa de entrada.</p>' +
      '</div>' +

      '<div class="sf-wstep">' +
        '<h3>Informe o seu e-mail</h3>' +
        '<p class="adm-hint">Digite o e-mail onde voc&ecirc; quer receber os avisos de venda e toque em <b>Salvar</b>.</p>' +
        '<label class="adm-field"><span>Seu e-mail</span><input id="emEmail" type="email" inputmode="email" autocomplete="email" placeholder="voce@exemplo.com"></label>' +
        '<button type="button" class="adm-btn adm-btn-primary" id="emSaveBtn">Salvar e-mail</button>' +
        '<div class="sf-quotes" id="emSaveOut"></div>' +
        '<p class="adm-hint">Salvou? Toque em <b>Próximo</b> para testar.</p>' +
      '</div>' +

      '<div class="sf-wstep">' +
        '<h3>Teste</h3>' +
        '<p class="adm-hint">Vamos mandar um e-mail de teste pra ver se chega (confira tamb&eacute;m a caixa de <b>spam</b> na 1&ordf; vez).</p>' +
        '<button type="button" class="adm-btn adm-btn-primary" id="emTestBtn">Enviar teste</button>' +
        '<div class="sf-quotes" id="emTestOut"></div>' +
      '</div>' +

      '<div class="sf-wstep sf-done">' +
        '<h3>&#127881; Pronto!</h3>' +
        '<p class="adm-hint">Cada venda vai te avisar por e-mail na hora. Voc&ecirc; n&atilde;o precisa deixar o site aberto.</p>' +
      '</div>' +

      '<div class="sf-wiz-nav"><button type="button" class="adm-btn adm-btn-ghost" id="emBack" style="display:none">Voltar</button>' +
        '<button type="button" class="adm-btn adm-btn-primary" id="emNext">Come&ccedil;ar</button></div>',
      []);

    /* --------- navegação do wizard (4 telas: intro, informar, testar, pronto) --------- */
    var TOTAL=2, current=0;
    var navLabels=['Começar','Próximo','Próximo','Concluir'];
    function setStep(n){
      current=n;
      qa('#admModal .sf-wstep').forEach(function(el,i){ el.classList.toggle('is-active', i===n); });
      var bar=q('#emWizBar');
      if(bar){ if(n===0 || n===3){ bar.style.display='none'; } else { bar.style.display=''; q('#emWizFill').style.width=(n/TOTAL*100)+'%'; q('#emWizLabel').textContent='Passo '+n+' de '+TOTAL; } }
      var back=q('#emBack'), next=q('#emNext');
      if(back) back.style.display = (n===0 || n===3) ? 'none' : '';
      // na tela de teste (2) esconde "Próximo": só avança para "Pronto!" com um teste que realmente saiu
      if(next){ next.textContent=navLabels[n]; next.style.display=(n===2)?'none':''; }
      var dlg=q('#admModal .adm-dialog-body'); if(dlg) dlg.scrollTop=0;
    }
    q('#emNext').addEventListener('click', function(){ if(current===3){ closeModal(); return; } setStep(current+1); });
    q('#emBack').addEventListener('click', function(){ if(current>0) setStep(current-1); });

    /* helper: idToken da dona (o Worker exige p/ autorizar /email-set e /email-test) */
    function withIdToken(cb, onAuthErr){
      var user = window.Cloud && Cloud._auth && Cloud._auth.currentUser;
      if(!user){ toast('Entre novamente para conectar com segurança.'); if(onAuthErr) onAuthErr(); return; }
      user.getIdToken().then(cb, function(){ if(onAuthErr) onAuthErr(); });
    }

    /* --------- passo "Informar": /email-set grava o e-mail no cofre --------- */
    q('#emSaveBtn').addEventListener('click', function(){
      var btn=this; if(btn.disabled) return;
      var out=q('#emSaveOut');
      var email=((q('#emEmail')&&q('#emEmail').value)||'').trim();
      if(!emCfg.setUrl){ if(out) out.innerHTML='<p class="sf-quote-err">Integração de avisos não configurada. Fale com a Avanzia.</p>'; return; }
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ if(out) out.innerHTML='<p class="sf-quote-err">Digite um e-mail válido (ex.: voce@exemplo.com).</p>'; return; }
      if(typeof fetch!=='function'){ if(out) out.innerHTML='<p class="sf-quote-err">Seu navegador não permite salvar. Tente por outro navegador.</p>'; return; }
      btn.disabled=true; if(out) out.innerHTML='<p class="adm-hint">Salvando…</p>';
      withIdToken(function(idToken){
        return fetch(emCfg.setUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ idToken:idToken, email:email }) })
          .then(function(r){ return r.json().catch(function(){ return {}; }); })
          .then(function(j){
            btn.disabled=false;
            if(j && j.ok===true){
              if(out) out.innerHTML='<p class="adm-hint"><b>Salvo!</b> Os avisos vão para <b>'+escAttr(email)+'</b>. &#10003;</p>';
              toast('E-mail salvo. ★');
            } else if(j && j.motivo==='email invalido'){
              if(out) out.innerHTML='<p class="sf-quote-err">E-mail inválido. Confira e tente de novo.</p>';
            } else {
              if(out) out.innerHTML='<p class="sf-quote-err">Não consegui salvar agora. Tente de novo em instantes.</p>';
            }
          })
          .catch(function(){ btn.disabled=false; if(out) out.innerHTML='<p class="sf-quote-err">Sem conexão com a internet. Confira e toque de novo.</p>'; });
      }, function(){ btn.disabled=false; if(out) out.innerHTML='<p class="sf-quote-err">Sua sessão expirou. Entre novamente e tente outra vez.</p>'; });
    });

    /* --------- passo "Teste": /email-test envia ao destinatário salvo.
       Só avança para "Pronto!" quando o teste REALMENTE sai. --------- */
    q('#emTestBtn').addEventListener('click', function(){
      var btn=this; if(btn.disabled) return;
      var out=q('#emTestOut');
      if(!emCfg.testUrl){ if(out) out.innerHTML='<p class="sf-quote-err">Integração de avisos não configurada. Fale com a Avanzia.</p>'; return; }
      if(typeof fetch!=='function'){ if(out) out.innerHTML='<p class="sf-quote-err">Seu navegador não permite enviar o teste. Faça uma venda de verdade para conferir.</p>'; return; }
      btn.disabled=true; if(out) out.innerHTML='<p class="adm-hint">Enviando…</p>';
      withIdToken(function(idToken){
        return fetch(emCfg.testUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ idToken:idToken }) })
          .then(function(r){ return r.json().catch(function(){ return {}; }); })
          .then(function(j){
            btn.disabled=false;
            if(j && j.ok===true){
              if(out) out.innerHTML='<p class="adm-hint"><b>Enviamos!</b> Veja na sua caixa de entrada (e no spam, na 1&ordf; vez). &#10003;</p>';
              toast('Avisos por e-mail ativos! ★');
              setStep(3);   // teste saiu de fato -> pode declarar "Pronto!"
            } else if(j && j.motivo==='nenhum email configurado'){
              if(out) out.innerHTML='<p class="sf-quote-err">Você ainda não informou um e-mail. Volte um passo, digite o seu e-mail e toque em <b>Salvar</b>.</p>';
            } else if(j && j.motivo==='email nao configurado'){
              if(out) out.innerHTML='<p class="sf-quote-err">Os avisos por e-mail ainda não foram ativados aqui. Fale com a Avanzia.</p>';
            } else {
              if(out) out.innerHTML='<p class="sf-quote-err">Não consegui enviar agora. Tente de novo em instantes.</p>';
            }
          })
          .catch(function(){ btn.disabled=false; if(out) out.innerHTML='<p class="sf-quote-err">Sem conexão com a internet. Confira e toque de novo.</p>'; });
      }, function(){ btn.disabled=false; if(out) out.innerHTML='<p class="sf-quote-err">Sua sessão expirou. Entre novamente e tente outra vez.</p>'; });
    });

    setStep(0);
  }

  /* ====================================================================
     PÁGINAS INSTITUCIONAIS (editar texto)
     ==================================================================== */
  function openPagina(slug){
    var pg=PAGINAS[slug]; if(!pg) return;
    openModal('Editar: '+pg.titulo,
      '<label class="adm-field"><span>Título da página</span><input id="pg_titulo" type="text" value="'+escAttr(pg.titulo)+'"></label>' +
      (pg.whatsapp!=null ? '<label class="adm-field"><span>WhatsApp (só números, com DDD)</span><input id="pg_wa" type="text" value="'+escAttr(pg.whatsapp)+'" placeholder="5515988241672"></label>' : '') +
      '<label class="adm-field"><span>Texto <small class="adm-hint" style="display:inline">— deixe uma linha em branco entre parágrafos</small></span>' +
        '<textarea id="pg_texto" rows="13">'+escAttr(pg.texto)+'</textarea></label>',
      [{label:'Salvar texto', cls:'adm-btn-primary', act:function(){ savePagina(slug); }}]);
  }
  function savePagina(slug){
    var dados={ titulo:(q('#pg_titulo').value||'').trim()||PAGINAS[slug].titulo, texto:(q('#pg_texto').value||'') };
    var wa=q('#pg_wa'); if(wa) dados.whatsapp=(wa.value||'').replace(/\D/g,'');
    adminSavePagina(slug, dados); closeModal(); render(); toast('Texto atualizado. ★');
  }

  /* ====================================================================
     BANNER (editar + reposicionar)
     ==================================================================== */
  var bannerImg=null;
  function openBanner(){
    bannerImg = BANNER.img || null;
    var prodOpts = PRODUTOS.filter(function(p){return p.real;}).map(function(p){
      return '<option value="'+escAttr(p.id)+'"'+(BANNER.produtoId===p.id?' selected':'')+'>'+escAttr(p.nome)+'</option>';
    }).join('');
    openModal('Editar banner', '' +
      '<label class="adm-field"><span>Chamada pequena (topo)</span><input id="bf_eyebrow" type="text" value="'+escAttr(BANNER.eyebrow)+'"></label>' +
      '<label class="adm-field"><span>Título grande</span><input id="bf_titulo" type="text" value="'+escAttr(BANNER.titulo)+'"><small class="adm-hint">Use &lt;em&gt;palavra&lt;/em&gt; para itálico.</small></label>' +
      '<label class="adm-field"><span>Subtítulo</span><textarea id="bf_sub" rows="2">'+escAttr(BANNER.sub)+'</textarea></label>' +
      '<label class="adm-field"><span>Imagem de fundo — usar foto de uma peça</span><select id="bf_prod">'+prodOpts+'</select></label>' +
      '<div class="adm-field"><span>…ou enviar imagem própria</span>' +
        '<div class="adm-photo adm-photo-wide" id="bf_photo">'+(bannerImg?('<img src="'+mediaSrc(bannerImg)+'" alt="Prévia"><span class="adm-photo-hint">Trocar</span>'):'<span class="adm-photo-empty">&#9733; Escolher imagem</span>')+'</div>' +
        '<input type="file" accept="image/*" id="bf_file" class="adm-file">' +
        (bannerImg?'<button type="button" class="adm-linkbtn" id="bf_clear">Remover imagem própria (voltar à foto da peça)</button>':'') +
      '</div>' +
      '<button type="button" class="adm-btn adm-block" id="bf_mover" style="margin-top:6px">&#10021; Reposicionar imagem no banner</button>',
      [{label:'Salvar banner', cls:'adm-btn-primary', act:saveBanner}]);
    var box=q('#bf_photo'), file=q('#bf_file');
    box.addEventListener('click', function(){ file.click(); });
    file.addEventListener('change', function(){
      var f=file.files&&file.files[0]; if(!f) return; toast('Processando imagem…');
      imgToDataURL(f, function(data){ addImageMedia(data).then(function(id){ if(!id) return; bannerImg=id; box.innerHTML='<img src="'+data+'" alt="Prévia"><span class="adm-photo-hint">Trocar</span>'; }); });
    });
    var clr=q('#bf_clear'); if(clr) clr.addEventListener('click', function(){ bannerImg=null; box.innerHTML='<span class="adm-photo-empty">&#9733; Escolher imagem</span>'; });
    q('#bf_mover').addEventListener('click', function(){ saveBanner(true); enterReposition(); });
  }
  function saveBanner(silent){
    adminSaveBanner({
      eyebrow:(q('#bf_eyebrow').value||'').trim(),
      titulo:(q('#bf_titulo').value||'').trim()||'USE AURA',
      sub:(q('#bf_sub').value||'').trim(),
      produtoId:q('#bf_prod').value,
      img: bannerImg || ''
    });
    closeModal();
    if(location.hash && location.hash.indexOf('home')<0 && location.hash.replace(/^#\/?/,'')!==''){ location.hash='#/home'; }
    else render();
    if(!silent) toast('Banner atualizado. ★');
  }

  /* reposicionar: arrastar a imagem do hero p/ enquadrar (object-position) */
  function enterReposition(){
    var hero=q('#heroBanner'), img=q('#heroImg');
    if(!hero || !img){ if(location.hash.indexOf('home')<0 && location.hash!==''){ location.hash='#/home'; } setTimeout(enterReposition, 350); return; }
    if(q('#admReposBar')) return;
    hero.classList.add('adm-reposition');
    var posX = BANNER.posX==null?50:BANNER.posX, posY = BANNER.posY==null?28:BANNER.posY;
    var dragging=false, sx=0, sy=0, bx=posX, by=posY;
    function apply(){ img.style.objectPosition = posX+'% '+posY+'%'; }
    function down(e){ dragging=true; var p=pt(e); sx=p.x; sy=p.y; bx=posX; by=posY; hero.setPointerCapture&&hero.setPointerCapture(e.pointerId); e.preventDefault(); }
    function move(e){ if(!dragging) return; var p=pt(e); var r=hero.getBoundingClientRect();
      posX = Math.max(0, Math.min(100, bx - (p.x-sx)/r.width*100));
      posY = Math.max(0, Math.min(100, by - (p.y-sy)/r.height*100));
      apply(); }
    function up(){ dragging=false; }
    function pt(e){ return {x:e.clientX, y:e.clientY}; }
    hero.addEventListener('pointerdown', down);
    hero.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);

    var bar=ce('div','adm-repos-bar','<span>Arraste a imagem para enquadrar</span>' +
      '<button class="adm-btn adm-btn-ghost" data-adm="rcancel">Cancelar</button>' +
      '<button class="adm-btn adm-btn-primary" data-adm="rsave">Salvar posição</button>');
    bar.id='admReposBar'; document.body.appendChild(bar);
    function cleanup(){ hero.classList.remove('adm-reposition'); hero.removeEventListener('pointerdown',down); hero.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); bar.remove(); }
    bar.addEventListener('click', function(e){
      var act=e.target.getAttribute('data-adm');
      if(act==='rsave'){ adminSaveBanner({posX:Math.round(posX), posY:Math.round(posY)}); cleanup(); toast('Enquadramento salvo. ★'); }
      else if(act==='rcancel'){ img.style.objectPosition=(BANNER.posX||50)+'% '+(BANNER.posY||28)+'%'; cleanup(); }
    });
  }

  /* ====================================================================
     PEDIDOS (lê do Firestore em tempo real; status editável)
     ==================================================================== */
  var _pedUnsub = null;
  function openPedidos(){
    openModal('Pedidos', '<div id="admPedidosBody"><p class="adm-hint">Carregando pedidos…</p></div>', []);
    var body=q('#admPedidosBody'); if(!body) return;
    if(!(window.Cloud && Cloud.firestoreEnabled)){
      body.innerHTML='<p class="adm-empty">Os pedidos aparecem aqui automaticamente assim que a loja estiver conectada à nuvem.</p>';
      return;
    }
    if(_pedUnsub){ _pedUnsub(); _pedUnsub=null; }
    _pedUnsub = Cloud.watchOrders(function(list){ if(q('#admPedidosBody')) renderPedidos(q('#admPedidosBody'), list); });
  }
  function renderPedidos(body, list){
    if(!list || !list.length){ body.innerHTML='<p class="adm-empty">Nenhum pedido ainda.</p>'; return; }
    var brl = (typeof formatBRL==='function') ? formatBRL : function(v){ return 'R$ '+Number(v||0).toFixed(2); };
    body.innerHTML = list.map(function(o){
      var cli=o.cliente||{}, en=o.entrega||{}, st=o.status||'novo';
      // qtd COAGIDO a número (nunca interpolar dado de pedido cru — é create público → anti stored-XSS)
      var itens=(o.itens||[]).map(function(it){ return escAttr(it.nome)+' — Tam. '+escAttr(it.tamanho)+' · '+escAttr(it.cor)+' · x'+(Number(it.qtd)||1); }).join('<br>');
      var opts=['novo','enviado','entregue'].map(function(s){ return '<option value="'+s+'"'+(s===st?' selected':'')+'>'+s+'</option>'; }).join('');
      return '<div class="adm-pedido adm-ped-'+escAttr(st)+'">' +
        '<div class="adm-pedido-top"><strong>#'+escAttr(o.orderId||o._id)+'</strong><span>'+brl(o.total)+'</span></div>' +
        '<div class="adm-pedido-cli">'+escAttr(cli.nome||'—')+' · '+escAttr(cli.tel||'')+(cli.email?(' · '+escAttr(cli.email)):'')+'</div>' +
        '<div class="adm-pedido-end">'+escAttr(en.endereco||'')+(en.numero?(', nº '+escAttr(en.numero)):'')+' — '+escAttr(en.bairro||'')+', '+escAttr(en.cidade||'')+(en.cep?(' · CEP '+escAttr(en.cep)):'')+'</div>' +
        '<div class="adm-pedido-itens">'+itens+'</div>' +
        '<div class="adm-pedido-foot"><span class="adm-pedido-pay">'+(o.pagamento==='pix'?'Pix':'Cartão')+'</span>' +
          '<label class="adm-pedido-status">Status <select data-oid="'+escAttr(o._id)+'">'+opts+'</select></label></div>' +
        (st==='pago' && o.frete_servico ? '<div class="sf-etiqueta"><button type="button" class="adm-btn adm-btn-primary sf-etiq-btn" data-etiq="'+escAttr(o.orderId||o._id)+'">&#128230; Gerar etiqueta</button></div>' : '') +
      '</div>';
    }).join('');
    qa('.adm-pedido-status select', body).forEach(function(sel){
      sel.addEventListener('change', function(){
        Cloud.updateOrderStatus(sel.getAttribute('data-oid'), sel.value).then(function(ok){ if(ok) toast('Status atualizado. ★'); });
      });
    });
    // Etiqueta SuperFrete: emite server-side (o token vive no cofre). Manda idToken
    // autenticado + orderId; a resposta traz o PDF pronto ou o motivo do erro.
    qa('.sf-etiq-btn', body).forEach(function(btn){
      btn.addEventListener('click', function(){
        if(btn.disabled) return; btn.disabled=true;   // trava clique-duplo
        var oid=btn.getAttribute('data-etiq');
        var cfg=(window.USEAURA_CONFIG && window.USEAURA_CONFIG.superfrete) || {};
        if(!cfg.etiquetaUrl){ toast('Integração de frete não configurada.'); btn.disabled=false; return; }
        var user=window.Cloud && Cloud._auth && Cloud._auth.currentUser;
        if(!user){ toast('Entre novamente para gerar a etiqueta.'); btn.disabled=false; return; }
        var lbl=btn.textContent; btn.textContent='Gerando…';
        user.getIdToken().then(function(idToken){
          return fetch(cfg.etiquetaUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ orderId:oid, idToken:idToken }) });
        // parse defensivo: a resposta de erro (400/502) traz {motivo}; não deixa o botão preso em "Gerando…"
        }).then(function(r){ return r.json().catch(function(){ return {}; }); }).then(function(j){
          btn.textContent=lbl; btn.disabled=false;
          if(j && j.ok && j.pdfUrl && /^https:\/\//i.test(String(j.pdfUrl))){   // só https (bloqueia javascript:/data: acidental)
            var a=document.createElement('a'); a.href=j.pdfUrl; a.target='_blank'; a.rel='noopener'; document.body.appendChild(a); a.click(); a.remove();
            toast('Etiqueta gerada. ★');
          } else { toast((j && j.motivo) ? String(j.motivo) : 'Não foi possível gerar a etiqueta.'); }
        }).catch(function(){ btn.textContent=lbl; btn.disabled=false; toast('Falha ao gerar a etiqueta. Tente de novo.'); });
      });
    });
  }

  /* ====================================================================
     MODAL genérico + confirmação
     ==================================================================== */
  function openModal(titulo, bodyHtml, actions){
    closeModal();
    var ov=ce('div','adm-overlay open','' +
      '<div class="adm-dialog adm-form" role="dialog" aria-modal="true" aria-label="'+escAttr(titulo)+'">' +
        '<div class="adm-dialog-head"><h2>'+escAttr(titulo)+'</h2><button class="adm-x" data-adm="close" aria-label="Fechar">&times;</button></div>' +
        '<div class="adm-dialog-body">'+bodyHtml+'</div>' +
        '<div class="adm-dialog-foot" id="admFoot"></div>' +
      '</div>');
    ov.id='admModal';
    document.body.appendChild(ov);
    var foot=q('#admFoot');
    (actions||[]).forEach(function(a){ var btn=ce('button','adm-btn '+(a.cls||''), a.label); btn.type='button'; btn.addEventListener('click', a.act); foot.appendChild(btn); });
    ov.addEventListener('click', function(e){ if(e.target===ov || (e.target.getAttribute&&e.target.getAttribute('data-adm')==='close')) closeModal(); });
    document.addEventListener('keydown', escModal);
  }
  function escModal(e){ if(e.key==='Escape') closeModal(); }
  function closeModal(){ var ov=q('#admModal'); if(ov) ov.remove(); document.removeEventListener('keydown', escModal); if(_pedUnsub){ _pedUnsub(); _pedUnsub=null; } }
  function openConfirm(msg, onYes){
    var ov=ce('div','adm-overlay open','' +
      '<div class="adm-dialog adm-confirm" role="dialog" aria-modal="true"><p>'+escAttr(msg)+'</p>' +
        '<div class="adm-dialog-foot"><button class="adm-btn adm-btn-ghost" data-adm="no">Cancelar</button>' +
        '<button class="adm-btn adm-btn-primary" data-adm="yes">Confirmar</button></div></div>');
    ov.id='admConfirm'; document.body.appendChild(ov);
    ov.addEventListener('click', function(e){ var act=e.target.getAttribute&&e.target.getAttribute('data-adm');
      if(e.target===ov||act==='no') ov.remove(); else if(act==='yes'){ ov.remove(); onYes(); } });
  }

  /* ====================================================================
     GATE: segurar a logo por 3s
     ==================================================================== */
  function bindHoldGate(){
    var logo=q('.site-header .wordmark'); if(!logo) return;
    var timer=null, held=false;
    // impede o menu de contexto/seleção do navegador no long-press (celular)
    logo.setAttribute('draggable','false');
    logo.addEventListener('contextmenu', function(e){ e.preventDefault(); });
    function start(){ held=false; logo.classList.add('adm-holding'); timer=setTimeout(function(){ held=true; logo.classList.remove('adm-holding'); openLogin(); }, 3000); }
    function cancel(){ clearTimeout(timer); logo.classList.remove('adm-holding'); }
    logo.addEventListener('pointerdown', start);
    logo.addEventListener('pointerup', cancel);
    logo.addEventListener('pointerleave', cancel);
    logo.addEventListener('pointercancel', cancel);
    logo.addEventListener('click', function(e){ if(held){ e.preventDefault(); e.stopPropagation(); held=false; } });
  }

  /* ====================================================================
     EDIÇÃO INLINE DE TEXTOS ([data-tk]) — delegada, gated por admin-mode
     ==================================================================== */
  function isTkTarget(el){ return !!(el && el.getAttribute && el.getAttribute('data-tk')!=null && el.isContentEditable); }
  function commitText(el){
    var key=el.getAttribute('data-tk'); if(!key) return;
    var val=(el.textContent||'').replace(/\s+/g,' ').trim();
    var orig=(el.getAttribute('data-tk-orig')||'').replace(/\s+/g,' ').trim();
    if(val===orig) return;                                   // sem mudança real → não salva/nem toast
    if(!val){ el.textContent = el.getAttribute('data-tk-orig')||''; return; }  // vazio → reverte (nunca rótulo em branco)
    if(typeof adminSaveTexto==='function'){ adminSaveTexto(key, val); toast('Texto salvo. ★'); }
  }
  function bindInlineTextEdit(){
    // captura ANTES do link/botão: clicar no texto edita, não navega/submete
    document.addEventListener('click', function(e){
      if(!document.body.classList.contains('admin-mode')) return;
      var el=e.target.closest && e.target.closest('[data-tk]');
      if(el){ e.preventDefault(); e.stopPropagation(); }
    }, true);
    // guarda o valor original ao focar (base do "sem mudança" e do Esc)
    document.addEventListener('focusin', function(e){ if(isTkTarget(e.target)) e.target.setAttribute('data-tk-orig', e.target.textContent); });
    // Enter confirma (sem quebra de linha); Esc cancela
    document.addEventListener('keydown', function(e){
      if(!isTkTarget(e.target)) return;
      if(e.key==='Enter'){ e.preventDefault(); e.target.blur(); }
      else if(e.key==='Escape'){ e.preventDefault(); e.target.textContent=e.target.getAttribute('data-tk-orig')||e.target.textContent; e.target.blur(); }
      e.stopPropagation();
    });
    // cola SEMPRE como texto plano de 1 linha (anti-HTML/anti-XSS na origem; a saída já é escapada)
    document.addEventListener('paste', function(e){
      if(!document.body.classList.contains('admin-mode') || !isTkTarget(e.target)) return;
      e.preventDefault();
      var text=(((e.clipboardData||window.clipboardData).getData('text'))||'').replace(/[\r\n]+/g,' ');
      try{ document.execCommand('insertText', false, text); }catch(_){ e.target.textContent += text; }
    });
    // focusout borbulha (blur não) → ponto único de commit
    document.addEventListener('focusout', function(e){ if(document.body.classList.contains('admin-mode') && isTkTarget(e.target)) commitText(e.target); });
  }

  window.AdminUI = { decorate: decorate };

  function init(){
    bindHoldGate();
    bindInlineTextEdit();
    // PRODUÇÃO: o estado de dono vem do Firebase Auth (persiste entre sessões).
    if(window.Cloud && Cloud.ready){
      Cloud.ready.then(function(){
        if(Cloud.authEnabled){
          Cloud.onOwnerChange(function(owner){ if(owner) enableAdmin(); else if(document.body.classList.contains('admin-mode')) disableAdmin(); });
        } else if(isLogged()) enableAdmin();   // fallback demo
      });
    } else if(isLogged()) enableAdmin();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
