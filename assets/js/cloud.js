/* ==========================================================================
   USE AURA — CAMADA DE NUVEM (Firestore + Firebase Auth + Cloudinary)
   --------------------------------------------------------------------------
   Expõe window.Cloud. É INERTE por padrão: se a config ainda está com
   placeholders (ou o SDK não carrega), Cloud.firestoreEnabled/authEnabled
   ficam false e TODOS os métodos viram no-op — o app cai no modo local
   (localStorage + IndexedDB) sem quebrar. Ao plugar as chaves, "acende".

   O SDK do Firebase só é baixado quando há config válida (fallback = 0 rede
   nova). Use Cloud.ready (Promise) para esperar a inicialização.
   ========================================================================== */
(function(){
  'use strict';
  var CFG = window.USEAURA_CONFIG || {};
  function ph(v){ return !v || String(v).indexOf('COLE_AQUI') === 0; }

  var fbOk  = CFG.firebase && !ph(CFG.firebase.apiKey) && !ph(CFG.firebase.projectId) && !ph(CFG.firebase.appId);
  var cldOk = CFG.cloudinary && !ph(CFG.cloudinary.cloudName) && !ph(CFG.cloudinary.uploadPreset);

  var Cloud = {
    firestoreEnabled: false,
    authEnabled: false,
    _owner: false,
    _db: null,
    _auth: null,
    ownerEmail: String(CFG.ownerEmail || '').toLowerCase(),
    ready: null,
    cloudinaryEnabled: function(){ return cldOk; }
  };

  function loadScript(src){
    return new Promise(function(res, rej){
      var s = document.createElement('script');
      s.src = src; s.async = true; s.onload = res; s.onerror = function(){ rej(new Error('falha ao carregar '+src)); };
      document.head.appendChild(s);
    });
  }

  /* ---- STORE (1 doc: config/store — {payload: JSON, updatedAt}) ---- */
  Cloud.watchStore = function(applyFn){
    if(!Cloud.firestoreEnabled) return;
    Cloud._db.doc('config/store').onSnapshot(function(snap){
      if(snap.metadata && snap.metadata.hasPendingWrites) return;   // ignora eco da própria escrita
      if(!snap.exists) return;
      var d = snap.data();
      if(d && d.payload){ try{ applyFn(JSON.parse(d.payload)); }catch(e){ console.warn('store parse:', e && e.message); } }
    }, function(err){ console.warn('store onSnapshot:', err && err.message); });
  };
  Cloud.saveStore = function(payloadObj){
    if(!Cloud.firestoreEnabled || !Cloud._owner) return Promise.resolve(false);
    return Cloud._db.doc('config/store').set({ payload: JSON.stringify(payloadObj), updatedAt: Date.now() })
      .then(function(){ return true; })
      .catch(function(e){ console.warn('saveStore nuvem:', e && e.message); return false; });
  };

  /* ---- PEDIDOS (coleção orders) ---- */
  Cloud.createOrder = function(order){
    if(!Cloud.firestoreEnabled) return Promise.resolve(null);
    return Cloud._db.collection('orders').add(order)
      .then(function(ref){ return ref.id; })
      .catch(function(e){ console.warn('createOrder:', e && e.message); return null; });
  };
  Cloud.watchOrders = function(cb){
    if(!Cloud.firestoreEnabled || !Cloud._owner) return function(){};
    return Cloud._db.collection('orders').orderBy('createdAt','desc').onSnapshot(function(snap){
      var arr = []; snap.forEach(function(doc){ var o = doc.data(); o._id = doc.id; arr.push(o); });
      cb(arr);
    }, function(err){ console.warn('orders onSnapshot:', err && err.message); });
  };
  Cloud.updateOrderStatus = function(id, status){
    if(!Cloud.firestoreEnabled || !Cloud._owner) return Promise.resolve(false);
    return Cloud._db.collection('orders').doc(id).update({ status: status, updatedAt: Date.now() })
      .then(function(){ return true; })
      .catch(function(e){ console.warn('updateOrderStatus:', e && e.message); return false; });
  };
  /* Cria o pedido com ID DETERMINÍSTICO = orderId (não .add() aleatório). Usado no
     fluxo de cartão InfinitePay: o n8n precisa achar orders/<orderId> pelo order_nsu
     para dar baixa após reconciliar. create anônimo exige status:'novo' (firestore.rules). */
  Cloud.createOrderWithId = function(orderId, order){
    if(!Cloud.firestoreEnabled || !orderId) return Promise.resolve(null);
    return Cloud._db.collection('orders').doc(String(orderId)).set(order)
      .then(function(){ return String(orderId); })
      .catch(function(e){ console.warn('createOrderWithId:', e && e.message); return null; });
  };
  /* Observa a CONFIRMAÇÃO pública de pagamento (doc payments/<orderId>, SEM PII,
     escrito só pelo n8n após reconciliar via /payment_check). Leitura pública nas
     rules → funciona para o comprador anônimo no retorno do checkout. cb(dataOuNull).
     Retorna a função de unsubscribe. */
  Cloud.watchPayment = function(orderId, cb){
    if(!Cloud.firestoreEnabled || !orderId) return function(){};
    return Cloud._db.collection('payments').doc(String(orderId)).onSnapshot(function(snap){
      cb(snap.exists ? snap.data() : null);
    }, function(err){ console.warn('watchPayment:', err && err.message); });
  };

  /* ---- AUTH (dona) ---- */
  Cloud.onOwnerChange = function(cb){
    if(!Cloud.authEnabled) return;
    Cloud._auth.onAuthStateChanged(function(u){
      Cloud._owner = !!(u && String(u.email||'').toLowerCase() === Cloud.ownerEmail);
      cb(Cloud._owner, u);
    });
  };
  Cloud.signIn = function(email, pass){
    if(!Cloud.authEnabled) return Promise.reject(new Error('auth off'));
    return Cloud._auth.signInWithEmailAndPassword(email, pass);
  };
  Cloud.signOut = function(){ return Cloud.authEnabled ? Cloud._auth.signOut() : Promise.resolve(); };

  /* ---- CLOUDINARY (upload unsigned; devolve secure_url ou null) ---- */
  Cloud.uploadMedia = function(fileOrDataUrl, kind){
    if(!cldOk) return Promise.resolve(null);
    var res = (kind === 'video') ? 'video' : 'image';
    var url = 'https://api.cloudinary.com/v1_1/' + CFG.cloudinary.cloudName + '/' + res + '/upload';
    var fd = new FormData();
    fd.append('file', fileOrDataUrl);
    fd.append('upload_preset', CFG.cloudinary.uploadPreset);
    return fetch(url, { method:'POST', body: fd })
      .then(function(r){ return r.json(); })
      .then(function(j){ return (j && j.secure_url) || null; })
      .catch(function(e){ console.warn('cloudinary upload:', e && e.message); return null; });
  };

  /* ---- inicialização (só baixa o SDK se houver config válida) ---- */
  Cloud.ready = (function(){
    if(!fbOk) return Promise.resolve();
    var base = 'https://www.gstatic.com/firebasejs/10.12.2/';
    return loadScript(base + 'firebase-app-compat.js')
      .then(function(){ return Promise.all([
        loadScript(base + 'firebase-auth-compat.js'),
        loadScript(base + 'firebase-firestore-compat.js')
      ]); })
      .then(function(){
        // authDomain é derivado do projectId se ficou com placeholder (evita login quebrado
        // quando o instalador cola apiKey/projectId/appId mas esquece o authDomain).
        if(!CFG.firebase.authDomain || String(CFG.firebase.authDomain).indexOf('COLE_AQUI')>=0){
          CFG.firebase.authDomain = CFG.firebase.projectId + '.firebaseapp.com';
        }
        firebase.initializeApp(CFG.firebase);
        Cloud._db = firebase.firestore();
        Cloud._auth = firebase.auth();
        if(CFG.emulator){
          try{
            if(CFG.emulator.firestore){ var fp = CFG.emulator.firestore.split(':'); Cloud._db.useEmulator(fp[0], parseInt(fp[1],10)); }
            if(CFG.emulator.auth){ Cloud._auth.useEmulator(CFG.emulator.auth, { disableWarnings:true }); }
          }catch(e){ console.warn('emulator:', e && e.message); }
        }
        Cloud.firestoreEnabled = true;
        Cloud.authEnabled = true;
      })
      .catch(function(e){ console.warn('Firebase indisponível — modo local:', e && e.message); });
  })();

  window.Cloud = Cloud;
})();
