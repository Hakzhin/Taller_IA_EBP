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
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
MODEL = "claude-haiku-4-5-20251001"

# ── Cargar API key ──
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
}


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

        payload = json.dumps({
            "model": MODEL,
            "system": system_prompt,
            "messages": api_messages,
            "max_tokens": 500,
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
