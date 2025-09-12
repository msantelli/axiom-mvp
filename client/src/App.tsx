import React from 'react'
import ProofEditor from './components/ProofEditor'
import exercises from './exercises.json'

export default function App(){
  return (
    <div style={{maxWidth:1000, margin:'0 auto', padding:16}}>
      <header style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h1 style={{margin:0}}>Sistemas Axiomáticos — MVP</h1>
        <a href="https://github.com/ariroffe/logics" target="_blank" rel="noreferrer">logics (opcional)</a>
      </header>
      <p style={{opacity:.8}}>Elegí reglas y líneas para construir la demostración paso a paso. Las líneas se numeran como en papel.</p>
      <ProofEditor />
      <hr style={{margin:'24px 0'}}/>
      <details>
        <summary>Banco de ejercicios (JSON)</summary>
        <pre>{JSON.stringify(exercises, null, 2)}</pre>
      </details>
    </div>
  )
}
