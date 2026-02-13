// ── Section Navigation (within Infantil) ──
function showSection(section) {
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
  document.querySelectorAll('#pathway-eso .section-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#pathway-eso .nav-pill').forEach(p => {
    p.classList.remove('active-eso-image', 'active-eso-video', 'active-eso-notebook', 'active-eso-materials', 'active-eso-tips');
  });

  document.getElementById('section-' + section).classList.add('active');
  document.getElementById('pill-' + section).classList.add('active-' + section);
  window.scrollTo({ top: 300, behavior: 'smooth' });
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
  const total = panel.querySelectorAll('.checklist-item').length;
  const done = panel.querySelectorAll('.checklist-item.done').length;
  const pct = Math.round((done / total) * 100);

  document.getElementById('fill-' + section).style.width = pct + '%';
  document.getElementById('label-' + section).textContent = done + ' de ' + total + ' pasos completados';

  if (done === total) {
    document.getElementById('label-' + section).textContent = '🎉 ¡Todos los pasos completados!';
  }
}

