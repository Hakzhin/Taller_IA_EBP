// ══════════════════════════════════════════
//  Taller IA · BupIA (in-app assistant)
//  Hoy + Tablón + Chat + Prompteca + Explorar
// ══════════════════════════════════════════

const Assistant = {

  // ── State ──
  isOpen: false,
  activeTab: 'hoy',
  chatHistory: [],
  exploreHistory: [],
  wizardState: { intent: null, level: null, sectionId: null },
  isSending: false,
  promptecaData: null,
  promptecaFilters: { etapa: null, categoria: null },
  rutaWizardState: { step: 0, etapa: null, asignatura: null, nivel: null },

  // ── DOM refs (set in buildDOM) ──
  root: null,
  fab: null,
  panel: null,
  badge: null,

  // ── Anthropic Direct API (for GitHub Pages) ──
  ANTHROPIC_URL: 'https://api.anthropic.com/v1/messages',
  ANTHROPIC_MODEL: 'claude-haiku-4-5-20251001',
  ANTHROPIC_VERSION: '2023-06-01',

  SYSTEM_PROMPTS: (() => {
    const CATALOG = `Catalogo de herramientas disponibles en la plataforma:

INFANTIL (3-6 anos):
- Imagenes: Gemini (Google), Grok Aurora (xAI, gratuito), Copilot/DALL-E (Microsoft)
- Musica: Suno (canciones con letra y voz), Gemini (piezas instrumentales)
- Cuentos: Storybook con Gemini (cuentos ilustrados automaticos)

PRIMARIA (6-12 anos):
- Imagenes: Gemini, Grok, Copilot
- Videos: Flow/Runway (clips cortos), Grok Video, Luma Dream Machine
- Musica: Suno, Gemini
- Cuadernos: NotebookLM (resumenes en audio, podcasts de temas)
- Materiales: Gemini, ChatGPT, Claude (programaciones, fichas, examenes, rubricas)

ESO (12-16 anos):
- Imagenes: Gemini, Grok, Copilot
- Videos: Flow, Grok Video, Luma
- Cuadernos: NotebookLM
- Materiales: Gemini, ChatGPT, Claude`;

    const BASE = `Eres "BupIA", el asistente de la plataforma "Taller IA" del Colegio El Buen Pastor (Madrid).
Ayudas a profesores a descubrir y usar herramientas de IA para educacion.

${CATALOG}

Reglas:
- Responde SIEMPRE en espanol.
- Se conciso y practico (los profesores tienen poco tiempo).
- Al recomendar, usa nombres exactos del catalogo. Indica que herramienta y por que.
- Si preguntan por herramientas fuera del catalogo, di que solo conoces las de la plataforma pero que pueden existir otras.
- Para consejos de prompts, referencia la "formula de 4 ingredientes": QUE quiero + COMO + PARA QUIEN + DETALLES.
- No inventes URLs ni funcionalidades que no existan.
- Usa un tono cercano y motivador.`;

    return {
      chat: BASE,
      recommend: BASE + `\n\nContexto adicional: El usuario esta en el recomendador de herramientas.\nResponde con 2-3 frases practicas explicando por que esas herramientas son utiles para su caso.\nNo repitas la lista de herramientas (ya se muestra en la interfaz).\nSugiere un prompt de ejemplo que podrian probar.`,
      bulletin: BASE + `\n\nContexto adicional: Genera un consejo breve y practico del dia para profesores que usan IA en el aula.\nMenciona una herramienta concreta del catalogo.\nFormato: un titulo llamativo (max 8 palabras) y 2-3 frases de contenido.\nResponde SOLO con JSON valido: {"title": "...", "body": "...", "toolId": "..."}\nEl toolId debe ser un ID del catalogo como "pri-gemini", "eso-chatgpt", "inf-suno", etc.`,
      explore: `Eres "BupIA" en modo Explorador. Ayudas a profesores del Colegio El Buen Pastor (Madrid) a descubrir herramientas de IA EXTERNAS que NO estan en su plataforma.

Tu publico son docentes con pocos o nulos conocimientos informaticos. Esto define TODO tu estilo:

TONO Y ESTILO:
- Cercano, humano, incluso con toques de humor o ironia suave ("Si, otra IA mas... pero esta merece la pena, prometido").
- Nada de jerga tecnica. Si usas un termino tecnico, explicalo entre parentesis en lenguaje llano.
- Frases cortas. Parrafos cortos. Que no parezca un manual de instrucciones.
- Transmite que es FACIL y que ellos PUEDEN. Nada de "configura el endpoint" sino "entra, dale a crear y listo".
- Cuando menciones una herramienta, explica para que sirve como se lo contarias a un companero en el cafe.

FORMATO DE RESPUESTA (usa markdown):
Para cada herramienta recomendada usa EXACTAMENTE este formato:

---

### [Icono] Nombre de la herramienta

**Que es:** Explicacion breve y clara en lenguaje humano.

**Lo bueno:** Que tiene de especial, por que merece la pena probarla.

**Plan gratis:** Que puedes hacer sin pagar (y limites si los hay).

**Ejemplo en el aula:** Un caso concreto adaptado a la etapa del profesor.

[Enlace directo a la herramienta](https://url-real.com)

---

IMPORTANTE: Solo recomienda herramientas que usen Inteligencia Artificial como funcionalidad central (generacion de texto, imagenes, video, audio, analisis automatico, tutores IA, etc.). NO recomiendes herramientas genericas de productividad, diseno o gestion que no incorporen IA de forma significativa.

Herramientas YA catalogadas (NO las recomiendes): Gemini, Grok/Aurora, Copilot/DALL-E, Suno, Flow/Runway, Luma Dream Machine, NotebookLM, ChatGPT, Claude, Storybook.

Contexto importante: Los docentes del colegio tienen acceso a **Canva para Educadores** (plan premium gratuito para profesores). Esto incluye funciones IA de Canva (Magic Write, Magic Design, texto a imagen, presentaciones IA, etc.), miles de plantillas educativas y herramientas de diseno avanzadas. Tenlo en cuenta al recomendar: si Canva ya cubre una necesidad, mencionalo como alternativa que ya tienen disponible antes de sugerir otra herramienta externa. No lo cuentes como una de las 2-3 recomendaciones externas.

Etapas educativas del colegio:
- Infantil (3-6 anos)
- Primaria (6-12 anos)
- ESO (12-16 anos)

Criterios para recomendar una herramienta:
1. GRATUITA o con plan gratuito generoso (sin tarjeta de credito obligatoria)
2. Accesible desde navegador (Chrome/Edge), sin instalacion de software
3. Registro simple (idealmente Google SSO o sin cuenta)
4. Alto valor pedagogico: genera recursos utiles para el aula
5. Funciona razonablemente en espanol
6. Aporta algo que Canva para Educadores NO cubre (o lo hace significativamente mejor)

Reglas:
- Responde SIEMPRE en espanol
- Recomienda 2-3 herramientas por consulta, no mas
- Si no estas seguro de que una herramienta siga siendo gratuita, dilo con naturalidad
- No inventes URLs ni funcionalidades
- Los enlaces deben ser URLs reales y clicables con formato markdown: [texto](url)`,
      ruta: BASE + `\n\nContexto adicional: El profesor quiere una RUTA DE APRENDIZAJE personalizada de 4 semanas para aprender a usar IA en el aula.

Genera una ruta de 4 semanas con EXACTAMENTE este formato JSON (sin texto antes ni despues, SOLO el JSON):
{
  "titulo": "Tu ruta de IA para [asignatura] en [etapa]",
  "resumen": "Frase motivadora de 1-2 lineas",
  "semanas": [
    {
      "numero": 1,
      "titulo": "Titulo de la semana",
      "objetivo": "Que lograras esta semana",
      "herramientas": ["nombre1"],
      "actividad": "Descripcion concreta de lo que hacer (2-3 frases)",
      "prompt_recomendado_id": null,
      "consejo": "Tip practico breve"
    }
  ]
}

Reglas:
- Semana 1: empieza con la herramienta mas facil para ese nivel. Principiante: Gemini. Intermedio: ChatGPT. Avanzado: combinar varias.
- Cada semana introduce algo nuevo de forma gradual.
- Actividades CONCRETAS relacionadas con la asignatura real del profesor.
- Cuando sea posible, referencia prompts de la Prompteca usando su "id" en prompt_recomendado_id.
- Responde SOLO con el JSON valido. Sin texto adicional.`,
    };
  })(),

  // ── Level metadata ──
  LEVELS: {
    infantil: { icon: '🎒', name: 'Infantil', ages: '3-6 años' },
    primaria: { icon: '📚', name: 'Primaria', ages: '6-12 años' },
    eso:      { icon: '🎓', name: 'ESO', ages: '12-16 años' },
  },

  // ── Intent options: "What do you want to do today?" ──
  INTENTS: [
    { id: 'image',     icon: '🎨', label: 'Crear imágenes',     desc: 'Ilustraciones, pósters, fichas visuales',     categories: ['image', 'pri-image', 'eso-image'] },
    { id: 'video',     icon: '🎬', label: 'Hacer vídeos',       desc: 'Clips cortos, animaciones, presentaciones',   categories: ['pri-video', 'eso-video'] },
    { id: 'music',     icon: '🎵', label: 'Componer música',    desc: 'Canciones, melodías, efectos de sonido',       categories: ['music', 'pri-music'] },
    { id: 'materials', icon: '📝', label: 'Generar materiales', desc: 'Exámenes, fichas, programaciones, rúbricas',   categories: ['pri-materials', 'eso-materials'] },
    { id: 'notebook',  icon: '📓', label: 'Resumir y estudiar', desc: 'Podcasts de apuntes, resúmenes en audio',      categories: ['pri-notebook', 'eso-notebook'] },
    { id: 'story',     icon: '📖', label: 'Crear cuentos',      desc: 'Cuentos ilustrados para los más pequeños',     categories: ['story'] },
  ],

  // ── Asignaturas (for Mi Ruta wizard) ──
  ASIGNATURAS: [
    { id: 'mates',    icon: '📐', label: 'Matemáticas' },
    { id: 'lengua',   icon: '📝', label: 'Lengua' },
    { id: 'ciencias', icon: '🔬', label: 'Ciencias' },
    { id: 'ingles',   icon: '🇬🇧', label: 'Inglés' },
    { id: 'musica',   icon: '🎵', label: 'Música' },
    { id: 'ef',       icon: '⚽', label: 'Ed. Física' },
    { id: 'religion', icon: '✝️', label: 'Religión' },
    { id: 'plastica', icon: '🎨', label: 'Plástica' },
    { id: 'general',  icon: '📚', label: 'General / Tutorías' },
  ],

  // ═══════════════════════════════════════
  //  Initialization
  // ═══════════════════════════════════════

  init() {
    this.root = document.getElementById('ai-assistant-root');
    if (!this.root) return;

    this.loadState();
    this.buildDOM();
    this.attachEvents();
    this.renderActiveTab();
    this.updateBadge();
    this.loadExternalCatalog();
    this.loadPrompteca();
  },

  async loadExternalCatalog() {
    try {
      const resp = await fetch('data/herramientas_externas.json');
      if (!resp.ok) return;
      const data = await resp.json();

      let text = `\n\nCATALOGO DE HERRAMIENTAS EXTERNAS VERIFICADAS (revision ${data.ultima_revision || '?'}):\n`;
      text += 'Usa este catalogo como referencia PRIORITARIA al recomendar. Son herramientas verificadas por el equipo del colegio.\n';

      for (const cat of (data.categorias || [])) {
        text += `\n${cat.icono} ${cat.nombre.toUpperCase()}:\n`;
        for (const h of (cat.herramientas || [])) {
          const star = h.destacado ? ' ⭐' : '';
          const etapas = (h.etapas || []).join(', ');
          text += `- ${h.nombre}${star} (${h.url}) — ${h.que_hace} Plan gratis: ${h.plan_gratis} Etapas: ${etapas}\n`;
        }
      }

      this.SYSTEM_PROMPTS.explore += text;
      console.log(`[BupIA] Catalogo externo cargado (${data.categorias.reduce((n, c) => n + c.herramientas.length, 0)} herramientas)`);
    } catch (e) {
      // Catalog not available — explorer uses model knowledge only
    }
  },

  async loadPrompteca() {
    try {
      const resp = await fetch('data/prompts.json');
      if (!resp.ok) return;
      this.promptecaData = await resp.json();
      console.log(`[BupIA] Prompteca cargada (${this.promptecaData.prompts.length} prompts)`);
    } catch (e) {
      this.promptecaData = null;
    }
  },

  // ═══════════════════════════════════════
  //  DOM Construction
  // ═══════════════════════════════════════

  buildDOM() {
    this.root.innerHTML = `
      <button class="assistant-fab" data-assistant-action="toggle">
        <img class="fab-avatar" src="img/bupia.png" alt="BupIA">
        <span class="fab-badge"></span>
      </button>

      <!-- Intro video modal (first visit) -->
      <div class="bupia-intro-overlay" id="bupia-intro-overlay">
        <div class="bupia-intro-modal">
          <video class="bupia-intro-video" id="bupia-intro-video"
                 src="media/bupia-intro.mp4"
                 playsinline preload="metadata"></video>
          <button class="bupia-intro-skip" id="bupia-intro-skip">Saltar ⏭️</button>
        </div>
      </div>

      <div class="assistant-panel">
        <div class="assistant-header">
          <div class="assistant-tabs">
            <button class="assistant-tab-btn" data-assistant-tab="hoy"><span class="tab-icon">🚀</span><span class="tab-label"> Hoy</span></button>
            <button class="assistant-tab-btn" data-assistant-tab="tablon"><span class="tab-icon">📋</span><span class="tab-label"> Tablón</span></button>
            <button class="assistant-tab-btn" data-assistant-tab="prompteca"><span class="tab-icon">📖</span><span class="tab-label"> Prompts</span></button>
            <button class="assistant-tab-btn" data-assistant-tab="explorar"><span class="tab-icon">🔍</span><span class="tab-label"> Explorar</span></button>
            <button class="assistant-tab-btn" data-assistant-tab="chat"><span class="tab-icon">💬</span><span class="tab-label"> Chat</span></button>
          </div>
          <button class="assistant-close-btn" data-assistant-action="close">✕</button>
        </div>
        <div class="assistant-body">
          <div class="assistant-tab-content" id="assistant-hoy"></div>
          <div class="assistant-tab-content" id="assistant-tablon"></div>
          <div class="assistant-tab-content" id="assistant-prompteca"></div>
          <div class="assistant-tab-content" id="assistant-chat">
            <div class="chat-messages" id="chat-messages"></div>
            <div class="chat-typing" id="chat-typing">
              <div class="chat-typing-dots">
                <div class="chat-typing-dot"></div>
                <div class="chat-typing-dot"></div>
                <div class="chat-typing-dot"></div>
              </div>
            </div>
          </div>
          <div class="assistant-tab-content" id="assistant-explorar">
            <div class="chat-messages" id="explore-messages"></div>
            <div class="chat-typing" id="explore-typing">
              <div class="chat-typing-dots">
                <div class="chat-typing-dot"></div>
                <div class="chat-typing-dot"></div>
                <div class="chat-typing-dot"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="chat-input-bar" id="chat-input-bar" style="display:none">
          <input type="text" class="chat-input" id="chat-input"
                 placeholder="Pregunta a BupIA..."
                 autocomplete="off">
          <button class="chat-send-btn" id="chat-send" data-assistant-action="send">➤</button>
        </div>
        <div class="assistant-footer">
          BupIA · Powered by Claude
        </div>
      </div>
    `;

    this.fab = this.root.querySelector('.assistant-fab');
    this.panel = this.root.querySelector('.assistant-panel');
    this.badge = this.root.querySelector('.fab-badge');
  },

  // ═══════════════════════════════════════
  //  Events
  // ═══════════════════════════════════════

  attachEvents() {
    // Delegated click handler on root
    this.root.addEventListener('click', (e) => {
      const target = e.target;

      // Intro video: skip button
      if (target.closest('#bupia-intro-skip')) {
        this.closeIntroVideo(true);
        return;
      }
      // Intro video: click overlay backdrop to skip
      if (target.id === 'bupia-intro-overlay') {
        this.closeIntroVideo(true);
        return;
      }
      // Intro video: rewatch button
      if (target.closest('[data-bupia-rewatch]')) {
        this.showIntroVideo();
        return;
      }

      // FAB toggle
      const actionEl = target.closest('[data-assistant-action]');
      if (actionEl) {
        const action = actionEl.dataset.assistantAction;
        if (action === 'toggle') this.toggle();
        else if (action === 'close') this.close();
        else if (action === 'send') this.handleSend();
        return;
      }

      // Tab switch
      const tabEl = target.closest('[data-assistant-tab]');
      if (tabEl) {
        this.switchTab(tabEl.dataset.assistantTab);
        return;
      }

      // Wizard: intent selection (new proactive flow)
      const intentEl = target.closest('[data-wizard-intent]');
      if (intentEl) {
        this.selectIntent(intentEl.dataset.wizardIntent);
        return;
      }

      // Wizard: level selection
      const levelEl = target.closest('[data-wizard-level]');
      if (levelEl) {
        this.selectLevel(levelEl.dataset.wizardLevel);
        return;
      }

      // Wizard: tool click → navigate to main app
      const toolEl = target.closest('[data-wizard-tool]');
      if (toolEl) {
        this.navigateToTool(toolEl.dataset.wizardTool, toolEl.dataset.wizardSection, toolEl.dataset.wizardPathway);
        return;
      }

      // Wizard: back button
      const backEl = target.closest('[data-wizard-back]');
      if (backEl) {
        const backTo = backEl.dataset.wizardBack;
        if (backTo === 'intents') {
          this.wizardState = { intent: null, level: null, sectionId: null };
          this.renderHoy();
        } else if (backTo === 'levels') {
          this.wizardState.level = null;
          this.wizardState.sectionId = null;
          this.renderHoy();
        }
        return;
      }

      // Bulletin: tool link
      const bulletinLink = target.closest('[data-bulletin-tool]');
      if (bulletinLink) {
        const toolId = bulletinLink.dataset.bulletinTool;
        this.navigateToToolFromId(toolId);
        return;
      }

      // Explore: quick-action chip
      const exploreChip = target.closest('[data-explore-query]');
      if (exploreChip) {
        const query = exploreChip.dataset.exploreQuery;
        const chipsContainer = this.root.querySelector('.explore-chips');
        if (chipsContainer) chipsContainer.remove();
        this.sendExploreMessage(query);
        return;
      }

      // Explore: reset / new search
      const exploreReset = target.closest('[data-explore-reset]');
      if (exploreReset) {
        this.resetExplorar();
        return;
      }

      // Prompteca: filter by etapa
      const etapaFilter = target.closest('[data-prompteca-etapa]');
      if (etapaFilter) {
        const val = etapaFilter.dataset.promptecaEtapa;
        this.promptecaFilters.etapa = val === 'todas' ? null : val;
        this.renderPrompteca();
        return;
      }

      // Prompteca: filter by category
      const catFilter = target.closest('[data-prompteca-cat]');
      if (catFilter) {
        const val = catFilter.dataset.promptecaCat;
        this.promptecaFilters.categoria = (this.promptecaFilters.categoria === val) ? null : val;
        this.renderPrompteca();
        return;
      }

      // Prompteca: toggle expand
      const toggleBtn = target.closest('[data-prompteca-toggle]');
      if (toggleBtn) {
        const id = toggleBtn.dataset.promptecaToggle;
        const body = this.root.querySelector(`#prompt-body-${id}`);
        if (body) {
          const isOpen = body.style.display !== 'none';
          body.style.display = isOpen ? 'none' : 'block';
          toggleBtn.textContent = isOpen ? '▼' : '▲';
        }
        return;
      }

      // Prompteca: copy
      const copyBtn = target.closest('[data-prompteca-copy]');
      if (copyBtn) {
        const id = copyBtn.dataset.promptecaCopy;
        this.copyPromptToClipboard(id, copyBtn);
        return;
      }

      // Prompteca: personalize
      const persBtn = target.closest('[data-prompteca-personalize]');
      if (persBtn) {
        this.personalizePrompt(persBtn.dataset.promptecaPersonalize);
        return;
      }

      // Mi Ruta: actions (start, regenerate)
      const rutaAction = target.closest('[data-ruta-action]');
      if (rutaAction) {
        const action = rutaAction.dataset.rutaAction;
        if (action === 'start' || action === 'regenerate') {
          this.rutaWizardState = { step: 1, etapa: null, asignatura: null, nivel: null };
          this.renderHoy();
        } else if (action === 'back-hoy') {
          this.rutaWizardState = { step: 0, etapa: null, asignatura: null, nivel: null };
          this.renderHoy();
        } else if (action === 'back-step2') {
          this.rutaWizardState.step = 2;
          this.rutaWizardState.asignatura = null;
          this.rutaWizardState.nivel = null;
          this.renderHoy();
        }
        return;
      }

      // Mi Ruta: wizard steps
      const rutaEtapa = target.closest('[data-ruta-etapa]');
      if (rutaEtapa) {
        this.rutaWizardState.etapa = rutaEtapa.dataset.rutaEtapa;
        this.rutaWizardState.step = 2;
        this.renderHoy();
        return;
      }

      const rutaAsig = target.closest('[data-ruta-asig]');
      if (rutaAsig) {
        this.rutaWizardState.asignatura = rutaAsig.dataset.rutaAsig;
        this.rutaWizardState.step = 3;
        this.renderHoy();
        return;
      }

      const rutaNivel = target.closest('[data-ruta-nivel]');
      if (rutaNivel) {
        this.rutaWizardState.nivel = rutaNivel.dataset.rutaNivel;
        this.rutaWizardState.step = 4;
        this.renderHoy();
        this.generateRuta();
        return;
      }

      // Mi Ruta: prompt link → navigate to prompteca
      const rutaPrompt = target.closest('[data-ruta-prompt]');
      if (rutaPrompt) {
        this.navigateToPromptecaPrompt(rutaPrompt.dataset.rutaPrompt);
        return;
      }
    });

    // Chat input: Enter key
    const chatInput = this.root.querySelector('#chat-input');
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSend();
        }
      });
    }
  },

  // ═══════════════════════════════════════
  //  Open / Close / Toggle
  // ═══════════════════════════════════════

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  },

  open() {
    // First visit → show intro video instead of panel
    if (!localStorage.getItem('bupia_intro_seen')) {
      this.showIntroVideo();
      return;
    }
    this.isOpen = true;
    this.panel.classList.add('open');
    this.fab.classList.add('open');
    this.renderActiveTab();
    this.saveState();
  },

  // ── Intro Video ──

  showIntroVideo() {
    const overlay = this.root.querySelector('#bupia-intro-overlay');
    const video = this.root.querySelector('#bupia-intro-video');
    if (!overlay || !video) return;

    overlay.classList.add('visible');
    video.currentTime = 0;
    video.play().catch(() => {});

    // When video ends naturally → close and open BupIA
    video.onended = () => this.closeIntroVideo(true);
  },

  closeIntroVideo(openPanel) {
    const overlay = this.root.querySelector('#bupia-intro-overlay');
    const video = this.root.querySelector('#bupia-intro-video');
    if (overlay) overlay.classList.remove('visible');
    if (video) { video.pause(); video.onended = null; }

    localStorage.setItem('bupia_intro_seen', '1');

    if (openPanel) {
      this.isOpen = true;
      this.panel.classList.add('open');
      this.fab.classList.add('open');
      this.renderActiveTab();
      this.saveState();
    }
  },

  close() {
    this.isOpen = false;
    this.panel.classList.remove('open');
    this.fab.classList.remove('open');
    this.saveState();
  },

  // ═══════════════════════════════════════
  //  Tab Switching
  // ═══════════════════════════════════════

  switchTab(tab) {
    this.activeTab = tab;

    // Update tab buttons
    this.root.querySelectorAll('.assistant-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.assistantTab === tab);
    });

    // Update tab content
    this.root.querySelectorAll('.assistant-tab-content').forEach(el => {
      el.classList.remove('active');
    });

    // Show/hide chat input bar
    const inputBar = this.root.querySelector('#chat-input-bar');
    const showInput = (tab === 'chat' || tab === 'explorar');
    if (inputBar) inputBar.style.display = showInput ? 'flex' : 'none';

    const chatInput = this.root.querySelector('#chat-input');
    if (chatInput) chatInput.placeholder = (tab === 'explorar') ? 'Busca herramientas de IA...' : 'Pregunta a BupIA...';

    this.renderActiveTab();
    this.saveState();
  },

  renderActiveTab() {
    // Activate the correct content panel
    const ids = { hoy: 'assistant-hoy', tablon: 'assistant-tablon', chat: 'assistant-chat', prompteca: 'assistant-prompteca', explorar: 'assistant-explorar' };
    const target = this.root.querySelector('#' + ids[this.activeTab]);
    if (target) target.classList.add('active');

    // Update tab button active states
    this.root.querySelectorAll('.assistant-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.assistantTab === this.activeTab);
    });

    // Show/hide chat input bar
    const showInput = (this.activeTab === 'chat' || this.activeTab === 'explorar');
    const inputBar = this.root.querySelector('#chat-input-bar');
    if (inputBar) inputBar.style.display = showInput ? 'flex' : 'none';

    const chatInput = this.root.querySelector('#chat-input');
    if (chatInput) chatInput.placeholder = (this.activeTab === 'explorar') ? 'Busca herramientas de IA...' : 'Pregunta a BupIA...';

    // Render content if needed
    if (this.activeTab === 'hoy') this.renderHoy();
    else if (this.activeTab === 'tablon') this.renderTablon();
    else if (this.activeTab === 'chat') this.renderChat();
    else if (this.activeTab === 'prompteca') this.renderPrompteca();
    else if (this.activeTab === 'explorar') this.renderExplorar();
  },

  // ═══════════════════════════════════════
  //  TABLÓN (Bulletin Board)
  // ═══════════════════════════════════════

  renderTablon() {
    const container = this.root.querySelector('#assistant-tablon');
    if (!container || container.dataset.rendered === 'true') return;

    let html = '<div class="ranking-header">🏆 Top 10 Herramientas IA para Docentes</div>';

    if (typeof RANKING_DATA !== 'undefined') {
      for (const item of RANKING_DATA) {
        html += this.renderRankingCard(item);
      }
    }

    container.innerHTML = html;
    container.dataset.rendered = 'true';
  },

  renderRankingCard(item) {
    const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
    const medal = medals[item.position] || '';
    const posClass = item.position <= 3 ? ' ranking-top3' : '';

    const precioBadge = {
      gratis: 'ranking-precio-gratis',
      freemium: 'ranking-precio-freemium',
      pago: 'ranking-precio-pago',
    }[item.tipo_precio] || 'ranking-precio-freemium';

    const precioLabel = {
      gratis: 'Gratis',
      freemium: 'Freemium',
      pago: 'De pago',
    }[item.tipo_precio] || '';

    const etapasHtml = (item.etapas || []).map(e => {
      const labels = { infantil: 'Infantil', primaria: 'Primaria', eso: 'ESO' };
      return `<span class="ranking-etapa">${labels[e] || e}</span>`;
    }).join('');

    return `
      <div class="ranking-card${posClass}">
        <div class="ranking-card-left">
          <span class="ranking-position">${medal || '#' + item.position}</span>
        </div>
        <div class="ranking-card-right">
          <div class="ranking-card-header">
            <span class="ranking-card-icon">${item.icono}</span>
            <span class="ranking-card-nombre">${item.nombre}</span>
            <span class="ranking-card-empresa">${item.empresa}</span>
            <span class="ranking-precio-badge ${precioBadge}">${precioLabel}</span>
          </div>
          <div class="ranking-card-body">${item.que_hace}</div>
          <div class="ranking-card-destaca"><strong>Destaca por:</strong> ${item.por_que_top}</div>
          <div class="ranking-card-footer">
            <div class="ranking-etapas">${etapasHtml}</div>
            <span class="ranking-card-precio">${item.precio}</span>
          </div>
          <a class="ranking-card-link" href="${item.url}" target="_blank" rel="noopener">Visitar ${item.nombre} ↗</a>
        </div>
      </div>
    `;
  },

  // ═══════════════════════════════════════
  //  HOY — "¿Qué quieres hacer hoy?"
  //  Proactive wizard: Intent → Level → Tool
  // ═══════════════════════════════════════

  renderHoy() {
    const container = this.root.querySelector('#assistant-hoy');
    if (!container) return;

    // Mi Ruta wizard active?
    if (this.rutaWizardState.step > 0) {
      this.renderRutaWizard(container);
      return;
    }

    const { intent, level, sectionId } = this.wizardState;

    if (!intent) {
      this.renderIntentPicker(container);
    } else if (!level) {
      this.renderLevelPicker(container);
    } else {
      this.renderResults(container);
    }
  },

  // Step 1: "What do you want to do today?"
  renderIntentPicker(container) {
    // Filter intents to only show those with available tools
    const available = this.INTENTS.filter(intent => {
      return intent.categories.some(catId => {
        for (const pw of Object.values(SITE_DATA.pathways)) {
          const sec = pw.sections.find(s => s.id === catId);
          if (sec && sec.tools && sec.tools.length > 0) return true;
        }
        return false;
      });
    });

    // Check for saved ruta
    const savedRuta = this.loadSavedRuta();
    const savedRutaHtml = savedRuta ? `
      <div class="ruta-saved" data-ruta-action="start">
        <div class="ruta-saved-icon">🗺️</div>
        <div class="ruta-saved-text">
          <div class="ruta-saved-title">${savedRuta.ruta.titulo || 'Tu Ruta de Aprendizaje'}</div>
          <div class="ruta-saved-desc">Toca para ver tu plan de 4 semanas</div>
        </div>
        <span class="wizard-intent-arrow">›</span>
      </div>
    ` : '';

    container.innerHTML = `
      <div class="wizard-hero">
        <img class="wizard-hero-avatar" src="img/bupia.png" alt="BupIA">
        <div class="wizard-hero-text">
          <div class="wizard-greeting">¡Hola, profe!</div>
          <div class="wizard-greeting-sub">Soy <strong>BupIA</strong>, tu asistente</div>
        </div>
        <button class="bupia-rewatch-btn" data-bupia-rewatch title="Ver vídeo de presentación">🎬</button>
      </div>
      ${savedRutaHtml}
      <div class="wizard-title">¿Qué quieres hacer hoy?</div>
      <div class="wizard-intents">
        ${available.map(i => `
          <button class="wizard-intent-btn" data-wizard-intent="${i.id}">
            <span class="wizard-intent-icon">${i.icon}</span>
            <div class="wizard-intent-info">
              <div class="wizard-intent-label">${i.label}</div>
              <div class="wizard-intent-desc">${i.desc}</div>
            </div>
            <span class="wizard-intent-arrow">›</span>
          </button>
        `).join('')}
      </div>
      <div class="ruta-cta">
        <div class="ruta-cta-divider"><span>o</span></div>
        <button class="ruta-cta-btn" data-ruta-action="start">
          <span class="ruta-cta-icon">🗺️</span>
          <div class="ruta-cta-text">
            <div class="ruta-cta-title">¿No sabes por dónde empezar?</div>
            <div class="ruta-cta-desc">Genera tu ruta personalizada de 4 semanas</div>
          </div>
          <span class="wizard-intent-arrow">›</span>
        </button>
      </div>
    `;
  },

  selectIntent(intentId) {
    const intent = this.INTENTS.find(i => i.id === intentId);
    if (!intent) return;

    this.wizardState.intent = intentId;
    this.wizardState.level = null;
    this.wizardState.sectionId = null;

    // Find which levels have this intent
    const levelsWithIntent = [];
    for (const [lvlKey, pw] of Object.entries(SITE_DATA.pathways)) {
      const match = pw.sections.find(s => intent.categories.includes(s.id) && s.tools && s.tools.length > 0);
      if (match) levelsWithIntent.push(lvlKey);
    }

    // If only 1 level available, skip level picker
    if (levelsWithIntent.length === 1) {
      this.selectLevel(levelsWithIntent[0]);
      return;
    }

    const container = this.root.querySelector('#assistant-hoy');
    if (container) this.renderLevelPicker(container);
  },

  // Step 2: "For which level?"
  renderLevelPicker(container) {
    const intent = this.INTENTS.find(i => i.id === this.wizardState.intent);
    if (!intent) return;

    // Filter levels that have this category
    const availableLevels = [];
    for (const [lvlKey, pw] of Object.entries(SITE_DATA.pathways)) {
      const match = pw.sections.find(s => intent.categories.includes(s.id) && s.tools && s.tools.length > 0);
      if (match) availableLevels.push(lvlKey);
    }

    container.innerHTML = `
      <button class="wizard-back-btn" data-wizard-back="intents">← Cambiar actividad</button>
      <div class="wizard-title">${intent.icon} ${intent.label}</div>
      <div class="wizard-subtitle">¿Para qué etapa educativa?</div>
      <div class="wizard-levels">
        ${availableLevels.map(key => `
          <button class="wizard-level-btn" data-wizard-level="${key}">
            <span class="wizard-level-icon">${this.LEVELS[key].icon}</span>
            <div class="wizard-level-name">${this.LEVELS[key].name}</div>
            <div class="wizard-level-ages">${this.LEVELS[key].ages}</div>
          </button>
        `).join('')}
      </div>
    `;
  },

  selectLevel(level) {
    const intent = this.INTENTS.find(i => i.id === this.wizardState.intent);
    if (!intent) return;

    this.wizardState.level = level;

    // Find the matching section for this level+intent
    const pw = SITE_DATA.pathways[level];
    if (!pw) return;

    const section = pw.sections.find(s => intent.categories.includes(s.id) && s.tools && s.tools.length > 0);
    if (section) {
      this.wizardState.sectionId = section.id;
    }

    const container = this.root.querySelector('#assistant-hoy');
    if (container) this.renderResults(container);
  },

  // Step 3: Show recommended tools
  renderResults(container) {
    const { intent: intentId, level, sectionId } = this.wizardState;
    const intent = this.INTENTS.find(i => i.id === intentId);
    const pathway = SITE_DATA.pathways[level];
    if (!intent || !pathway) return;

    const section = pathway.sections.find(s => s.id === sectionId);
    if (!section || !section.tools) return;

    const tools = section.tools.map(id => SITE_DATA.tools[id]).filter(Boolean);

    // Check how many levels have this intent — if only 1, back goes to intents
    let levelsWithIntent = 0;
    for (const pw of Object.values(SITE_DATA.pathways)) {
      if (pw.sections.find(s => intent.categories.includes(s.id) && s.tools && s.tools.length > 0)) levelsWithIntent++;
    }
    const backTarget = levelsWithIntent <= 1 ? 'intents' : 'levels';
    const backLabel = levelsWithIntent <= 1 ? '← Cambiar actividad' : '← Cambiar nivel';

    container.innerHTML = `
      <button class="wizard-back-btn" data-wizard-back="${backTarget}">${backLabel}</button>
      <div class="wizard-title">${intent.icon} ${intent.label}</div>
      <div class="wizard-subtitle">Herramientas recomendadas para ${this.LEVELS[level].name}</div>
      <div class="wizard-results">
        ${tools.map(t => `
          <div class="wizard-tool-card" data-wizard-tool="${t.id}" data-wizard-section="${sectionId}" data-wizard-pathway="${level}">
            <img class="wizard-tool-logo" src="${t.logo}" alt="${t.logoAlt}">
            <div class="wizard-tool-info">
              <div class="wizard-tool-name">${t.name}</div>
              <div class="wizard-tool-tagline">${t.tagline}</div>
            </div>
            <span class="wizard-tool-arrow">→</span>
          </div>
        `).join('')}
      </div>
      <div id="wizard-ai-slot"></div>
    `;

    // Load AI recommendation (async)
    this.loadAIRecommendation(level, intent.label);
  },

  async loadAIRecommendation(level, intentLabel) {
    const slot = this.root.querySelector('#wizard-ai-slot');
    if (!slot) return;

    try {
      const result = await this.apiCall('recommend', [
        { role: 'user', content: `Quiero ${intentLabel.toLowerCase()} para ${this.LEVELS[level].name} (${this.LEVELS[level].ages}). ¿Qué me recomiendas?` }
      ]);

      if (result && result.content) {
        slot.innerHTML = `
          <div class="wizard-ai-comment">
            <div class="wizard-ai-label">💡 Consejo de BupIA</div>
            ${result.content}
          </div>
        `;
      }
    } catch (e) {
      // Silent fail — tools are enough
    }
  },

  // ═══════════════════════════════════════
  //  CHAT
  // ═══════════════════════════════════════

  renderChat() {
    const container = this.root.querySelector('#chat-messages');
    if (!container) return;

    // Only render if empty (preserve existing messages)
    if (container.children.length > 0) return;

    // Welcome message
    this.appendMessage('assistant',
      '¡Hola! 👋 Soy **BupIA**, tu asistente del Taller IA. Puedo ayudarte a:\n\n' +
      '• Encontrar la herramienta perfecta para tu clase\n' +
      '• Darte consejos sobre cómo escribir buenos prompts\n' +
      '• Resolver dudas sobre las herramientas de la plataforma\n\n' +
      '¿En qué puedo ayudarte?'
    );
  },

  handleSend() {
    const input = this.root.querySelector('#chat-input');
    if (!input) return;

    const text = input.value.trim();
    if (!text || this.isSending) return;

    input.value = '';

    if (this.activeTab === 'explorar') {
      this.sendExploreMessage(text);
    } else {
      this.sendMessage(text);
    }
  },

  async sendMessage(text) {
    this.isSending = true;
    const sendBtn = this.root.querySelector('#chat-send');
    if (sendBtn) sendBtn.disabled = true;

    // Show user message
    this.appendMessage('user', text);

    // Add to history
    this.chatHistory.push({ role: 'user', content: text });

    // Trim history to last 10 messages
    if (this.chatHistory.length > 10) {
      this.chatHistory = this.chatHistory.slice(-10);
    }

    // Show typing
    this.showTyping();

    try {
      const result = await this.apiCall('chat', this.chatHistory);

      this.hideTyping();

      if (result && result.content) {
        this.appendMessage('assistant', result.content);
        this.chatHistory.push({ role: 'assistant', content: result.content });
        this.saveState();
      } else {
        this.appendMessage('error', 'No se recibió respuesta. Comprueba la conexión.');
      }
    } catch (err) {
      this.hideTyping();
      this.appendMessage('error', err.message || 'Error al conectar con el asistente.');
    }

    this.isSending = false;
    if (sendBtn) sendBtn.disabled = false;

    // Focus input
    const input = this.root.querySelector('#chat-input');
    if (input) input.focus();
  },

  // ── Markdown renderer (lightweight, no dependencies) ──
  formatMarkdown(text) {
    // Escape HTML
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Process line by line for block elements
    const lines = html.split('\n');
    const out = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Horizontal rule
      if (/^---+$/.test(line.trim())) {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push('<hr>');
        continue;
      }

      // Headings (###, ##)
      const h3 = line.match(/^###\s+(.+)/);
      if (h3) {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push(`<h4 class="chat-heading">${h3[1]}</h4>`);
        continue;
      }
      const h2 = line.match(/^##\s+(.+)/);
      if (h2) {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push(`<h3 class="chat-heading">${h2[1]}</h3>`);
        continue;
      }

      // Unordered list items (- or *)
      const li = line.match(/^[\-\*]\s+(.+)/);
      if (li) {
        if (!inList) { out.push('<ul>'); inList = true; }
        out.push(`<li>${li[1]}</li>`);
        continue;
      }

      // Numbered list items
      const oli = line.match(/^\d+\.\s+(.+)/);
      if (oli) {
        if (inList) { out.push('</ul>'); inList = false; }
        // Simple: render as bullet (avoids tracking <ol> state)
        if (!lines[i - 1]?.match(/^\d+\.\s+/)) out.push('<ol>');
        out.push(`<li>${oli[1]}</li>`);
        if (!lines[i + 1]?.match(/^\d+\.\s+/)) out.push('</ol>');
        continue;
      }

      // Close list if we hit a non-list line
      if (inList) { out.push('</ul>'); inList = false; }

      // Empty line = paragraph break
      if (line.trim() === '') {
        out.push('<br>');
        continue;
      }

      out.push(line + '<br>');
    }
    if (inList) out.push('</ul>');

    html = out.join('\n');

    // Inline formatting
    // Links: [text](url)
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1 ↗</a>');

    // Bare URLs (not already inside an href)
    html = html.replace(/(?<!="|'>)(https?:\/\/[^\s<,)]+)/g,
      '<a href="$1" target="_blank" rel="noopener">$1 ↗</a>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    return html;
  },

  appendMessage(role, text) {
    const container = this.root.querySelector('#chat-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `chat-msg chat-msg-${role}`;
    div.innerHTML = this.formatMarkdown(text);

    container.appendChild(div);

    // Scroll to bottom
    const body = this.root.querySelector('.assistant-body');
    if (body) body.scrollTop = body.scrollHeight;
  },

  showTyping() {
    const el = this.root.querySelector('#chat-typing');
    if (el) el.classList.add('visible');

    const body = this.root.querySelector('.assistant-body');
    if (body) body.scrollTop = body.scrollHeight;
  },

  hideTyping() {
    const el = this.root.querySelector('#chat-typing');
    if (el) el.classList.remove('visible');
  },

  // ═══════════════════════════════════════
  //  EXPLORAR (AI Tool Discovery)
  // ═══════════════════════════════════════

  renderExplorar() {
    const container = this.root.querySelector('#explore-messages');
    if (!container) return;

    if (container.children.length > 0) return;

    this.appendExploreMessage('assistant',
      '**Modo Explorador** 🔍\n\n' +
      'Aquí te ayudo a descubrir herramientas de IA **que no están en la plataforma** pero que pueden ser muy útiles para tu aula.\n\n' +
      'Busco herramientas que sean:\n' +
      '• Gratuitas o con plan free generoso\n' +
      '• Accesibles desde el navegador\n' +
      '• Con valor pedagógico real\n\n' +
      'Prueba con los atajos de abajo o escríbeme lo que necesitas.'
    );

    const chipsDiv = document.createElement('div');
    chipsDiv.className = 'explore-chips';
    chipsDiv.innerHTML = `
      <button class="explore-chip" data-explore-query="Herramientas para crear presentaciones interactivas en el aula">📊 Presentaciones</button>
      <button class="explore-chip" data-explore-query="Herramientas para crear fichas y ejercicios interactivos">📝 Fichas interactivas</button>
      <button class="explore-chip" data-explore-query="Herramientas de IA para crear imágenes educativas gratis, alternativas a las de la plataforma">🎨 Más imágenes IA</button>
      <button class="explore-chip" data-explore-query="Herramientas para gamificar el aula con IA">🎮 Gamificación</button>
      <button class="explore-chip" data-explore-query="Herramientas de IA para crear vídeos educativos cortos gratis">🎬 Vídeos educativos</button>
      <button class="explore-chip" data-explore-query="Herramientas para evaluar y dar feedback con IA">✅ Evaluación con IA</button>
    `;
    container.appendChild(chipsDiv);
  },

  resetExplorar() {
    const container = this.root.querySelector('#explore-messages');
    if (container) container.innerHTML = '';
    this.exploreHistory = [];
    this.renderExplorar();
    this.saveState();
  },

  showExploreResetBtn() {
    const container = this.root.querySelector('#explore-messages');
    if (!container) return;
    // Remove any existing reset button first
    const existing = container.querySelector('.explore-reset-btn');
    if (existing) existing.remove();
    const btn = document.createElement('button');
    btn.className = 'explore-reset-btn';
    btn.setAttribute('data-explore-reset', 'true');
    btn.innerHTML = '🔄 Nueva búsqueda';
    container.appendChild(btn);
    const body = this.root.querySelector('.assistant-body');
    if (body) body.scrollTop = body.scrollHeight;
  },

  async sendExploreMessage(text) {
    this.isSending = true;
    const sendBtn = this.root.querySelector('#chat-send');
    if (sendBtn) sendBtn.disabled = true;

    this.appendExploreMessage('user', text);
    this.exploreHistory.push({ role: 'user', content: text });

    if (this.exploreHistory.length > 10) {
      this.exploreHistory = this.exploreHistory.slice(-10);
    }

    this.showExploreTyping();

    try {
      const result = await this.apiCall('explore', this.exploreHistory);
      this.hideExploreTyping();

      if (result && result.content) {
        this.appendExploreMessage('assistant', result.content);
        this.exploreHistory.push({ role: 'assistant', content: result.content });
        this.saveState();
        this.showExploreResetBtn();
      } else {
        this.appendExploreMessage('error', 'No se recibió respuesta. Comprueba la conexión.');
      }
    } catch (err) {
      this.hideExploreTyping();
      this.appendExploreMessage('error', err.message || 'Error al conectar con el asistente.');
    }

    this.isSending = false;
    if (sendBtn) sendBtn.disabled = false;

    const input = this.root.querySelector('#chat-input');
    if (input) input.focus();
  },

  appendExploreMessage(role, text) {
    const container = this.root.querySelector('#explore-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `chat-msg chat-msg-${role}`;
    div.innerHTML = this.formatMarkdown(text);

    container.appendChild(div);

    const body = this.root.querySelector('.assistant-body');
    if (body) body.scrollTop = body.scrollHeight;
  },

  showExploreTyping() {
    const el = this.root.querySelector('#explore-typing');
    if (el) el.classList.add('visible');
    const body = this.root.querySelector('.assistant-body');
    if (body) body.scrollTop = body.scrollHeight;
  },

  hideExploreTyping() {
    const el = this.root.querySelector('#explore-typing');
    if (el) el.classList.remove('visible');
  },

  // ═══════════════════════════════════════
  //  PROMPTECA (Prompt Library)
  // ═══════════════════════════════════════

  renderPrompteca() {
    const container = this.root.querySelector('#assistant-prompteca');
    if (!container) return;

    if (!this.promptecaData) {
      container.innerHTML = '<div class="wizard-title">Cargando Prompteca...</div>';
      return;
    }

    const { etapa, categoria } = this.promptecaFilters;
    const meta = this.promptecaData.categorias_meta;

    // Filter prompts
    let prompts = this.promptecaData.prompts;
    if (etapa) prompts = prompts.filter(p => p.etapas.includes(etapa));
    if (categoria) prompts = prompts.filter(p => p.categoria === categoria);

    // Etapa pills
    const etapas = [
      { id: 'todas', label: 'Todas' },
      { id: 'infantil', label: '🎒 Infantil' },
      { id: 'primaria', label: '📚 Primaria' },
      { id: 'eso', label: '🎓 ESO' },
    ];

    const etapaPills = etapas.map(e => {
      const active = (e.id === 'todas' && !etapa) || e.id === etapa;
      return `<button class="wizard-cat-pill${active ? ' selected' : ''}" data-prompteca-etapa="${e.id}">${e.label}</button>`;
    }).join('');

    // Category pills
    const catPills = Object.entries(meta).map(([id, m]) => {
      const active = categoria === id;
      return `<button class="wizard-cat-pill${active ? ' selected' : ''}" data-prompteca-cat="${id}">${m.icono} ${m.label}</button>`;
    }).join('');

    // Prompt cards
    const cards = prompts.map(p => {
      const catMeta = meta[p.categoria] || {};
      const etapasHtml = (p.etapas || []).map(e => {
        const labels = { infantil: 'Infantil', primaria: 'Primaria', eso: 'ESO' };
        return `<span class="ranking-etapa">${labels[e] || e}</span>`;
      }).join('');

      return `
        <div class="prompteca-card" id="prompteca-card-${p.id}">
          <div class="prompteca-card-header" data-prompteca-toggle="${p.id}">
            <span class="prompteca-card-icon">${catMeta.icono || '📄'}</span>
            <div class="prompteca-card-title">${p.titulo}</div>
            <button class="prompteca-toggle-btn" data-prompteca-toggle="${p.id}">▼</button>
          </div>
          <div class="prompteca-card-desc">${p.descripcion}</div>
          <div class="prompteca-card-meta">
            ${etapasHtml}
            <span class="prompteca-tool-badge">${p.herramienta}</span>
          </div>
          <div class="prompteca-card-prompt" id="prompt-body-${p.id}" style="display:none">
            <pre class="prompteca-prompt-text">${p.prompt}</pre>
            <div class="prompteca-card-actions">
              <button class="prompteca-copy-btn" data-prompteca-copy="${p.id}">📋 Copiar</button>
              <button class="prompteca-personalize-btn" data-prompteca-personalize="${p.id}">✨ Personalizar</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="ranking-header">📖 Prompteca — Prompts listos para usar</div>
      <div class="prompteca-filters">
        <div class="prompteca-filter-row">${etapaPills}</div>
        <div class="prompteca-filter-row">${catPills}</div>
      </div>
      <div class="prompteca-count">${prompts.length} prompts</div>
      <div class="prompteca-list">${cards}</div>
    `;
  },

  copyPromptToClipboard(promptId, btnEl) {
    if (!this.promptecaData) return;
    const prompt = this.promptecaData.prompts.find(p => p.id === promptId);
    if (!prompt) return;

    const text = prompt.prompt;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showCopyFeedback(btnEl);
      }).catch(() => {
        this.fallbackCopy(text, btnEl);
      });
    } else {
      this.fallbackCopy(text, btnEl);
    }
  },

  fallbackCopy(text, btnEl) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    this.showCopyFeedback(btnEl);
  },

  showCopyFeedback(btnEl) {
    if (!btnEl) return;
    const orig = btnEl.textContent;
    btnEl.textContent = '✅ ¡Copiado!';
    btnEl.classList.add('copied');
    setTimeout(() => {
      btnEl.textContent = orig;
      btnEl.classList.remove('copied');
    }, 2000);
  },

  personalizePrompt(promptId) {
    if (!this.promptecaData) return;
    const prompt = this.promptecaData.prompts.find(p => p.id === promptId);
    if (!prompt) return;

    // Switch to chat tab with prompt pre-loaded
    const msg = `Quiero adaptar este prompt de la Prompteca para mi clase:\n\n"${prompt.titulo}"\n\n${prompt.prompt}\n\nAyúdame a personalizarlo para mi contexto.`;

    this.switchTab('chat');

    // Send the message
    setTimeout(() => {
      this.sendMessage(msg);
    }, 200);
  },

  navigateToPromptecaPrompt(promptId) {
    this.switchTab('prompteca');
    setTimeout(() => {
      const card = this.root.querySelector(`#prompteca-card-${promptId}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('prompteca-highlight');
        setTimeout(() => card.classList.remove('prompteca-highlight'), 2000);
        // Auto-expand
        const body = this.root.querySelector(`#prompt-body-${promptId}`);
        if (body) body.style.display = 'block';
      }
    }, 100);
  },

  // ═══════════════════════════════════════
  //  MI RUTA (Personalized Learning Path)
  // ═══════════════════════════════════════

  renderRutaWizard(container) {
    const { step, etapa, asignatura, nivel } = this.rutaWizardState;

    if (step === 1) {
      // Step 1: Etapa
      container.innerHTML = `
        <button class="wizard-back-btn" data-ruta-action="back-hoy">← Volver</button>
        <div class="wizard-title">🗺️ Genera tu ruta personalizada</div>
        <div class="wizard-subtitle">Paso 1 de 3 — ¿En qué etapa enseñas?</div>
        <div class="wizard-levels">
          ${Object.entries(this.LEVELS).map(([key, lv]) => `
            <button class="wizard-level-btn" data-ruta-etapa="${key}">
              <span class="wizard-level-icon">${lv.icon}</span>
              <div class="wizard-level-name">${lv.name}</div>
              <div class="wizard-level-ages">${lv.ages}</div>
            </button>
          `).join('')}
        </div>
      `;
    } else if (step === 2) {
      // Step 2: Asignatura
      container.innerHTML = `
        <button class="wizard-back-btn" data-ruta-action="start">← Cambiar etapa</button>
        <div class="wizard-title">🗺️ Genera tu ruta personalizada</div>
        <div class="wizard-subtitle">Paso 2 de 3 — ¿Qué asignatura principal?</div>
        <div class="wizard-categories">
          ${this.ASIGNATURAS.map(a => `
            <button class="wizard-cat-pill" data-ruta-asig="${a.id}">${a.icon} ${a.label}</button>
          `).join('')}
        </div>
      `;
    } else if (step === 3) {
      // Step 3: Nivel tecnológico
      container.innerHTML = `
        <button class="wizard-back-btn" data-ruta-action="back-step2">← Cambiar asignatura</button>
        <div class="wizard-title">🗺️ Genera tu ruta personalizada</div>
        <div class="wizard-subtitle">Paso 3 de 3 — ¿Tu nivel con la tecnología?</div>
        <div class="wizard-levels">
          <button class="wizard-level-btn" data-ruta-nivel="principiante">
            <span class="wizard-level-icon">🌱</span>
            <div class="wizard-level-name">Principiante</div>
            <div class="wizard-level-ages">Nunca he usado IA</div>
          </button>
          <button class="wizard-level-btn" data-ruta-nivel="intermedio">
            <span class="wizard-level-icon">🌿</span>
            <div class="wizard-level-name">Intermedio</div>
            <div class="wizard-level-ages">He probado alguna vez</div>
          </button>
          <button class="wizard-level-btn" data-ruta-nivel="avanzado">
            <span class="wizard-level-icon">🌳</span>
            <div class="wizard-level-name">Avanzado</div>
            <div class="wizard-level-ages">Uso IA regularmente</div>
          </button>
        </div>
      `;
    } else if (step === 4) {
      // Loading / result
      const savedRuta = this.loadSavedRuta();
      if (savedRuta && savedRuta.inputs &&
          savedRuta.inputs.etapa === etapa &&
          savedRuta.inputs.asignatura === asignatura &&
          savedRuta.inputs.nivel === nivel) {
        this.renderRutaResult(container, savedRuta.ruta);
      } else {
        container.innerHTML = `
          <div class="ruta-loading">
            <div class="wizard-title">🗺️ Generando tu ruta...</div>
            <div class="wizard-subtitle">Esto puede tardar unos segundos</div>
            <div class="chat-typing visible" style="justify-content:center; background:none; border:none;">
              <div class="chat-typing-dots">
                <div class="chat-typing-dot"></div>
                <div class="chat-typing-dot"></div>
                <div class="chat-typing-dot"></div>
              </div>
            </div>
          </div>
        `;
      }
    }
  },

  async generateRuta() {
    const { etapa, asignatura, nivel } = this.rutaWizardState;

    const etapaLabel = this.LEVELS[etapa]?.name || etapa;
    const asigLabel = this.ASIGNATURAS.find(a => a.id === asignatura)?.label || asignatura;

    // Build prompt catalog for the ruta AI
    let promptecaCatalog = '';
    if (this.promptecaData) {
      const filtered = this.promptecaData.prompts.filter(p => p.etapas.includes(etapa));
      promptecaCatalog = filtered.map(p => `- ${p.id}: "${p.titulo}" (${p.categoria})`).join('\n');
    }

    const userMsg = `Genera una ruta de aprendizaje de IA para:
- Etapa: ${etapaLabel}
- Asignatura: ${asigLabel}
- Nivel tecnológico: ${nivel}

Prompts disponibles en la Prompteca para esta etapa:
${promptecaCatalog || '(ninguno disponible)'}`;

    try {
      const result = await this.apiCall('ruta', [{ role: 'user', content: userMsg }]);

      if (result && result.content) {
        let rutaData;
        try {
          // Try to extract JSON from the response
          const jsonMatch = result.content.match(/\{[\s\S]*\}/);
          rutaData = JSON.parse(jsonMatch ? jsonMatch[0] : result.content);
        } catch (parseErr) {
          throw new Error('La IA no devolvió un formato válido. Intenta de nuevo.');
        }

        // Save
        this.saveRuta(rutaData, { etapa, asignatura, nivel });

        // Render
        const container = this.root.querySelector('#assistant-hoy');
        if (container) this.renderRutaResult(container, rutaData);
      } else {
        throw new Error('No se recibió respuesta.');
      }
    } catch (err) {
      const container = this.root.querySelector('#assistant-hoy');
      if (container) {
        container.innerHTML = `
          <button class="wizard-back-btn" data-ruta-action="back-hoy">← Volver</button>
          <div class="wizard-title">😕 No se pudo generar la ruta</div>
          <div class="wizard-subtitle">${err.message || 'Error desconocido'}</div>
          <button class="ruta-regenerate-btn" data-ruta-action="regenerate">🔄 Intentar de nuevo</button>
        `;
      }
    }
  },

  renderRutaResult(container, rutaData) {
    const weeks = (rutaData.semanas || []).map(w => {
      const promptLink = w.prompt_recomendado_id ?
        `<div class="ruta-week-prompt" data-ruta-prompt="${w.prompt_recomendado_id}">📖 Ver prompt recomendado →</div>` : '';

      return `
        <div class="ruta-week">
          <div class="ruta-week-header">
            <span class="ruta-week-number">Semana ${w.numero}</span>
            <span class="ruta-week-title">${w.titulo}</span>
          </div>
          <div class="ruta-week-body">
            <div class="ruta-week-row">🎯 <strong>Objetivo:</strong> ${w.objetivo}</div>
            <div class="ruta-week-row">🔧 <strong>Herramientas:</strong> ${(w.herramientas || []).join(', ')}</div>
            <div class="ruta-week-row">📝 ${w.actividad}</div>
            ${promptLink}
            <div class="ruta-week-tip">💡 ${w.consejo}</div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <button class="wizard-back-btn" data-ruta-action="back-hoy">← Volver al inicio</button>
      <div class="ruta-container">
        <div class="ruta-title">🗺️ ${rutaData.titulo || 'Tu Ruta Personalizada'}</div>
        <div class="ruta-summary">${rutaData.resumen || ''}</div>
        <div class="ruta-timeline">${weeks}</div>
        <button class="ruta-regenerate-btn" data-ruta-action="regenerate">🔄 Regenerar ruta</button>
      </div>
    `;
  },

  saveRuta(rutaData, inputs) {
    try {
      localStorage.setItem('bupia_ruta', JSON.stringify({
        generatedAt: new Date().toISOString(),
        inputs,
        ruta: rutaData,
      }));
    } catch (e) { /* quota exceeded */ }
  },

  loadSavedRuta() {
    try {
      const raw = localStorage.getItem('bupia_ruta');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },

  // ═══════════════════════════════════════
  //  API
  // ═══════════════════════════════════════

  async apiCall(feature, messages) {
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

    // ── Localhost: use Python proxy ──
    if (isLocal) {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature, messages }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || data.detail || `Error HTTP ${resp.status}`);
      }
      if (data.choices && data.choices[0] && data.choices[0].message) {
        return { content: data.choices[0].message.content };
      }
      if (data.error) {
        throw new Error(typeof data.error === 'string' ? data.error : data.error.message || 'Error desconocido');
      }
      return null;
    }

    // ── GitHub Pages: call Anthropic directly ──
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('El asistente no está disponible en este dominio.');
    }

    if (!this.checkRateLimit()) {
      throw new Error('Has alcanzado el límite diario de consultas. Vuelve mañana 😊');
    }

    const systemPrompt = this.SYSTEM_PROMPTS[feature] || this.SYSTEM_PROMPTS.chat;
    const apiMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');
    const maxTokens = feature === 'ruta' ? 2000 : feature === 'explore' ? 1500 : 1000;

    const resp = await fetch(this.ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': this.ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.ANTHROPIC_MODEL,
        system: systemPrompt,
        messages: apiMessages,
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      const errMsg = data.error?.message || data.error || `Error HTTP ${resp.status}`;
      if (resp.status === 401) {
        localStorage.removeItem('bupia_api_key');
        throw new Error('API key inválida. Recarga la página para introducir una nueva.');
      }
      throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    }

    // Parse Anthropic response format
    let text = '';
    if (data.content) {
      for (const block of data.content) {
        if (block.type === 'text') text += block.text || '';
      }
    }

    return text ? { content: text } : null;
  },

  // ── API key protection ──
  _ALLOWED_HOSTS: ['hakzhin.github.io', 'localhost', '127.0.0.1'],
  _DAILY_LIMIT: 50,

  getApiKey() {
    // Domain restriction
    if (!this._ALLOWED_HOSTS.includes(window.location.hostname)) return null;
    // XOR-obfuscated key (not plain text)
    const d = [89,65,7,75,68,94,7,75,90,67,26,25,7,26,80,80,125,93,111,7,124,83,24,69,89,31,114,94,31,98,69,80,96,30,66,125,92,26,27,79,80,120,115,73,31,103,105,88,123,89,104,108,99,25,93,79,101,83,89,117,104,7,80,93,110,125,97,123,7,125,108,122,79,19,101,90,71,24,127,76,109,105,101,65,103,82,95,70,105,123,82,102,79,123,79,126,92,28,123,7,110,108,90,82,91,77,107,107];
    return d.map(c => String.fromCharCode(c ^ 42)).join('');
  },

  checkRateLimit() {
    const today = new Date().toISOString().slice(0, 10);
    const stored = JSON.parse(localStorage.getItem('bupia_usage') || '{}');
    if (stored.date !== today) {
      stored.date = today;
      stored.count = 0;
    }
    if (stored.count >= this._DAILY_LIMIT) return false;
    stored.count++;
    localStorage.setItem('bupia_usage', JSON.stringify(stored));
    return true;
  },

  // ═══════════════════════════════════════
  //  Navigation Bridge (to main app)
  // ═══════════════════════════════════════

  navigateToTool(toolId, sectionId, pathway) {
    this.close();

    // Navigate to the pathway
    if (typeof showPathway === 'function') {
      showPathway(pathway);
    }

    // Switch to the correct section
    setTimeout(() => {
      const pillEl = document.getElementById('pill-' + sectionId);
      if (pillEl && typeof showPathwaySection === 'function') {
        showPathwaySection(sectionId, pillEl);
      }

      // Open the tool tutorial
      setTimeout(() => {
        if (typeof toggleTool === 'function') {
          toggleTool(toolId);
        }
      }, 200);
    }, 200);
  },

  navigateToToolFromId(toolId) {
    // Find which pathway and section this tool belongs to
    for (const [pwKey, pw] of Object.entries(SITE_DATA.pathways)) {
      for (const section of pw.sections) {
        if (section.tools && section.tools.includes(toolId)) {
          this.navigateToTool(toolId, section.id, pwKey);
          return;
        }
      }
    }
  },

  // ═══════════════════════════════════════
  //  Badge / Notifications
  // ═══════════════════════════════════════

  updateBadge() {
    if (!this.badge) return;

    const lastSeen = parseInt(sessionStorage.getItem('bulletin_last_seen') || '0', 10);
    const total = (typeof RANKING_DATA !== 'undefined') ? RANKING_DATA.length : 0;
    const unread = Math.max(0, total - lastSeen);

    if (unread > 0) {
      this.badge.textContent = unread;
      this.badge.classList.add('visible');
    } else {
      this.badge.classList.remove('visible');
    }

    // Mark as seen when tablón is viewed
    if (this.isOpen && this.activeTab === 'tablon') {
      sessionStorage.setItem('bulletin_last_seen', String(total));
      this.badge.classList.remove('visible');
    }
  },

  // ═══════════════════════════════════════
  //  Persistence (sessionStorage)
  // ═══════════════════════════════════════

  saveState() {
    try {
      sessionStorage.setItem('assistant_state', JSON.stringify({
        activeTab: this.activeTab,
        chatHistory: this.chatHistory.slice(-10),
        exploreHistory: this.exploreHistory.slice(-10),
      }));
    } catch (e) { /* quota exceeded — ignore */ }
  },

  loadState() {
    try {
      const raw = sessionStorage.getItem('assistant_state');
      if (raw) {
        const state = JSON.parse(raw);
        this.activeTab = state.activeTab || 'hoy';
        this.chatHistory = state.chatHistory || [];
        this.exploreHistory = state.exploreHistory || [];
      }
    } catch (e) { /* ignore */ }
  },
};

// ── Boot ──
document.addEventListener('DOMContentLoaded', () => Assistant.init());
