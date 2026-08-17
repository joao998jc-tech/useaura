/* ==========================================================================
   USE AURA — CONFIGURAÇÃO DE PRODUÇÃO  (PONTO ÚNICO PARA PLUGAR AS CHAVES)
   --------------------------------------------------------------------------
   Enquanto os valores estiverem como "COLE_AQUI_...", o site roda em MODO LOCAL
   (localStorage + IndexedDB) — exatamente como na demonstração, sem quebrar.
   Assim que você colar as chaves reais, o site "acende" o MODO PRODUÇÃO:
   Firestore (dados sincronizam entre aparelhos) + Cloudinary (fotos/vídeos) +
   login real da dona (Firebase Auth).

   NENHUMA destas chaves é segredo: a segurança vem das firestore.rules
   (escrita só da dona autenticada) e do upload_preset unsigned do Cloudinary.
   ========================================================================== */
window.USEAURA_CONFIG = {
  /* 1) Firebase → Console Firebase > Config. do projeto > Seus apps (Web) */
  firebase: {
    apiKey:            "COLE_AQUI_apiKey",
    authDomain:        "COLE_AQUI_projectId.firebaseapp.com",
    projectId:         "COLE_AQUI_projectId",
    storageBucket:     "",                       // NÃO usamos Storage (fotos = Cloudinary)
    messagingSenderId: "COLE_AQUI_messagingSenderId",
    appId:             "COLE_AQUI_appId"
  },

  /* 2) E-mail do login da dona — o MESMO cadastrado em Firebase Auth.
        Se trocar este e-mail, troque também em firestore.rules (função isOwner). */
  ownerEmail: "useaura@gmail.com",

  /* 3) Cloudinary → Dashboard (cloudName) + Settings > Upload > upload preset
        UNSIGNED (marque "Unsigned" e permita imagem E vídeo). */
  cloudinary: {
    cloudName:    "COLE_AQUI_cloudName",
    uploadPreset: "COLE_AQUI_uploadPreset"
  },

  /* 4) Pix — RECEBIMENTO REAL. O código copia-e-cola / QR gerado na tela de
        pagamento roteia o dinheiro DIRETO para esta chave (cai na conta da
        dona; a Avanzia não toca no valor). "nome"/"cidade" são cosméticos
        (aparecem no comprovante do pagador); o roteamento é 100% pela chave.
        Para trocar a conta que recebe, basta trocar a "chave" aqui. */
  pix: {
    chave:  "+5515988241672",   // chave Pix (telefone com +55) da USE AURA
    nome:   "USE AURA",          // Merchant Name (máx 25) — cosmético
    cidade: "SARAPUI"            // Merchant City (máx 15) — cosmético
  }

  /* 5) (opcional, só para TESTE com Firebase Emulator — deixe ausente em produção)
     emulator: { firestore: "127.0.0.1:8080", auth: "http://127.0.0.1:9099" } */
};
