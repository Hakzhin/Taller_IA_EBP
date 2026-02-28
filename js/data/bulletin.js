// ══════════════════════════════════════════
//  Taller IA · Bulletin Board Data
//  Datos estáticos del tablón de anuncios
// ══════════════════════════════════════════

const BULLETIN_DATA = [
  {
    id: 'tip-formula',
    icon: '🎯',
    title: 'La fórmula mágica del prompt',
    body: 'Usa los 4 ingredientes: <strong>QUÉ</strong> quiero + <strong>CÓMO</strong> lo quiero + <strong>PARA QUIÉN</strong> + <strong>DETALLES</strong> extra. Ejemplo: «Crea un examen tipo test (QUÉ) con 10 preguntas de opción múltiple (CÓMO) para alumnos de 3º de Primaria (PARA QUIÉN) sobre el sistema solar, con respuestas al final (DETALLES)».',
    category: 'tip',
    date: '2025-02-01',
  },
  {
    id: 'tip-suno',
    icon: '🎵',
    title: 'Canciones para memorizar',
    body: 'Con <strong>Suno</strong> puedes crear canciones educativas con letra personalizada. Pide una canción sobre las tablas de multiplicar o los ríos de España. ¡Los alumnos las recordarán cantando!',
    toolId: 'pri-suno',
    category: 'tip',
    date: '2025-02-05',
  },
  {
    id: 'tip-notebooklm',
    icon: '🎧',
    title: 'Podcasts de tus apuntes',
    body: '<strong>NotebookLM</strong> convierte cualquier documento en un podcast de audio. Sube un tema del libro de texto y genera un resumen hablado que tus alumnos pueden escuchar en casa.',
    toolId: 'pri-notebooklm',
    category: 'tip',
    date: '2025-02-10',
  },
  {
    id: 'news-grok',
    icon: '🆕',
    title: 'Grok Aurora: imágenes gratis',
    body: 'Grok de xAI ofrece generación de imágenes <strong>totalmente gratuita</strong> y sin límite visible. Ideal para crear ilustraciones para fichas, pósters y presentaciones sin gastar un euro.',
    toolId: 'pri-grok',
    category: 'news',
    date: '2025-02-15',
  },
  {
    id: 'tip-roles',
    icon: '🎭',
    title: 'Dale un rol a la IA',
    body: 'Empieza tus prompts con «Actúa como un profesor de Primaria experto en...». Cuando la IA tiene un <strong>rol claro</strong>, las respuestas son más precisas y adaptadas al nivel educativo.',
    category: 'tip',
    date: '2025-02-18',
  },
  {
    id: 'seasonal-carnaval',
    icon: '🎪',
    title: 'Ideas IA para Carnaval',
    body: 'Usa <strong>Gemini</strong> para diseñar máscaras y disfraces temáticos, o pide a <strong>Suno</strong> que componga la canción del desfile de tu clase. ¡La IA puede ser tu mejor aliada para las fiestas del cole!',
    category: 'seasonal',
    date: '2025-02-20',
  },
  {
    id: 'tip-iteracion',
    icon: '🔄',
    title: 'No te conformes a la primera',
    body: 'Si el resultado no es perfecto, <strong>itera</strong>. Dile a la IA: «Hazlo más sencillo», «Añade ejemplos visuales» o «Cambia el tono a más divertido». Cada iteración mejora el resultado.',
    category: 'tip',
    date: '2025-02-22',
  },
  {
    id: 'tip-storybook',
    icon: '📖',
    title: 'Cuentos ilustrados en minutos',
    body: 'Con <strong>Storybook + Gemini</strong> puedes crear cuentos personalizados con ilustraciones automáticas. Perfecto para Infantil: pon los nombres de tus alumnos como protagonistas.',
    toolId: 'inf-storybook',
    category: 'tip',
    date: '2025-02-25',
  },
];
