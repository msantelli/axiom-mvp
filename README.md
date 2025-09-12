# Sistemas Axiomáticos — MVP (Netlify-ready)

Repositorio: https://github.com/msantelli/axiom-mvp

Práctica guiada de demostraciones con un **editor de líneas** (estilo papel) para sistemas axiomáticos. Enfatiza reglas explícitas, referencias, y verificaciones automáticas.

## Inicio rápido
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

## ¿Cómo usar el editor de líneas?
- Elegí un ejercicio (arriba a la izquierda). Los **Dados** se muestran como líneas 1..n.
- Elegí una **regla** (MP, MT, HS, ADJ, SIMP, DS), luego hacé click en las líneas que requiere. Confirmá “Agregar línea”.
- Cada línea queda registrada con su **regla** y **referencias**. El botón **Verificar** chequea todos los pasos.
- Teclado: M (MP), T (MT), H (SH), A (ADJ), S (SIMP), D (DS), 1/2/3 (instanciar A1–A3), Enter (agregar), Esc (cancelar), Ctrl/Cmd+Z / +Y (Deshacer/Rehacer).
- **ASCII/Unicode**: alterná ~/¬, ^/∧, v/∨, <->/↔.
- **Contradicción**: para ejercicios de inconsistencia (Guía 6), activá “Contradicción”. El verificador confirma cuando hay X y ¬X (o X∧¬X) y te dice **en qué líneas**.
- **Axiomas A1–A3**: instanciá α, β, γ con previsualización.
- **Semántica (opt-in)**: activá “Semántica” y tocá ∵ en una línea para ver la **tautología del esquema** (pequeña verdad‑tabla) y si tus **premisas implican** la conclusión (contraejemplo si no).
- **Deshacer/Rehacer**, **Borrar última**, **Copiar texto** (portapapeles con líneas numeradas y justificaciones).

## Estructura
- `client/src/lib/logic.ts`: parser (¬, ∧, ∨, ↔, ->), axiomas A1–A3, reglas (MP, MT, HS, ADJ, SIMP, DS), verificador.
- `client/src/lib/semantics.ts`: verdad‑tablas, tautologías y chequeo de implicación (para ayudas ∵).
- `client/src/components/ProofEditor.tsx`: editor de líneas, reglas, axiomas, ayudas ∵, inconsistencia.
- `client/src/exercises.json`: banco de ejercicios (incluye Guía 6 y modo “contradicción”).
- `netlify.toml`: config de build listo para usar.

## Nota didáctica
El editor busca **alinear la experiencia con las demostraciones en papel**: líneas numeradas, reglas explícitas, referencias claras y verificación incremental. Las ayudas ∵ conectan con la intuición de las **tablas de verdad** sin distraer del método axiomático.

## Atribución
- Autor: Mauro Santelli (UBA - IIF-SADAF[CONICET] - UDESA).
- App para uso de la materia Introducción a la ciencia (C094 y C095).
- Profesores de Magistrales: Sergio Barberis, Aníbal Szapiro, Mauro Santelli, Tomás Balmaceda, Andrea Melamed, Nicolás Serrano.
- Profesores de tutoriales: Maximiliano Zeller, Ignacio Madroñal, Marcos Travaglia, Dalila Serebrinsky.
- Diseñada y prototipada con OpenAI Codex y Claude Code.
