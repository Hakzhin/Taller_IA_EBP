#!/usr/bin/env python3
"""
BupIA Cloud Run Proxy — Proxy seguro para la API de Anthropic.
Elimina la necesidad de exponer la API key en el frontend.
Basado en los patrones de _server.py del repositorio principal.
"""

import os
import time
import json

from flask import Flask, request, jsonify
import requests as http_client

app = Flask(__name__)

# ══════════════════════════════════════════════════
#  Configuration (from environment variables)
# ══════════════════════════════════════════════════

API_KEY = os.environ["ANTHROPIC_API_KEY"]
MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS", "https://hakzhin.github.io"
).split(",")
DAILY_LIMIT = int(os.environ.get("DAILY_LIMIT", "50"))
TAVILY_KEY = os.environ.get("TAVILY_API_KEY", "")
TAVILY_URL = "https://api.tavily.com/search"


# ══════════════════════════════════════════════════
#  Rate Limiting (in-memory, resets on cold start)
# ══════════════════════════════════════════════════

_rate = {}  # ip -> {"date": "YYYY-MM-DD", "count": int}


def check_rate(ip):
    """Enforce per-IP daily request limit. Returns True if allowed."""
    today = time.strftime("%Y-%m-%d")
    entry = _rate.get(ip, {"date": "", "count": 0})
    if entry["date"] != today:
        entry = {"date": today, "count": 0}
    if entry["count"] >= DAILY_LIMIT:
        return False
    entry["count"] += 1
    _rate[ip] = entry
    return True


# ══════════════════════════════════════════════════
#  Load catalog (single source of truth)
# ══════════════════════════════════════════════════

_data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

try:
    with open(os.path.join(_data_dir, "catalog.json"), "r", encoding="utf-8") as f:
        _catalog_data = json.load(f)
    CATALOG = _catalog_data.get("catalog_text", "")
    print(f"[Catalogo] Cargado v{_catalog_data.get('version', '?')}")
except Exception as e:
    print(f"[Catalogo] Error: {e}, usando fallback")
    CATALOG = "Catalogo no disponible."


# ══════════════════════════════════════════════════
#  System Prompts (mirrors JS SYSTEM_PROMPTS)
# ══════════════════════════════════════════════════

BASE_PROMPT = f"""Eres "BupIA", el asistente inteligente de la plataforma "Taller IA" del Colegio El Buen Pastor, en Murcia.

SOBRE TI (autoconocimiento -- responde con naturalidad si te preguntan):
- Nombre: BupIA (pronunciado "bupia"). El nombre viene de "Buen Pastor" + "IA".
- Que eres: Un asistente de inteligencia artificial especializado en educacion, integrado en la plataforma "Taller IA" del colegio.
- Modelo: Funcionas con Claude Sonnet 4.6, un modelo de Anthropic. Anthropic es una empresa lider en IA segura y responsable.
- Creador: Fuiste disenada y desarrollada por el equipo del Colegio El Buen Pastor como herramienta pionera de apoyo al profesorado.
- Plataforma: Vives dentro de "Taller IA", una plataforma web creada por el colegio que organiza herramientas de IA por etapas educativas (Infantil, Primaria, ESO, IA PRO).
- Proposito: Ayudar a los maestros y profesores del colegio a descubrir, entender y usar herramientas de IA en su dia a dia docente.
- Usuarios: Tus interlocutores son docentes del Colegio El Buen Pastor (Murcia). Pueden ser maestros de Infantil, Primaria o profesores de ESO. Tratalos con respeto, cercania y paciencia.
- Memoria: Tienes memoria persistente. Recuerdas las conversaciones anteriores del usuario dentro del mismo navegador.
- Marca: BupIA es una marca registrada del Colegio El Buen Pastor.

{CATALOG}

Reglas:
- Responde SIEMPRE en espanol.
- Se conciso y practico (los profesores tienen poco tiempo).
- Al recomendar, usa nombres exactos del catalogo. Indica que herramienta y por que.
- Si preguntan por herramientas fuera del catalogo, di que solo conoces las de la plataforma pero que pueden usar el modo Explorador para descubrir mas.
- Para consejos de prompts, referencia la "formula de 4 ingredientes": QUE quiero + COMO + PARA QUIEN + DETALLES.
- No inventes URLs ni funcionalidades que no existan.
- Usa un tono cercano y motivador. Eres una companera, no un manual.
- Si preguntan por RUBRICAS o evaluacion, recomienda Rubric@sEBP (app propia del colegio) con el enlace directo. Explica brevemente que pueden elegir etapa, asignatura y criterios LOMLOE, y la IA genera la rubrica completa.
- Si preguntan por el itinerario IA PRO, explica que es para usuarios avanzados que quieren crear proyectos, agentes o aplicaciones con IA.
- Si te preguntan sobre ti misma (que eres, como funcionas, que modelo usas, quien te creo), responde con la informacion de la seccion "SOBRE TI" de forma natural y cercana, sin sonar robotica.
- Usa markdown para dar formato: **negrita** para resaltar, listas con * para opciones, y separa secciones con saltos de linea.
- Respuestas entre 80-200 palabras idealmente. Si el tema lo requiere, puedes extenderte, pero avisa al usuario ("Te lo explico en detalle:").
- Si la pregunta es sencilla, responde en 1-3 frases. No alargues innecesariamente.
- Si te hacen preguntas no relacionadas con educacion, IA o el colegio, redirige amablemente: "Buena pregunta! Pero mi especialidad es ayudarte con herramientas de IA para el aula. En que puedo ayudarte con eso?". No respondas a temas politicos, medicos, legales no educativos ni personales."""

EXPLORE_PROMPT = """Eres "BupIA" en modo Explorador. Ayudas a profesores del Colegio El Buen Pastor (Murcia) a descubrir herramientas de IA EXTERNAS que NO estan en su plataforma.

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
- Los enlaces deben ser URLs reales y clicables con formato markdown: [texto](url)"""

FEATURE_PROMPTS = {
    "chat": BASE_PROMPT,
    "recommend": BASE_PROMPT + "\n\nContexto adicional: El usuario esta en el recomendador de herramientas.\nResponde con 2-3 frases practicas explicando por que esas herramientas son utiles para su caso.\nNo repitas la lista de herramientas (ya se muestra en la interfaz).\nSugiere un prompt de ejemplo que podrian probar.",
    "bulletin": BASE_PROMPT + '\n\nContexto adicional: Genera un consejo breve y practico del dia para profesores que usan IA en el aula.\nMenciona una herramienta concreta del catalogo.\nFormato: un titulo llamativo (max 8 palabras) y 2-3 frases de contenido.\nResponde SOLO con JSON valido: {"title": "...", "body": "...", "toolId": "..."}\nEl toolId debe ser un ID del catalogo como "pri-gemini", "eso-chatgpt", "inf-suno", etc.',
    "explore": EXPLORE_PROMPT,
    "ruta": BASE_PROMPT + """

Contexto adicional: El profesor quiere una RUTA DE APRENDIZAJE personalizada de 4 semanas para aprender a usar IA en el aula.

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
- Responde SOLO con el JSON valido. Sin texto adicional.""",
}

# ── Load external catalog for explorer ──
_ext_catalog_path = os.path.join(_data_dir, "herramientas_externas.json")
if os.path.exists(_ext_catalog_path):
    with open(_ext_catalog_path, "r", encoding="utf-8") as f:
        _ext_data = json.load(f)
    _lines = [
        f"\n\nCATALOGO DE HERRAMIENTAS EXTERNAS VERIFICADAS (revision {_ext_data.get('ultima_revision', '?')}):",
        "Usa este catalogo como referencia PRIORITARIA al recomendar. Son herramientas verificadas por el equipo del colegio.\n",
    ]
    for cat in _ext_data.get("categorias", []):
        _lines.append(f"\n{cat['icono']} {cat['nombre'].upper()}:")
        for h in cat.get("herramientas", []):
            star = " ⭐" if h.get("destacado") else ""
            etapas = ", ".join(h.get("etapas", []))
            _lines.append(
                f"- {h['nombre']}{star} ({h['url']}) — {h['que_hace']} "
                f"Plan gratis: {h['plan_gratis']} Etapas: {etapas}"
            )
    FEATURE_PROMPTS["explore"] += "\n".join(_lines)
    _count = sum(len(c.get("herramientas", [])) for c in _ext_data["categorias"])
    print(f"[OK] Catalogo externo cargado ({_count} herramientas)")
else:
    print(f"[!] No se encontro {_ext_catalog_path}. El explorador usara solo conocimiento del modelo.")


# ══════════════════════════════════════════════════
#  Tavily Search (for Explorer feature)
# ══════════════════════════════════════════════════


def search_tavily(query):
    """Search the web via Tavily API. Returns list of results or []."""
    if not TAVILY_KEY:
        return []
    try:
        resp = http_client.post(
            TAVILY_URL,
            json={
                "api_key": TAVILY_KEY,
                "query": f"herramientas IA educacion gratuitas {query}",
                "search_depth": "basic",
                "max_results": 5,
            },
            timeout=5,
        )
        resp.raise_for_status()
        results = []
        for r in resp.json().get("results", []):
            results.append({
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "content": r.get("content", "")[:200],
            })
        return results
    except Exception as e:
        print(f"[Tavily] Search failed: {e}")
        return []


# ══════════════════════════════════════════════════
#  Flask Routes
# ══════════════════════════════════════════════════


@app.route("/api/chat", methods=["POST"])
def chat():
    """Main proxy endpoint. Receives {feature, messages} and forwards to Anthropic."""
    # ── Origin validation ──
    origin = request.headers.get("Origin", "")
    if origin and origin not in ALLOWED_ORIGINS:
        return jsonify(error="Origin not allowed"), 403

    # ── Rate limiting ──
    ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    if ip and "," in ip:
        ip = ip.split(",")[0].strip()
    if not check_rate(ip):
        return jsonify(error="Limite diario alcanzado. Vuelve manana 😊"), 429

    # ── Parse request ──
    body = request.get_json(silent=True)
    if not body or not body.get("messages"):
        return jsonify(error="El campo 'messages' es obligatorio"), 400

    feature = body.get("feature", "chat")
    messages = [m for m in body["messages"] if m.get("role") in ("user", "assistant")]

    # ── Build system prompt ──
    system_prompt = FEATURE_PROMPTS.get(feature, FEATURE_PROMPTS["chat"])

    # ── Tavily web search for Explorer ──
    if feature == "explore" and TAVILY_KEY and messages:
        last_user_msg = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user_msg = m.get("content", "")
                break
        if last_user_msg:
            results = search_tavily(last_user_msg)
            if results:
                web_ctx = "\n\nRESULTADOS DE BUSQUEDA WEB RECIENTES:\n"
                for i, r in enumerate(results, 1):
                    web_ctx += f"{i}. {r['title']} ({r['url']}) — {r['content']}\n"
                web_ctx += (
                    "\nUsa estos resultados como fuente actualizada para complementar "
                    "el catalogo. Verifica que las URLs sean reales antes de recomendarlas. "
                    "Si un resultado no es relevante o no es una herramienta IA educativa, ignoralo."
                )
                system_prompt = system_prompt + web_ctx

    # ── Feature-specific settings ──
    max_tokens = 2000 if feature == "ruta" else 1500 if feature == "explore" else 1000
    temperature = 0.3 if feature in ("ruta", "bulletin") else 0.7

    # ── Forward to Anthropic ──
    try:
        resp = http_client.post(
            ANTHROPIC_URL,
            json={
                "model": MODEL,
                "system": system_prompt,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
            headers={
                "x-api-key": API_KEY,
                "anthropic-version": ANTHROPIC_VERSION,
                "Content-Type": "application/json",
            },
            timeout=30,
        )
    except http_client.exceptions.RequestException as e:
        return jsonify(error=f"No se pudo conectar a Anthropic: {e}"), 502

    # ── Transform response (Anthropic → OpenAI-compatible) ──
    if not resp.ok:
        return (resp.text, resp.status_code, {"Content-Type": "application/json"})

    result = resp.json()
    text = ""
    for block in result.get("content", []):
        if block.get("type") == "text":
            text += block.get("text", "")

    return jsonify(choices=[{"message": {"role": "assistant", "content": text}}])


@app.route("/api/chat", methods=["OPTIONS"])
def cors_preflight():
    """CORS preflight for POST requests."""
    return "", 204


@app.route("/health", methods=["GET"])
def health():
    """Health check for Cloud Run."""
    return jsonify(status="ok", model=MODEL)


# ══════════════════════════════════════════════════
#  CORS Headers
# ══════════════════════════════════════════════════


@app.after_request
def add_cors(response):
    origin = request.headers.get("Origin", "")
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


# ══════════════════════════════════════════════════
#  Entry point
# ══════════════════════════════════════════════════

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"\n  BupIA proxy activo en http://localhost:{port}")
    print(f"  Modelo: {MODEL}")
    print(f"  Origenes permitidos: {ALLOWED_ORIGINS}")
    print(f"  Limite diario: {DAILY_LIMIT}/IP\n")
    app.run(host="0.0.0.0", port=port, debug=False)
