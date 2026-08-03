import React, { useEffect, useState } from 'react'
import ProofEditor from './components/ProofEditor'
import exercises from './exercises.json'

function temaInicial(): 'dark'|'light' {
  try{
    const g = localStorage.getItem('axiom:tema')
    if (g==='dark' || g==='light') return g
  }catch{ /* sin storage */ }
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  return 'dark'
}

export default function App(){
  const [aboutOpen, setAboutOpen] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [tema, setTema] = useState<'dark'|'light'>(temaInicial)

  useEffect(()=>{
    document.documentElement.dataset.theme = tema
  }, [tema])

  function alternarTema(){
    setTema(t => {
      const nuevo = t==='dark' ? 'light' : 'dark'
      try{ localStorage.setItem('axiom:tema', nuevo) }catch{ /* sin storage */ }
      return nuevo
    })
  }

  return (
    <div className="contenedor">
      <header className="topbar">
        <div>
          <h1 className="wordmark"><span className="wordmark-simbolo">⊢</span>sistemas axiomáticos</h1>
          <p className="subtitulo">práctica de demostraciones · introducción a la ciencia · c094 · c095</p>
        </div>
        <div className="topbar-derecha">
          <button className="boton-plano" type="button" onClick={alternarTema} aria-label="Cambiar tema">
            {tema==='dark' ? 'claro' : 'oscuro'}
          </button>
          <button className="boton-plano" type="button" onClick={()=> setTutorialOpen(true)}>tutorial</button>
          <button className="boton-plano" type="button" onClick={()=> setAboutOpen(true)}>acerca</button>
          <a className="boton-plano" href="https://github.com/msantelli/axiom-mvp" target="_blank" rel="noreferrer">repositorio</a>
          <a className="boton-plano" href="https://github.com/ariroffe/logics" target="_blank" rel="noreferrer">logics</a>
        </div>
      </header>
      <p className="intro">Elegí reglas y líneas para construir la demostración paso a paso. Las líneas se numeran como en papel.</p>
      <ProofEditor />
      <details className="banco">
        <summary>banco de ejercicios (json)</summary>
        <pre>{JSON.stringify(exercises, null, 2)}</pre>
      </details>
      <footer className="pie">
        <p>hecho por mauro santelli (uba · iif-sadaf [conicet] · udesa) · introducción a la ciencia, c094 y c095 · <a href="https://github.com/ariroffe/logics" target="_blank" rel="noreferrer">logics</a> de Ariel Roffé como referencia</p>
      </footer>
      {tutorialOpen && <TutorialModal onClose={()=> setTutorialOpen(false)} />}
      {aboutOpen && <AboutModal onClose={()=> setAboutOpen(false)} />}
    </div>
  )
}

function TutorialModal({onClose}:{onClose: ()=>void}){
  return (
    <div className="velo" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-encabezado">
          <h3 className="modal-titulo">Tutorial rápido</h3>
          <button className="boton" onClick={onClose}>cerrar</button>
        </div>
        <div className="modal-cuerpo">
          <ol>
            <li>Elegí un ejercicio desde el selector superior e identificá la meta y las premisas dadas.</li>
            <li>Revisá las reglas permitidas indicadas en la tarjeta “Demostración”. Activá una regla y luego marcá las líneas que requiere.</li>
            <li>Confirmá con “Agregar línea” (o Enter). Cada línea nueva queda numerada, con su justificación y referencias.</li>
            <li>Usá los atajos de teclado (M, T, H, A, S, D) para acelerar la selección de reglas y Ctrl/Cmd+Z para deshacer.</li>
            <li>Verificá los pasos con el botón “Verificar” o activá “Contradicción” cuando el objetivo sea derivar una inconsistencia.</li>
            <li>Pedí ayuda semántica activando el switch “Semántica” y usando el botón ∵ en cada línea para ver tablas de verdad.</li>
          </ol>
          <p style={{marginTop:16}}>
            ¿Te quedaste con dudas? Consultá la guía completa en <a href="/tutorial.html" target="_blank" rel="noreferrer">/tutorial.html</a>.
          </p>
        </div>
      </div>
    </div>
  )
}

function AboutModal({onClose}:{onClose: ()=>void}){
  return (
    <div className="velo" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-encabezado">
          <h3 className="modal-titulo">Acerca de esta app</h3>
          <button className="boton" onClick={onClose}>cerrar</button>
        </div>
        <div className="modal-cuerpo">
          <p><b>Autor:</b> <a href="https://maurosantelli.com.ar" target="_blank" rel="noreferrer">Mauro Santelli</a> (UBA - IIF-SADAF[CONICET] - Profesor invitado UDESA).</p>
          <p>App para uso de la materia <i>Introducción a la ciencia</i> (C094 y C095).</p>
          <p><b>Profesores:</b> Aníbal Szapiro, Tomás Balmaceda, Sergio Barberis, Andrea Melamed, Mauro Santelli, Nicolás Serrano, Virginia Ketzelman y Christián Carman.</p>
          <p><b>Tutores:</b> Ignacio Madroñal, Marcos Travaglia, Dalila Serebrinsky, Jonathan Erenfryd, Paula Villafañe, Marina Melantoni, Alejandro Petrone, Luciana Espinosa y Alejandro Zárate.</p>
          <p className="nota-suave" style={{marginTop:12}}>Diseñada y prototipada con OpenAI Codex y Claude Code.</p>
        </div>
      </div>
    </div>
  )
}
