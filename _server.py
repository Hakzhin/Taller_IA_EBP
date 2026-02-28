#!/usr/bin/env python3
# ══════════════════════════════════════════════════
#  _server.py — Taller IA · Servidor con proxy API
#  Sirve archivos estaticos + proxea /api/chat a Anthropic (Claude)
#  Stdlib only (sin dependencias externas)
# ══════════════════════════════════════════════════

import http.server
import json
import os
import sys
import urllib.request
import urllib.error

PORT = 8085
API_KEY_FILE = "api_key.txt"
TAVILY_KEY_FILE = "tavily_key.txt"
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
MODEL = "claude-haiku-4-5-20251001"
TAVILY_URL = "https://api.tavily.com/search"

# ── Cargar API key (Anthropic) ──
api_key = None
key_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), API_KEY_FILE)
if os.path.exists(key_path):
    with open(key_path, "r", encoding="utf-8") as f:
        api_key = f.read().strip()
    if api_key.startswith("PEGA_AQUI") or len(api_key) < 10:
        api_key = None
        print(f"[!] {API_KEY_FILE} contiene texto placeholder. El chat IA no funcionara.")
    else:
        masked = api_key[:12] + "..." + api_key[-4:]
        print(f"[OK] API key cargada ({masked})")
else:
    print(f"[!] No se encontro {API_KEY_FILE}. El chat IA no funcionara.")
    print(f"    Crea el archivo con tu API key de Anthropic para activar el asistente.")

# ── Cargar API key (Tavily — búsqueda web) ──
tavily_key = None
tavily_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), TAVILY_KEY_FILE)
if os.path.exists(tavily_path):
    with open(tavily_path, "r", encoding="utf-8") as f:
        tavily_key = f.read().strip()
    if tavily_key.startswith("PEGA_AQUI") or len(tavily_key) < 10:
        tavily_key = None
        print(f"[!] {TAVILY_KEY_FILE} contiene texto placeholder. Busqueda web desactivada.")
    else:
        print(f"[OK] Tavily API key cargada. Busqueda web activada para el explorador.")
else:
    print(f"[!] No se encontro {TAVILY_KEY_FILE}. Busqueda web desactivada.")
    print(f"    Registrate en tavily.com (gratis) y pega tu key para activar busqueda en tiempo real.")


def search_tavily(query):
    """Busca en internet via Tavily API. Retorna lista de resultados o [] si falla."""
    if not tavily_key:
        return []

    search_query = f"herramientas IA educacion gratuitas {query}"
    payload = json.dumps({
        "api_key": tavily_key,
        "query": search_query,
        "search_depth": "basic",
        "max_results": 5,
    }).encode("utf-8")

    req = urllib.request.Request(
        TAVILY_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
    )

    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        results = []
        for r in data.get("results", []):
            results.append({
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "content": r.get("content", "")[:200],
            })
        return results
    except Exception as e:
        print(f"[Tavily] Busqueda fallida: {e}")
        return []

# ── System prompts ──
CATALOG = """Catalogo de herramientas disponibles en la plataforma:

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
- Materiales: Gemini, ChatGPT, Claude"""

BASE_PROMPT = f"""Eres "BupIA", el asistente de la plataforma "Taller IA" del Colegio El Buen Pastor (Madrid).
Ayudas a profesores a descubrir y usar herramientas de IA para educacion.

{CATALOG}

Reglas:
- Responde SIEMPRE en espanol.
- Se conciso y practico (los profesores tienen poco tiempo).
- Al recomendar, usa nombres exactos del catalogo. Indica que herramienta y por que.
- Si preguntan por herramientas fuera del catalogo, di que solo conoces las de la plataforma pero que pueden existir otras.
- Para consejos de prompts, referencia la "formula de 4 ingredientes": QUE quiero + COMO + PARA QUIEN + DETALLES.
- No inventes URLs ni funcionalidades que no existan.
- Usa un tono cercano y motivador."""

FEATURE_PROMPTS = {
    "chat": BASE_PROMPT,
    "recommend": BASE_PROMPT + """

Contexto adicional: El usuario esta en el recomendador de herramientas.
Responde con 2-3 frases practicas explicando por que esas herramientas son utiles para su caso.
No repitas la lista de herramientas (ya se muestra en la interfaz).
Sugiere un prompt de ejemplo que podrian probar.""",
    "bulletin": BASE_PROMPT + """

Contexto adicional: Genera un consejo breve y practico del dia para profesores que usan IA en el aula.
Menciona una herramienta concreta del catalogo.
Formato: un titulo llamativo (max 8 palabras) y 2-3 frases de contenido.
Responde SOLO con JSON valido: {"title": "...", "body": "...", "toolId": "..."}
El toolId debe ser un ID del catalogo como "pri-gemini", "eso-chatgpt", "inf-suno", etc.""",
    "explore": """Eres "BupIA" en modo Explorador. Ayudas a profesores del Colegio El Buen Pastor (Madrid) a descubrir herramientas de IA EXTERNAS que NO estan en su plataforma.

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
- Los enlaces deben ser URLs reales y clicables con formato markdown: [texto](url)""",
}

# ── Cargar catálogo externo de herramientas verificadas ──
_catalog_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "herramientas_externas.json")
if os.path.exists(_catalog_path):
    with open(_catalog_path, "r", encoding="utf-8") as f:
        _catalog_data = json.load(f)
    _catalog_lines = [f"\n\nCATALOGO DE HERRAMIENTAS EXTERNAS VERIFICADAS (revision {_catalog_data.get('ultima_revision', '?')}):",
                      "Usa este catalogo como referencia PRIORITARIA al recomendar. Son herramientas verificadas por el equipo del colegio.\n"]
    for cat in _catalog_data.get("categorias", []):
        _catalog_lines.append(f"\n{cat['icono']} {cat['nombre'].upper()}:")
        for h in cat.get("herramientas", []):
            star = " ⭐" if h.get("destacado") else ""
            etapas = ", ".join(h.get("etapas", []))
            _catalog_lines.append(f"- {h['nombre']}{star} ({h['url']}) — {h['que_hace']} Plan gratis: {h['plan_gratis']} Etapas: {etapas}")
    _catalog_text = "\n".join(_catalog_lines)
    FEATURE_PROMPTS["explore"] += _catalog_text
    print(f"[OK] Catalogo externo cargado ({sum(len(c.get('herramientas',[])) for c in _catalog_data['categorias'])} herramientas)")
else:
    print(f"[!] No se encontro {_catalog_path}. El explorador usara solo conocimiento del modelo.")


class TallerHandler(http.server.SimpleHTTPRequestHandler):
    """Sirve archivos estaticos + proxea /api/chat a Anthropic (Claude)."""

    def do_POST(self):
        if self.path != "/api/chat":
            self.send_error(404, "Not Found")
            return

        # Verificar API key
        if not api_key:
            self.send_json(503, {
                "error": "API key no configurada",
                "detail": f"Crea el archivo {API_KEY_FILE} con tu API key de Anthropic."
            })
            return

        # Leer body
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, ValueError):
            self.send_json(400, {"error": "JSON invalido en el body"})
            return

        messages = body.get("messages", [])
        feature = body.get("feature", "chat")

        if not messages:
            self.send_json(400, {"error": "El campo 'messages' es obligatorio"})
            return

        # Construir peticion a Anthropic
        # Anthropic usa 'system' como parametro top-level, no como mensaje
        system_prompt = FEATURE_PROMPTS.get(feature, FEATURE_PROMPTS["chat"])

        # Filtrar mensajes: solo user/assistant (Anthropic no acepta role "system" en messages)
        api_messages = [m for m in messages if m.get("role") in ("user", "assistant")]
        max_tokens = 1500 if feature == "explore" else 500

        # ── Búsqueda web en tiempo real para el Explorador ──
        if feature == "explore" and tavily_key and api_messages:
            last_user_msg = ""
            for m in reversed(api_messages):
                if m.get("role") == "user":
                    last_user_msg = m.get("content", "")
                    break
            if last_user_msg:
                results = search_tavily(last_user_msg)
                if results:
                    web_context = "\n\nRESULTADOS DE BUSQUEDA WEB RECIENTES:\n"
                    for i, r in enumerate(results, 1):
                        web_context += f"{i}. {r['title']} ({r['url']}) — {r['content']}\n"
                    web_context += "\nUsa estos resultados como fuente actualizada para complementar el catalogo. Verifica que las URLs sean reales antes de recomendarlas. Si un resultado no es relevante o no es una herramienta IA educativa, ignoralo."
                    system_prompt = system_prompt + web_context

        payload = json.dumps({
            "model": MODEL,
            "system": system_prompt,
            "messages": api_messages,
            "max_tokens": max_tokens,
            "temperature": 0.7,
        }).encode("utf-8")

        req = urllib.request.Request(
            ANTHROPIC_URL,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": ANTHROPIC_VERSION,
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode("utf-8"))

            # Transformar respuesta Anthropic → formato OpenAI (para que el JS no cambie)
            # Anthropic: { "content": [{"type":"text","text":"..."}] }
            # OpenAI:    { "choices": [{"message":{"content":"..."}}] }
            text = ""
            if result.get("content"):
                for block in result["content"]:
                    if block.get("type") == "text":
                        text += block.get("text", "")

            openai_compat = {
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": text,
                    }
                }]
            }
            self.send_json(200, openai_compat)

        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8", errors="replace")
            try:
                error_json = json.loads(error_body)
            except json.JSONDecodeError:
                error_json = {"error": error_body}
            self.send_json(e.code, error_json)
        except urllib.error.URLError as e:
            self.send_json(502, {"error": f"No se pudo conectar a Anthropic: {e.reason}"})
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def send_json(self, code, data):
        """Envia una respuesta JSON con el codigo HTTP dado."""
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        """CORS preflight para peticiones POST desde el navegador."""
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, format, *args):
        """Log simplificado (solo POST /api/chat y errores)."""
        msg = format % args
        if "/api/chat" in msg or "404" in msg or "500" in msg:
            sys.stderr.write(f"[{self.log_date_time_string()}] {msg}\n")


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server = http.server.HTTPServer(("0.0.0.0", PORT), TallerHandler)
    print(f"\n  BupIA servidor activo en http://localhost:{PORT}")
    print(f"  Proxy API: POST /api/chat -> Anthropic ({MODEL})")
    print(f"  Pulsa Ctrl+C para detener\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Servidor detenido.")
        server.server_close()
