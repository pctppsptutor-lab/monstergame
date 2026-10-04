/* MONSTER GACHA - Game presentation & animation layer
 * Authority rules: The game NEVER decides isCorrect and NEVER changes score.
 * Animate only from ClassroomGameBridge 'result' and 'state' events.
 */
(function () {
  'use strict';

  const cg = ClassroomGameBridge.create({ gameId: 'monster-gacha', version: '2.0.0' });
  const stage = document.getElementById('stage');

  const BODY_PARTS = [
    { id: 'eyes', name: 'Đôi Mắt Tinh Anh', en: 'Sparkly Eyes', icon: '👀' },
    { id: 'horns', name: 'Cặp Sừng Rồng Vàng', en: 'Dragon Horns', icon: '🦄' },
    { id: 'mouth', name: 'Nụ Cười Răng Khểnh', en: 'Cheery Fangs', icon: '😄' },
    { id: 'wings', name: 'Đôi Cánh Tiên Bướm', en: 'Fairy Wings', icon: '🧚' },
    { id: 'arms', name: 'Đôi Tay Ôm Ấm Áp', en: 'Fluffy Arms', icon: '👐' },
    { id: 'feet', name: 'Giày Sneaker Cầu Vồng', en: 'Rainbow Sneakers', icon: '👟' },
    { id: 'tail', name: 'Chiếc Đuôi Bồng Bềnh', en: 'Fluffy Tail', icon: '🦊' },
    { id: 'antenna', name: 'Ăng-ten Ngôi Sao', en: 'Cosmic Star', icon: '⭐' }
  ];

  let questions = new Map();
  let current = null;
  let advancing = null;
  let locked = false;
  let settings = { muted: false, reducedMotion: false };
  let timer = null;
  let audioCtx = null;

  // Track unlocked monster parts across rounds
  const unlockedParts = new Set();

  // Helper DOM builders
  const h = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  };

  const SVG_NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    return el;
  }

  // Web Audio Synthesizer for rich arcade sound effects (zero external files)
  function getAudio() {
    if (!audioCtx) {
      const AudioClass = window.AudioContext || window.webkitAudioContext;
      if (AudioClass) audioCtx = new AudioClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playCrankSound() {
    if (settings.muted) return;
    try {
      const ctx = getAudio();
      if (!ctx) return;
      const now = ctx.currentTime;
      for (let i = 0; i < 4; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320 + i * 140, now + i * 0.1);
        gain.gain.setValueAtTime(0.08, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.08);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.09);
      }
    } catch {}
  }

  function playCapsuleOpenSound() {
    if (settings.muted) return;
    try {
      const ctx = getAudio();
      if (!ctx) return;
      const now = ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.07);
        gain.gain.setValueAtTime(0.12, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.38);
      });
    } catch {}
  }

  function playAttachSound() {
    if (settings.muted) return;
    try {
      const ctx = getAudio();
      if (!ctx) return;
      const now = ctx.currentTime;
      const freqs = [659.25, 880, 1174.66, 1318.51];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + idx * 0.05);
        gain.gain.setValueAtTime(0.1, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.32);
      });
    } catch {}
  }

  function playFailSound() {
    if (settings.muted) return;
    try {
      const ctx = getAudio();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.35);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    } catch {}
  }

  function message(text) {
    clearInterval(timer);
    stage.replaceChildren(h('div', 'big-status', text));
  }

  function lockInputs() {
    stage.querySelectorAll('button, input, select').forEach(n => { n.disabled = true; });
  }

  // Create Gacha Machine SVG
  function createGachaSVG() {
    const svg = s('svg', {
      viewBox: '0 0 160 210',
      class: 'gacha-svg',
      'aria-label': 'Máy Gacha Quái Thú'
    });

    const defs = s('defs');
    
    // Glass dome gradient
    const glassGrad = s('radialGradient', { id: 'glassG', cx: '35%', cy: '35%', r: '65%' });
    glassGrad.append(
      s('stop', { offset: '0%', 'stop-color': '#ffffff', 'stop-opacity': '0.75' }),
      s('stop', { offset: '60%', 'stop-color': '#e0f2fe', 'stop-opacity': '0.35' }),
      s('stop', { offset: '100%', 'stop-color': '#38bdf8', 'stop-opacity': '0.5' })
    );

    // Body metal gradient
    const bodyGrad = s('linearGradient', { id: 'bodyG', x1: '0', y1: '0', x2: '1', y2: '0' });
    bodyGrad.append(
      s('stop', { offset: '0%', 'stop-color': '#dc2626' }),
      s('stop', { offset: '50%', 'stop-color': '#ef4444' }),
      s('stop', { offset: '100%', 'stop-color': '#b91c1c' })
    );

    // Gold trim
    const goldGrad = s('linearGradient', { id: 'goldG', x1: '0', y1: '0', x2: '0', y2: '1' });
    goldGrad.append(
      s('stop', { offset: '0%', 'stop-color': '#fde047' }),
      s('stop', { offset: '100%', 'stop-color': '#d97706' })
    );

    defs.append(glassGrad, bodyGrad, goldGrad);
    svg.append(defs);

    // Machine roof / top dome cap
    svg.append(
      s('path', { d: 'M 40 45 Q 80 18 120 45 Z', fill: 'url(#goldG)', stroke: '#b45309', 'stroke-width': '2' }),
      s('circle', { cx: '80', cy: '24', r: '7', fill: '#f59e0b', stroke: '#b45309', 'stroke-width': '2' })
    );

    // Glass globe background
    svg.append(s('circle', {
      cx: '80', cy: '82', r: '52',
      fill: 'url(#glassG)', stroke: '#38bdf8', 'stroke-width': '3'
    }));

    // Mini capsules inside
    const capsGroup = s('g', { class: 'capsule-jiggle' });
    const caps = [
      { cx: 65, cy: 92, col1: '#f43f5e', col2: '#ffffff' },
      { cx: 95, cy: 90, col1: '#06b6d4', col2: '#fef08a' },
      { cx: 80, cy: 110, col1: '#a855f7', col2: '#ffffff' },
      { cx: 58, cy: 112, col1: '#10b981', col2: '#bae6fd' },
      { cx: 102, cy: 110, col1: '#f59e0b', col2: '#fbcfe8' },
      { cx: 80, cy: 75, col1: '#ec4899', col2: '#67e8f9' }
    ];
    caps.forEach(c => {
      const g = s('g');
      g.append(
        s('circle', { cx: c.cx, cy: c.cy, r: '12', fill: c.col1 }),
        s('path', { d: `M ${c.cx - 12} ${c.cy} A 12 12 0 0 1 ${c.cx + 12} ${c.cy} Z`, fill: c.col2, opacity: '0.9' }),
        s('line', { x1: c.cx - 12, y1: c.cy, x2: c.cx + 12, y2: c.cy, stroke: '#475569', 'stroke-width': '1.5' }),
        s('circle', { cx: c.cx - 4, cy: c.cy - 4, r: '2.5', fill: '#ffffff', opacity: '0.8' })
      );
      capsGroup.append(g);
    });
    svg.append(capsGroup);

    // Glass highlight arcs
    svg.append(s('path', {
      d: 'M 44 65 A 46 46 0 0 1 112 55',
      fill: 'none', stroke: '#ffffff', 'stroke-width': '4', 'stroke-linecap': 'round', opacity: '0.85'
    }));

    // Machine lower metal body
    svg.append(
      s('rect', { x: '24', y: '124', width: '112', height: '76', rx: '14', fill: 'url(#bodyG)', stroke: '#991b1b', 'stroke-width': '3' }),
      s('rect', { x: '20', y: '120', width: '120', height: '10', rx: '5', fill: 'url(#goldG)', stroke: '#b45309', 'stroke-width': '2' }),
      s('rect', { x: '46', y: '133', width: '68', height: '14', rx: '7', fill: '#fef08a', stroke: '#b45309', 'stroke-width': '1.5' })
    );

    const txt = s('text', {
      x: '80', y: '143', 'text-anchor': 'middle', 'font-size': '8', 'font-weight': '900', fill: '#b45309'
    });
    txt.textContent = '★ GACHA ★';
    svg.append(txt);

    // Crank mechanism
    const crank = s('g', { id: 'gachaCrank', class: 'gacha-crank-group' });
    crank.append(
      s('circle', { cx: '80', cy: '160', r: '14', fill: 'url(#goldG)', stroke: '#b45309', 'stroke-width': '2' }),
      s('line', { x1: '80', y1: '160', x2: '80', y2: '144', stroke: '#92400e', 'stroke-width': '5', 'stroke-linecap': 'round' }),
      s('circle', { cx: '80', cy: '142', r: '6', fill: '#ef4444', stroke: '#7f1d1d', 'stroke-width': '1.5' })
    );
    svg.append(crank);

    // Dispenser chute
    svg.append(
      s('path', { d: 'M 62 182 L 98 182 L 94 200 L 66 200 Z', fill: '#0f172a', stroke: '#cbd5e1', 'stroke-width': '2' }),
      s('rect', { x: '65', y: '184', width: '30', height: '4', rx: '2', fill: '#475569' })
    );

    return svg;
  }

  // Create Monster SVG with 8 attachable parts
  function createMonsterSVG() {
    const svg = s('svg', {
      viewBox: '0 0 200 200',
      class: 'monster-svg',
      id: 'monsterSvg',
      'aria-label': 'Quái thú Blobby'
    });

    const defs = s('defs');

    // Body gradient
    const blobGrad = s('linearGradient', { id: 'blobGrad', x1: '0', y1: '0', x2: '0', y2: '1' });
    blobGrad.append(
      s('stop', { offset: '0%', 'stop-color': '#a855f7' }),
      s('stop', { offset: '60%', 'stop-color': '#7c3aed' }),
      s('stop', { offset: '100%', 'stop-color': '#4f46e5' })
    );

    // Horn gradient
    const hornGrad = s('linearGradient', { id: 'hornGrad', x1: '0', y1: '0', x2: '1', y2: '1' });
    hornGrad.append(
      s('stop', { offset: '0%', 'stop-color': '#fbbf24' }),
      s('stop', { offset: '100%', 'stop-color': '#ea580c' })
    );

    // Wing gradient
    const wingGrad = s('linearGradient', { id: 'wingGrad', x1: '0', y1: '0', x2: '1', y2: '1' });
    wingGrad.append(
      s('stop', { offset: '0%', 'stop-color': '#38bdf8' }),
      s('stop', { offset: '100%', 'stop-color': '#ec4899' })
    );

    defs.append(blobGrad, hornGrad, wingGrad);
    svg.append(defs);

    // Pedestal / Floating cloud
    svg.append(s('ellipse', {
      cx: '100', cy: '182', rx: '62', ry: '12',
      fill: '#e0e7ff', opacity: '0.85'
    }));

    // Root monster group for breathing / bouncing animation
    const root = s('g', { class: 'monster-base', id: 'monsterRoot' });

    // 1. Part: WINGS (rendered behind body)
    const wingsGroup = s('g', { id: 'part-wings' });
    wingsGroup.style.display = unlockedParts.has('wings') ? 'inline' : 'none';
    const leftWing = s('path', {
      d: 'M 48 95 C 10 70 -5 102 18 126 C 30 136 44 120 48 110 Z',
      fill: 'url(#wingGrad)', stroke: '#0284c7', 'stroke-width': '2.5', class: 'wing-flap-left'
    });
    const rightWing = s('path', {
      d: 'M 152 95 C 190 70 205 102 182 126 C 170 136 156 120 152 110 Z',
      fill: 'url(#wingGrad)', stroke: '#0284c7', 'stroke-width': '2.5', class: 'wing-flap-right'
    });
    wingsGroup.append(leftWing, rightWing);
    root.append(wingsGroup);

    // 2. Part: TAIL (behind body)
    const tailGroup = s('g', { id: 'part-tail', class: 'tail-wag' });
    tailGroup.style.display = unlockedParts.has('tail') ? 'inline' : 'none';
    tailGroup.append(
      s('path', {
        d: 'M 142 136 C 178 142 195 120 182 104 C 170 92 158 108 146 122 Z',
        fill: '#f59e0b', stroke: '#b45309', 'stroke-width': '2.5'
      }),
      s('circle', { cx: '182', cy: '102', r: '10', fill: '#fef08a', stroke: '#b45309', 'stroke-width': '2' })
    );
    root.append(tailGroup);

    // 3. Base Body (Blob)
    const body = s('path', {
      d: 'M 54 116 C 50 78 72 52 100 52 C 128 52 150 78 146 116 C 142 152 124 164 100 164 C 76 164 58 152 54 116 Z',
      fill: 'url(#blobGrad)', stroke: '#4c1d95', 'stroke-width': '3'
    });
    root.append(body);

    // Blush spots
    root.append(
      s('circle', { cx: '72', cy: '116', r: '8', fill: '#f43f5e', opacity: '0.4' }),
      s('circle', { cx: '128', cy: '116', r: '8', fill: '#f43f5e', opacity: '0.4' })
    );

    // Default resting face when eyes or mouth missing
    const defaultFace = s('g', { id: 'defaultFace' });
    if (!unlockedParts.has('eyes')) {
      defaultFace.append(
        s('path', { d: 'M 80 98 Q 86 102 92 98', stroke: '#c4b5fd', 'stroke-width': '3', 'stroke-linecap': 'round', fill: 'none' }),
        s('path', { d: 'M 108 98 Q 114 102 120 98', stroke: '#c4b5fd', 'stroke-width': '3', 'stroke-linecap': 'round', fill: 'none' })
      );
    }
    if (!unlockedParts.has('mouth')) {
      defaultFace.append(
        s('path', { d: 'M 96 114 Q 100 118 104 114', stroke: '#c4b5fd', 'stroke-width': '2.5', 'stroke-linecap': 'round', fill: 'none' })
      );
    }
    root.append(defaultFace);

    // 4. Part: EYES
    const eyesGroup = s('g', { id: 'part-eyes' });
    eyesGroup.style.display = unlockedParts.has('eyes') ? 'inline' : 'none';
    // Left eye
    eyesGroup.append(
      s('circle', { cx: '82', cy: '96', r: '13', fill: '#0f172a', stroke: '#ffffff', 'stroke-width': '2' }),
      s('circle', { cx: '83', cy: '96', r: '9', fill: '#06b6d4' }),
      s('circle', { cx: '84', cy: '95', r: '6', fill: '#0f172a' }),
      s('circle', { cx: '81', cy: '92', r: '3', fill: '#ffffff' }),
      s('circle', { cx: '86', cy: '98', r: '1.5', fill: '#ffffff' })
    );
    // Right eye
    eyesGroup.append(
      s('circle', { cx: '118', cy: '96', r: '13', fill: '#0f172a', stroke: '#ffffff', 'stroke-width': '2' }),
      s('circle', { cx: '117', cy: '96', r: '9', fill: '#06b6d4' }),
      s('circle', { cx: '116', cy: '95', r: '6', fill: '#0f172a' }),
      s('circle', { cx: '114', cy: '92', r: '3', fill: '#ffffff' }),
      s('circle', { cx: '119', cy: '98', r: '1.5', fill: '#ffffff' })
    );
    root.append(eyesGroup);

    // 5. Part: HORNS
    const hornsGroup = s('g', { id: 'part-horns' });
    hornsGroup.style.display = unlockedParts.has('horns') ? 'inline' : 'none';
    hornsGroup.append(
      s('path', { d: 'M 68 58 C 54 36 44 20 56 16 C 66 14 74 34 80 54 Z', fill: 'url(#hornGrad)', stroke: '#b45309', 'stroke-width': '2' }),
      s('path', { d: 'M 132 58 C 146 36 156 20 144 16 C 134 14 126 34 120 54 Z', fill: 'url(#hornGrad)', stroke: '#b45309', 'stroke-width': '2' })
    );
    root.append(hornsGroup);

    // 6. Part: MOUTH
    const mouthGroup = s('g', { id: 'part-mouth' });
    mouthGroup.style.display = unlockedParts.has('mouth') ? 'inline' : 'none';
    mouthGroup.append(
      s('path', { d: 'M 85 114 Q 100 134 115 114 C 111 126 89 126 85 114 Z', fill: '#dc2626', stroke: '#991b1b', 'stroke-width': '2' }),
      s('polygon', { points: '90,114 93,120 96,114', fill: '#ffffff' }),
      s('polygon', { points: '104,114 107,120 110,114', fill: '#ffffff' })
    );
    root.append(mouthGroup);

    // 7. Part: ARMS
    const armsGroup = s('g', { id: 'part-arms' });
    armsGroup.style.display = unlockedParts.has('arms') ? 'inline' : 'none';
    armsGroup.append(
      s('path', { d: 'M 54 116 C 30 112 24 128 38 138 C 50 146 62 136 58 123 Z', fill: '#9333ea', stroke: '#581c87', 'stroke-width': '2' }),
      s('path', { d: 'M 146 116 C 170 102 180 118 168 133 C 154 146 142 134 142 123 Z', fill: '#9333ea', stroke: '#581c87', 'stroke-width': '2' })
    );
    root.append(armsGroup);

    // 8. Part: FEET (Sneakers)
    const feetGroup = s('g', { id: 'part-feet' });
    feetGroup.style.display = unlockedParts.has('feet') ? 'inline' : 'none';
    feetGroup.append(
      s('path', { d: 'M 70 156 L 70 166 C 58 166 52 175 58 181 C 66 187 88 187 90 181 C 92 173 86 159 82 156 Z', fill: '#06b6d4', stroke: '#0e7490', 'stroke-width': '2' }),
      s('path', { d: 'M 56 179 Q 74 186 90 179', stroke: '#facc15', 'stroke-width': '4', fill: 'none' }),
      s('path', { d: 'M 130 156 L 130 166 C 142 166 148 175 142 181 C 134 187 112 187 110 181 C 108 173 114 159 118 156 Z', fill: '#06b6d4', stroke: '#0e7490', 'stroke-width': '2' }),
      s('path', { d: 'M 144 179 Q 126 186 110 179', stroke: '#facc15', 'stroke-width': '4', fill: 'none' })
    );
    root.append(feetGroup);

    // 9. Part: ANTENNA
    const antGroup = s('g', { id: 'part-antenna', class: 'antenna-glow' });
    antGroup.style.display = unlockedParts.has('antenna') ? 'inline' : 'none';
    antGroup.append(
      s('path', { d: 'M 100 52 C 98 34 105 24 100 12', stroke: '#f59e0b', 'stroke-width': '3.5', 'stroke-linecap': 'round', fill: 'none' }),
      s('polygon', { points: '100,2 103,9 110,9 104,14 106,21 100,16 94,21 96,14 90,9 97,9', fill: '#fde047', stroke: '#b45309', 'stroke-width': '1.5' })
    );
    root.append(antGroup);

    svg.append(root);
    return svg;
  }

  // Create UI Header & Parts Tracker
  function createHeader(meta) {
    const hdr = h('header', 'game-header');

    const titleBox = h('div', 'header-title');
    titleBox.append(
      h('span', '', '🔮 Quái Thú Gacha'),
      h('span', 'title-badge', `Vòng ${meta.index + 1}/8`)
    );

    const tracker = h('div', 'parts-tracker');
    tracker.append(h('span', 'tracker-label', `Bộ phận: ${unlockedParts.size}/8`));

    BODY_PARTS.forEach(bp => {
      const badge = h('div', `part-badge ${unlockedParts.has(bp.id) ? 'unlocked' : ''}`, bp.icon);
      badge.title = `${bp.name} (${bp.en})`;
      tracker.append(badge);
    });

    hdr.append(titleBox, tracker);
    return hdr;
  }

  // Render Question and Arena
  function renderScene(q, meta) {
    clearInterval(timer);
    stage.replaceChildren();

    // 1. Header with tracker
    stage.append(createHeader(meta));

    // 2. Arena Card (Gacha Machine + Monster)
    const arena = h('div', 'arena-card');
    arena.id = 'arenaCard';

    const gachaBox = h('div', 'arena-box');
    const gWrap = h('div', 'gacha-wrap');
    gWrap.append(createGachaSVG());
    gachaBox.append(gWrap);

    const monsterBox = h('div', 'arena-box');
    const mWrap = h('div', 'monster-wrap');
    mWrap.append(createMonsterSVG());
    monsterBox.append(mWrap);

    arena.append(gachaBox, monsterBox);
    stage.append(arena);

    // 3. Question Card
    const qCard = h('div', 'question-card');
    const metaRow = h('div', 'q-meta');
    metaRow.append(h('span', 'q-badge', `Câu đố ${meta.index + 1} / 8`));
    qCard.append(metaRow);

    const prompt = h('h1', 'q-prompt', q.prompt);
    qCard.append(prompt);

    // Render Answer Options
    const optGrid = h('div', 'options-grid');
    q.options.forEach((o, idx) => {
      const btn = h('button', 'opt-btn');
      btn.type = 'button';
      btn.dataset.id = o.id;

      const letter = String.fromCharCode(65 + idx);
      const letterSpan = h('span', 'opt-letter', letter);
      const textSpan = h('span', 'opt-text', o.text);

      btn.append(letterSpan, textSpan);
      btn.addEventListener('click', () => {
        if (locked) return;
        locked = true;
        lockInputs();
        btn.classList.add('picked');
        cg.attempt(q.id, o.id);
      });

      optGrid.append(btn);
    });
    qCard.append(optGrid);

    // Timer Bar (if question has time limit)
    if (q.timeLimitMs) {
      const bar = h('div', 'timebar');
      const fill = h('div', 'timefill');
      bar.append(fill);
      qCard.append(bar);

      const deadline = Number(meta.servedAt || Date.now()) + q.timeLimitMs;
      timer = setInterval(() => {
        const left = Math.max(0, deadline - Date.now());
        fill.style.width = `${Math.min(100, (left / q.timeLimitMs) * 100)}%`;
        if (!left) {
          clearInterval(timer);
          if (!locked) {
            locked = true;
            lockInputs();
            cg.timeout(q.id);
          }
        }
      }, 200);
    }

    stage.append(qCard);
    if (locked) lockInputs();
  }

  // Handle Result and Reward Animation
  function handleResult(r) {
    clearInterval(timer);
    locked = true;
    lockInputs();

    const qCard = stage.querySelector('.question-card');
    const arena = document.getElementById('arenaCard');

    // Highlight options
    stage.querySelectorAll('.opt-btn').forEach(b => {
      if (b.dataset.id === r.correctOptionId) {
        b.classList.add('right');
      } else if (b.dataset.id === r.answer) {
        b.classList.add('wrong');
      }
    });

    // Feedback message
    const fb = h('div', `feedback-box ${r.status}`);
    const statusText = r.status === 'correct'
      ? `Chính xác! 🎉 Bạn được +${r.delta} điểm!`
      : r.status === 'timeout'
        ? `Hết giờ rồi! ⏰ Đáp án đúng là: ${r.correctText}`
        : `Chưa chính xác! 💡 Đáp án đúng là: ${r.correctText}`;

    fb.append(h('span', '', statusText));
    if (r.explanation) {
      fb.append(h('span', 'feedback-explain', r.explanation));
    }
    qCard?.append(fb);

    // Animate Gacha and Monster based on authority result
    if (r.status === 'correct') {
      // 1. Rotate Gacha crank
      const crank = document.getElementById('gachaCrank');
      if (crank) crank.classList.add('crank-rotating');
      playCrankSound();

      // Pick a random uncollected body part
      const remaining = BODY_PARTS.filter(p => !unlockedParts.has(p.id));
      const wonPart = remaining.length > 0
        ? remaining[Math.floor(Math.random() * remaining.length)]
        : BODY_PARTS[Math.floor(Math.random() * BODY_PARTS.length)];

      unlockedParts.add(wonPart.id);

      setTimeout(() => {
        playCapsuleOpenSound();

        // Show floating reward overlay
        if (arena) {
          const overlay = h('div', 'reward-overlay');
          const capsule = h('div', 'reward-capsule', '🎁');
          capsule.style.fontSize = '3.5rem';

          const title = h('h2', 'reward-title', `QUAY TRÚNG: ${wonPart.name}!`);
          const desc = h('p', 'reward-desc', `Bé quái thú vừa nhận được: ${wonPart.en} ${wonPart.icon}`);

          overlay.append(capsule, title, desc);
          arena.append(overlay);
        }

        // Attach part onto Monster SVG
        const partEl = document.getElementById(`part-${wonPart.id}`);
        if (partEl) partEl.style.display = 'inline';

        // Remove default sleepy eyes/mouth if replaced
        if (wonPart.id === 'eyes' || wonPart.id === 'mouth') {
          const defFace = document.getElementById('defaultFace');
          if (defFace) defFace.replaceChildren();
        }

        const mRoot = document.getElementById('monsterRoot');
        if (mRoot) mRoot.classList.add('monster-happy');

        playAttachSound();
      }, settings.reducedMotion ? 200 : 700);
    } else {
      // Wrong or timeout
      playFailSound();
      const mRoot = document.getElementById('monsterRoot');
      if (mRoot) mRoot.classList.add('monster-sad');
    }

    // Advance to next question after animation
    const qid = r.questionId;
    advancing = qid;
    const delay = settings.reducedMotion ? 1200 : 2500;
    setTimeout(() => {
      if (current?.id === qid) {
        current = null;
        advancing = null;
        if (cg.state?.pace !== 'teacher') {
          cg.advance(qid);
        }
      }
    }, delay);
  }

  // Bridge event subscriptions
  cg.on('settings', s => {
    settings = s;
    document.body.classList.toggle('reduced', !!s.reducedMotion);
  });

  cg.on('content', ({ questions: list }) => {
    questions = new Map(list.map(q => [q.id, q]));
    current = null;
    advancing = null;
    message('✨ Sẵn sàng tham gia Vòng quay Quái thú Gacha!');
  });

  cg.on('start', () => {
    if (!current) message('🚀 Bắt đầu trò chơi!');
  });

  cg.on('end', () => {
    locked = true;
    clearInterval(timer);
    const endBox = h('div', 'big-status');
    endBox.append(
      h('h1', '', '🏆 KẾT THÚC 8 VÒNG CHƠI!'),
      h('p', '', `Quái thú của bạn đã mở khóa được ${unlockedParts.size}/8 bộ phận cơ thể!`),
      h('p', '', 'Hãy xem bảng vinh danh và tổng kết trên màn hình nhé! ⭐')
    );
    stage.replaceChildren(endBox);
  });

  cg.on('error', e => {
    if (e.code !== 'PAUSED') locked = false;
    stage.append(h('p', 'feedback wrong', e.message));
  });

  cg.on('state', s => {
    if (s.status !== 'playing') return;
    if (s.paused) {
      current = null;
      locked = true;
      message('⏸️ Giáo viên đang tạm dừng. Em chờ một chút nhé!');
      return;
    }

    const q = s.question && questions.get(s.question.id);
    if (!q) {
      if (!s.question) {
        message(s.me?.waiting ? 'Em sẽ tham gia từ vòng tiếp theo nhé!' : '🎉 Em đã hoàn thành 8 vòng! Chờ các bạn nhé.');
      }
      return;
    }

    if (current?.id === q.id || advancing === q.id) {
      if (s.waitingForReveal && !stage.querySelector('.wait-reveal')) {
        stage.append(h('p', 'feedback-box wait-reveal', 'Đã nhận câu trả lời. Chờ cả lớp nộp nhé!'));
      }
      return;
    }

    current = q;
    locked = !!s.question.answered;
    renderScene(q, s.question);

    if (locked && s.waitingForReveal) {
      stage.append(h('p', 'feedback-box wait-reveal', 'Đã nhận câu trả lời. Chờ cả lớp nộp nhé!'));
    }
  });

  cg.on('result', r => {
    if (!current || r.questionId !== current.id) return;
    handleResult(r);
  });

  // Keyboard shortcut listener for options (1, 2, 3, 4)
  document.addEventListener('keydown', e => {
    const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
    const idx = keyMap[e.key.toLowerCase()];
    if (idx !== undefined) {
      const btns = stage.querySelectorAll('.opt-btn');
      if (btns[idx] && !btns[idx].disabled) {
        btns[idx].click();
      }
    }
  });
})();
