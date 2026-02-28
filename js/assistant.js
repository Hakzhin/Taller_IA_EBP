// ══════════════════════════════════════════
//  Taller IA · BupIA (in-app assistant)
//  Hoy + Tablón + Chat
// ══════════════════════════════════════════

const Assistant = {

  // ── State ──
  isOpen: false,
  activeTab: 'hoy',
  chatHistory: [],
  wizardState: { intent: null, level: null, sectionId: null },
  isSending: false,

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
      <div class="assistant-panel">
        <div class="assistant-header">
          <div class="assistant-tabs">
            <button class="assistant-tab-btn" data-assistant-tab="hoy">🚀 Hoy</button>
            <button class="assistant-tab-btn" data-assistant-tab="tablon">📋 Tablón</button>
            <button class="assistant-tab-btn" data-assistant-tab="chat">💬 Chat</button>
          </div>
          <button class="assistant-close-btn" data-assistant-action="close">✕</button>
        </div>
        <div class="assistant-body">
          <div class="assistant-tab-content" id="assistant-hoy"></div>
          <div class="assistant-tab-content" id="assistant-tablon"></div>
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
    this.isOpen = true;
    this.panel.classList.add('open');
    this.fab.classList.add('open');
    this.renderActiveTab();
    this.saveState();
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
    if (inputBar) inputBar.style.display = (tab === 'chat') ? 'flex' : 'none';

    this.renderActiveTab();
    this.saveState();
  },

  renderActiveTab() {
    // Activate the correct content panel
    const ids = { hoy: 'assistant-hoy', tablon: 'assistant-tablon', chat: 'assistant-chat' };
    const target = this.root.querySelector('#' + ids[this.activeTab]);
    if (target) target.classList.add('active');

    // Update tab button active states
    this.root.querySelectorAll('.assistant-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.assistantTab === this.activeTab);
    });

    // Show/hide chat input bar
    const inputBar = this.root.querySelector('#chat-input-bar');
    if (inputBar) inputBar.style.display = (this.activeTab === 'chat') ? 'flex' : 'none';

    // Render content if needed
    if (this.activeTab === 'hoy') this.renderHoy();
    else if (this.activeTab === 'tablon') this.renderTablon();
    else if (this.activeTab === 'chat') this.renderChat();
  },

  // ═══════════════════════════════════════
  //  TABLÓN (Bulletin Board)
  // ═══════════════════════════════════════

  renderTablon() {
    const container = this.root.querySelector('#assistant-tablon');
    if (!container || container.dataset.rendered === 'true') return;

    let html = '';

    // AI tip placeholder (loaded async)
    html += '<div id="ai-tip-slot"></div>';

    // Static bulletin cards
    if (typeof BULLETIN_DATA !== 'undefined') {
      for (const item of BULLETIN_DATA) {
        html += this.renderBulletinCard(item);
      }
    }

    container.innerHTML = html;
    container.dataset.rendered = 'true';

    // Load AI tip (async, cached)
    this.loadAITip();
  },

  renderBulletinCard(item) {
    const badgeClass = {
      tip: 'bulletin-badge-tip',
      news: 'bulletin-badge-news',
      seasonal: 'bulletin-badge-seasonal',
      ai: 'bulletin-badge-ai',
    }[item.category] || 'bulletin-badge-tip';

    const badgeLabel = {
      tip: 'Consejo',
      news: 'Novedad',
      seasonal: 'Estacional',
      ai: '✨ IA',
    }[item.category] || '';

    const toolLink = item.toolId
      ? `<a class="bulletin-card-link" data-bulletin-tool="${item.toolId}">Ver herramienta →</a>`
      : '';

    return `
      <div class="bulletin-card">
        <div class="bulletin-card-header">
          <span class="bulletin-card-icon">${item.icon}</span>
          <span class="bulletin-card-title">${item.title}</span>
          <span class="bulletin-card-badge ${badgeClass}">${badgeLabel}</span>
        </div>
        <div class="bulletin-card-body">${item.body}</div>
        ${toolLink}
      </div>
    `;
  },

  async loadAITip() {
    const slot = this.root.querySelector('#ai-tip-slot');
    if (!slot) return;

    // Check cache (24h)
    const cached = sessionStorage.getItem('ai_tip_cache');
    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          slot.innerHTML = this.renderBulletinCard({
            id: 'ai-tip',
            icon: '🤖',
            title: data.title,
            body: data.body,
            toolId: data.toolId || null,
            category: 'ai',
          });
          return;
        }
      } catch (e) { /* ignore bad cache */ }
    }

    // Fetch from API
    try {
      const result = await this.apiCall('bulletin', [
        { role: 'user', content: 'Genera el consejo del día.' }
      ]);

      if (result && result.content) {
        let tipData;
        try {
          // Try to parse as JSON
          const jsonMatch = result.content.match(/\{[\s\S]*\}/);
          tipData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        } catch (e) {
          // Fallback: use raw text
          tipData = { title: 'Consejo IA del día', body: result.content, toolId: null };
        }

        if (tipData) {
          sessionStorage.setItem('ai_tip_cache', JSON.stringify({
            ...tipData,
            timestamp: Date.now(),
          }));

          slot.innerHTML = this.renderBulletinCard({
            id: 'ai-tip',
            icon: '🤖',
            title: tipData.title || 'Consejo IA',
            body: tipData.body || '',
            toolId: tipData.toolId || null,
            category: 'ai',
          });
        }
      }
    } catch (e) {
      // Silent fail — static content is enough
      console.log('BupIA: no se pudo cargar consejo IA', e.message);
    }
  },

  // ═══════════════════════════════════════
  //  HOY — "¿Qué quieres hacer hoy?"
  //  Proactive wizard: Intent → Level → Tool
  // ═══════════════════════════════════════

  renderHoy() {
    const container = this.root.querySelector('#assistant-hoy');
    if (!container) return;

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

    container.innerHTML = `
      <div class="wizard-hero">
        <img class="wizard-hero-avatar" src="img/bupia.png" alt="BupIA">
        <div class="wizard-hero-text">
          <div class="wizard-greeting">¡Hola, profe!</div>
          <div class="wizard-greeting-sub">Soy <strong>BupIA</strong>, tu asistente</div>
        </div>
      </div>
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
    this.sendMessage(text);
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

  appendMessage(role, text) {
    const container = this.root.querySelector('#chat-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `chat-msg chat-msg-${role}`;

    // Convert newlines to <br> and basic formatting
    div.innerHTML = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');

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
        max_tokens: 500,
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
    const total = (typeof BULLETIN_DATA !== 'undefined') ? BULLETIN_DATA.length : 0;
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
      }
    } catch (e) { /* ignore */ }
  },
};

// ── Boot ──
document.addEventListener('DOMContentLoaded', () => Assistant.init());
