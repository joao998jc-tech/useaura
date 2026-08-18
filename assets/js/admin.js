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
      '</div>';
    }).join('');
    qa('.adm-pedido-status select', body).forEach(function(sel){
      sel.addEventListener('change', function(){
        Cloud.updateOrderStatus(sel.getAttribute('data-oid'), sel.value).then(function(ok){ if(ok) toast('Status atualizado. ★'); });
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
