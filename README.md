# ChoreoSync Pro 🎭⚡
### Dirección Coreográfica, Bloqueo Escénico y Sincronización Musical por Conteos de 8 Tiempos

**ChoreoSync Pro** es una plataforma profesional en tiempo real para coreógrafos, directores escénicos y bailarines. Permite diseñar formaciones, calcular trayectorias de desplazamiento con curvas cuadráticas de Bézier, detectar colisiones físicas en escena, marcar ritmos musicales en ciclos del 1 al 8 con **Tap-to-Beat**, y sincronizar en vivo los celulares de todos los bailarines vía WebSockets y códigos QR.

---

## 🏛 Arquitectura del Proyecto

El código está estructurado bajo principios de Clean Architecture y componentes de alto rendimiento a 60 FPS:

```text
choreosync-pro/
├── package.json               # Dependencias: React 19, Vite 6, Tailwind CSS, Lucide, QRcode, WS
├── vite.config.ts             # Configuración de compilación ultrarrápida
├── tailwind.config.js         # Tema Dark Mode Studio (Slate-950, Violet-500, Cyan-400, Emerald-400)
├── server.js                  # Servidor WebSocket + HTTP para salas en vivo y conexión móvil
├── index.html                 # Punto de entrada HTML5 responsivo
└── src/
    ├── types/
    │   └── choreo.ts          # Modelos de datos: Dancers, Beats (1-8), Formations, StageZone, Collisions
    ├── utils/
    │   ├── interpolation.ts   # Interpolación Bézier cuadrática, Ease-in-out, Hold vs Travel, 9 cuadrantes #
    │   ├── collision.ts       # Detección de colisiones instantáneas y escaneo global de transiciones
    │   ├── audioSynthesizer.ts# Web Audio API: Clics de metrónomo (1650Hz + Sub-kick), decodificador MP3/WAV
    │   ├── realtime.ts        # Adaptador híbrido: BroadcastChannel (local) + WebSocket (Wi-Fi móvil) + QR
    │   └── storage.ts         # Persistencia en LocalStorage, exportación e importación .JSON, Demo precargada
    ├── components/
    │   ├── Header/            # Barra superior con Contador Gigante (OCHO #X | TIEMPO Y) y selector de vista
    │   ├── StageCanvas/       # Motor gráfico Canvas 2D: Cuadrícula #, 9 zonas, fichas interactivas, curvas
    │   ├── Timeline/          # Línea de tiempo multipista: Audio, Conteos 1-8, Formaciones (Hold/Transición)
    │   ├── AudioEngine/       # Controles de audio: Play/Pause, velocidad (0.5x, 0.75x, 1x), Tap-to-Beat [T]
    │   ├── DancerView/        # Simulador móvil para bailarines: Modo espejo 180°, tarjeta de instrucciones
    │   ├── ChoreographerStudio/# Panel lateral: Gestión de bailarines (color, nivel) y formaciones
    │   └── RealtimeRoom/      # Modal de Sala en Vivo con generación automática de código QR para teléfonos
    ├── App.tsx                # Orquestador del estado global, atajos de teclado y bucle a 60 FPS
    ├── index.css              # Estilos base y scrollbars de estudio
    └── main.tsx               # Montaje de React 19
```

---

## 🚀 Inicio Rápido

### 1. Iniciar en modo desarrollo
```bash
npm run dev
```
Abre tu navegador en `http://localhost:5173`.

### 2. Iniciar la Sala en Vivo para Celulares (Wi-Fi Local)
```bash
# Compilar la aplicación para producción
npm run build

# Iniciar el servidor WebSocket + HTTP
npm start
```
El servidor mostrará la IP local de tu computadora en la red Wi-Fi (ejemplo: `http://192.168.1.50:3000`). Los bailarines solo deben escanear el **Código QR** en pantalla desde la cámara de sus teléfonos para unirse a la sala en tiempo real.

---

## ⌨ Atajos de Teclado Profesionales

| Tecla | Acción |
| :--- | :--- |
| `Espacio` o `S` | **Play / Pausa** (o marcar conteo si el modo grabación está activo) |
| `T` | **Tap-to-Beat**: Inserta un marcador exacto de tiempo en conteos del 1 al 8 |
| `Flecha Derecha` | Avanzar al siguiente conteo musical |
| `Flecha Izquierda` | Retroceder al conteo anterior |
| `Doble Clic` en Timeline | Crear y anclar una nueva formación en ese conteo exacto |

---

## 🌟 Funcionalidades Principales

1. **Escenario con División `#` (9 Zonas Clásicas):**
   - Visualización espacial clara: *Downstage (Frente)*, *Center (Centro)* y *Upstage (Fondo)* en sus divisiones Izquierda, Centro y Derecha.
   - Indicador claro de orientación con vista de auditorio o de bailarín.
2. **Trayectorias Curvas con Puntos de Control Bézier:**
   - Cada bailarín tiene una curva cuadrática de desplazamiento con función *Ease-in-out* configurable para evitar colisiones.
3. **Detector de Colisiones Escénicas:**
   - Detección geométrica en tiempo real. Si dos bailarines se cruzan a la misma altura/nivel, se activa una alarma visual y se marca en rojo en el timeline.
4. **Sistema Tap-to-Beat (1 al 8):**
   - Mapea compases y frases coreográficas al vuelo mientras suena la canción.
5. **Doble Interfaz (Director vs. Bailarín):**
   - El bailarín selecciona su ficha para resaltarla y activar el **Modo Espejo 180°**, que invierte el escenario para ver su derecha e izquierda reales sobre el escenario.
6. **Exportación e Importación:**
   - Guarda y comparte proyectos completos en formato `.json` o mantén tus cambios respaldados con autoguardado en `localStorage`.

## Piloto en internet con Render

En Render, crea un Blueprint desde este repositorio y la rama `main`. El
archivo `render.yaml` configura el servicio Node, la comprobación de salud y
una clave de director generada por Render. Copia esa clave desde **Environment**
de tu servicio y guárdala en privado. En la URL pública de Render, abre
**Sala en vivo**, introduce la clave y pulsa **Dirigir ensayo**.

Comparte solo el QR o el enlace de bailarín. La invitación se conserva en el
navegador del director y se puede reutilizar mientras conserve la misma URL e
identificador de sala. El servidor activa un único director por sala y mantiene
el último estado en memoria durante el ensayo. Si el servicio se reinicia, el
director debe volver a publicar su proyecto desde el estudio. Conserva una
copia `.choreo` con audio para recuperar el ensayo desde otra computadora.

Antes de una competencia, abre el servicio y ensaya con un teléfono en datos
móviles. Comprueba la entrada tardía, la pausa y una reconexión. El plan gratuito
puede entrar en reposo por inactividad.
