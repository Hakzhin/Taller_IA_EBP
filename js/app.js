// ══════════════════════════════════════════
//  Taller IA · Colegio El Buen Pastor
//  Unified JavaScript (single source of truth)
// ══════════════════════════════════════════

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

  animate();
})();

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

  document.querySelectorAll('.tutorial-panel').forEach(p => p.classList.remove('open'));
  document.querySelectorAll('.tool-card').forEach(c => c.classList.remove('active'));

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

// ── Section Navigation (within Infantil) ──
function showSection(section) {
  document.querySelectorAll('.tutorial-panel').forEach(p => p.classList.remove('open'));
  document.querySelectorAll('.tool-card').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('#pathway-infantil .section-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#pathway-infantil .nav-pill').forEach(p => {
    p.classList.remove('active-image', 'active-music', 'active-story', 'active-tips');
  });

  document.getElementById('section-' + section).classList.add('active');
  document.getElementById('pill-' + section).classList.add('active-' + section);
  window.scrollTo({ top: 300, behavior: 'smooth' });
}

// ── Section Navigation (within ESO) ──
function showEsoSection(section) {
  document.querySelectorAll('.tutorial-panel').forEach(p => p.classList.remove('open'));
  document.querySelectorAll('.tool-card').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('#pathway-eso .section-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#pathway-eso .nav-pill').forEach(p => {
    p.classList.remove('active-eso-image', 'active-eso-video', 'active-eso-notebook', 'active-eso-materials', 'active-eso-tips');
  });

  document.getElementById('section-' + section).classList.add('active');
  document.getElementById('pill-' + section).classList.add('active-' + section);
  window.scrollTo({ top: 300, behavior: 'smooth' });
}

// ── Section Navigation (within Primaria) ──
function showPrimariaSection(section) {
  document.querySelectorAll('.tutorial-panel').forEach(p => p.classList.remove('open'));
  document.querySelectorAll('.tool-card').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('#pathway-primaria .section-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#pathway-primaria .nav-pill').forEach(p => {
    p.classList.remove('active-pri-image', 'active-pri-video', 'active-pri-music', 'active-pri-notebook', 'active-pri-materials', 'active-pri-tips');
  });

  document.getElementById('section-' + section).classList.add('active');
  document.getElementById('pill-' + section).classList.add('active-' + section);
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

// ── Step Detail Toggle ──
function toggleDetail(stepEl) {
  const detail = stepEl.querySelector('.step-detail');
  const hint = stepEl.querySelector('.step-toggle-hint');
  if (detail) {
    detail.classList.toggle('open');
    if (detail.classList.contains('open')) {
      hint.textContent = 'Toca aquí para ocultar ▲';
    } else {
      hint.textContent = 'Toca aquí para ver más detalles ▼';
    }
  }
}

// ── Checklist & Progress ──
function toggleCheck(item, section) {
  item.classList.toggle('done');
  const box = item.querySelector('.check-box');
  box.textContent = item.classList.contains('done') ? '✓' : '';
  updateProgress(section);
}

function updateProgress(section) {
  const panel = document.getElementById('section-' + section);
  if (!panel) return;
  const total = panel.querySelectorAll('.checklist-item').length;
  const done = panel.querySelectorAll('.checklist-item.done').length;
  const pct = Math.round((done / total) * 100);

  const fill = document.getElementById('fill-' + section);
  const label = document.getElementById('label-' + section);
  if (fill) fill.style.width = pct + '%';
  if (label) {
    label.textContent = done === total
      ? '🎉 ¡Todos los pasos completados!'
      : done + ' de ' + total + ' pasos completados';
  }
}
