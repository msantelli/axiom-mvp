import React, { useState } from 'react'
import { checkProof, Step } from '../lib/logic'

type Item = { id: string, text: string }
type Exercise = {
  id: string
  title: string
  goal: string
  given?: string[]
  allowed: { axioms: (1|2|3)[], rules: ('MP')[] }
  hints?: string[]
}

const initialItems: Item[] = [
  { id: 'g1', text: 'A' },
  { id: 'g2', text: '(A->B)' },
  { id: 'a1', text: 'A->(B->A) (Axioma 1)' },
  { id: 'i1', text: '(A->(B->C))->((A->B)->(A->C)) (Axioma 2)' },
]

const demo: Exercise = {
  id: 'demo-mp',
  title: 'Intro MP: A, (A->B) ⊢ B',
  goal: 'B',
  given: ['A','(A->B)'],
  allowed: { axioms: [1,2,3], rules: ['MP'] },
  hints: ['Arrastrá A sobre (A->B) para producir B con MP.']
}

export default function DragProof(){
  const [tray, setTray] = useState<Item[]>(initialItems)
  const [steps, setSteps] = useState<Step[]>([])
  const [drag, setDrag] = useState<Item|null>(null)
  const [message, setMessage] = useState<string>('Arrastrá (A→B) al área de implicaciones para aplicar MP')

  function onDragStart(it: Item){ setDrag(it) }
  function onDragEnd(){ setDrag(null) }

  function onDropOnImp(){
    if (!drag) return
    const dragged = drag.text
    
    // Check if dragged item is an implication
    const m = dragged.match(/^\((.+)->(.+)\)$/) || dragged.match(/^(.+)->(.+)$/)
    if (!m) return setMessage('Arrastrá una implicación (X->Y) aquí')
    
    const antecedent = m[1]
    const consequent = m[2]
    
    // Check if we have the antecedent in the tray to apply MP
    const hasAntecedent = tray.some(item => item.text.replace(/\s+/g,'') === antecedent.replace(/\s+/g,''))
    
    if (hasAntecedent) {
      const line = steps.length + 1
      const newStep: Step = { line, formula: consequent, just: {kind:'MP', from: 1, impliesFrom: 2} }
      setSteps([...steps, newStep])
      setTray([...tray, { id: `c${line}`, text: consequent }])
      setMessage(`MP aplicado: de ${antecedent} y ${dragged} inferís ${consequent}`)
    } else {
      setMessage(`Para aplicar MP necesitas el antecedente: ${antecedent}`)
    }
  }

  function verifyAll(){
    const res = checkProof(steps, demo.goal, demo.given)
    if (res.ok) setMessage('✔️ ¡Demostración completa!')
    else setMessage('❌ Revisa: ' + res.errors.map(e=>`línea ${e.line}: ${e.msg}`).join(' | '))
  }

  return (
    <div style={{display:'grid', gap:12, gridTemplateColumns:'1fr 2fr'}}>
      <div>
        <h2>{demo.title}</h2>
        <p><b>Dado:</b> {demo.given?.join(', ')}</p>
        <p><b>Meta:</b> {demo.goal}</p>
        <p style={{padding:8, border:'1px dashed #888', borderRadius:8}}>{message}</p>
        <button onClick={verifyAll}>Verificar</button>
        <h3>Bandeja</h3>
        {tray.map(it=> (
          <div key={it.id}
               draggable
               onDragStart={()=>onDragStart(it)}
               onDragEnd={onDragEnd}
               style={{userSelect:'none', margin:'6px 0', padding:8, border:'1px solid #ccc', borderRadius:8, background:'#fafafa'}}>
            {it.text}
          </div>
        ))}
      </div>
      <div>
        <h3>Área de trabajo</h3>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
          <div style={{padding:8, border:'1px solid #ccc', borderRadius:8, minHeight:80}}
               onDragOver={e=>e.preventDefault()}
               onDrop={()=> setMessage('Arrastrá una implicación aquí para usarla como premisa (lado derecho MP)')}>
            <b>Premisas / Hechos</b>
            <div style={{marginTop:6}}>1: A</div>
            <div>2: (A-&gt;B)</div>
          </div>
          <div style={{padding:8, border:'1px solid #ccc', borderRadius:8, minHeight:80}}
               onDragOver={e=>e.preventDefault()}
               onDrop={()=> setMessage('Arrastrá el antecedente sobre una implicación en la bandeja para obtener la conclusión')}>
            <b>Nuevas líneas</b>
            {steps.map(s => <div key={s.line}>{s.line}: {s.formula}  <i>({s.just.kind})</i></div>)}
          </div>
          <div style={{padding:8, border:'1px dashed #aaa', borderRadius:8, minHeight:80}}
               onDragOver={e=>e.preventDefault()}
               onDrop={()=> setMessage('Arrastrá aquí la fórmula antecedente')} />
          <div style={{padding:8, border:'1px dashed #aaa', borderRadius:8, minHeight:80}}
               onDragOver={e=>e.preventDefault()}
               onDrop={(e)=> {
                 e.preventDefault()
                 if (drag) onDropOnImp()
               }}>
            <b>Soltá aquí una implicación (X-&gt;Y)</b>
          </div>
        </div>
      </div>
    </div>
  )
}