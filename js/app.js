// ══════════════════════════════════════════
//  Taller IA · Colegio El Buen Pastor
//  Unified JavaScript (single source of truth)
// ══════════════════════════════════════════

// ── Welcome Clip ──
(function () {
  var KEY = 'welcome_clip_seen';
  var TIMELINE = [[0,0],[3500,1],[8000,2],[12500,3],[16000,4]];
  var TOTAL = 18500;
  var clipHTML = '';

  // Save template HTML before first removal
  var initial = document.getElementById('welcome-clip');
  if (initial) {
    clipHTML = initial.outerHTML;
    if (localStorage.getItem(KEY)) { initial.remove(); }
    else { playClip(initial); }
  }

  function playClip(overlay) {
    document.body.classList.add('wc-active');
    var scenes = overlay.querySelectorAll('.wc-scene');
    var skip = overlay.querySelector('.wc-skip');
    var timeouts = [];

    function run() {
      TIMELINE.forEach(function (entry) {
        var ms = entry[0], idx = entry[1];
        timeouts.push(setTimeout(function () {
          scenes.forEach(function (s) { s.classList.remove('active'); });
          scenes[idx].classList.add('active');
        }, ms));
      });
      timeouts.push(setTimeout(finish, TOTAL));
    }

    function finish() {
      timeouts.forEach(clearTimeout);
      localStorage.setItem(KEY, '1');
      overlay.classList.add('wc-done');
      document.body.classList.remove('wc-active');
      document.querySelectorAll('.morph-logo, .morph-title, .landing-header p, .landing-subtitle, .pathway-card, .mothership-card').forEach(function (el) {
        el.style.animation = 'none';
        void el.offsetHeight;
        el.style.animation = '';
      });
      if (typeof window._startNeuralCanvas === 'function') window._startNeuralCanvas();
      setTimeout(function () { overlay.remove(); }, 1200);
    }

    skip.addEventListener('click', finish);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) finish(); });
    run();
  }

  // Expose replay for footer link
  window.replayWelcomeClip = function () {
    if (!clipHTML || document.getElementById('welcome-clip')) return;
    // Scroll to top first
    window.scrollTo({ top: 0, behavior: 'instant' });
    // Show landing screen if in a pathway
    var landing = document.getElementById('landing-screen');
    if (landing) landing.style.display = '';
    document.querySelectorAll('.pathway-content').forEach(function (p) { p.classList.remove('active'); });
    // Re-insert and play
    var tmp = document.createElement('div');
    tmp.innerHTML = clipHTML;
    var overlay = tmp.firstElementChild;
    overlay.classList.remove('wc-done');
    document.body.insertBefore(overlay, document.body.firstChild);
    playClip(overlay);
  };
})();

// ── Initialize: render pathways from data ──
Renderer.renderAll();

// ── Neural Particle Animation (Landing) ──
(function () {
  const canvas = document.getElementById('neural-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const colors = ['#ff7b54', '#7c5cbf', '#2ec4a0', '#6366f1'];
  const DURATION = 1400;
  let particles = [];

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  function createParticles() {
    particles = [];
    for (let i = 0; i < 45; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2.5 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2
      });
    }
  }

  function animate() {
    resize();
    createParticles();
    const cx = canvas.width / 2;
    const cy = canvas.height * 0.32;
    const start = performance.now();

    function draw(now) {
      const t = Math.min((now - start) / DURATION, 1);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const pull = t * t;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx * (1 - pull) + (cx - p.x) * pull * 0.05;
        p.y += p.vy * (1 - pull) + (cy - p.y) * pull * 0.05;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 - t * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 1 - t * 0.8;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dist = Math.hypot(p.x - q.x, p.y - q.y);
          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = (1 - dist / 110) * (1 - t * 0.9) * 0.35;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      if (t < 1) {
        requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    requestAnimationFrame(draw);
  }

  window._startNeuralCanvas = animate;
  if (!document.body.classList.contains('wc-active')) animate();
})();

// ── Release cardFadeIn so hover transforms work ──
document.querySelectorAll('.pathway-card').forEach(card => {
  card.addEventListener('animationend', () => {
    card.style.animation = 'none';
  });
});

// ── Pathway Navigation (Landing ↔ Itinerary) ──
function showPathway(pathway) {
  document.getElementById('landing-screen').style.display = 'none';
  document.querySelectorAll('.pathway-content').forEach(p => p.classList.remove('active'));
  document.getElementById('pathway-' + pathway).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goHome() {
  document.querySelectorAll('.pathway-content').forEach(p => p.classList.remove('active'));
  document.getElementById('landing-screen').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Tool Card Toggle ──
function toggleTool(toolId) {
  const panel = document.getElementById('panel-' + toolId);
  const card = document.getElementById('card-' + toolId);
  if (!panel || !card) return;
  const isOpen = panel.classList.contains('open');

  // Close all panels/cards in the same pathway
  const pathwayEl = panel.closest('.pathway-content');
  if (pathwayEl) {
    pathwayEl.querySelectorAll('.tutorial-panel').forEach(p => p.classList.remove('open'));
    pathwayEl.querySelectorAll('.tool-card').forEach(c => c.classList.remove('active'));
  }

  if (!isOpen) {
    panel.classList.add('open');
    card.classList.add('active');
    setTimeout(() => {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }
}

// ── Tutorial Step Detail Toggle ──
function toggleStepDetail(stepEl) {
  const detail = stepEl.querySelector('.tut-step-detail');
  const hint = stepEl.querySelector('.tut-step-hint');
  if (!detail) return;
  const isOpen = detail.classList.contains('open');

  stepEl.closest('.tut-steps').querySelectorAll('.tut-step-detail').forEach(d => d.classList.remove('open'));
  stepEl.closest('.tut-steps').querySelectorAll('.tut-step-hint').forEach(h => {
    h.textContent = 'Toca para ver detalles ▼';
  });

  if (!isOpen) {
    detail.classList.add('open');
    if (hint) hint.textContent = 'Toca para ocultar ▲';
  }
}

// ── Unified Section Navigation ──
// Works for all pathways (infantil, primaria, eso) using data-active-class
function showPathwaySection(sectionId, pillEl) {
  // Find the pathway container from the pill button
  const pathwayEl = pillEl.closest('.pathway-content');
  if (!pathwayEl) return;

  // Close tool panels/cards
  pathwayEl.querySelectorAll('.tutorial-panel').forEach(p => p.classList.remove('open'));
  pathwayEl.querySelectorAll('.tool-card').forEach(c => c.classList.remove('active'));

  // Deactivate all section panels
  pathwayEl.querySelectorAll('.section-panel').forEach(p => p.classList.remove('active'));

  // Deactivate all nav pills (remove all possible active classes)
  pathwayEl.querySelectorAll('.nav-pill').forEach(p => {
    const ac = p.dataset.activeClass;
    if (ac) p.classList.remove(ac);
  });

  // Activate the target section
  const sectionEl = document.getElementById('section-' + sectionId);
  if (sectionEl) sectionEl.classList.add('active');

  // Activate the pill using its data-active-class
  const activeClass = pillEl.dataset.activeClass;
  if (activeClass) pillEl.classList.add(activeClass);

  window.scrollTo({ top: 300, behavior: 'smooth' });
}

// ── Trucos Sub-Tab Navigation ──
function showTrucosTab(tabId, level) {
  const prefix = level ? level + '-' : '';
  const targetPanel = document.getElementById('tt-' + prefix + tabId);
  const targetBtn = document.getElementById('ttb-' + prefix + tabId);

  if (!targetPanel || !targetBtn) return;

  // Find the containing section-panel
  const container = targetPanel.closest('.section-panel');
  if (!container) return;

  // Deactivate all within this container
  container.querySelectorAll('.trucos-tab-btn').forEach(b => b.classList.remove('tt-active'));
  container.querySelectorAll('.trucos-panel').forEach(p => p.classList.remove('tt-visible'));

  // Activate target
  targetPanel.classList.add('tt-visible');
  targetBtn.classList.add('tt-active');
}

// ── Event Delegation (replaces inline onclick handlers) ──
document.addEventListener('click', function (e) {
  const target = e.target;

  // data-pathway → showPathway
  const pathwayEl = target.closest('[data-pathway]');
  if (pathwayEl) {
    showPathway(pathwayEl.dataset.pathway);
    return;
  }

  // data-action="goHome" → goHome
  const actionEl = target.closest('[data-action="goHome"]');
  if (actionEl) {
    goHome();
    return;
  }

  // data-section + data-nav → unified section navigation
  const navEl = target.closest('[data-section][data-nav]');
  if (navEl) {
    showPathwaySection(navEl.dataset.section, navEl);
    return;
  }

  // data-tool → toggleTool
  const toolEl = target.closest('[data-tool]');
  if (toolEl) {
    toggleTool(toolEl.dataset.tool);
    return;
  }

  // data-action="toggleStep" → toggleStepDetail
  const stepEl = target.closest('[data-action="toggleStep"]');
  if (stepEl) {
    toggleStepDetail(stepEl);
    return;
  }

  // data-tab + data-level → showTrucosTab
  const tabEl = target.closest('[data-tab][data-level]');
  if (tabEl) {
    showTrucosTab(tabEl.dataset.tab, tabEl.dataset.level);
    return;
  }
});
