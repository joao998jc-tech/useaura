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
    apiKey:            "AIzaSyAUPnFq1m_jRb_LWBLgHKbWPD0Z2ZM0W-I",
    authDomain:        "useaura-34065.firebaseapp.com",
    projectId:         "useaura-34065",
    storageBucket:     "",                       // NÃO usamos Storage (fotos = Cloudinary)
    messagingSenderId: "389600672899",
    appId:             "1:389600672899:web:d1bcfbbee43b133233efb6"
  },

  /* 2) E-mail do login da dona — o MESMO cadastrado em Firebase Auth.
        Se trocar este e-mail, troque também em firestore.rules (função isOwner). */
  ownerEmail: "useaura@gmail.com",

  /* 3) Cloudinary → Dashboard (cloudName) + Settings > Upload > upload preset
        UNSIGNED (marque "Unsigned" e permita imagem E vídeo). */
  cloudinary: {
    cloudName:    "qxgzvdeg",
    uploadPreset: "useaura_unsigned"
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
  },

  /* 5) Cartão — PARCELAMENTO. Enquanto o cartão for "combinar pelo WhatsApp"
        (sem checkout que realmente parcela), mantenha ativo:false — assim o site
        NÃO promete "em até 3x" que ainda não pode cumprir. Quando o cartão real
        (InfinitePay Checkout) entrar no ar, ligue ativo:true e o "em até 3x"
        volta a aparecer nas peças com o toggle "Parcela em até 3x" marcado.
        maxParcelas / semJuros = conforme o que o checkout de fato oferecer. */
  cartao: {
    ativo:       true,    // Fase B NO AR: cartão real via InfinitePay (parcela volta a aparecer na PDP)
    maxParcelas: 3,
    semJuros:    true
  },

  /* 6) InfinitePay — CARTÃO REAL (checkout hospedado). O site NÃO coleta cartão:
        o navegador chama o n8n (VPS), que cria o link de pagamento (POST /links)
        e devolve a URL; o cliente é redirecionado ao checkout seguro da
        InfinitePay e, ao voltar (#/retorno/<pedido>), o site lê a confirmação
        REAL no Firestore (doc público payments/<pedido>, escrito só pelo n8n
        após reconciliar via /payment_check). Enquanto "ativo:false" OU sem as
        URLs do n8n, o cartão continua no fluxo antigo (combinar no WhatsApp) —
        inerte por padrão, "acende" quando a dona ligar o repasse de taxas e as
        URLs forem preenchidas. NADA aqui é segredo (o handle é público); a
        credencial fica no n8n. Regra 74: número de parcelas em `cartao` acima. */
  infinitepay: {
    ativo:        true,               // NO AR: Pix e cartão passam pelo checkout InfinitePay (baixa automática)
    handle:       "ana-laura-oug",    // handle PÚBLICO InfinitePay (sem $) — auth do POST /links
    apiBase:      "https://api.checkout.infinitepay.io", // referência; quem chama é o Worker, não o browser
    // Backend migrado do n8n (VPS cancelada) p/ Cloudflare Worker (grátis). >>> TROCAR avanzia <<<
    // pelo subdomínio real que o `wrangler deploy` mostrar (ex.: useaura-backend.joao.workers.dev).
    criarLinkUrl: "https://useaura-backend.avanzia.workers.dev/criar-link", // Worker rota Fluxo A (POST)
    redirectBase: ""                  // vazio = deriva de origin+path atual (robusto no subpath do GitHub Pages)
  },

  /* 7) SuperFrete — FRETE REAL self-service (Correios via SuperFrete). Só URLs do
        n8n (VPS), como em infinitepay: NADA aqui é segredo. O TOKEN da SuperFrete
        NÃO fica neste arquivo — a dona cola no wizard da Área da Dona e ele vai
        DIRETO para o cofre (n8n → variável server-side); o browser nunca guarda
        nem reenvia o token. O navegador só pede a COTAÇÃO (id do serviço) e o n8n
        recomputa/emite server-side. Inerte por padrão: só "acende" quando a dona
        liga o frete real na Área da Dona (FRETE.superfrete.ativo). */
  superfrete: {
    // Migrado do n8n p/ Cloudflare Worker. >>> TROCAR avanzia <<< (o mesmo do bloco infinitepay).
    cotarUrl:       "https://useaura-backend.avanzia.workers.dev/sf-cotar",
    salvarTokenUrl: "https://useaura-backend.avanzia.workers.dev/sf-token",
    etiquetaUrl:    "https://useaura-backend.avanzia.workers.dev/sf-etiqueta"
  },

  /* 8) Telegram — AVISO DE VENDA no celular da dona (substitui o ntfy, que dava 429
        no Cloudflare Worker). NADA aqui é segredo: o bot token vive só no Worker
        (secret). A dona conecta sozinha no modo dona ("Conectar Telegram") → o
        Worker gera um link t.me/<bot>?start=<código> → ela dá Start → o Worker
        grava o chat_id no cofre. O disparo do aviso é 100% server-side (no
        pagamento confirmado). >>> TROCAR avanzia <<< (o mesmo dos blocos acima). */
  telegram: {
    pairUrl: "https://useaura-backend.avanzia.workers.dev/tg-pair",
    testUrl: "https://useaura-backend.avanzia.workers.dev/tg-test"
  },

  /* 9) E-mail — AVISO DE VENDA por e-mail (SOMADO ao Telegram; canal principal por
        não depender do aparelho da dona nem exigir app/conta nova). NADA aqui é
        segredo: a chave da Brevo vive só no Worker (secret) e o disparo é 100%
        server-side (no pagamento confirmado). A dona informa o e-mail de recebimento
        no modo dona ("Avisos por e-mail") → vai pro cofre (secrets/email), trocável
        sem deploy. >>> TROCAR avanzia <<< (o mesmo dos blocos acima). */
  email: {
    setUrl:  "https://useaura-backend.avanzia.workers.dev/email-set",
    testUrl: "https://useaura-backend.avanzia.workers.dev/email-test"
  }

  /* 10) (opcional, só para TESTE com Firebase Emulator — deixe ausente em produção)
     emulator: { firestore: "127.0.0.1:8080", auth: "http://127.0.0.1:9099" } */
};
