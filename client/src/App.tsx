import React, { useState } from 'react'
import ProofEditor from './components/ProofEditor'
import exercises from './exercises.json'

export default function App(){
  const [aboutOpen, setAboutOpen] = useState(false)
  return (
    <div className="app-container" style={{maxWidth:1000, margin:'24px auto', padding:16}}>
      <header style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8}}>
        <h1 style={{margin:0}}>Sistemas Axiomáticos: Introducción a la ciencia - C094 - C095</h1>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <button onClick={()=> setAboutOpen(true)}>Acerca</button>
          <a href="https://github.com/msantelli/axiom-mvp" target="_blank" rel="noreferrer">Repositorio</a>
          <a href="https://github.com/ariroffe/logics" target="_blank" rel="noreferrer">logics (opcional)</a>
        </div>
      </header>
      <p style={{opacity:.8}}>Elegí reglas y líneas para construir la demostración paso a paso. Las líneas se numeran como en papel.</p>
      <ProofEditor />
      <hr style={{margin:'24px 0'}}/>
      <details>
        <summary>Banco de ejercicios (JSON)</summary>
        <pre>{JSON.stringify(exercises, null, 2)}</pre>
      </details>
      {aboutOpen && <AboutModal onClose={()=> setAboutOpen(false)} />}
    </div>
  )
}

function AboutModal({onClose}:{onClose: ()=>void}){
  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000}} onClick={onClose}>
      <div style={{background:'#fff', padding:16, borderRadius:8, width:'min(720px, 96vw)'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <h3 style={{margin:0}}>Acerca de esta app</h3>
          <button onClick={onClose}>Cerrar</button>
        </div>
        <div style={{marginTop:8, lineHeight:1.45}}>
          <p style={{margin:'6px 0'}}><b>Autor:</b> Mauro Santelli (UBA - IIF-SADAF[CONICET] - Profesor invitado UDESA).</p>
          <p style={{margin:'6px 0'}}>App para uso de la materia <i>Introducción a la ciencia</i> (C094 y C095).</p>
          <p style={{margin:'6px 0'}}><b>Profesores de Magistrales:</b> Sergio Barberis, Aníbal Szapiro, Mauro Santelli, Tomás Balmaceda, Andrea Melamed, Nicolás Serrano.</p>
          <p style={{margin:'6px 0'}}><b>Profesores de tutoriales:</b> Maximiliano Zeller, Ignacio Madroñal, Marcos Travaglia, Dalila Serebrinsky.</p>
          <p style={{margin:'12px 0 0 0', opacity:.8}}>Diseñada y prototipada con OpenAI Codex y Claude Code.</p>
        </div>
      </div>
    </div>
  )
}
