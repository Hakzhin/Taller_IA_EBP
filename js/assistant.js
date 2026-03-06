// ══════════════════════════════════════════
//  Taller IA · BupIA (in-app assistant)
//  Hoy + Tablón + Chat + Prompteca + Explorar
// ══════════════════════════════════════════

class ApiError extends Error {
  constructor(message, type = 'unknown') {
    super(message);
    this.type = type; // 'network' | 'timeout' | 'rate_limit' | 'api' | 'unknown'
  }
}

const Assistant = {

  // ── State ──
  isOpen: false,
  isMaximized: false,
  activeTab: 'hoy',
  chatHistory: [],
  exploreHistory: [],
  wizardState: { intent: null, level: null, sectionId: null },
  isSending: false,
  _lastSendTime: 0,
  promptecaData: null,
  promptecaFilters: { etapa: null, categoria: null },
  rutaWizardState: { step: 0, etapa: null, asignatura: null, nivel: null },
  generatorState: { active: false, type: null, step: 0, etapa: null, params: {}, result: null },

  // ── DOM refs (set in buildDOM) ──
  root: null,
  fab: null,
  panel: null,
  badge: null,

  // ── Proxy URL (Cloud Run en producción, localhost en desarrollo) ──
  // Cloud Run proxy (producción)
  PROXY_URL: 'https://bupia-proxy-322838173417.us-west1.run.app/api/chat',

  // ── System Prompts (single source of truth — solo editar aquí) ──
  // CATALOG: se mantiene aquí como fallback; la fuente canónica es data/catalog.json.
  // Python (_server.py) carga el catálogo directamente desde el JSON.
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
- Materiales: Gemini, ChatGPT, Claude

IA PRO (nivel avanzado):
- Proyectos: ChatGPT Proyectos, Claude Proyectos
- Agentes: Custom GPTs, Claude como Agente, Gemini Gems
- Programacion: Google AI Studio, Claude Code, Google Antigravity

APPS PROPIAS DEL COLEGIO:
- Rubric@sEBP (https://rubric-s-830258786759.us-west1.run.app/): Generador inteligente de rubricas de evaluacion alineadas con LOMLOE. Usa Gemini para generar rubricas completas. El profesor elige etapa (Infantil/Primaria/Secundaria), asignatura, curso, elemento a evaluar, criterios LOMLOE e items con ponderacion. La IA genera descriptores para cada nivel de desempeno (Insuficiente a Sobresaliente). Exporta a Excel y PDF. Incluye chat con Gemini para dudas. Disponible en espanol, ingles y frances.`;

    const BASE = `Eres "BupIA", el copiloto de inteligencia artificial de la plataforma "Taller IA" del Colegio El Buen Pastor, en Murcia.

SOBRE TI (autoconocimiento — responde con naturalidad si te preguntan):
- Nombre: BupIA (pronunciado "bupia"). El nombre viene de "Buen Pastor" + "IA".
- Que eres: Un copiloto integral de IA educativa que combina recomendacion de herramientas, generacion de contenido didactico, asesoria en atencion a la diversidad e inclusion, y formacion personalizada para docentes. Estas integrada en la plataforma "Taller IA" del colegio.
- Modelo: Funcionas con Claude Sonnet 4.6, un modelo de Anthropic. Anthropic es una empresa lider en IA segura y responsable.
- Creador: Fuiste disenada y desarrollada por el equipo del Colegio El Buen Pastor como herramienta pionera de apoyo al profesorado.
- Plataforma: Vives dentro de "Taller IA", una plataforma web creada por el colegio que organiza herramientas de IA por etapas educativas (Infantil, Primaria, ESO, IA PRO).
- Proposito: Acompanar a los docentes del colegio en todo su flujo de trabajo con IA: desde descubrir herramientas hasta generar unidades didacticas, examenes, rubricas, actividades, comunicaciones a familias y adaptaciones curriculares completas. Tambien asesoras en atencion a la diversidad (TDAH, dislexia, TEA, altas capacidades...) aplicando principios DUA, y ofreces rutas de aprendizaje personalizadas de 4 semanas.
- Usuarios: Tus interlocutores son docentes del Colegio El Buen Pastor (Murcia). Pueden ser maestros de Infantil, Primaria o profesores de ESO. Tratalos con respeto, cercanía y paciencia.
- Memoria: Tienes memoria persistente. Recuerdas las conversaciones anteriores del usuario dentro del mismo navegador.
- Capacidades: (1) Recomendar herramientas IA del catalogo de la plataforma, (2) Generar contenido didactico con 5 generadores (Unidad Didactica, Examen, Actividad, Comunicacion a familias, Adaptacion Curricular) mas la app Rubric@sEBP para rubricas LOMLOE, (3) Asesorar en atencion a la diversidad e inclusion educativa con enfoque DUA, (4) Explorar herramientas IA externas con busqueda web en tiempo real, (5) Crear rutas de aprendizaje personalizadas de 4 semanas, (6) Ofrecer una Prompteca con recetas listas para usar.
- Marca: BupIA es una marca registrada del Colegio El Buen Pastor.

${CATALOG}

ATENCION A LA DIVERSIDAD — Eres experta en inclusion educativa y atencion a la diversidad. Conoces:

PERFILES Y ESTRATEGIAS:
- TDAH: Fragmentar tareas en pasos cortos, instrucciones claras y directas, timers visuales, descansos programados, refuerzo positivo frecuente, ubicacion preferente en el aula, reducir distractores.
- Dislexia y dificultades lectoescritoras: Tipografia accesible (sans-serif, interlineado amplio), apoyos visuales y auditivos, mas tiempo en tareas escritas, evaluacion oral como alternativa, textos simplificados, evitar copiar de la pizarra.
- TEA (Trastorno del Espectro Autista): Anticipacion de cambios con antelacion, rutinas visuales con pictogramas, instrucciones explicitas y literales (evitar ironias y dobles sentidos), reducir estimulos sensoriales, historias sociales, companero-guia.
- Altas capacidades: Enriquecimiento curricular (NO mas de lo mismo, sino diferente y mas profundo), proyectos de investigacion autonomos, mentoria entre iguales, compactacion curricular, retos creativos y pensamiento divergente.
- Desfase curricular: Actividades multinivel, material manipulativo y concreto, agrupamientos flexibles, planes de refuerzo individualizados, evaluacion por progreso personal.
- Incorporacion tardia / Barrera idiomatica: Apoyo linguistico, companero-tutor bilingue, pictogramas y apoyos visuales, adaptacion cultural del contenido, valorar conocimientos previos del pais de origen.
- Discapacidad sensorial: Materiales en formatos alternativos (braille, audiodescripcion, subtitulos, lengua de signos), ubicacion preferente, adaptacion de materiales visuales/auditivos.
- Discapacidad intelectual: Simplificar contenidos sin infantilizar, material manipulativo, repeticion y sobreaprendizaje, objetivos funcionales, evaluacion adaptada.

MARCO LEGAL Y PEDAGOGICO:
- LOMLOE: Principio de inclusion como eje transversal. Atencion a la diversidad como derecho de todo el alumnado, no solo de quienes tienen diagnostico.
- DUA (Diseno Universal para el Aprendizaje): Multiples formas de representacion (como se presenta la info), expresion (como demuestra el alumno lo aprendido) e implicacion (como se motiva).
- PTI: Plan de Trabajo Individualizado para alumnos con necesidades especificas de apoyo educativo.
- Adaptaciones NO significativas: Mismos objetivos, diferente metodologia, materiales o temporalizacion.
- Adaptaciones significativas: Se modifican los objetivos y criterios de evaluacion.
- Enriquecimiento curricular: Para altas capacidades — ampliar, profundizar, conectar.

Si un profesor pregunta sobre diversidad, adaptar actividades, o perfiles especificos, responde con estrategias PRACTICAS y CONCRETAS para su aula. Recuerda que tienen el generador de Adaptaciones Curriculares (icono 🧩) en la pestana Hoy para generar adaptaciones completas automaticamente.

Reglas:
- Responde SIEMPRE en espanol.
- Se conciso y practico (los profesores tienen poco tiempo).
- Al recomendar, usa nombres exactos del catalogo. Indica que herramienta y por que.
- Si preguntan por herramientas fuera del catalogo, recuerda que tienes el modo Explorador con busqueda web en tiempo real. Invitalos a usar la pestana Explorar.
- Si un profesor necesita crear material didactico (unidades, examenes, rubricas, actividades, comunicaciones o adaptaciones), recuerdale que puede usar los generadores de la pestana Hoy.
- Para consejos de prompts, referencia la "formula de 4 ingredientes": QUE quiero + COMO + PARA QUIEN + DETALLES.
- No inventes URLs ni funcionalidades que no existan.
- Usa un tono cercano y motivador. Eres una companera, no un manual.
- Si preguntan por RUBRICAS o evaluacion, recomienda Rubric@sEBP (app propia del colegio) con el enlace directo. Explica brevemente que pueden elegir etapa, asignatura y criterios LOMLOE, y la IA genera la rubrica completa.
- Si preguntan por el itinerario IA PRO, explica que es para usuarios avanzados que quieren crear proyectos, agentes o aplicaciones con IA.
- Si te preguntan sobre ti misma (que eres, como funcionas, que modelo usas, quien te creo), responde con la informacion de la seccion "SOBRE TI" de forma natural y cercana, sin sonar robotica.
- Usa markdown para dar formato: **negrita** para resaltar, listas con • para opciones, y separa secciones con saltos de linea.
- Respuestas entre 80-200 palabras idealmente. Si el tema lo requiere, puedes extenderte, pero avisa al usuario ("Te lo explico en detalle:").
- Si la pregunta es sencilla, responde en 1-3 frases. No alargues innecesariamente.
- Si te hacen preguntas no relacionadas con educacion, IA o el colegio, redirige amablemente: "¡Buena pregunta! Pero mi especialidad es ayudarte con herramientas de IA para el aula. ¿En que puedo ayudarte con eso?". No respondas a temas politicos, medicos, legales no educativos ni personales.`;

    return {
      chat: BASE + `\n\nOBLIGATORIO — SIEMPRE al final de cada respuesta, DEBES incluir exactamente 3 sugerencias de seguimiento usando EXACTAMENTE este formato (con las etiquetas [SUGERENCIAS] y [/SUGERENCIAS]). NUNCA omitas este bloque:\n\n[SUGERENCIAS]\n1. Pregunta sugerida contextual\n2. Pregunta sugerida contextual\n3. Pregunta sugerida contextual\n[/SUGERENCIAS]\n\nLas sugerencias deben ser preguntas breves (max 12 palabras) relacionadas con tu respuesta. Este bloque es OBLIGATORIO en TODAS tus respuestas sin excepcion.`,
      recommend: BASE + `\n\nContexto adicional: El usuario esta en el recomendador de herramientas.\nResponde con 2-3 frases practicas explicando por que esas herramientas son utiles para su caso.\nNo repitas la lista de herramientas (ya se muestra en la interfaz).\nSugiere un prompt de ejemplo que podrian probar.`,
      bulletin: BASE + `\n\nContexto adicional: Genera un consejo breve y practico del dia para profesores que usan IA en el aula.\nMenciona una herramienta concreta del catalogo.\nFormato: un titulo llamativo (max 8 palabras) y 2-3 frases de contenido.\nResponde SOLO con JSON valido: {"title": "...", "body": "...", "toolId": "..."}\nEl toolId debe ser un ID del catalogo como "pri-gemini", "eso-chatgpt", "inf-suno", etc.`,
      explore: `Eres "BupIA" en modo Explorador. Ayudas a profesores del Colegio El Buen Pastor (Murcia) a descubrir herramientas de IA EXTERNAS que NO estan en su plataforma.

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
    pro:      { icon: '🚀', name: 'IA PRO', ages: 'Avanzado' },
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

  // ── Favorites ──
  loadFavorites() {
    try {
      return JSON.parse(localStorage.getItem('bupia_favorites')) || { messages: [], prompts: [] };
    } catch { return { messages: [], prompts: [] }; }
  },

  saveFavorites(favs) {
    localStorage.setItem('bupia_favorites', JSON.stringify(favs));
  },

  toggleFavMessage(btnEl) {
    const msgDiv = btnEl.closest('.chat-msg');
    if (!msgDiv) return;
    const content = msgDiv.querySelector('.chat-msg-content');
    if (!content) return;
    const text = (content.innerText || content.textContent).trim();
    if (!text) return;

    const favs = this.loadFavorites();
    const idx = favs.messages.findIndex(m => m.text === text);
    if (idx >= 0) {
      favs.messages.splice(idx, 1);
      btnEl.textContent = '☆';
      btnEl.classList.remove('favorited');
    } else {
      favs.messages.push({
        text: text.substring(0, 300),
        date: new Date().toISOString().split('T')[0],
        source: msgDiv.closest('.assistant-explorar-mode') ? 'explore' : 'chat'
      });
      btnEl.textContent = '★';
      btnEl.classList.add('favorited');
    }
    this.saveFavorites(favs);
  },

  toggleFavPrompt(promptId) {
    const favs = this.loadFavorites();
    const idx = favs.prompts.indexOf(promptId);
    if (idx >= 0) {
      favs.prompts.splice(idx, 1);
    } else {
      favs.prompts.push(promptId);
    }
    this.saveFavorites(favs);
    // Re-render prompteca to update button state
    if (this.activeTab === 'prompteca') this.renderPrompteca();
  },

  removeFavMessage(index) {
    const favs = this.loadFavorites();
    if (index >= 0 && index < favs.messages.length) {
      favs.messages.splice(index, 1);
      this.saveFavorites(favs);
      this.renderHoy();
    }
  },

  removeFavPrompt(promptId) {
    const favs = this.loadFavorites();
    const idx = favs.prompts.indexOf(promptId);
    if (idx >= 0) {
      favs.prompts.splice(idx, 1);
      this.saveFavorites(favs);
      this.renderHoy();
    }
  },

  _renderFavoritesSection() {
    const favs = this.loadFavorites();
    const totalFavs = favs.messages.length + favs.prompts.length;
    if (totalFavs === 0) return '';

    let items = '';

    // Favorite messages
    favs.messages.forEach((m, i) => {
      const preview = m.text.length > 80 ? m.text.substring(0, 80) + '...' : m.text;
      const source = m.source === 'explore' ? '🔍' : '💬';
      items += `
        <div class="fav-item">
          <span class="fav-item-icon">${source}</span>
          <div class="fav-item-text">${this.escapeHtml(preview)}</div>
          <button class="fav-item-remove" data-fav-remove-msg="${i}" aria-label="Eliminar favorito">✕</button>
        </div>`;
    });

    // Favorite prompts
    if (this.promptecaData && this.promptecaData.prompts) {
      favs.prompts.forEach(pid => {
        const p = this.promptecaData.prompts.find(pr => pr.id === pid);
        if (!p) return;
        items += `
          <div class="fav-item fav-item-prompt" data-fav-goto-prompt="${this.escapeHtml(pid)}">
            <span class="fav-item-icon">📖</span>
            <div class="fav-item-text">${this.escapeHtml(p.titulo)}</div>
            <button class="fav-item-remove" data-fav-remove-prompt="${this.escapeHtml(pid)}" aria-label="Eliminar favorito">✕</button>
          </div>`;
      });
    }

    return `
      <div class="favs-section" id="favs-section">
        <button class="favs-header" data-favs-toggle aria-expanded="false">
          <span>⭐ Mis favoritos (${totalFavs})</span>
          <span class="favs-toggle-icon">▼</span>
        </button>
        <div class="favs-list" id="favs-list" style="display:none">
          ${items}
        </div>
      </div>`;
  },

  // ── Share Prompt ──
  sharePrompt(promptId, btnEl) {
    const url = `${location.origin}${location.pathname}#prompt=${promptId}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        this.showShareFeedback(btnEl);
      }).catch(() => {
        this.fallbackShareCopy(url, btnEl);
      });
    } else {
      this.fallbackShareCopy(url, btnEl);
    }
  },

  fallbackShareCopy(url, btnEl) {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); this.showShareFeedback(btnEl); }
    catch { /* ignore */ }
    document.body.removeChild(ta);
  },

  showShareFeedback(btnEl) {
    if (!btnEl) return;
    const orig = btnEl.textContent;
    btnEl.textContent = '✅';
    btnEl.classList.add('shared');
    setTimeout(() => {
      btnEl.textContent = orig;
      btnEl.classList.remove('shared');
    }, 1500);
  },

  handleDeepLink() {
    const hash = location.hash;
    if (hash.startsWith('#prompt=')) {
      const promptId = decodeURIComponent(hash.split('=')[1]);
      // Wait for prompteca data to load then navigate
      const tryNav = () => {
        if (this.promptecaData && this.promptecaData.prompts) {
          this.open();
          this.switchTab('prompteca');
          setTimeout(() => {
            const card = this.root.querySelector(`#prompteca-card-${promptId}`);
            if (card) {
              card.scrollIntoView({ behavior: 'smooth', block: 'center' });
              card.classList.add('prompteca-highlight');
              // Toggle open the card
              const body = card.querySelector(`#prompt-body-${promptId}`);
              if (body) body.style.display = 'block';
              setTimeout(() => card.classList.remove('prompteca-highlight'), 3000);
            }
          }, 300);
          // Clean hash
          history.replaceState(null, '', location.pathname + location.search);
        } else if (this.promptecaData === undefined) {
          setTimeout(tryNav, 300);
        }
      };
      tryNav();
    }
  },

  // ── Progress Tracking ──
  loadProgress() {
    try {
      return JSON.parse(localStorage.getItem('bupia_progress')) || this._defaultProgress();
    } catch { return this._defaultProgress(); }
  },

  _defaultProgress() {
    return {
      toolsExplored: [],
      promptsUsed: 0,
      rutasGenerated: 0,
      generatorUses: 0,
      streak: 0,
      lastActiveDate: '',
      totalConsultas: 0
    };
  },

  saveProgress(p) {
    localStorage.setItem('bupia_progress', JSON.stringify(p));
  },

  trackAction(action, data) {
    const p = this.loadProgress();
    const today = new Date().toISOString().slice(0, 10);

    // Update streak
    if (p.lastActiveDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      p.streak = (p.lastActiveDate === yesterday) ? p.streak + 1 : 1;
      p.lastActiveDate = today;
    }

    switch (action) {
      case 'login':
        // Just updates streak
        break;
      case 'consulta':
        p.totalConsultas++;
        break;
      case 'prompt':
        p.promptsUsed++;
        break;
      case 'tool':
        if (data && !p.toolsExplored.includes(data)) {
          p.toolsExplored.push(data);
        }
        break;
      case 'ruta':
        p.rutasGenerated++;
        break;
      case 'generator':
        p.generatorUses++;
        break;
    }

    this.saveProgress(p);
  },

  getUserLevel(p) {
    const total = p.totalConsultas + p.promptsUsed + p.rutasGenerated + p.generatorUses + p.toolsExplored.length;
    if (total >= 31) return { icon: '🌳', name: 'Maestro IA' };
    if (total >= 11) return { icon: '🌿', name: 'Creador' };
    return { icon: '🌱', name: 'Explorador' };
  },

  _renderProgressDashboard() {
    const p = this.loadProgress();
    const level = this.getUserLevel(p);

    // Count total available tools
    let totalTools = 0;
    for (const pw of Object.values(SITE_DATA.pathways)) {
      for (const sec of pw.sections) {
        if (sec.tools) totalTools += sec.tools.length;
      }
    }

    const toolPct = totalTools > 0 ? Math.round((p.toolsExplored.length / totalTools) * 100) : 0;
    const barWidth = Math.min(toolPct, 100);

    return `
      <div class="progress-dashboard">
        <div class="progress-dash-header">
          <span class="progress-dash-title">📊 Tu progreso</span>
          <span class="progress-level-badge">${level.icon} ${level.name}</span>
        </div>
        <div class="progress-dash-grid">
          <div class="progress-dash-stat">
            <span class="progress-stat-icon">🔥</span>
            <span class="progress-stat-value">${p.streak}</span>
            <span class="progress-stat-label">días seguidos</span>
          </div>
          <div class="progress-dash-stat">
            <span class="progress-stat-icon">🛠️</span>
            <span class="progress-stat-value">${p.toolsExplored.length}/${totalTools}</span>
            <span class="progress-stat-label">herramientas</span>
          </div>
          <div class="progress-dash-stat">
            <span class="progress-stat-icon">📝</span>
            <span class="progress-stat-value">${p.promptsUsed}</span>
            <span class="progress-stat-label">prompts</span>
          </div>
          <div class="progress-dash-stat">
            <span class="progress-stat-icon">💬</span>
            <span class="progress-stat-value">${p.totalConsultas}</span>
            <span class="progress-stat-label">consultas</span>
          </div>
        </div>
        <div class="progress-bar-mini">
          <div class="progress-bar-mini-fill" style="width:${barWidth}%"></div>
        </div>
      </div>`;
  },

  // ── Dark Mode ──
  applyTheme() {
    const saved = localStorage.getItem('bupia_theme');
    let theme = saved;
    if (!theme || theme === 'auto') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : '';
    const btn = document.getElementById('dark-mode-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  },

  toggleDarkMode() {
    const current = document.documentElement.dataset.theme;
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next === 'dark' ? 'dark' : '';
    localStorage.setItem('bupia_theme', next);
    const btn = document.getElementById('dark-mode-toggle');
    if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
  },

  init() {
    this.root = document.getElementById('ai-assistant-root');
    if (!this.root) return;

    this.loadState();
    this.buildDOM();
    this.applyTheme();
    this.trackAction('login');
    this.attachEvents();
    this.renderActiveTab();
    this.updateBadge();
    this.loadExternalCatalog();
    this.loadPrompteca();
    this.loadSchoolDNA();
    this.loadLOMLOE();
    this.loadInspeccion();
    this._setupConnectivityMonitor();
    this.handleDeepLink();
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
      this.promptecaData = undefined; // undefined = loading, null = error
      const resp = await fetch('data/prompts.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      this.promptecaData = await resp.json();
      console.log(`[BupIA] Prompteca cargada (${this.promptecaData.prompts.length} prompts)`);
    } catch (e) {
      this.promptecaData = null;
      console.warn('[BupIA] Error cargando Prompteca:', e.message);
    }
  },

  async loadSchoolDNA() {
    try {
      const resp = await fetch('data/escuela_dna.json');
      if (!resp.ok) return;
      const dna = await resp.json();

      let text = `\n\nADN DEL COLEGIO (usa esta informacion cuando hablen del colegio, su historia, valores, programas o identidad):\n`;
      text += `Nombre: ${dna.nombre_completo} | Tipo: ${dna.tipo}\n`;
      text += `Ubicacion: ${dna.ubicacion} | Tel: ${dna.telefono} | Web: ${dna.web}\n`;
      text += `Fundado en ${dna.fundacion.anio} por ${dna.fundacion.fundador}.\n`;
      text += `${dna.fundacion.origen_nombre}\n`;
      text += `${dna.fundacion.historia_breve}\n`;
      text += `\nMision: ${dna.identidad.mision}\n`;
      text += `Vision: ${dna.identidad.vision}\n`;
      text += `Valores: ${dna.identidad.valores.join(', ')}.\n`;
      text += `Caracter: ${dna.identidad.caracter_propio}\n`;
      text += `\nEtapas educativas: ${dna.etapas_educativas.map(e => e.nombre + ' (' + e.cursos + ', ' + e.rango_edad + ')').join(' | ')}\n`;
      text += `\nPastoral: ${dna.pastoral.descripcion}\n`;
      text += `Actividades pastorales: ${dna.pastoral.actividades_clave.join('; ')}.\n`;
      text += `\nERASMUS+: Acreditacion ${dna.programas_destacados.erasmus_plus.acreditacion}. ${dna.programas_destacados.erasmus_plus.descripcion}\n`;
      text += `Destinos recientes: ${dna.programas_destacados.erasmus_plus.destinos_recientes.join(', ')}.\n`;
      text += `Objetivos Erasmus+: ${dna.programas_destacados.erasmus_plus.objetivos.join('; ')}.\n`;
      text += `Idiomas: ${dna.programas_destacados.idiomas.join(', ')}.\n`;
      text += `Extraescolares: ${dna.programas_destacados.extraescolares.join(', ')}.\n`;
      text += `Apps propias del colegio: ${dna.programas_destacados.apps_propias.join(', ')}.\n`;
      text += `\nComunidad: ${dna.comunidad.ampa}. Redes: Instagram ${dna.comunidad.redes_sociales.instagram}, Facebook ${dna.comunidad.redes_sociales.facebook}, Twitter ${dna.comunidad.redes_sociales.twitter}.\n`;

      // Inject DNA into ALL feature prompts
      for (const key of Object.keys(this.SYSTEM_PROMPTS)) {
        this.SYSTEM_PROMPTS[key] += text;
      }

      console.log(`[BupIA] ADN del colegio cargado`);
    } catch (e) {
      // DNA not available — BupIA works without it
    }
  },

  async loadLOMLOE() {
    try {
      const resp = await fetch('data/lomloe_murcia.json');
      if (!resp.ok) return;
      const lom = await resp.json();

      let text = `\n\nLOMLOE REGION DE MURCIA (eres experta en esta normativa; cita decretos cuando sea relevante):\n`;

      // Marco legal
      text += `\nMARCO LEGAL: ${lom.marco_legal.ley_nacional}\n`;
      for (const d of lom.marco_legal.decretos_murcia) {
        text += `- ${d.etapa}: ${d.decreto} (${d.borm}). Base: ${d.base_nacional}.`;
        if (d.modificacion) text += ` Modificacion: ${d.modificacion}`;
        text += `\n`;
      }

      // Competencias clave
      text += `\n${lom.competencias_clave.descripcion}:\n`;
      text += lom.competencias_clave.listado.map(c => `${c.sigla} = ${c.nombre}`).join('; ') + '.\n';

      // Conceptos clave
      text += `\nCONCEPTOS CLAVE LOMLOE:\n`;
      for (const [key, val] of Object.entries(lom.conceptos_clave)) {
        text += `- ${key.replace(/_/g, ' ').toUpperCase()}: ${val}\n`;
      }

      // Evaluación
      text += `\nEVALUACION:\n`;
      text += `Principios: ${lom.evaluacion.principios}\n`;
      text += `Infantil: ${lom.evaluacion.infantil}\n`;
      text += `Primaria: ${lom.evaluacion.primaria}\n`;
      text += `ESO: ${lom.evaluacion.eso}\n`;
      text += `Como evaluar: ${lom.evaluacion.como_evaluar}\n`;

      // Áreas por etapa
      text += `\nAREAS POR ETAPA:\n`;
      text += `Infantil (${lom.areas_por_etapa.infantil.ciclos}): ${lom.areas_por_etapa.infantil.areas.join('; ')}.\n`;
      text += `Primaria (${lom.areas_por_etapa.primaria.ciclos}): ${lom.areas_por_etapa.primaria.areas.join('; ')}. ${lom.areas_por_etapa.primaria.nota}\n`;
      text += `ESO (${lom.areas_por_etapa.eso.cursos}): Comunes: ${lom.areas_por_etapa.eso.materias_comunes.join(', ')}. ${lom.areas_por_etapa.eso.novedad_2024}\n`;

      // Guía situaciones de aprendizaje
      text += `\nGUIA PARA DISENAR SITUACIONES DE APRENDIZAJE:\n`;
      text += lom.guia_situaciones_aprendizaje.pasos.join('\n') + '\n';

      // Recursos oficiales
      text += `\nRECURSOS OFICIALES MURCIA:\n`;
      for (const r of lom.recursos_oficiales) {
        text += `- ${r.nombre}: ${r.url}\n`;
      }

      // Inject into ALL prompts
      for (const key of Object.keys(this.SYSTEM_PROMPTS)) {
        this.SYSTEM_PROMPTS[key] += text;
      }

      console.log(`[BupIA] LOMLOE Murcia cargado`);
    } catch (e) {
      // LOMLOE not available — BupIA works with general knowledge
    }
  },

  async loadInspeccion() {
    try {
      const resp = await fetch('data/inspeccion_murcia.json');
      if (!resp.ok) return;
      const ins = await resp.json();

      let text = `\n\nINSPECCION DE EDUCACION (asesora a los docentes para estar preparados ante la inspeccion; da checklists practicos y cita normativa):\n`;

      // Marco legal
      text += `\nNORMATIVA DE INSPECCION:\n`;
      for (const n of ins.marco_legal.normativa_inspeccion) {
        text += `- ${n.nombre}: ${n.descripcion}`;
        if (n.novedad) text += ` NOVEDAD: ${n.novedad}`;
        text += `\n`;
      }
      text += `Organizacion: ${ins.marco_legal.organizacion}\n`;

      // Programación didáctica
      text += `\nELEMENTOS OBLIGATORIOS DE UNA PROGRAMACION DIDACTICA:\n`;
      text += ins.que_revisan_los_inspectores.programacion_didactica.elementos_obligatorios.map(e => `- ${e}`).join('\n') + '\n';
      text += `Errores frecuentes: ${ins.que_revisan_los_inspectores.programacion_didactica.errores_frecuentes.join('; ')}.\n`;

      // Situaciones de aprendizaje
      text += `\nELEMENTOS DE UNA SITUACION DE APRENDIZAJE (para inspeccion):\n`;
      text += ins.que_revisan_los_inspectores.situaciones_de_aprendizaje.elementos_requeridos.map(e => `- ${e}`).join('\n') + '\n';

      // Evaluación que revisan
      text += `\nQUE REVISAN SOBRE EVALUACION:\n`;
      text += ins.que_revisan_los_inspectores.evaluacion.map(e => `- ${e}`).join('\n') + '\n';

      // Atención a la diversidad
      text += `\nATENCION A LA DIVERSIDAD (inspeccion):\n`;
      text += ins.que_revisan_los_inspectores.atencion_diversidad.map(e => `- ${e}`).join('\n') + '\n';

      // Observación de aula
      text += `\nQUE OBSERVAN EN EL AULA:\n`;
      text += ins.que_revisan_los_inspectores.observacion_aula.que_observan.map(e => `- ${e}`).join('\n') + '\n';

      // Derechos y deberes
      text += `\nDERECHOS DEL DOCENTE ante inspeccion: ${ins.derechos_docente.join('; ')}.\n`;
      text += `DEBERES DEL DOCENTE ante inspeccion: ${ins.deberes_docente.join('; ')}.\n`;

      // Concertado
      text += `\nESPECIFICO CENTROS CONCERTADOS: ${ins.especifico_concertado.obligaciones_concierto.join('; ')}.\n`;
      text += `Ideario religioso: ${ins.especifico_concertado.ideario_religioso.proteccion} ${ins.especifico_concertado.ideario_religioso.limites}\n`;

      // Checklists
      text += `\nCHECKLIST PRE-INSPECCION para docentes:\n`;
      text += ins.preparacion_practica.checklist_pre_inspeccion.map(e => `- ${e}`).join('\n') + '\n';
      text += `DURANTE la inspeccion: ${ins.preparacion_practica.durante_inspeccion.join('; ')}.\n`;
      text += `DESPUES de la inspeccion: ${ins.preparacion_practica.despues_inspeccion.join('; ')}.\n`;

      // RD 68/2026
      text += `\n${ins.rd_68_2026_novedades.titulo}: ${ins.rd_68_2026_novedades.implicacion_practica}\n`;

      // Inject into ALL prompts
      for (const key of Object.keys(this.SYSTEM_PROMPTS)) {
        this.SYSTEM_PROMPTS[key] += text;
      }

      console.log(`[BupIA] Inspección Murcia cargado`);
    } catch (e) {
      // Inspection data not available — BupIA works without it
    }
  },

  // ═══════════════════════════════════════
  //  DOM Construction
  // ═══════════════════════════════════════

  buildDOM() {
    this.root.innerHTML = `
      <button class="assistant-fab" data-assistant-action="toggle"
              aria-label="Abrir asistente BupIA" aria-expanded="false" aria-controls="bupia-panel">
        <img class="fab-avatar" src="img/bupia.png" alt="BupIA">
        <span class="fab-badge" aria-hidden="true"></span>
      </button>

      <!-- Intro video modal (first visit) -->
      <div class="bupia-intro-overlay" id="bupia-intro-overlay" aria-hidden="true">
        <div class="bupia-intro-modal">
          <video class="bupia-intro-video" id="bupia-intro-video"
                 src="media/bupia-intro.mp4"
                 playsinline preload="none"
                 aria-label="Video de presentacion de BupIA"></video>
          <button class="bupia-intro-skip" id="bupia-intro-skip" aria-label="Saltar video de introduccion">Saltar ⏭️</button>
        </div>
      </div>

      <div class="assistant-panel" id="bupia-panel" role="complementary" aria-label="Asistente BupIA">
        <div class="assistant-header">
          <div class="assistant-tabs" role="tablist" aria-label="Secciones del asistente">
            <button class="assistant-tab-btn" data-assistant-tab="hoy" role="tab" id="tab-hoy" aria-selected="true" aria-controls="assistant-hoy" title="¿Qué quieres hacer hoy?"><span class="tab-icon" aria-hidden="true">🚀</span><span class="tab-label"> Hoy</span></button>
            <button class="assistant-tab-btn" data-assistant-tab="tablon" role="tab" id="tab-tablon" aria-selected="false" aria-controls="assistant-tablon" tabindex="-1" title="Top 10 herramientas IA"><span class="tab-icon" aria-hidden="true">📋</span><span class="tab-label"> Tablón</span></button>
            <button class="assistant-tab-btn" data-assistant-tab="prompteca" role="tab" id="tab-prompteca" aria-selected="false" aria-controls="assistant-prompteca" tabindex="-1" title="Prompts listos para usar"><span class="tab-icon" aria-hidden="true">📖</span><span class="tab-label"> Recetas</span></button>
            <button class="assistant-tab-btn" data-assistant-tab="explorar" role="tab" id="tab-explorar" aria-selected="false" aria-controls="assistant-explorar" tabindex="-1" title="Descubre herramientas IA externas"><span class="tab-icon" aria-hidden="true">🔍</span><span class="tab-label"> Explorar</span></button>
            <button class="assistant-tab-btn" data-assistant-tab="chat" role="tab" id="tab-chat" aria-selected="false" aria-controls="assistant-chat" tabindex="-1" title="Chat con BupIA"><span class="tab-icon" aria-hidden="true">💬</span><span class="tab-label"> Chat</span></button>
          </div>
          <button class="assistant-maximize-btn" data-assistant-action="maximize" aria-label="Maximizar panel" title="Maximizar">⛶</button>
          <button class="assistant-close-btn" data-assistant-action="close" aria-label="Cerrar asistente">✕</button>
        </div>
        <div class="assistant-body">
          <div class="assistant-tab-content" id="assistant-hoy" role="tabpanel" aria-labelledby="tab-hoy"></div>
          <div class="assistant-tab-content" id="assistant-tablon" role="tabpanel" aria-labelledby="tab-tablon"></div>
          <div class="assistant-tab-content" id="assistant-prompteca" role="tabpanel" aria-labelledby="tab-prompteca"></div>
          <div class="assistant-tab-content" id="assistant-chat" role="tabpanel" aria-labelledby="tab-chat">
            <div class="chat-header-bar">
              <span class="chat-header-title">💬 Chat con BupIA</span>
              <div class="chat-header-actions">
                <button class="chat-header-icon-btn" id="chat-search-toggle" title="Buscar en chat" aria-label="Buscar en chat">🔍</button>
                <button class="chat-clear-btn" id="chat-clear" title="Nueva conversación" aria-label="Borrar conversacion">🗑️</button>
              </div>
            </div>
            <div class="chat-search-bar" id="chat-search-bar" style="display:none">
              <input type="text" class="chat-search-input" id="chat-search-input" placeholder="Buscar en chat..." autocomplete="off" aria-label="Buscar en chat">
            </div>
            <div class="chat-messages" id="chat-messages" aria-live="polite" aria-relevant="additions"></div>
            <div class="chat-typing" id="chat-typing" aria-hidden="true">
              <div class="chat-typing-dots">
                <div class="chat-typing-dot"></div>
                <div class="chat-typing-dot"></div>
                <div class="chat-typing-dot"></div>
              </div>
              <span class="chat-typing-label">BupIA está pensando...</span>
            </div>
          </div>
          <div class="assistant-tab-content assistant-explorar-mode" id="assistant-explorar" role="tabpanel" aria-labelledby="tab-explorar">
            <div class="chat-header-bar">
              <span class="chat-header-title">🔍 Explorador IA</span>
              <button class="chat-clear-btn" id="explore-clear" title="Nueva búsqueda" aria-label="Borrar busqueda">🗑️</button>
            </div>
            <div class="chat-messages" id="explore-messages" aria-live="polite" aria-relevant="additions"></div>
            <div class="chat-typing" id="explore-typing" aria-hidden="true">
              <div class="chat-typing-dots">
                <div class="chat-typing-dot"></div>
                <div class="chat-typing-dot"></div>
                <div class="chat-typing-dot"></div>
              </div>
              <span class="chat-typing-label">BupIA está buscando...</span>
            </div>
          </div>
        </div>
        <div class="chat-input-bar" id="chat-input-bar" style="display:none">
          <div class="chat-input-wrapper">
            <input type="text" class="chat-input" id="chat-input"
                   placeholder="Pregunta a BupIA..."
                   autocomplete="off" maxlength="500"
                   aria-label="Mensaje para BupIA">
            <span class="chat-char-counter" id="chat-char-counter" aria-live="polite"></span>
          </div>
          <button class="chat-send-btn" id="chat-send" data-assistant-action="send" aria-label="Enviar mensaje">➤</button>
        </div>
        <div class="assistant-footer" role="contentinfo">
          <span>BupIA · Potenciado por Claude</span>
          <button class="dark-mode-toggle" id="dark-mode-toggle" aria-label="Cambiar modo oscuro/claro" title="Modo oscuro/claro">🌙</button>
          <span class="rate-counter" id="rate-counter"></span>
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

      // Dark mode toggle
      if (target.closest('#dark-mode-toggle')) {
        this.toggleDarkMode();
        return;
      }

      // FAB toggle
      const actionEl = target.closest('[data-assistant-action]');
      if (actionEl) {
        const action = actionEl.dataset.assistantAction;
        if (action === 'toggle') this.toggle();
        else if (action === 'close') this.close();
        else if (action === 'maximize') this.toggleMaximize();
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

      // Chat: clear conversation (persistent memory)
      if (target.closest('#chat-clear')) {
        this.clearChat();
        return;
      }

      // Explore: clear search history
      if (target.closest('#explore-clear')) {
        this.resetExplorar();
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

      // Chat: followup suggestion chip
      const followupChip = target.closest('[data-followup-query]');
      if (followupChip) {
        const query = followupChip.dataset.followupQuery;
        this.root.querySelectorAll('.chat-followup-chips').forEach(el => el.remove());
        this.handleSend(query);
        return;
      }

      // Chat: search toggle
      const searchToggle = target.closest('#chat-search-toggle');
      if (searchToggle) {
        this.toggleChatSearch();
        return;
      }

      // Explore: reset / new search
      const exploreReset = target.closest('[data-explore-reset]');
      if (exploreReset) {
        this.resetExplorar();
        return;
      }

      // Prompteca: retry on error
      const retryBtn = target.closest('[data-prompteca-retry]');
      if (retryBtn) {
        this.loadPrompteca().then(() => this.renderPrompteca());
        return;
      }

      // Chat: retry on error
      const chatRetry = target.closest('[data-chat-retry]');
      if (chatRetry) {
        const errorMsg = chatRetry.closest('.chat-msg-error');
        if (errorMsg) errorMsg.remove();
        const lastUserMsg = this.chatHistory[this.chatHistory.length - 1];
        if (lastUserMsg && lastUserMsg.role === 'user') {
          this.chatHistory.pop();
          this.handleSend(lastUserMsg.content);
        }
        return;
      }

      // Explore: retry on error
      const exploreRetry = target.closest('[data-explore-retry]');
      if (exploreRetry) {
        const errorMsg = exploreRetry.closest('.chat-msg-error');
        if (errorMsg) errorMsg.remove();
        const lastUserMsg = this.exploreHistory[this.exploreHistory.length - 1];
        if (lastUserMsg && lastUserMsg.role === 'user') {
          this.exploreHistory.pop();
          this.sendExploreMessage(lastUserMsg.content);
        }
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

      // Chat: copy assistant message
      const chatCopyBtn = target.closest('[data-chat-copy]');
      if (chatCopyBtn) {
        this.copyChatMessage(chatCopyBtn);
        return;
      }

      // Explore: copy assistant message
      const exploreCopyBtn = target.closest('[data-explore-copy]');
      if (exploreCopyBtn) {
        this.copyChatMessage(exploreCopyBtn);
        return;
      }

      // Favorites: toggle star on chat/explore message
      const favBtn = target.closest('[data-chat-fav]');
      if (favBtn) {
        this.toggleFavMessage(favBtn);
        return;
      }

      // Share prompt
      const shareBtn = target.closest('[data-prompteca-share]');
      if (shareBtn) {
        this.sharePrompt(shareBtn.dataset.promptecaShare, shareBtn);
        return;
      }

      // Favorites: toggle star on prompteca
      const promptFavBtn = target.closest('[data-prompteca-fav]');
      if (promptFavBtn) {
        this.toggleFavPrompt(promptFavBtn.dataset.promptecaFav);
        return;
      }

      // Favorites: toggle collapse
      if (target.closest('[data-favs-toggle]')) {
        const list = this.root.querySelector('#favs-list');
        const icon = this.root.querySelector('.favs-toggle-icon');
        if (list) {
          const open = list.style.display !== 'none';
          list.style.display = open ? 'none' : 'block';
          if (icon) icon.textContent = open ? '▼' : '▲';
        }
        return;
      }

      // Favorites: remove message
      const favRemoveMsg = target.closest('[data-fav-remove-msg]');
      if (favRemoveMsg) {
        e.stopPropagation();
        this.removeFavMessage(parseInt(favRemoveMsg.dataset.favRemoveMsg, 10));
        return;
      }

      // Favorites: remove prompt
      const favRemovePrompt = target.closest('[data-fav-remove-prompt]');
      if (favRemovePrompt) {
        e.stopPropagation();
        this.removeFavPrompt(favRemovePrompt.dataset.favRemovePrompt);
        return;
      }

      // Favorites: go to prompt
      const favGotoPrompt = target.closest('[data-fav-goto-prompt]');
      if (favGotoPrompt && !target.closest('[data-fav-remove-prompt]')) {
        this.switchTab('prompteca');
        setTimeout(() => {
          const card = this.root.querySelector(`#prompteca-card-${favGotoPrompt.dataset.favGotoPrompt}`);
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.classList.add('prompteca-highlight');
            setTimeout(() => card.classList.remove('prompteca-highlight'), 2000);
          }
        }, 200);
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

      // Generators: start a generator
      const genStart = target.closest('[data-gen-start]');
      if (genStart) {
        this.startGenerator(genStart.dataset.genStart);
        return;
      }

      // Generators: select etapa
      const genEtapa = target.closest('[data-gen-etapa]');
      if (genEtapa) {
        this.generatorState.etapa = genEtapa.dataset.genEtapa;
        this.generatorState.step = 2;
        this.renderHoy();
        return;
      }

      // Generators: submit form
      const genSubmit = target.closest('[data-gen-submit]');
      if (genSubmit) {
        this.submitGenerator();
        return;
      }

      // Generators: back navigation
      const genBack = target.closest('[data-gen-back]');
      if (genBack) {
        const dest = genBack.dataset.genBack;
        if (dest === 'menu') {
          this.generatorState = { active: false, type: null, step: 0, etapa: null, params: {}, result: null };
        } else if (dest === 'etapa') {
          this.generatorState.step = 1;
          this.generatorState.etapa = null;
        }
        this.renderHoy();
        return;
      }

      // Generators: copy result
      const genCopy = target.closest('[data-gen-copy]');
      if (genCopy) {
        this.copyGeneratorResult();
        return;
      }

      // Generators: regenerate
      const genRegen = target.closest('[data-gen-regenerate]');
      if (genRegen) {
        this.generatorState.result = null;
        this.generatorState.step = 2;
        this.renderHoy();
        return;
      }

      // Generators: multinivel tab switching
      const levelTab = target.closest('[data-gen-level]');
      if (levelTab) {
        const level = levelTab.dataset.genLevel;
        const container = levelTab.closest('.gen-result') || levelTab.parentElement.parentElement;
        container.querySelectorAll('.gen-level-tab').forEach(t => t.classList.toggle('active', t.dataset.genLevel === level));
        container.querySelectorAll('.gen-level-panel').forEach(p => p.classList.toggle('active', p.dataset.genLevelPanel === level));
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
      chatInput.addEventListener('input', () => {
        this.updateCharCounter();
      });
    }

    // Search input: filter chat messages in real time
    const searchInput = this.root.querySelector('#chat-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.filterChatMessages(searchInput.value);
      });
    }

    // Keyboard: ESC — first restore from maximized, second closes panel
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        e.preventDefault();
        if (this.isMaximized) {
          this.toggleMaximize();
        } else {
          this.close();
        }
      }
    });

    // Focus trap inside open panel
    this.panel.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focusable = [...this.panel.querySelectorAll(
        'button:not([disabled]):not([style*="display:none"]), input:not([disabled]), [tabindex="0"]'
      )].filter(el => el.offsetParent !== null); // only visible
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    // Arrow key navigation in tablist (WAI-ARIA Tabs pattern)
    const tablist = this.root.querySelector('[role="tablist"]');
    if (tablist) {
      tablist.addEventListener('keydown', (e) => {
        const tabs = [...tablist.querySelectorAll('[role="tab"]')];
        const idx = tabs.indexOf(document.activeElement);
        if (idx === -1) return;

        let newIdx;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          newIdx = (idx + 1) % tabs.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          newIdx = (idx - 1 + tabs.length) % tabs.length;
        } else if (e.key === 'Home') {
          newIdx = 0;
        } else if (e.key === 'End') {
          newIdx = tabs.length - 1;
        } else {
          return;
        }
        e.preventDefault();
        tabs[newIdx].focus();
        tabs[newIdx].click();
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
    this.fab.setAttribute('aria-expanded', 'true');
    this.renderActiveTab();
    this.updateRateCounter();
    this.saveState();
    // Focus active tab button for keyboard users
    const activeTabBtn = this.root.querySelector('.assistant-tab-btn.active');
    if (activeTabBtn) activeTabBtn.focus();
  },

  // ── Intro Video ──

  showIntroVideo() {
    const overlay = this.root.querySelector('#bupia-intro-overlay');
    const video = this.root.querySelector('#bupia-intro-video');
    if (!overlay || !video) return;

    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    video.currentTime = 0;

    video.play().catch(() => {
      // Video failed to play — show fallback welcome
      this.showVideoFallback(overlay);
    });

    // Handle network/load errors
    video.onerror = () => this.showVideoFallback(overlay);

    // When video ends naturally → close and open BupIA
    video.onended = () => this.closeIntroVideo(true);
  },

  showVideoFallback(overlay) {
    const modal = overlay.querySelector('.bupia-intro-modal');
    if (!modal) return;

    modal.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  padding:40px 30px;text-align:center;background:linear-gradient(135deg,#2d2b3d,#4a3f6b);
                  width:100%;min-height:300px;border-radius:20px;">
        <img src="img/bupia.png" alt="BupIA" loading="lazy"
             style="width:80px;height:80px;border-radius:50%;margin-bottom:20px;
                    box-shadow:0 4px 20px rgba(124,92,191,0.5);">
        <div style="color:#fff;font-size:1.25rem;font-weight:700;margin-bottom:8px;
                    font-family:'Poppins',sans-serif;">
          ¡Hola, profe! 👋
        </div>
        <div style="color:rgba(255,255,255,0.8);font-size:0.875rem;line-height:1.6;
                    max-width:320px;font-family:'Poppins',sans-serif;margin-bottom:24px;">
          Soy <strong>BupIA</strong>, tu copiloto IA del Colegio El Buen Pastor.
          Genero contenido, asesoro en diversidad y te ayudo a descubrir herramientas para el aula.
        </div>
        <button onclick="Assistant.closeIntroVideo(true)"
                style="padding:10px 28px;border:none;border-radius:20px;
                       background:linear-gradient(135deg,#7c5cbf,#ff7b54);color:#fff;
                       font-family:'Poppins',sans-serif;font-size:0.875rem;font-weight:600;
                       cursor:pointer;"
                aria-label="Comenzar a usar BupIA">
          Comenzar 🚀
        </button>
      </div>
    `;
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
      this.fab.setAttribute('aria-expanded', 'true');
      this.renderActiveTab();
      this.saveState();
      // Focus active tab button for keyboard users
      const activeTabBtn = this.root.querySelector('.assistant-tab-btn.active');
      if (activeTabBtn) activeTabBtn.focus();
    }
  },

  close() {
    // Restore from maximized first if needed
    if (this.isMaximized) this.toggleMaximize();
    this.isOpen = false;
    this.panel.classList.remove('open');
    this.fab.classList.remove('open');
    this.fab.setAttribute('aria-expanded', 'false');
    this.saveState();
    // Return focus to FAB
    this.fab.focus();
  },

  toggleMaximize() {
    this.isMaximized = !this.isMaximized;
    this.panel.classList.toggle('maximized', this.isMaximized);
    this.fab.classList.toggle('hidden-for-maximize', this.isMaximized);
    const btn = this.panel.querySelector('.assistant-maximize-btn');
    if (btn) {
      btn.textContent = this.isMaximized ? '⧉' : '⛶';
      btn.title = this.isMaximized ? 'Restaurar' : 'Maximizar';
      btn.setAttribute('aria-label', this.isMaximized ? 'Restaurar panel' : 'Maximizar panel');
    }
  },

  // ═══════════════════════════════════════
  //  Tab Switching
  // ═══════════════════════════════════════

  switchTab(tab) {
    this.activeTab = tab;

    // Update tab buttons (visual + ARIA + roving tabindex)
    this.root.querySelectorAll('.assistant-tab-btn').forEach(btn => {
      const isActive = btn.dataset.assistantTab === tab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      btn.setAttribute('tabindex', isActive ? '0' : '-1');
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

    // Update tab button active states (visual + ARIA + roving tabindex)
    this.root.querySelectorAll('.assistant-tab-btn').forEach(btn => {
      const isActive = btn.dataset.assistantTab === this.activeTab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      btn.setAttribute('tabindex', isActive ? '0' : '-1');
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

    if (typeof RANKING_DATA !== 'undefined' && RANKING_DATA.length > 0) {
      for (const item of RANKING_DATA) {
        html += this.renderRankingCard(item);
      }
    } else {
      html += `
        <div class="tablon-empty-state">
          <div class="tablon-empty-icon" aria-hidden="true">📋</div>
          <div class="tablon-empty-title">Ranking no disponible</div>
          <div class="tablon-empty-text">El ranking de herramientas se actualizará próximamente.</div>
        </div>
      `;
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
      return `<span class="ranking-etapa">${labels[e] || this.escapeHtml(e)}</span>`;
    }).join('');

    return `
      <div class="ranking-card${posClass}">
        <div class="ranking-card-left">
          <span class="ranking-position">${medal || '#' + item.position}</span>
        </div>
        <div class="ranking-card-right">
          <div class="ranking-card-header">
            <span class="ranking-card-icon">${this.escapeHtml(item.icono)}</span>
            <span class="ranking-card-nombre">${this.escapeHtml(item.nombre)}</span>
            <span class="ranking-card-empresa">${this.escapeHtml(item.empresa)}</span>
            <span class="ranking-precio-badge ${precioBadge}">${precioLabel}</span>
          </div>
          <div class="ranking-card-body">${this.escapeHtml(item.que_hace)}</div>
          <div class="ranking-card-destaca"><strong>Destaca por:</strong> ${this.escapeHtml(item.por_que_top)}</div>
          <div class="ranking-card-footer">
            <div class="ranking-etapas">${etapasHtml}</div>
            <span class="ranking-card-precio">${this.escapeHtml(item.precio)}</span>
          </div>
          <a class="ranking-card-link" href="${this.escapeHtml(item.url)}" target="_blank" rel="noopener">Visitar ${this.escapeHtml(item.nombre)} ↗</a>
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

    // Generator wizard active?
    if (this.generatorState.active) {
      this.renderGeneratorWizard(container);
      return;
    }

    // Mi Ruta wizard active?
    if (this.rutaWizardState.step > 0) {
      this.renderRutaWizard(container);
      return;
    }

    const { intent, level, sectionId } = this.wizardState;

    if (!intent) {
      this.renderIntentPicker(container);
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
        <img class="wizard-hero-avatar" src="img/bupia.png" alt="BupIA" loading="lazy">
        <div class="wizard-hero-text">
          <div class="wizard-greeting">¡Hola, profe!</div>
          <div class="wizard-greeting-sub">Soy <strong>BupIA</strong>, tu copiloto IA</div>
        </div>
        <button class="bupia-rewatch-btn" data-bupia-rewatch title="Ver vídeo de presentación">🎬</button>
      </div>
      ${savedRutaHtml}
      ${this._renderProgressDashboard()}
      ${this._renderFavoritesSection()}
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
      <div class="wizard-apps-section">
        <div class="ruta-cta-divider"><span>Crear contenido con IA</span></div>
        <div class="gen-picker-grid">
          ${this.GENERATOR_TYPES.map(g => g.externalUrl
            ? `<a href="${g.externalUrl}" target="_blank" rel="noopener" class="gen-picker-card gen-picker-external">
              <span class="gen-picker-icon">${g.icon}</span>
              <div class="gen-picker-label">${g.label} ↗</div>
            </a>`
            : `<button class="gen-picker-card" data-gen-start="${g.id}">
              <span class="gen-picker-icon">${g.icon}</span>
              <div class="gen-picker-label">${g.label}</div>
            </button>`
          ).join('')}
        </div>
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
    this.wizardState.level = 'all';
    this.wizardState.sectionId = null;

    const container = this.root.querySelector('#assistant-hoy');
    if (container) this.renderResults(container);
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

  // Step 3: Show recommended tools (aggregated from all levels)
  renderResults(container) {
    const { intent: intentId, level } = this.wizardState;
    const intent = this.INTENTS.find(i => i.id === intentId);
    if (!intent) return;

    // Collect tools from all levels, deduplicating by tool name
    const seen = new Set();
    const toolEntries = []; // {tool, sectionId, pathway}
    for (const [lvlKey, pw] of Object.entries(SITE_DATA.pathways)) {
      for (const sec of pw.sections) {
        if (!intent.categories.includes(sec.id) || !sec.tools) continue;
        for (const tid of sec.tools) {
          const t = SITE_DATA.tools[tid];
          if (!t || seen.has(t.name)) continue;
          seen.add(t.name);
          toolEntries.push({ tool: t, sectionId: sec.id, pathway: lvlKey });
        }
      }
    }

    if (toolEntries.length === 0) return;

    container.innerHTML = `
      <button class="wizard-back-btn" data-wizard-back="intents">← Cambiar actividad</button>
      <div class="wizard-title">${intent.icon} ${intent.label}</div>
      <div class="wizard-subtitle">Herramientas recomendadas</div>
      <div class="wizard-results">
        ${toolEntries.map(({ tool: t, sectionId, pathway }) => `
          <div class="wizard-tool-card" data-wizard-tool="${this.escapeHtml(t.id)}" data-wizard-section="${this.escapeHtml(sectionId)}" data-wizard-pathway="${this.escapeHtml(pathway)}">
            <img class="wizard-tool-logo" src="${this.escapeHtml(t.logo)}" alt="${this.escapeHtml(t.logoAlt)}">
            <div class="wizard-tool-info">
              <div class="wizard-tool-name">${this.escapeHtml(t.name)}</div>
              <div class="wizard-tool-tagline">${this.escapeHtml(t.tagline)}</div>
            </div>
            <span class="wizard-tool-arrow">→</span>
          </div>
        `).join('')}
      </div>
      <div id="wizard-ai-slot"></div>
    `;

    // Load AI recommendation (async)
    const firstLevel = toolEntries[0].pathway;
    this.loadAIRecommendation(firstLevel, intent.label);
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
            ${this.formatMarkdown(result.content)}
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

    if (this.chatHistory.length > 0) {
      // Restore saved conversation from persistent memory
      this.chatHistory.forEach(msg => {
        this.appendMessage(msg.role, msg.content, null, msg.timestamp);
      });
    } else {
      // Empty state hero
      const heroDiv = document.createElement('div');
      heroDiv.className = 'chat-empty-hero';
      heroDiv.innerHTML = '<div class="empty-state-icon">💬</div><div class="empty-state-title">Chat con BupIA</div>';
      container.appendChild(heroDiv);

      // Welcome message for first-time users
      this.appendMessage('assistant',
        '¡Hola! 👋 Soy **BupIA**, tu copiloto IA del Taller IA. Puedo ayudarte a:\n\n' +
        '• **Generar contenido**: unidades didácticas, exámenes, rúbricas, actividades y más\n' +
        '• **Adaptar a la diversidad**: estrategias para TDAH, dislexia, TEA, altas capacidades...\n' +
        '• **Encontrar herramientas**: recomendaciones del catálogo y exploración web\n' +
        '• **Mejorar tus prompts**: consejos con la fórmula de 4 ingredientes\n' +
        '• **Planificar tu formación**: rutas de aprendizaje personalizadas\n\n' +
        '¿En qué puedo ayudarte hoy?'
      );
    }
  },

  clearChat() {
    this.chatHistory = [];
    const container = this.root.querySelector('#chat-messages');
    if (container) container.innerHTML = '';
    this.saveState();
    this.renderChat(); // Shows welcome again
  },

  handleSend(overrideText) {
    const input = this.root.querySelector('#chat-input');
    if (!input && !overrideText) return;

    const text = overrideText || (input ? input.value.trim() : '');
    if (!text || this.isSending) return;

    // Length guard for programmatic sends (input enforces 500 via maxlength)
    if (text.length > 2000) {
      this.appendMessage('error', `Mensaje demasiado largo (${text.length}/2000 caracteres). Acórtalo.`);
      return;
    }

    // Debounce: prevent rapid duplicate sends (300ms)
    const now = Date.now();
    if (now - this._lastSendTime < 300) return;
    this._lastSendTime = now;

    if (input && !overrideText) input.value = '';

    if (this.activeTab === 'explorar') {
      this.sendExploreMessage(text);
    } else {
      this.sendMessage(text);
    }
  },

  async sendMessage(text) {
    this.isSending = true;
    this.trackAction('consulta');
    const sendBtn = this.root.querySelector('#chat-send');
    if (sendBtn) sendBtn.disabled = true;

    // Show user message
    const userTs = Date.now();
    this.appendMessage('user', text, null, userTs);

    // Add to history
    this.chatHistory.push({ role: 'user', content: text, timestamp: userTs });

    // Trim history to last 50 messages (persistent memory)
    if (this.chatHistory.length > 50) {
      this.chatHistory = this.chatHistory.slice(-50);
    }

    // Try streaming first, fallback to standard
    let success = false;
    const chatContext = this.buildSmartContext(this.chatHistory);
    try {
      this.showTyping();
      const streamDiv = this.appendStreamingMessage('#chat-messages');
      let fullText = '';
      let streamOk = false;

      await this.apiCallStream('chat', chatContext,
        (token) => {
          if (!streamOk) { this.hideTyping(); streamOk = true; }
          fullText += token;
          this.updateStreamingMessage(streamDiv, fullText);
        },
        () => {
          this.hideTyping();
          const savedText = this.finalizeStreamingMessage(streamDiv, fullText, 'chat');
          this.chatHistory.push({ role: 'assistant', content: savedText || fullText, timestamp: Date.now() });
          this.saveState();
        },
        (errMsg) => {
          this.hideTyping();
          if (streamDiv) streamDiv.remove();
          this.appendMessage('error', errMsg || 'Error en el streaming.', 'api');
        }
      );
      success = true;
    } catch (streamErr) {
      // Fallback to non-streaming
      this.hideTyping();
      // Remove empty stream div if it exists
      const emptyStream = this.root.querySelector('.chat-msg.streaming');
      if (emptyStream) emptyStream.remove();

      this.showTyping();
      try {
        const result = await this.apiCall('chat', chatContext);
        this.hideTyping();
        if (result && result.content) {
          this.appendMessage('assistant', result.content);
          const { cleanText: ct } = this._parseSuggestions(result.content);
          this.chatHistory.push({ role: 'assistant', content: ct, timestamp: Date.now() });
          this.saveState();
          success = true;
        } else {
          this.appendMessage('error', 'No se recibió respuesta. Comprueba la conexión.');
        }
      } catch (err) {
        this.hideTyping();
        this.appendMessage('error', err.message || 'Error al conectar con el asistente.', err.type || 'unknown');
      }
    }

    this.isSending = false;
    if (sendBtn) sendBtn.disabled = false;
    this.updateRateCounter();

    // Focus input
    const input = this.root.querySelector('#chat-input');
    if (input) input.focus();
  },

  // ── HTML Escape (for dynamic data in innerHTML) ──
  escapeHtml(text) {
    if (!text) return '';
    const map = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
    return String(text).replace(/[&<>"']/g, m => map[m]);
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

  _parseSuggestions(text) {
    const match = text.match(/\[SUGERENCIAS\]([\s\S]*?)\[\/SUGERENCIAS\]/);
    if (!match) return { cleanText: text, suggestions: [] };
    const cleanText = text.replace(match[0], '').trim();
    const suggestions = match[1].trim().split('\n')
      .map(s => s.replace(/^\d+\.\s*/, '').trim())
      .filter(s => s.length > 0)
      .slice(0, 3);
    return { cleanText, suggestions };
  },

  _renderFollowupChips(container, suggestions) {
    if (!suggestions.length || !container) return;
    // Remove previous chips
    this.root.querySelectorAll('.chat-followup-chips').forEach(el => el.remove());
    const chipsDiv = document.createElement('div');
    chipsDiv.className = 'chat-followup-chips';
    chipsDiv.innerHTML = suggestions.map(s =>
      `<button class="chat-followup-chip" data-followup-query="${this.escapeHtml(s)}">${this.escapeHtml(s)}</button>`
    ).join('');
    container.appendChild(chipsDiv);
    const body = this.root.querySelector('.assistant-body');
    if (body) body.scrollTop = body.scrollHeight;
  },

  appendMessage(role, text, errorType, savedTimestamp) {
    const container = this.root.querySelector('#chat-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `chat-msg chat-msg-${role}`;

    // Timestamp helper
    const ts = savedTimestamp ? new Date(savedTimestamp) : new Date();
    const timeStr = ts.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    if (role === 'error') {
      const icons = { network: '📡', timeout: '⏱️', rate_limit: '🚫', api: '⚠️', unknown: '❌' };
      const icon = icons[errorType] || '❌';
      const showRetry = errorType !== 'rate_limit';
      div.innerHTML = `
        <span class="chat-error-icon">${icon}</span>
        <span class="chat-error-text">${this.formatMarkdown(text)}</span>
        ${showRetry ? '<button class="chat-retry-btn" data-chat-retry aria-label="Reintentar mensaje">🔄 Reintentar</button>' : ''}
      `;
    } else if (role === 'assistant') {
      const { cleanText, suggestions } = this._parseSuggestions(text);
      div.innerHTML = `
        <div class="chat-msg-content">${this.formatMarkdown(cleanText)}</div>
        <span class="chat-msg-time">${timeStr}</span>
        <div class="chat-msg-actions">
          <button class="chat-copy-btn" data-chat-copy aria-label="Copiar respuesta">📋</button>
          <button class="chat-fav-btn" data-chat-fav aria-label="Guardar en favoritos">☆</button>
        </div>
      `;
      container.appendChild(div);
      this._renderFollowupChips(container, suggestions);
      const body = this.root.querySelector('.assistant-body');
      if (body) body.scrollTop = body.scrollHeight;
      return;
    } else {
      div.innerHTML = `${this.formatMarkdown(text)}<span class="chat-msg-time">${timeStr}</span>`;
    }

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

  // ── Streaming helpers ──

  _streamRafId: null,
  _streamPendingText: '',

  async apiCallStream(feature, messages, onToken, onDone, onError) {
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const baseUrl = isLocal ? '' : this.PROXY_URL.replace('/api/chat', '');
    const url = baseUrl + '/api/chat/stream';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let resp;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature, messages }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      throw new ApiError(err.name === 'AbortError'
        ? 'La solicitud tardó demasiado. Inténtalo de nuevo.'
        : 'No se pudo conectar. Comprueba tu conexión.',
        err.name === 'AbortError' ? 'timeout' : 'network');
    }

    clearTimeout(timeoutId);

    if (!resp.ok || !resp.body) {
      const data = await resp.json().catch(() => ({}));
      throw new ApiError(data.error || data.detail || `Error del servidor (${resp.status})`,
        resp.status === 429 ? 'rate_limit' : 'api');
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n\n');
      buffer = parts.pop();

      for (const chunk of parts) {
        const line = chunk.trim();
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.token) onToken(data.token);
          if (data.done) { onDone(); return; }
          if (data.error) { onError(data.error); return; }
        } catch { /* skip malformed */ }
      }
    }
    onDone();
  },

  appendStreamingMessage(containerId) {
    const container = this.root.querySelector(containerId || '#chat-messages');
    if (!container) return null;
    const div = document.createElement('div');
    div.className = 'chat-msg chat-msg-assistant streaming';
    div.innerHTML = '<div class="chat-msg-content"></div>';
    container.appendChild(div);
    return div;
  },

  updateStreamingMessage(div, text) {
    this._streamPendingText = text;
    if (!this._streamRafId) {
      this._streamRafId = requestAnimationFrame(() => {
        const content = div?.querySelector('.chat-msg-content');
        if (content) content.innerHTML = this.formatMarkdown(this._streamPendingText);
        this._streamRafId = null;
        const body = this.root.querySelector('.assistant-body');
        if (body) body.scrollTop = body.scrollHeight;
      });
    }
  },

  finalizeStreamingMessage(div, text, mode) {
    if (this._streamRafId) {
      cancelAnimationFrame(this._streamRafId);
      this._streamRafId = null;
    }
    if (!div) return;
    div.classList.remove('streaming');

    // Parse suggestions from response
    const { cleanText, suggestions } = this._parseSuggestions(text);

    const content = div.querySelector('.chat-msg-content');
    if (content) content.innerHTML = this.formatMarkdown(cleanText);

    // Timestamp
    const timeStr = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const timeSpan = document.createElement('span');
    timeSpan.className = 'chat-msg-time';
    timeSpan.textContent = timeStr;
    div.appendChild(timeSpan);

    const copyAttr = mode === 'explore' ? 'data-explore-copy' : 'data-chat-copy';
    const actions = document.createElement('div');
    actions.className = 'chat-msg-actions';
    actions.innerHTML = `
      <button class="chat-copy-btn" ${copyAttr} aria-label="Copiar respuesta">📋</button>
      <button class="chat-fav-btn" data-chat-fav aria-label="Guardar en favoritos">☆</button>
    `;
    div.appendChild(actions);

    // Render followup chips (chat mode only)
    if (mode === 'chat' && suggestions.length) {
      const container = div.parentElement;
      this._renderFollowupChips(container, suggestions);
    }

    const body = this.root.querySelector('.assistant-body');
    if (body) body.scrollTop = body.scrollHeight;

    return cleanText;
  },

  // ═══════════════════════════════════════
  //  EXPLORAR (AI Tool Discovery)
  // ═══════════════════════════════════════

  renderExplorar() {
    const container = this.root.querySelector('#explore-messages');
    if (!container) return;

    if (container.children.length > 0) return;

    if (this.exploreHistory.length > 0) {
      // Restore saved exploration from persistent memory
      this.exploreHistory.forEach(msg => {
        this.appendExploreMessage(msg.role, msg.content, null, msg.timestamp);
      });
    } else {
      this.renderExplorarWelcome(container);
    }
  },

  renderExplorarWelcome(container) {
    if (!container) container = this.root.querySelector('#explore-messages');
    if (!container) return;

    // Empty state hero
    const heroDiv = document.createElement('div');
    heroDiv.className = 'explore-empty-hero';
    heroDiv.innerHTML = '<div class="empty-state-icon">🔍</div><div class="empty-state-title">Explorador IA</div>';
    container.appendChild(heroDiv);

    this.appendExploreMessage('assistant',
      '**Modo Explorador** 🔍\n\n' +
      'Aquí te ayudo a descubrir herramientas de IA **que no están en la plataforma** pero que pueden ser muy útiles para tu aula.\n\n' +
      'Busco herramientas que sean:\n' +
      '• Gratuitas o con plan free generoso\n' +
      '• Accesibles desde el navegador\n' +
      '• Con valor pedagógico real\n\n' +
      'Prueba con los atajos de abajo o escríbeme lo que necesitas. También puedo buscar herramientas de **accesibilidad e inclusión** 🧩'
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
      <button class="explore-chip" data-explore-query="Herramientas de IA para atención a la diversidad, adaptaciones curriculares, inclusión educativa y necesidades educativas especiales">🧩 Diversidad e inclusión</button>
      <button class="explore-chip" data-explore-query="Herramientas de IA de accesibilidad educativa: texto a voz, pictogramas, lectura fácil, apoyo visual y auditivo para alumnos con NEE">♿ Accesibilidad</button>
    `;
    container.appendChild(chipsDiv);
  },

  resetExplorar() {
    const container = this.root.querySelector('#explore-messages');
    if (container) container.innerHTML = '';
    this.exploreHistory = [];
    this.renderExplorarWelcome(container);
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

    const exploreUserTs = Date.now();
    this.appendExploreMessage('user', text, null, exploreUserTs);
    this.exploreHistory.push({ role: 'user', content: text, timestamp: exploreUserTs });

    if (this.exploreHistory.length > 50) {
      this.exploreHistory = this.exploreHistory.slice(-50);
    }

    // Try streaming first, fallback to standard
    const exploreContext = this.buildSmartContext(this.exploreHistory);
    try {
      this.showExploreTyping();
      const streamDiv = this.appendStreamingMessage('#explore-messages');
      let fullText = '';
      let streamOk = false;

      await this.apiCallStream('explore', exploreContext,
        (token) => {
          if (!streamOk) { this.hideExploreTyping(); streamOk = true; }
          fullText += token;
          this.updateStreamingMessage(streamDiv, fullText);
        },
        () => {
          this.hideExploreTyping();
          const savedExpText = this.finalizeStreamingMessage(streamDiv, fullText, 'explore');
          this.exploreHistory.push({ role: 'assistant', content: savedExpText || fullText, timestamp: Date.now() });
          this.saveState();
          this.showExploreResetBtn();
        },
        (errMsg) => {
          this.hideExploreTyping();
          if (streamDiv) streamDiv.remove();
          this.appendExploreMessage('error', errMsg || 'Error en el streaming.', 'api');
        }
      );
    } catch (streamErr) {
      this.hideExploreTyping();
      const emptyStream = this.root.querySelector('#explore-messages .streaming');
      if (emptyStream) emptyStream.remove();

      this.showExploreTyping();
      try {
        const result = await this.apiCall('explore', exploreContext);
        this.hideExploreTyping();
        if (result && result.content) {
          this.appendExploreMessage('assistant', result.content, null, Date.now());
          this.exploreHistory.push({ role: 'assistant', content: result.content, timestamp: Date.now() });
          this.saveState();
          this.showExploreResetBtn();
        } else {
          this.appendExploreMessage('error', 'No se recibió respuesta. Comprueba la conexión.');
        }
      } catch (err) {
        this.hideExploreTyping();
        this.appendExploreMessage('error', err.message || 'Error al conectar con el asistente.', err.type || 'unknown');
      }
    }

    this.isSending = false;
    if (sendBtn) sendBtn.disabled = false;
    this.updateRateCounter();

    const input = this.root.querySelector('#chat-input');
    if (input) input.focus();
  },

  appendExploreMessage(role, text, errorType, savedTimestamp) {
    const container = this.root.querySelector('#explore-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `chat-msg chat-msg-${role}`;

    const ts = savedTimestamp ? new Date(savedTimestamp) : new Date();
    const timeStr = ts.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    if (role === 'error') {
      const icons = { network: '📡', timeout: '⏱️', rate_limit: '🚫', api: '⚠️', unknown: '❌' };
      const icon = icons[errorType] || '❌';
      const showRetry = errorType !== 'rate_limit';
      div.innerHTML = `
        <span class="chat-error-icon">${icon}</span>
        <span class="chat-error-text">${this.formatMarkdown(text)}</span>
        ${showRetry ? '<button class="chat-retry-btn" data-explore-retry aria-label="Reintentar mensaje">🔄 Reintentar</button>' : ''}
      `;
    } else if (role === 'assistant') {
      div.innerHTML = `
        <div class="chat-msg-content">${this.formatMarkdown(text)}</div>
        <span class="chat-msg-time">${timeStr}</span>
        <div class="chat-msg-actions">
          <button class="chat-copy-btn" data-explore-copy aria-label="Copiar respuesta">📋</button>
          <button class="chat-fav-btn" data-chat-fav aria-label="Guardar en favoritos">☆</button>
        </div>
      `;
    } else {
      div.innerHTML = `${this.formatMarkdown(text)}<span class="chat-msg-time">${timeStr}</span>`;
    }

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

  // ═══════════════════════════════════════
  //  GENERATORS (Structured content)
  // ═══════════════════════════════════════

  GENERATOR_TYPES: [
    { id: 'generator_ud', icon: '📘', label: 'Unidad Didáctica', desc: 'Objetivos, contenidos, actividades y evaluación' },
    { id: 'generator_examen', icon: '📝', label: 'Examen / Test', desc: 'Preguntas, respuestas y criterios' },
    { id: 'generator_rubrica', icon: '📊', label: 'Rúbrica', desc: 'Criterios, niveles y descriptores', externalUrl: 'https://rubric-s-830258786759.us-west1.run.app/' },
    { id: 'generator_actividad', icon: '🎯', label: 'Actividad de Aula', desc: 'Pasos, materiales y temporización' },
    { id: 'generator_comunicacion', icon: '✉️', label: 'Comunicación', desc: 'Mensajes profesionales a familias' },
    { id: 'generator_adaptacion', icon: '🧩', label: 'Adaptación Curricular', desc: 'Adapta actividades a perfiles de diversidad' },
  ],

  startGenerator(typeId) {
    this.generatorState = { active: true, type: typeId, step: 1, etapa: null, params: {}, result: null };
    this.renderHoy();
  },

  renderGeneratorWizard(container) {
    const gs = this.generatorState;
    const gen = this.GENERATOR_TYPES.find(g => g.id === gs.type);
    if (!gen) return;

    if (gs.step === 1) {
      // Step 1: Choose etapa
      container.innerHTML = `
        <button class="wizard-back-btn" data-gen-back="menu">← Volver</button>
        <div class="wizard-title">${gen.icon} ${gen.label}</div>
        <div class="wizard-subtitle">¿Para qué etapa educativa?</div>
        <div class="wizard-levels">
          <button class="wizard-level-btn" data-gen-etapa="Infantil">
            <span class="wizard-level-icon">🎒</span>
            <div class="wizard-level-name">Infantil</div>
            <div class="wizard-level-ages">3-6 años</div>
          </button>
          <button class="wizard-level-btn" data-gen-etapa="Primaria">
            <span class="wizard-level-icon">📚</span>
            <div class="wizard-level-name">Primaria</div>
            <div class="wizard-level-ages">6-12 años</div>
          </button>
          <button class="wizard-level-btn" data-gen-etapa="ESO">
            <span class="wizard-level-icon">🎓</span>
            <div class="wizard-level-name">ESO</div>
            <div class="wizard-level-ages">12-16 años</div>
          </button>
        </div>`;
    } else if (gs.step === 2) {
      // Step 2: Form with specific fields
      const fields = this._getGeneratorFields(gs.type);
      const errorBanner = gs.error
        ? `<div class="gen-error-banner">⚠️ ${this.escapeHtml(gs.error)}</div>`
        : '';
      container.innerHTML = `
        <button class="wizard-back-btn" data-gen-back="etapa">← Cambiar etapa</button>
        <div class="wizard-title">${gen.icon} ${gen.label} · ${gs.etapa}</div>
        ${errorBanner}
        <div class="gen-form">
          ${fields.map(f => `
            <div class="gen-field">
              <label class="gen-label" for="gen-${f.id}">${f.label}</label>
              ${f.type === 'textarea'
                ? `<textarea class="gen-input gen-textarea" id="gen-${f.id}" placeholder="${this.escapeHtml(f.placeholder || '')}" rows="2"></textarea>`
                : f.type === 'select'
                  ? `<select class="gen-input gen-select" id="gen-${f.id}">${f.options.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}</select>`
                  : f.type === 'checkbox'
                    ? `<label class="gen-checkbox-label"><input type="checkbox" class="gen-checkbox" id="gen-${f.id}"> ${f.checkLabel || f.label}</label>`
                    : `<input class="gen-input" id="gen-${f.id}" type="text" placeholder="${this.escapeHtml(f.placeholder || '')}">`
              }
            </div>
          `).join('')}
          <button class="gen-submit-btn" data-gen-submit>✨ Generar</button>
        </div>`;
    } else if (gs.step === 3) {
      // Step 3: Loading
      container.innerHTML = `
        <div class="wizard-title">${gen.icon} Generando ${gen.label.toLowerCase()}...</div>
        <div class="ruta-loading">
          <div class="chat-typing visible" style="display:flex;justify-content:center">
            <div class="chat-typing-dots">
              <div class="chat-typing-dot"></div>
              <div class="chat-typing-dot"></div>
              <div class="chat-typing-dot"></div>
            </div>
          </div>
          <p style="margin-top:0.75rem;font-size:0.8125rem;color:var(--text-medium)">BupIA está preparando tu contenido...</p>
        </div>`;
    } else if (gs.step === 4 && gs.result) {
      // Step 4: Result
      container.innerHTML = `
        <button class="wizard-back-btn" data-gen-back="menu">← Nuevo generador</button>
        <div class="wizard-title">${gen.icon} ${gen.label}</div>
        <div class="gen-result">
          ${this._renderGeneratorResult(gs.type, gs.result)}
        </div>
        <div class="gen-result-actions">
          <button class="prompteca-copy-btn" data-gen-copy style="flex:1">📋 Copiar todo</button>
          <button class="ruta-regenerate-btn" data-gen-regenerate style="flex:1;margin-top:0">🔄 Regenerar</button>
        </div>`;
    }
  },

  _getGeneratorFields(type) {
    const common = [
      { id: 'asignatura', label: 'Asignatura', placeholder: 'Ej: Matemáticas, Lengua, Ciencias...', type: 'text' },
      { id: 'tema', label: 'Tema', placeholder: 'Ej: Fracciones, Los seres vivos...', type: 'text' },
    ];
    switch (type) {
      case 'generator_ud':
        return [...common, { id: 'sesiones', label: 'Nº de sesiones', placeholder: 'Ej: 6', type: 'text' }];
      case 'generator_examen':
        return [...common, { id: 'preguntas', label: 'Nº de preguntas', placeholder: 'Ej: 10', type: 'text' },
          { id: 'multinivel', label: '', type: 'checkbox', checkLabel: '🌈 Generar 3 niveles (refuerzo / estándar / ampliación)' }];
      case 'generator_rubrica':
        return [...common, { id: 'actividad', label: 'Actividad a evaluar', placeholder: 'Ej: Presentación oral, proyecto...', type: 'text' }];
      case 'generator_actividad':
        return [...common, { id: 'duracion', label: 'Duración', placeholder: 'Ej: 50 minutos', type: 'text' },
          { id: 'multinivel', label: '', type: 'checkbox', checkLabel: '🌈 Generar 3 niveles (refuerzo / estándar / ampliación)' }];
      case 'generator_comunicacion':
        return [
          { id: 'motivo', label: 'Motivo', placeholder: 'Ej: Excursión, reunión, información...', type: 'text' },
          { id: 'detalles', label: 'Detalles', placeholder: 'Fecha, lugar, instrucciones...', type: 'textarea' },
          { id: 'tono', label: 'Tono', placeholder: 'formal, cercano, informativo', type: 'text' },
        ];
      case 'generator_adaptacion':
        return [
          ...common,
          { id: 'actividad_original', label: 'Actividad a adaptar', placeholder: 'Describe la actividad, contenido o tarea original que quieres adaptar...', type: 'textarea' },
          { id: 'perfil', label: 'Perfil del alumno', type: 'select', options: [
            { value: 'tdah', label: '🔵 TDAH' },
            { value: 'dislexia', label: '📖 Dislexia / Dificultades lectoescritoras' },
            { value: 'tea', label: '🧩 TEA (Trastorno del Espectro Autista)' },
            { value: 'altas_capacidades', label: '🌟 Altas Capacidades' },
            { value: 'desfase_curricular', label: '📉 Desfase curricular' },
            { value: 'incorporacion_tardia', label: '🌍 Incorporación tardía / Barrera idiomática' },
            { value: 'discapacidad_sensorial', label: '👁️ Discapacidad visual o auditiva' },
            { value: 'discapacidad_intelectual', label: '🧠 Discapacidad intelectual' },
            { value: 'otro', label: '📋 Otro perfil' },
          ]},
          { id: 'tipo_adaptacion', label: 'Tipo de adaptación', type: 'select', options: [
            { value: 'no_significativa', label: '🟢 No significativa (mismos objetivos, diferente metodología)' },
            { value: 'significativa', label: '🟠 Significativa (objetivos modificados)' },
            { value: 'enriquecimiento', label: '🔵 Enriquecimiento curricular (ampliación)' },
          ]},
        ];
      default: return common;
    }
  },

  async submitGenerator() {
    const gs = this.generatorState;
    const fields = this._getGeneratorFields(gs.type);
    const params = {};
    for (const f of fields) {
      const el = this.root.querySelector(`#gen-${f.id}`);
      if (!el) { params[f.id] = ''; continue; }
      if (f.type === 'checkbox') {
        params[f.id] = el.checked;
      } else if (f.type === 'select') {
        // Send the readable label text, not the internal value
        const selectedOpt = el.options[el.selectedIndex];
        params[f.id] = selectedOpt ? selectedOpt.textContent.trim() : el.value;
      } else {
        params[f.id] = el.value.trim();
      }
    }
    gs.params = params;
    gs.step = 3;
    this.renderHoy();

    // Build prompt message
    let msg = `Genera contenido para ${gs.etapa}.\n`;
    for (const [k, v] of Object.entries(params)) {
      if (v && k !== 'multinivel') msg += `${k}: ${v}\n`;
    }

    // Multinivel: add instructions for 3-level generation
    if (params.multinivel === true) {
      msg += `\nIMPORTANTE: Genera 3 VERSIONES del mismo contenido con diferente nivel de dificultad. Envuelve todo en un objeto JSON con "multinivel": true y "niveles": {"refuerzo": {...}, "estandar": {...}, "ampliacion": {...}}. Cada nivel tiene la misma estructura JSON que generarias normalmente, pero adaptado asi:\n- REFUERZO: Simplificado, con mas apoyos, menos complejidad, instrucciones mas detalladas\n- ESTANDAR: Nivel medio del grupo\n- AMPLIACION: Mayor profundidad, pensamiento critico, retos extra, conexiones interdisciplinares\n`;
    }

    try {
      if (!this.checkRateLimit()) {
        gs.step = 2;
        this.renderHoy();
        return;
      }

      gs.error = null;  // Clear previous error
      const resp = await this.apiCall(gs.type, [{ role: 'user', content: msg }]);
      this.trackAction('generator');

      // Guard against null response
      if (!resp || !resp.content) {
        throw new Error('No se recibió respuesta del servidor.');
      }

      // Try parsing JSON from response
      let parsed = null;
      try {
        const jsonMatch = resp.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch { /* not JSON — use raw */ }

      gs.result = parsed || resp.content;
      gs.step = 4;
      this.renderHoy();
    } catch (err) {
      console.error('[BupIA] Generator error:', err);
      gs.error = err?.message || 'Error al generar. Inténtalo de nuevo.';
      gs.step = 2;
      this.renderHoy();
    }
  },

  _renderGeneratorResult(type, data) {
    if (typeof data === 'string') {
      return `<div class="gen-raw-result">${this.formatMarkdown(data)}</div>`;
    }

    switch (type) {
      case 'generator_ud': return this._renderUD(data);
      case 'generator_examen': return this._renderExamen(data);
      case 'generator_rubrica': return this._renderRubrica(data);
      case 'generator_actividad': return this._renderActividad(data);
      case 'generator_comunicacion': return this._renderComunicacion(data);
      case 'generator_adaptacion': return this._renderAdaptacion(data);
      default: return `<pre class="gen-raw-result">${this.escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
    }
  },

  _renderUD(d) {
    const acts = (d.actividades || []).map(a => `
      <div class="gen-card-section">
        <div class="gen-card-section-title">Sesión ${a.sesion}: ${this.escapeHtml(a.titulo)}</div>
        <p>${this.escapeHtml(a.descripcion)}</p>
        <small>⏱️ ${this.escapeHtml(a.duracion || '')} · 📦 ${(a.recursos || []).map(r => this.escapeHtml(r)).join(', ')}</small>
      </div>`).join('');

    return `
      <div class="gen-card">
        <h3 class="gen-card-title">${this.escapeHtml(d.titulo || '')}</h3>
        <div class="gen-card-meta">${this.escapeHtml(d.etapa || '')} · ${this.escapeHtml(d.asignatura || '')} · ${this.escapeHtml(d.temporalizacion || '')}</div>
        <details class="gen-details" open><summary>🎯 Objetivos</summary><ul>${(d.objetivos || []).map(o => `<li>${this.escapeHtml(o)}</li>`).join('')}</ul></details>
        <details class="gen-details"><summary>📚 Contenidos</summary><ul>${(d.contenidos || []).map(c => `<li>${this.escapeHtml(c)}</li>`).join('')}</ul></details>
        <details class="gen-details" open><summary>📋 Actividades</summary>${acts}</details>
        <details class="gen-details"><summary>✅ Evaluación</summary><ul>${(d.evaluacion?.criterios || []).map(c => `<li>${this.escapeHtml(c)}</li>`).join('')}</ul><p><strong>Instrumentos:</strong> ${(d.evaluacion?.instrumentos || []).join(', ')}</p></details>
        ${d.atencion_diversidad ? `<details class="gen-details"><summary>🌈 Atención a la diversidad (DUA)</summary>${
          typeof d.atencion_diversidad === 'object'
            ? `<div class="gen-dua-grid">
                <div class="gen-dua-card gen-dua-representacion">
                  <div class="gen-dua-title">👁️ Representación</div>
                  <p>${this.escapeHtml(d.atencion_diversidad.representacion || '')}</p>
                </div>
                <div class="gen-dua-card gen-dua-expresion">
                  <div class="gen-dua-title">✍️ Expresión</div>
                  <p>${this.escapeHtml(d.atencion_diversidad.expresion || '')}</p>
                </div>
                <div class="gen-dua-card gen-dua-implicacion">
                  <div class="gen-dua-title">💪 Implicación</div>
                  <p>${this.escapeHtml(d.atencion_diversidad.implicacion || '')}</p>
                </div>
              </div>
              ${d.atencion_diversidad.adaptaciones_sugeridas ? `<p style="margin-top:8px;font-size:0.8rem"><strong>Adaptaciones sugeridas:</strong> ${this.escapeHtml(d.atencion_diversidad.adaptaciones_sugeridas)}</p>` : ''}`
            : `<p>${this.escapeHtml(d.atencion_diversidad)}</p>`
        }</details>` : ''}
      </div>`;
  },

  _renderExamen(d) {
    // Multinivel: render 3 tabs
    if (d.multinivel && d.niveles) {
      const levels = [
        { key: 'refuerzo', label: '🟢 Refuerzo', active: true },
        { key: 'estandar', label: '🟡 Estándar', active: false },
        { key: 'ampliacion', label: '🔴 Ampliación', active: false },
      ];
      const tabs = levels.map(l => `<button class="gen-level-tab${l.active ? ' active' : ''}" data-gen-level="${l.key}">${l.label}</button>`).join('');
      const panels = levels.map(l => `<div class="gen-level-panel${l.active ? ' active' : ''}" data-gen-level-panel="${l.key}">${this._renderExamenSingle(d.niveles[l.key] || {})}</div>`).join('');
      return `<div class="gen-level-tabs">${tabs}</div>${panels}`;
    }
    return this._renderExamenSingle(d);
  },

  _renderExamenSingle(d) {
    const pregs = (d.preguntas || []).map(q => {
      let body = `<div class="gen-card-section"><strong>${q.numero}. ${this.escapeHtml(q.enunciado)}</strong> <span class="gen-badge">${this.escapeHtml(q.tipo || '')} · ${q.puntuacion || 1} pt</span>`;
      if (q.opciones && q.opciones.length) {
        body += '<ul>' + q.opciones.map(o => `<li>${this.escapeHtml(o)}</li>`).join('') + '</ul>';
      }
      body += `<details class="gen-answer"><summary>Ver respuesta</summary><p>${this.escapeHtml(typeof q.respuesta_correcta === 'string' ? q.respuesta_correcta : JSON.stringify(q.respuesta_correcta))}</p></details></div>`;
      return body;
    }).join('');

    return `
      <div class="gen-card">
        <h3 class="gen-card-title">${this.escapeHtml(d.titulo || '')}</h3>
        <div class="gen-card-meta">${this.escapeHtml(d.etapa || '')} · ${this.escapeHtml(d.asignatura || '')} · ⏱️ ${this.escapeHtml(d.duracion || '')} · Total: ${d.puntuacion_total || '?'} puntos</div>
        ${d.instrucciones ? `<p class="gen-instructions">${this.escapeHtml(d.instrucciones)}</p>` : ''}
        ${pregs}
      </div>`;
  },

  _renderRubrica(d) {
    const levels = ['excelente', 'notable', 'bien', 'insuficiente'];
    const headers = ['Criterio', 'Peso', ...levels.map(l => l.charAt(0).toUpperCase() + l.slice(1))];
    const rows = (d.criterios || []).map(c => `
      <tr>
        <td><strong>${this.escapeHtml(c.nombre)}</strong></td>
        <td>${this.escapeHtml(c.peso || '')}</td>
        ${levels.map(l => `<td>${this.escapeHtml(c.niveles?.[l] || '')}</td>`).join('')}
      </tr>`).join('');

    return `
      <div class="gen-card">
        <h3 class="gen-card-title">${this.escapeHtml(d.titulo || '')}</h3>
        <div class="gen-card-meta">${this.escapeHtml(d.etapa || '')} · ${this.escapeHtml(d.asignatura || '')}</div>
        <div class="gen-table-wrap">
          <table class="gen-rubrica-table">
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${d.observaciones ? `<p class="gen-observations">${this.escapeHtml(d.observaciones)}</p>` : ''}
      </div>`;
  },

  _renderActividad(d) {
    // Multinivel: render 3 tabs
    if (d.multinivel && d.niveles) {
      const levels = [
        { key: 'refuerzo', label: '🟢 Refuerzo', active: true },
        { key: 'estandar', label: '🟡 Estándar', active: false },
        { key: 'ampliacion', label: '🔴 Ampliación', active: false },
      ];
      const tabs = levels.map(l => `<button class="gen-level-tab${l.active ? ' active' : ''}" data-gen-level="${l.key}">${l.label}</button>`).join('');
      const panels = levels.map(l => `<div class="gen-level-panel${l.active ? ' active' : ''}" data-gen-level-panel="${l.key}">${this._renderActividadSingle(d.niveles[l.key] || {})}</div>`).join('');
      return `<div class="gen-level-tabs">${tabs}</div>${panels}`;
    }
    return this._renderActividadSingle(d);
  },

  _renderActividadSingle(d) {
    const pasos = (d.pasos || []).map(p => `
      <div class="gen-card-section">
        <div class="gen-card-section-title">Paso ${p.paso}: ${this.escapeHtml(p.titulo)}</div>
        <p>${this.escapeHtml(p.descripcion)}</p>
        <small>⏱️ ${this.escapeHtml(p.duracion || '')}</small>
      </div>`).join('');

    return `
      <div class="gen-card">
        <h3 class="gen-card-title">${this.escapeHtml(d.titulo || '')}</h3>
        <div class="gen-card-meta">${this.escapeHtml(d.etapa || '')} · ${this.escapeHtml(d.asignatura || '')} · ⏱️ ${this.escapeHtml(d.duracion || '')}</div>
        <details class="gen-details" open><summary>🎯 Objetivos</summary><ul>${(d.objetivos || []).map(o => `<li>${this.escapeHtml(o)}</li>`).join('')}</ul></details>
        <details class="gen-details"><summary>📦 Materiales</summary><ul>${(d.materiales || []).map(m => `<li>${this.escapeHtml(m)}</li>`).join('')}</ul></details>
        <details class="gen-details" open><summary>📋 Pasos</summary>${pasos}</details>
        ${d.adaptaciones ? `<details class="gen-details"><summary>🌈 Adaptaciones (DUA)</summary>${
          typeof d.adaptaciones === 'object'
            ? `<div class="gen-dua-grid">
                <div class="gen-dua-card gen-dua-representacion">
                  <div class="gen-dua-title">📉 Refuerzo</div>
                  <p>${this.escapeHtml(d.adaptaciones.refuerzo || '')}</p>
                </div>
                <div class="gen-dua-card gen-dua-expresion">
                  <div class="gen-dua-title">📈 Ampliación</div>
                  <p>${this.escapeHtml(d.adaptaciones.ampliacion || '')}</p>
                </div>
              </div>
              ${d.adaptaciones.dua_representacion ? `<p style="margin-top:8px;font-size:0.8rem"><strong>👁️ Representación:</strong> ${this.escapeHtml(d.adaptaciones.dua_representacion)}</p>` : ''}
              ${d.adaptaciones.dua_expresion ? `<p style="font-size:0.8rem"><strong>✍️ Expresión:</strong> ${this.escapeHtml(d.adaptaciones.dua_expresion)}</p>` : ''}`
            : `<p>${this.escapeHtml(d.adaptaciones)}</p>`
        }</details>` : ''}
        ${d.evaluacion ? `<details class="gen-details"><summary>✅ Evaluación</summary><p>${this.escapeHtml(d.evaluacion)}</p></details>` : ''}
      </div>`;
  },

  _renderComunicacion(d) {
    return `
      <div class="gen-card gen-letter">
        <div class="gen-letter-header">
          <strong>${this.escapeHtml(d.asunto || '')}</strong>
          <span class="gen-badge">${this.escapeHtml(d.tono || '')} · ${this.escapeHtml(d.canal_sugerido || '')}</span>
        </div>
        <div class="gen-letter-body">
          <p><em>${this.escapeHtml(d.saludo || '')}</em></p>
          <p>${this.escapeHtml(d.cuerpo || '').replace(/\n/g, '<br>')}</p>
          <p><em>${this.escapeHtml(d.cierre || '')}</em></p>
          <p><strong>${this.escapeHtml(d.firma || '')}</strong></p>
        </div>
      </div>`;
  },

  _renderAdaptacion(d) {
    const a = d.adaptacion || {};
    const dua = d.principios_dua || {};
    const tipoBadge = (d.tipo_adaptacion || '').toLowerCase().includes('significativa') && !(d.tipo_adaptacion || '').toLowerCase().includes('no ')
      ? 'gen-badge-orange'
      : (d.tipo_adaptacion || '').toLowerCase().includes('enriquecimiento')
        ? 'gen-badge-blue'
        : 'gen-badge-green';

    return `
      <div class="gen-card gen-adaptation">
        <h3 class="gen-card-title">${this.escapeHtml(d.titulo || 'Adaptación Curricular')}</h3>
        <div class="gen-card-meta">
          ${this.escapeHtml(d.etapa || '')} · ${this.escapeHtml(d.asignatura || '')}
          <span class="gen-badge ${tipoBadge}">${this.escapeHtml(d.tipo_adaptacion || '')}</span>
        </div>
        <div class="gen-adaptation-profile">
          <strong>Perfil:</strong> ${this.escapeHtml(d.perfil || '')}
        </div>
        ${d.actividad_original ? `<details class="gen-details"><summary>📄 Actividad original</summary><p>${this.escapeHtml(d.actividad_original)}</p></details>` : ''}
        <details class="gen-details" open><summary>💡 Justificación pedagógica</summary><p>${this.escapeHtml(d.justificacion || '')}</p></details>
        <details class="gen-details" open><summary>🧩 Actividad adaptada</summary>
          <p>${this.escapeHtml(a.actividad_adaptada || '')}</p>
          ${a.metodologia ? `<p><strong>Metodología:</strong> ${this.escapeHtml(a.metodologia)}</p>` : ''}
          ${a.temporalizacion ? `<p><strong>Temporalización:</strong> ${this.escapeHtml(a.temporalizacion)}</p>` : ''}
        </details>
        ${a.objetivos && a.objetivos.length ? `<details class="gen-details"><summary>🎯 Objetivos adaptados</summary><ul>${a.objetivos.map(o => `<li>${this.escapeHtml(o)}</li>`).join('')}</ul></details>` : ''}
        ${a.materiales && a.materiales.length ? `<details class="gen-details"><summary>📦 Materiales adaptados</summary><ul>${a.materiales.map(m => `<li>${this.escapeHtml(m)}</li>`).join('')}</ul></details>` : ''}
        ${a.apoyos && a.apoyos.length ? `<details class="gen-details"><summary>🤝 Apoyos</summary><ul>${a.apoyos.map(ap => `<li>${this.escapeHtml(ap)}</li>`).join('')}</ul></details>` : ''}
        ${a.evaluacion ? `<details class="gen-details"><summary>✅ Evaluación adaptada</summary><p>${this.escapeHtml(a.evaluacion)}</p></details>` : ''}
        <details class="gen-details" open><summary>🌈 Principios DUA</summary>
          <div class="gen-dua-grid">
            <div class="gen-dua-card gen-dua-representacion">
              <div class="gen-dua-title">👁️ Representación</div>
              <p>${this.escapeHtml(dua.representacion || 'No especificado')}</p>
            </div>
            <div class="gen-dua-card gen-dua-expresion">
              <div class="gen-dua-title">✍️ Expresión</div>
              <p>${this.escapeHtml(dua.expresion || 'No especificado')}</p>
            </div>
            <div class="gen-dua-card gen-dua-implicacion">
              <div class="gen-dua-title">💪 Implicación</div>
              <p>${this.escapeHtml(dua.implicacion || 'No especificado')}</p>
            </div>
          </div>
        </details>
        ${d.recomendaciones_docente ? `<details class="gen-details" open><summary>👩‍🏫 Recomendaciones para el docente</summary><p>${this.escapeHtml(d.recomendaciones_docente)}</p></details>` : ''}
      </div>`;
  },

  copyGeneratorResult() {
    const gs = this.generatorState;
    if (!gs.result) return;
    const text = typeof gs.result === 'string' ? gs.result : JSON.stringify(gs.result, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        const btn = this.root.querySelector('[data-gen-copy]');
        if (btn) this.showCopyFeedback(btn);
      });
    }
  },

  renderPrompteca() {
    const container = this.root.querySelector('#assistant-prompteca');
    if (!container) return;

    // Still loading
    if (this.promptecaData === undefined) {
      container.innerHTML = '<div class="wizard-title">Cargando Prompteca...</div>';
      return;
    }

    // Error loading
    if (this.promptecaData === null) {
      container.innerHTML = `
        <div class="wizard-title">No se pudo cargar la Prompteca</div>
        <p style="text-align:center;color:var(--text-muted);margin:8px 0 16px;">
          Comprueba tu conexión e inténtalo de nuevo.
        </p>
        <div style="text-align:center;">
          <button class="pathway-chip" data-prompteca-retry>🔄 Reintentar</button>
        </div>`;
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
        return `<span class="ranking-etapa">${labels[e] || this.escapeHtml(e)}</span>`;
      }).join('');

      return `
        <div class="prompteca-card" id="prompteca-card-${this.escapeHtml(p.id)}">
          <div class="prompteca-card-header" data-prompteca-toggle="${this.escapeHtml(p.id)}">
            <span class="prompteca-card-icon">${this.escapeHtml(catMeta.icono) || '📄'}</span>
            <div class="prompteca-card-title">${this.escapeHtml(p.titulo)}</div>
            <button class="prompteca-toggle-btn" data-prompteca-toggle="${this.escapeHtml(p.id)}">▼</button>
          </div>
          <div class="prompteca-card-desc">${this.escapeHtml(p.descripcion)}</div>
          <div class="prompteca-card-meta">
            ${etapasHtml}
            <span class="prompteca-tool-badge">${this.escapeHtml(p.herramienta)}</span>
          </div>
          <div class="prompteca-card-prompt" id="prompt-body-${this.escapeHtml(p.id)}" style="display:none">
            <pre class="prompteca-prompt-text">${this.escapeHtml(p.prompt)}</pre>
            <div class="prompteca-card-actions">
              <button class="prompteca-copy-btn" data-prompteca-copy="${p.id}">📋 Copiar</button>
              <button class="prompteca-personalize-btn" data-prompteca-personalize="${p.id}">✨ Personalizar</button>
              <button class="prompteca-share-btn" data-prompteca-share="${p.id}">🔗</button>
              <button class="prompteca-fav-btn${this.loadFavorites().prompts.includes(p.id) ? ' favorited' : ''}" data-prompteca-fav="${p.id}" aria-label="Favorito">${this.loadFavorites().prompts.includes(p.id) ? '★' : '☆'}</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="ranking-header">📖 Prompteca — Recetas listas para usar</div>
      <div class="prompteca-filters">
        <div class="prompteca-filter-row">${etapaPills}</div>
        <div class="prompteca-filter-row">${catPills}</div>
      </div>
      <div class="prompteca-count">${prompts.length} recetas</div>
      <div class="prompteca-list">${cards}</div>
    `;
  },

  copyPromptToClipboard(promptId, btnEl) {
    if (!this.promptecaData) return;
    const prompt = this.promptecaData.prompts.find(p => p.id === promptId);
    if (!prompt) return;
    this.trackAction('prompt');

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

  copyChatMessage(btnEl) {
    const msgDiv = btnEl.closest('.chat-msg');
    if (!msgDiv) return;
    const content = msgDiv.querySelector('.chat-msg-content');
    if (!content) return;
    const text = content.innerText || content.textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showCopyFeedback(btnEl);
      }).catch(() => this.fallbackCopy(text, btnEl));
    } else {
      this.fallbackCopy(text, btnEl);
    }
  },

  personalizePrompt(promptId) {
    if (!this.promptecaData) return;
    const prompt = this.promptecaData.prompts.find(p => p.id === promptId);
    if (!prompt) return;
    this.trackAction('prompt');

    // Switch to chat tab with prompt pre-loaded
    const promptText = prompt.prompt.length > 500
      ? prompt.prompt.substring(0, 500) + '…'
      : prompt.prompt;
    const msg = `Quiero adaptar este prompt de la Prompteca para mi clase:\n\n"${prompt.titulo}"\n\n${promptText}\n\nAyúdame a personalizarlo para mi contexto.`;

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

Recetas disponibles en la Prompteca para esta etapa:
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
          <div class="wizard-subtitle">${this.escapeHtml(err.message) || 'Error desconocido'}</div>
          <button class="ruta-regenerate-btn" data-ruta-action="regenerate">🔄 Intentar de nuevo</button>
        `;
      }
    }
  },

  renderRutaResult(container, rutaData) {
    const weeks = (rutaData.semanas || []).map(w => {
      const promptLink = w.prompt_recomendado_id ?
        `<div class="ruta-week-prompt" data-ruta-prompt="${this.escapeHtml(w.prompt_recomendado_id)}">📖 Ver prompt recomendado →</div>` : '';

      return `
        <div class="ruta-week">
          <div class="ruta-week-header">
            <span class="ruta-week-number">Semana ${this.escapeHtml(String(w.numero))}</span>
            <span class="ruta-week-title">${this.escapeHtml(w.titulo)}</span>
          </div>
          <div class="ruta-week-body">
            <div class="ruta-week-row">🎯 <strong>Objetivo:</strong> ${this.escapeHtml(w.objetivo)}</div>
            <div class="ruta-week-row">🔧 <strong>Herramientas:</strong> ${(w.herramientas || []).map(h => this.escapeHtml(h)).join(', ')}</div>
            <div class="ruta-week-row">📝 ${this.escapeHtml(w.actividad)}</div>
            ${promptLink}
            <div class="ruta-week-tip">💡 ${this.escapeHtml(w.consejo)}</div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <button class="wizard-back-btn" data-ruta-action="back-hoy">← Volver al inicio</button>
      <div class="ruta-container">
        <div class="ruta-title">🗺️ ${this.escapeHtml(rutaData.titulo) || 'Tu Ruta Personalizada'}</div>
        <div class="ruta-summary">${this.escapeHtml(rutaData.resumen) || ''}</div>
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

  async apiCall(feature, messages, _retryCount = 0) {
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const url = isLocal ? '/api/chat' : this.PROXY_URL;

    // Client-side rate limit (UX feedback — server enforces the real limit)
    if (!isLocal && !this.checkRateLimit()) {
      throw new ApiError('Has alcanzado el límite diario de consultas. Vuelve mañana 😊', 'rate_limit');
    }

    // Offline pre-check
    if (!navigator.onLine) {
      throw new ApiError('Sin conexión a internet. Comprueba tu WiFi.', 'network');
    }

    // Fetch with timeout: 45s for generators (long JSON output), 15s for chat
    const isGenerator = feature.startsWith('generator_') || feature === 'ruta';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), isGenerator ? 45000 : 15000);

    let resp;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature, messages }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new ApiError('La solicitud tardó demasiado. Inténtalo de nuevo.', 'timeout');
      }
      // Network error — retry with exponential backoff (max 2)
      if (_retryCount < 2) {
        await new Promise(r => setTimeout(r, Math.pow(2, _retryCount) * 1000));
        return this.apiCall(feature, messages, _retryCount + 1);
      }
      throw new ApiError('No se pudo conectar. Comprueba tu conexión a internet.', 'network');
    }
    clearTimeout(timeoutId);

    const data = await resp.json();
    if (!resp.ok) {
      // NEVER retry on rate limit
      if (resp.status === 429) {
        throw new ApiError('Has alcanzado el límite de consultas. Vuelve mañana 😊', 'rate_limit');
      }
      // Server error — retry with backoff
      if (resp.status >= 500 && _retryCount < 2) {
        await new Promise(r => setTimeout(r, Math.pow(2, _retryCount) * 1000));
        return this.apiCall(feature, messages, _retryCount + 1);
      }
      throw new ApiError(data.error || data.detail || `Error del servidor (${resp.status})`, 'api');
    }

    // OpenAI-compatible format (proxy transforms Anthropic response)
    if (data.choices?.[0]?.message) {
      return { content: data.choices[0].message.content };
    }
    if (data.error) {
      throw new ApiError(typeof data.error === 'string' ? data.error : data.error.message || 'Error desconocido', 'api');
    }
    return null;
  },

  // ── Rate limit (client-side UX only — server enforces the real limit) ──
  _DAILY_LIMIT: 100,

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

  // ── Connectivity monitor ──
  _setupConnectivityMonitor() {
    window.addEventListener('online', () => this._updateConnectionStatus(true));
    window.addEventListener('offline', () => this._updateConnectionStatus(false));
    if (!navigator.onLine) this._updateConnectionStatus(false);
  },

  _updateConnectionStatus(isOnline) {
    let indicator = this.root.querySelector('#connection-status');
    if (isOnline) {
      if (indicator) {
        indicator.classList.add('conn-fade-out');
        setTimeout(() => indicator.remove(), 500);
      }
    } else {
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'connection-status';
        indicator.className = 'connection-status-bar';
        indicator.setAttribute('role', 'alert');
        indicator.innerHTML = '📡 Sin conexión a internet';
        const body = this.root.querySelector('.assistant-body');
        if (body) body.insertBefore(indicator, body.firstChild);
      }
    }
  },

  updateCharCounter() {
    const input = this.root.querySelector('#chat-input');
    const counter = this.root.querySelector('#chat-char-counter');
    if (!input || !counter) return;
    const remaining = 500 - input.value.length;
    counter.textContent = remaining <= 50 ? remaining : '';
    counter.classList.toggle('chat-char-warning', remaining <= 50 && remaining > 20);
    counter.classList.toggle('chat-char-danger', remaining <= 20);
  },

  updateRateCounter() {
    const el = this.root.querySelector('#rate-counter');
    if (!el) return;
    const today = new Date().toISOString().slice(0, 10);
    const stored = JSON.parse(localStorage.getItem('bupia_usage') || '{}');
    const used = (stored.date === today) ? stored.count : 0;
    const remaining = this._DAILY_LIMIT - used;
    el.textContent = `${remaining}/${this._DAILY_LIMIT} consultas`;
    el.style.opacity = remaining <= 10 ? '1' : '0.5';
    el.style.color = remaining <= 5 ? '#ef4444' : '';
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
  //  Smart Context Window (B5)
  // ═══════════════════════════════════════

  buildSmartContext(history) {
    // Send full history if small enough
    const msgs = history.map(m => ({ role: m.role, content: m.content }));
    if (msgs.length <= 8) return msgs;

    // Summarize older messages, keep last 6 complete
    const older = msgs.slice(0, -6);
    const recent = msgs.slice(-6);
    const summary = older.map(m =>
      `[${m.role}]: ${m.content.substring(0, 100)}${m.content.length > 100 ? '...' : ''}`
    ).join('\n');
    return [
      { role: 'user', content: `[Contexto resumido de la conversación anterior]\n${summary}` },
      { role: 'assistant', content: 'Entendido, tengo el contexto de nuestra conversación.' },
      ...recent,
    ];
  },

  // ═══════════════════════════════════════
  //  Chat Search (B6)
  // ═══════════════════════════════════════

  toggleChatSearch() {
    const searchBar = this.root.querySelector('#chat-search-bar');
    if (!searchBar) return;
    const isVisible = searchBar.style.display !== 'none';
    searchBar.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) {
      const input = searchBar.querySelector('#chat-search-input');
      if (input) { input.value = ''; input.focus(); }
      this.filterChatMessages('');
    } else {
      this.filterChatMessages('');
    }
  },

  filterChatMessages(query) {
    const containerId = this.activeTab === 'explorar' ? '#explore-messages' : '#chat-messages';
    const msgs = this.root.querySelectorAll(`${containerId} .chat-msg`);
    const q = query.toLowerCase().trim();

    msgs.forEach(msg => {
      // Remove previous highlights
      msg.querySelectorAll('mark').forEach(m => {
        const parent = m.parentNode;
        parent.replaceChild(document.createTextNode(m.textContent), m);
        parent.normalize();
      });

      if (!q) {
        msg.style.display = '';
        return;
      }

      const textContent = msg.textContent.toLowerCase();
      if (textContent.includes(q)) {
        msg.style.display = '';
        // Highlight matches in content div
        const contentEl = msg.querySelector('.chat-msg-content') || msg;
        this._highlightText(contentEl, q);
      } else {
        msg.style.display = 'none';
      }
    });
  },

  _highlightText(el, query) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach(node => {
      const idx = node.textContent.toLowerCase().indexOf(query);
      if (idx === -1) return;
      const span = document.createElement('mark');
      const after = node.splitText(idx);
      after.splitText(query.length);
      span.textContent = after.textContent;
      after.parentNode.replaceChild(span, after);
    });
  },

  // ═══════════════════════════════════════
  //  Persistence (localStorage — survives browser close)
  // ═══════════════════════════════════════

  saveState() {
    try {
      localStorage.setItem('assistant_state', JSON.stringify({
        activeTab: this.activeTab,
        chatHistory: this.chatHistory.slice(-50),
        exploreHistory: this.exploreHistory.slice(-50),
      }));
    } catch (e) { /* quota exceeded — ignore */ }
  },

  loadState() {
    try {
      // Migrate from sessionStorage if exists (one-time)
      let raw = localStorage.getItem('assistant_state');
      if (!raw) {
        raw = sessionStorage.getItem('assistant_state');
        if (raw) {
          localStorage.setItem('assistant_state', raw);
          sessionStorage.removeItem('assistant_state');
        }
      }
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
