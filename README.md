# Sistemas Axiomáticos — MVP (Netlify-ready)

**Objetivo**: práctica guiada de demostraciones en un sistema axiomático tipo Hilbert (A1–A3 + MP), con un **constructor drag & drop** para aplicar MP y un verificador de líneas básico.

## Rápido inicio
```bash
cd client
npm ci
npm run dev
```
Abrí http://localhost:5173

## Deploy en Netlify
- Conectá el repo de GitHub.
- Build command: `npm ci && npm run build`
- Base: `client`
- Publish dir: `client/dist`
- Asegurate de tener `public/_redirects` para SPA.

## Estructura
- `client/src/lib/logic.ts`: parser, axiomas y verificador (A1–A3 + MP).
- `client/src/components/DragProof.tsx`: UI drag & drop (HTML5 nativo) para aplicar MP.
- `client/src/exercises.json`: ejemplos de ejercicios (puede crecer).
- `netlify.toml`: config de build listo para usar.

## Próximos pasos
- Agregar reconocimiento explícito de instancias de axiomas (actividad de selección).
- Agregar reglas adicionales (∧, ∨, etc.) y natural deduction como modo alternativo.
- Integración opcional con [ariroffe/logics](https://github.com/ariroffe/logics) para validación semántica/contraejemplos.
- Persistir intentos en LocalStorage y exportar en JSON.
- Mejorar drag & drop con react-dnd y panel de justificaciones.

## Nota didáctica
Este MVP enfatiza la **transición entre líneas** via **reglas de inferencia** (MP) y **reconocimiento de esquemas** (A1–A3), que son la base para escalar a demostraciones más complejas.
