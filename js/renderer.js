// ══════════════════════════════════════════
//  Taller IA · Renderer (template engine)
//  Generates pathway HTML from SITE_DATA
//  Trucos sections stay as static HTML
// ══════════════════════════════════════════

const Renderer = {

  // ── Entry point: render all pathways ──
  renderAll() {
    const wrapper = document.querySelector('.app-wrapper');
    // Use :scope > to find only DIRECT child footer (not ones inside trucos-static)
    const footer = wrapper.querySelector(':scope > footer.footer');

    for (const pathway of Object.values(SITE_DATA.pathways)) {
      const el = this.renderPathway(pathway);
      if (footer) {
        wrapper.insertBefore(el, footer);
      } else {
        wrapper.appendChild(el);
      }
    }

    // Move static trucos sections into the rendered pathways
    this.moveTrucos();
  },

  // ── Move static trucos HTML into rendered pathways ──
  moveTrucos() {
    const container = document.getElementById('trucos-static');
    if (!container) return;

    for (const pathway of Object.values(SITE_DATA.pathways)) {
      // Scope placeholder search to the rendered pathway element
      const pathwayEl = document.getElementById(`pathway-${pathway.id}`);
      if (!pathwayEl) continue;

      for (const section of pathway.sections) {
        if (!section.trucosData) continue;

        // Find the static trucos content wrapper
        const staticEl = container.querySelector(`#static-${section.id}`);
        if (!staticEl) continue;

        // Find the placeholder WITHIN the rendered pathway (not globally,
        // because trucos-static also has elements with the same IDs)
        const placeholder = pathwayEl.querySelector(`[id="section-${section.id}"]`);
        if (!placeholder) continue;

        // The static wrapper contains a section-panel div with the real content.
        // Move all its children into the placeholder instead of replacing,
        // so we preserve the placeholder's position and active class.
        const content = staticEl.firstElementChild;
        if (content) {
          // Copy over the class from static content (has section-panel + any trucos classes)
          // but preserve the 'active' class if the placeholder has it
          const wasActive = placeholder.classList.contains('active');
          // Replace placeholder with the actual static section
          placeholder.parentNode.replaceChild(content, placeholder);
          if (wasActive) content.classList.add('active');
        }
      }
    }

    // Remove the hidden container
    container.remove();
  },

  // ── Pathway container ──
  renderPathway(pw) {
    const div = document.createElement('div');
    div.id = `pathway-${pw.id}`;
    div.className = 'pathway-content';

    div.innerHTML =
      `<button class="btn-back" data-action="goHome">← Volver al inicio</button>` +
      `<header class="header">` +
        `<div class="header-badge">${pw.badgeLabel}</div>` +
        `<h1>${pw.title}</h1>` +
        `<p>${pw.subtitle}</p>` +
      `</header>` +
      `<nav class="nav-pills">` +
        pw.sections.map(s => this.renderNavPill(s, pw)).join('') +
      `</nav>` +
      pw.sections.map(s => this.renderSection(s, pw)).join('');

    return div;
  },

  // ── Nav pill button ──
  renderNavPill(section, pw) {
    // Compute active class: use stored value or derive from section id
    const pillActiveClass = section.pillActiveClass || `active-${section.id}`;
    const activeClass = section.isDefault ? ` ${pillActiveClass}` : '';
    return (
      `<button class="nav-pill${activeClass}" ` +
        `data-section="${section.id}" data-nav="${pw.navFn}" ` +
        `data-active-class="${pillActiveClass}" ` +
        `id="pill-${section.id}">` +
        `<span class="pill-icon">${section.icon}</span> ${section.label}` +
      `</button>`
    );
  },

  // ── Section panel (tools or trucos placeholder) ──
  renderSection(section, pw) {
    // Trucos sections: render an empty placeholder that will be
    // replaced with static HTML by moveTrucos()
    if (section.trucosData) {
      const activeClass = section.isDefault ? ' active' : '';
      return `<div class="section-panel${activeClass}" id="section-${section.id}"></div>`;
    }

    const tools = section.tools.map(tid => SITE_DATA.tools[tid]);
    const activeClass = section.isDefault ? ' active' : '';

    return (
      `<div class="section-panel${activeClass}" id="section-${section.id}">` +
        `<div class="tool-grid">` +
          tools.map(t => this.renderToolCard(t)).join('') +
        `</div>` +
        tools.map(t => this.renderTutorialPanel(t)).join('') +
      `</div>`
    );
  },

  // ── Tool card ──
  renderToolCard(tool) {
    const chip = tool.chipNew ? ' <span class="chip-new">Nuevo</span>' : '';
    return (
      `<div class="tool-card ${tool.cardClass}" id="card-${tool.id}" data-tool="${tool.id}">` +
        `<div class="tool-logo-wrap"><img src="${tool.logo}" alt="${tool.logoAlt}"></div>` +
        `<div class="tool-card-name">${tool.name}${chip}</div>` +
        `<div class="tool-card-tagline">${tool.tagline}</div>` +
        `<div class="tool-card-arrow" id="arrow-${tool.id}">→</div>` +
      `</div>`
    );
  },

  // ── Tutorial panel ──
  renderTutorialPanel(tool) {
    return (
      `<div class="tutorial-panel" id="panel-${tool.id}">` +
        `<div class="tutorial-inner ${tool.tutClass}">` +
          tool.info.map(html => `<div class="tut-info">${html}</div>`).join('') +
          `<div class="tut-steps">` +
            tool.steps.map((step, i) =>
              `<div class="tut-step" data-action="toggleStep">` +
                `<div class="tut-step-num">${i + 1}</div>` +
                `<div class="tut-step-body">` +
                  `<div class="tut-step-title">${step.title}</div>` +
                  `<div class="tut-step-desc">${step.desc}</div>` +
                  `<div class="tut-step-hint">Toca para ver detalles ▼</div>` +
                  `<div class="tut-step-detail">${step.detail}</div>` +
                `</div>` +
              `</div>`
            ).join('') +
          `</div>` +
          `<div class="tut-task">` +
            `<h4>🎯 Tu misión</h4>` +
            `<p>${tool.mission}</p>` +
            `<div class="tut-task-example">${tool.example}</div>` +
          `</div>` +
          `<a href="${tool.link}" target="_blank" class="tut-open-btn">${tool.linkLabel}</a>` +
        `</div>` +
      `</div>`
    );
  },
};
