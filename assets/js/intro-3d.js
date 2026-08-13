/* =========================================================
   USE AURA — INTRO-3D.JS  (abertura cinematográfica)
   Mecânica espelhada da Hero do Marcelinho (hero-iphone-3d.js), Regra 80 —
   fidelidade de EFEITO, muda só o branding. NÃO toca no resto do site.

   OBJETO (v2): MEDALHA 3D da logo "Aura Roupas & Acessórios" — disco preto
   metálico (CylinderGeometry) + aro rose-gold volumétrico (TorusGeometry) +
   face com textura reconstruída em canvas (mapa de cor + bump p/ relevo +
   metalnessMap p/ o dourado brilhar). Substitui o antigo wordmark "USE AURA"
   em TextGeometry. Toda a cena/câmera/luzes/entrada/fallback foi preservada.

   FASES (window.__auraIntro.phaseState):
   - "idle"     medalha girando devagar no eixo Y (turntable) com leve tilt 3D,
                revelando espessura, aro e relevo. "toque para entrar" pulsando.
   - "entrando" clique/toque no CTA: a medalha AVANÇA rumo à câmera (dolly-in +
                escala) e preenche a tela.
   - "site"     intro concluída: overlay some, o app (renderizado embaixo) surge.

   Three.js via importmap (esm.sh, igual ao molde). A textura da medalha é
   gerada em <canvas> (sem asset externo → roda em GitHub Pages/local).

   FALLBACK GRACIOSO (o site NUNCA fica preso):
   - sem three (CDN fora) / sem WebGL / prefers-reduced-motion → intro ESTÁTICA
     (fundo marrom + wordmark HTML + botão "Entrar"). Se o módulo nem rodar, a
     intro nasce display:none no CSS → o site aparece (fallback por omissão).
   - aba oculta pausa o rAF. Perda de contexto WebGL cai no fallback estático.
   ========================================================= */

(function () {
  "use strict";

  var body = document.body;
  var intro = document.getElementById("intro");
  var stage = intro ? intro.querySelector(".intro__stage") : null;
  var enterBtn = document.getElementById("introEnter");
  var hint = intro ? intro.querySelector(".intro__hint") : null;

  if (!intro || !stage || !enterBtn) return;

  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var mql = window.matchMedia ? window.matchMedia.bind(window) : null;
  var coarse = !!(mql && mql("(pointer: coarse)").matches);
  var uaMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  var isMobile = window.innerWidth < 760 || coarse || uaMobile;

  /* ---- perfil de desempenho por dispositivo (roda liso em aparelho fraco) ---- */
  var cores = navigator.hardwareConcurrency || 8;
  var memGB = navigator.deviceMemory || 8;
  var veryLow = isMobile && (cores <= 4 || memGB <= 4);     // aparelho de entrada
  var MAX_DPR = veryLow ? 1.25 : (isMobile ? 1.5 : 2);
  var TEX = isMobile ? (veryLow ? 512 : 704) : 1024;         // textura da medalha
  var SEG = veryLow ? { cyl: 48, tt: 72, ts: 14 } : (isMobile ? { cyl: 64, tt: 96, ts: 16 } : { cyl: 96, tt: 128, ts: 22 });
  var FRAME_MS = !isMobile ? 0 : (veryLow ? 34 : 25);        // 60 / 40 / 30 fps

  var phase = "idle";          // idle | entrando | site
  var revealed = false;
  var entering = false;
  var enterStart = 0;
  var ENTER_MS = 900;          // duração do dolly-in
  var textReady = false;       // (medalha pronta) — gate do dolly-in
  var baseScale = 1;

  var MEDAL_R = 1.0;           // raio base da medalha (o fit escala depois)

  body.classList.add("is-intro");
  function lockScroll(on) {
    document.documentElement.style.overflow = on ? "hidden" : "";
    body.classList.toggle("no-scroll", !!on);
  }
  lockScroll(true);

  /* ---- Revela o site (fim da intro) ---- */
  function revealSite() {
    if (revealed) return;
    revealed = true;
    phase = "site";
    stop();
    if (!location.hash || location.hash === "#" || location.hash === "#/") {
      location.hash = "#/home";
    }
    intro.classList.add("is-entering");
    body.classList.remove("is-intro");
    lockScroll(false);
    window.scrollTo(0, 0);
    var appEl = document.getElementById("app");
    if (appEl) { try { appEl.focus({ preventScroll: true }); } catch (e) {} }
    window.setTimeout(function () {
      intro.style.display = "none";
      if (renderer) { try { renderer.dispose(); } catch (e) {} }
    }, 520);
  }

  /* ---- Entrada pelo CTA: dolly-in, depois revela ---- */
  function onEnter() {
    if (entering || revealed) return;
    entering = true;
    phase = "entrando";
    if (hint) hint.style.opacity = "0";
    if (!textReady || reduceMotion) { window.setTimeout(revealSite, 220); return; }
    enterStart = performance.now();
  }
  enterBtn.addEventListener("click", onEnter);

  /* ---- Fallback estático ---- */
  function staticIntro() {
    body.classList.add("intro-static");
    phase = "idle";
  }
  if (reduceMotion) { staticIntro(); exposeHooks(); return; }

  /* =========================================================
     MODO 3D — carrega three + monta a MEDALHA
     ========================================================= */
  var renderer, scene, camera, rig, pmrem;
  var medalMats = [];
  var spinY = 0;
  var SPIN_RATE = 0.25;         // rad/s — turntable MUITO lento (objeto pesado/premium)
  var TILT = -0.13;             // leve inclinação 3D fixa

  (async function boot() {
    var THREE, RoomEnvironment;
    try {
      THREE = await import("three");
      RoomEnvironment = (await import(
        "https://esm.sh/three@0.182.0/examples/jsm/environments/RoomEnvironment.js"
      )).RoomEnvironment;
    } catch (e) {
      staticIntro(); exposeHooks(); return;
    }
    if (!buildScene(THREE, RoomEnvironment)) {
      staticIntro(); exposeHooks(); return;
    }
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    resize();
    play();
    textReady = true;
    exposeHooks();
  })();

  /* ---------------------------------------------------------
     TEXTURA DA MEDALHA — reconstrução da logo em canvas
     (frontal, círculo perfeito; relevo vem do bump em 3D)
     --------------------------------------------------------- */
  function makeMedalCanvas() {
    var S = TEX, c = document.createElement("canvas");
    c.width = c.height = S;
    drawMedal(c.getContext("2d"), S);
    return c;
  }
  function goldGrad(ctx, y0, y1) {
    var g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0.00, "#F8E9BE");
    g.addColorStop(0.32, "#E6C57E");
    g.addColorStop(0.60, "#C89A50");
    g.addColorStop(1.00, "#8F6329");
    return g;
  }
  function star4(ctx, cx, cy, r, grad) {
    ctx.save(); ctx.translate(cx, cy); ctx.beginPath();
    var spikes = 4, inner = r * 0.30;
    for (var i = 0; i < spikes * 2; i++) {
      var rad = (i % 2 === 0) ? r : inner;
      var a = (i * Math.PI / spikes) - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill(); ctx.restore();
  }
  function heart(ctx, cx, cy, s, fill) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.beginPath();
    ctx.moveTo(0, 0.28);
    ctx.bezierCurveTo(0, -0.06, -0.52, -0.10, -0.52, 0.18);
    ctx.bezierCurveTo(-0.52, 0.44, -0.08, 0.60, 0, 0.86);
    ctx.bezierCurveTo(0.08, 0.60, 0.52, 0.44, 0.52, 0.18);
    ctx.bezierCurveTo(0.52, -0.10, 0, -0.06, 0, 0.28);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.restore();
  }
  function tracked(ctx, txt, cx, y, font, spacing) {
    ctx.font = font; ctx.textBaseline = "middle";
    var i, w = 0, ws = [];
    for (i = 0; i < txt.length; i++) { var cw = ctx.measureText(txt[i]).width; ws.push(cw); w += cw + spacing; }
    w -= spacing;
    var x = cx - w / 2;
    ctx.fillStyle = goldGrad(ctx, y - 24, y + 24);
    ctx.textAlign = "left";
    for (i = 0; i < txt.length; i++) { ctx.fillText(txt[i], x, y); x += ws[i] + spacing; }
  }
  function drawMedal(ctx, S) {
    var cx = S / 2, cy = S / 2, R = S * 0.492;
    ctx.clearRect(0, 0, S, S);

    // corpo preto sofisticado (leve gradiente radial p/ profundidade)
    var disc = ctx.createRadialGradient(cx, cy - R * 0.28, R * 0.15, cx, cy, R);
    disc.addColorStop(0, "#26251f");
    disc.addColorStop(0.55, "#17150f");
    disc.addColorStop(1, "#090806");
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = disc; ctx.fill();

    // aro externo metálico (rose-gold) — o volume real vem do torus 3D; aqui é a cor
    ctx.lineJoin = "round";
    ctx.beginPath(); ctx.arc(cx, cy, R - 15, 0, Math.PI * 2);
    ctx.lineWidth = 26; ctx.strokeStyle = goldGrad(ctx, cy - R, cy + R); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R - 40, 0, Math.PI * 2);
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(248,233,190,0.7)"; ctx.stroke();

    // relevo dourado (sombra sutil embaixo p/ dar emboss na própria arte)
    ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;

    // lua crescente (topo, centro-direita)
    var mx = cx + R * 0.16, my = cy - R * 0.42, mr = R * 0.205;
    ctx.save();
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fillStyle = goldGrad(ctx, my - mr, my + mr); ctx.fill();
    ctx.globalCompositeOperation = "destination-out"; ctx.shadowColor = "transparent";
    ctx.beginPath(); ctx.arc(mx + mr * 0.55, my - mr * 0.18, mr * 0.92, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // estrelas ao lado da lua
    var gStar = goldGrad(ctx, my - 40, my + 40);
    star4(ctx, mx + mr * 1.25, my - mr * 0.15, R * 0.045, gStar);
    star4(ctx, mx + mr * 1.62, my + mr * 0.28, R * 0.026, gStar);
    star4(ctx, mx + mr * 1.15, my + mr * 0.52, R * 0.018, gStar);

    // "Aura" — script elegante (Playfair Display italic; fallback serif)
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.font = 'italic 700 ' + Math.round(R * 0.46) + 'px "Playfair Display", Georgia, serif';
    ctx.fillStyle = goldGrad(ctx, cy - R * 0.05, cy + R * 0.30);
    ctx.fillText("Aura", cx, cy + R * 0.17);

    // sparkles decorativos ao redor do nome
    star4(ctx, cx - R * 0.34, cy + R * 0.10, R * 0.028, gStar);
    star4(ctx, cx + R * 0.40, cy + R * 0.24, R * 0.022, gStar);

    // ROUPAS · ACESSÓRIOS (caps espaçado) + traços com estrelinhas
    var yR = cy + R * 0.44;
    tracked(ctx, "ROUPAS", cx, yR, '600 ' + Math.round(R * 0.072) + 'px "Playfair Display", Georgia, serif', R * 0.03);
    tracked(ctx, "ACESSÓRIOS", cx, yR + R * 0.115, '600 ' + Math.round(R * 0.062) + 'px "Playfair Display", Georgia, serif', R * 0.028);

    // traços decorativos ladeando "ROUPAS"
    ctx.strokeStyle = goldGrad(ctx, yR - 10, yR + 10); ctx.lineWidth = 3;
    lineDash(ctx, cx - R * 0.34, yR, cx - R * 0.20, yR);
    lineDash(ctx, cx + R * 0.20, yR, cx + R * 0.34, yR);
    star4(ctx, cx - R * 0.375, yR, R * 0.02, gStar);
    star4(ctx, cx + R * 0.375, yR, R * 0.02, gStar);

    // coração + traços (base)
    var yH = cy + R * 0.66;
    ctx.strokeStyle = goldGrad(ctx, yH - 10, yH + 10); ctx.lineWidth = 3;
    lineDash(ctx, cx - R * 0.20, yH, cx - R * 0.07, yH);
    lineDash(ctx, cx + R * 0.07, yH, cx + R * 0.20, yH);
    ctx.shadowColor = "transparent";
    heart(ctx, cx, yH - R * 0.015, R * 0.055, goldGrad(ctx, yH - R * 0.05, yH + R * 0.05));
  }
  function lineDash(ctx, x0, y0, x1, y1) {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }

  function buildScene(THREE, RoomEnvironment) {
    try { renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: true, powerPreference: "high-performance" }); }
    catch (e) { return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    stage.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 6);

    /* Luzes (mantidas): chave neutra + acento quente + rim frio → brilho no metal */
    scene.add(new THREE.AmbientLight(0xffffff, 0.32));
    var key = new THREE.SpotLight(0xffffff, 3.0);
    key.position.set(-3, 6, 6); key.angle = 0.5; key.penumbra = 1; key.decay = 0;
    scene.add(key);
    var warm = new THREE.PointLight(new THREE.Color("#F0C98C"), 2.6);
    warm.position.set(4, -1, 3); warm.decay = 0; scene.add(warm);
    var cool = new THREE.PointLight(new THREE.Color("#8FB8D6"), 1.5);
    cool.position.set(-4, 2, -2); cool.decay = 0; scene.add(cool);

    pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    /* ---- textura da face (canvas) ---- */
    var canvas = makeMedalCanvas();
    var tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4;
    // as fontes podem carregar depois → redesenha e atualiza a textura
    if (document.fonts && document.fonts.load) {
      Promise.all([
        document.fonts.load('italic 700 200px "Playfair Display"'),
        document.fonts.load('600 80px "Playfair Display"')
      ]).then(function () {
        drawMedal(canvas.getContext("2d"), canvas.width); tex.needsUpdate = true;
      }).catch(function () {});
    }

    var R = MEDAL_R, depth = 0.17;

    /* face: cor pela textura; metalnessMap faz o dourado brilhar e o preto ficar
       fosco sofisticado; bumpMap dá o relevo dos elementos. */
    var faceMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, map: tex, metalnessMap: tex, bumpMap: tex,
      metalness: 1.0, roughness: 0.34, bumpScale: 0.055, envMapIntensity: 1.4,
      transparent: true, opacity: 0
    });
    var sideMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#3a2814"), metalness: 0.95, roughness: 0.42,
      envMapIntensity: 1.2, transparent: true, opacity: 0
    });
    var goldMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#C98E52"), metalness: 1.0, roughness: 0.22,
      envMapIntensity: 2.0, transparent: true, opacity: 0
    });

    // corpo (disco escuro) — só dá a espessura; as faces vêm dos círculos
    var body3d = new THREE.Mesh(new THREE.CylinderGeometry(R, R, depth, SEG.cyl, 1), sideMat);
    body3d.rotation.x = Math.PI / 2;

    // faces frente/verso com UV previsível (sempre em pé)
    var faceGeo = new THREE.CircleGeometry(R * 0.985, SEG.cyl);
    var front = new THREE.Mesh(faceGeo, faceMat); front.position.z = depth / 2 + 0.002;
    var back = new THREE.Mesh(faceGeo, faceMat); back.position.z = -depth / 2 - 0.002; back.rotation.y = Math.PI;

    // aro rose-gold volumétrico (torus no plano XY = borda da medalha)
    var ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.995, depth * 0.62, SEG.ts, SEG.tt), goldMat);

    medalMats = [faceMat, sideMat, goldMat];

    rig = new THREE.Group();
    rig.add(body3d); rig.add(front); rig.add(back); rig.add(ring);
    rig.rotation.x = TILT;
    scene.add(rig);

    renderer.domElement.addEventListener("webglcontextlost", function (e) {
      e.preventDefault(); stop(); if (!revealed) staticIntro();
    }, false);

    return true;
  }

  /* ---- fit responsivo: escala a medalha p/ ~fração do MENOR lado (nunca corta) ---- */
  function fitToViewport() {
    if (!rig) return;
    var dist = camera.position.z;
    var vpH = 2 * Math.tan((camera.fov * Math.PI) / 360) * dist;
    var vpW = vpH * camera.aspect;
    var frac = isMobile ? 0.64 : 0.5;         // presença forte, sem competir
    var target = Math.min(vpW, vpH) * frac;    // diâmetro alvo
    baseScale = target / (2 * MEDAL_R);
    if (!entering) rig.scale.setScalar(baseScale);
  }
  function resize() {
    if (!renderer) return;
    var w = stage.clientWidth || window.innerWidth;
    var h = stage.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fitToViewport();
  }
  function onResize() { resize(); }

  /* =========================================================
     LOOP
     ========================================================= */
  var raf = 0, running = false;
  var t0 = performance.now();
  var lastRender = 0;
  var introStart = 0, introDone = false, INTRO_IN_MS = 850;
  function ease(t) { return -(Math.cos(Math.PI * Math.min(Math.max(t, 0), 1)) - 1) / 2; }
  function lerp(a, b, f) { return a + (b - a) * f; }
  function setOpacity(o) { for (var i = 0; i < medalMats.length; i++) medalMats[i].opacity = o; }

  function tick(now) {
    if (!running) return;
    raf = window.requestAnimationFrame(tick);
    // throttle de FPS por dispositivo (economiza GPU/bateria no aparelho fraco)
    if (FRAME_MS && (now - lastRender) < FRAME_MS) return;
    var dt = lastRender ? Math.min((now - lastRender) / 1000, 0.05) : 0.016;
    lastRender = now;

    var t = (now - t0) / 1000;
    var floatY = Math.sin(t * 1.0) * 0.045;

    if (entering) {
      var k = ease((now - enterStart) / ENTER_MS);
      spinY = lerp(spinY, Math.round(spinY / (Math.PI * 2)) * (Math.PI * 2), 0.12);
      rig.rotation.y = spinY;
      rig.rotation.x = lerp(rig.rotation.x, 0, 0.15);
      rig.position.y = lerp(rig.position.y, 0, 0.2);
      rig.position.z = k * 4.0;
      rig.scale.setScalar(baseScale * (1 + k * 7));
      setOpacity(1);
      if ((now - enterStart) >= ENTER_MS) { revealSite(); return; }
    } else {
      if (!introStart) introStart = now;
      spinY += SPIN_RATE * dt;                              // velocidade por TEMPO (mesma em qualquer FPS)
      rig.rotation.y = spinY;
      rig.rotation.x = TILT + Math.sin(t * 0.4) * 0.025;   // eixo Y predominante + micro-vida
      if (!introDone) {
        // ENTRADA: fade-in + aproximação + escala (elegante e rápida)
        var p = ease((now - introStart) / INTRO_IN_MS);
        setOpacity(p);
        rig.position.z = (1 - p) * -1.0;
        rig.position.y = floatY;
        rig.scale.setScalar(baseScale * (0.82 + 0.18 * p));
        if (p >= 1) { introDone = true; }
      } else {
        rig.position.z = 0;
        rig.position.y = floatY;
        rig.scale.setScalar(baseScale);
      }
    }

    renderer.render(scene, camera);
  }
  function play() { if (running || !renderer) return; running = true; lastRender = 0; raf = window.requestAnimationFrame(tick); }
  function pause() { if (!running) return; running = false; if (raf) window.cancelAnimationFrame(raf); raf = 0; }
  function stop() { pause(); }

  function onVisibility() {
    if (document.hidden) pause();
    else if (!revealed) play();
  }

  /* =========================================================
     HOOKS DE VERIFICAÇÃO (Regra 81)
     ========================================================= */
  function exposeHooks() {
    window.__auraIntro = {
      get phaseState() { return phase; },
      get revealed() { return revealed; },
      get textReady() { return textReady; },
      get running() { return running; },
      get isStatic() { return body.classList.contains("intro-static"); },
      get introDone() { return introDone; },
      get rotY() {
        if (!rig) return null;
        var TWO = Math.PI * 2; return ((rig.rotation.y % TWO) + TWO) % TWO;
      },
      get rig() { return rig ? { y: rig.position.y, z: rig.position.z, s: rig.scale.x } : null; },
      get debug() {
        return {
          medalR: MEDAL_R, baseScale: baseScale,
          stageW: stage.clientWidth, stageH: stage.clientHeight,
          aspect: camera ? camera.aspect : null,
          spinRate: SPIN_RATE, tex: TEX, dpr: MAX_DPR, frameMs: FRAME_MS, veryLow: veryLow
        };
      },
      enter: onEnter,
      reveal: revealSite
    };
  }
})();
