import React, { useEffect, useMemo, useState } from 'react'
import exercisesData from '../exercises.json'
import { parse, show, equalF, checkProof, instantiate, AXIOMS, type F, type Step, type Just } from '../lib/logic'

type Rule = 'MP'|'MT'|'HS'|'ADJ'|'SIMP'|'DS'|'AX1'|'AX2'|'AX3'

export default function ProofEditor(){
  const [exIdx, setExIdx] = useState(0)
  const ex = exercisesData[exIdx]
  const given = ex.given ?? []
  const goal = ex.goal
  const allowedRules: string[] = (ex.allowed?.rules as any) ?? ['MP']
  const allowedAxioms: number[] = (ex.allowed?.axioms as any) ?? [1,2,3]

  const [steps, setSteps] = useState<Step[]>([])
  const [history, setHistory] = useState<Step[][]>([])
  const [future, setFuture] = useState<Step[][]>([])
  const [activeRule, setActiveRule] = useState<Rule|null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [simpPick, setSimpPick] = useState<'left'|'right'>('left')
  const [ascii, setAscii] = useState<boolean>(false)
  const [message, setMessage] = useState<string>('Seleccioná una regla y luego las líneas referenciadas')
  const [hoverLine, setHoverLine] = useState<number|null>(null)
  const [hoverRefs, setHoverRefs] = useState<number[]>([])
  const [goalIsContradiction, setGoalIsContradiction] = useState<boolean>(false)
  const [axOpen, setAxOpen] = useState<{n:1|2|3}|null>(null)
  const [axAlpha, setAxAlpha] = useState('A')
  const [axBeta, setAxBeta] = useState('B')
  const [axGamma, setAxGamma] = useState('C')

  const allLines = useMemo(()=>{
    const lines: { idx:number, formula:string, tag:string }[] = []
    given.forEach((g, i)=> lines.push({ idx: i+1, formula: g, tag: 'Given' }))
    steps.forEach((s, j)=> lines.push({ idx: given.length + j + 1, formula: s.formula, tag: justToTag(s.just) }))
    return lines
  }, [given, steps])

  useEffect(()=>{
    // Default contradiction mode per exercise setting, if present
    setGoalIsContradiction((ex as any).goalMode === 'contradiction')
  }, [exIdx])

  function justToTag(j: Just): string {
    switch(j.kind){
      case 'AX': return `A${j.axiom}`
      case 'MP': return `MP ${j.from},${j.impliesFrom}`
      case 'MT': return `MT ${j.imp},${j.not}`
      case 'HS': return `HS ${j.left},${j.right}`
      case 'ADJ': return `ADJ ${j.left},${j.right}`
      case 'SIMP': return `SIMP ${j.from}.${j.pick==='left'?'L':'R'}`
      case 'DS': return `DS ${j.disj},${j.not}`
    }
  }

  function display(formula: string): string {
    const normalized = show(parse(formula))
    if (!ascii) return normalized
    return normalized
      .split('¬').join('~')
      .split('∧').join('^')
      .split('∨').join('v')
      .split('↔').join('<->')
  }

  function onPickRule(rule: Rule){
    if (rule.startsWith('AX')){
      const n = Number(rule.replace('AX','')) as 1|2|3
      if (!allowedAxioms.includes(n)) { setMessage(`A${n} no permitido en este ejercicio`); return }
      setAxOpen({n}); setActiveRule(null); setSelected([])
      setMessage(`Instanciar A${n}: completá α, β, γ y confirmá`)
      return
    }
    if (!allowedRules.includes(rule as any)){
      setMessage(`La regla ${rule} no está permitida en este ejercicio`)
      return
    }
    setActiveRule(rule)
    setSelected([])
    setMessage(instructionFor(rule))
  }

  function instructionFor(rule: Rule): string {
    switch(rule){
      case 'MP': return 'MP: seleccioná dos líneas: X y (X->Y)'
      case 'MT': return 'MT: seleccioná dos líneas: (X->Y) y ¬Y'
      case 'HS': return 'HS: seleccioná dos líneas: (X->Y) y (Y->Z)'
      case 'ADJ': return 'ADJ: seleccioná dos líneas: X y Y'
      case 'SIMP': return 'SIMP: seleccioná una conjunción X∧Y y elegí lado'
      case 'DS': return 'DS: seleccioná dos líneas: (X∨Y) y ¬X o ¬Y'
      default: return 'Seleccioná una regla'
    }
  }

  function toggleSelect(lineIdx: number){
    if (!activeRule) return
    setSelected(prev => prev.includes(lineIdx) ? prev.filter(i=>i!==lineIdx) : [...prev, lineIdx])
  }

  function refsForLine(idx: number): number[] {
    // Return referenced source line numbers for a derived step line idx
    const base = given.length
    const k = idx - base - 1
    if (k < 0 || k >= steps.length) return []
    const j = steps[k].just
    switch(j.kind){
      case 'AX': return []
      case 'MP': return [j.from, j.impliesFrom]
      case 'MT': return [j.imp, j.not]
      case 'HS': return [j.left, j.right]
      case 'ADJ': return [j.left, j.right]
      case 'SIMP': return [j.from]
      case 'DS': return [j.disj, j.not]
    }
  }

  function getF(lineIdx: number): F {
    const line = allLines.find(l=>l.idx===lineIdx)
    if (!line) throw new Error('Índice de línea inválido')
    return parse(line.formula)
  }

  function computeConclusion(): { formula: string, just: Just } | { error: string }{
    if (!activeRule) return { error: 'Elegí una regla' }
    const nextLine = given.length + steps.length + 1
    try{
      if (activeRule==='MP'){
        if (selected.length!==2) return { error: 'MP requiere dos líneas' }
        const [aIdx, bIdx] = selected
        const A = getF(aIdx)
        const B = getF(bIdx)
        // try (A, B=Imp)
        if (B.kind==='imp' && equalF(A, B.left)) {
          return { formula: show(B.right), just: { kind:'MP', from: aIdx, impliesFrom: bIdx } }
        }
        // try swapped
        if (A.kind==='imp' && equalF(B, A.left)) {
          return { formula: show(A.right), just: { kind:'MP', from: bIdx, impliesFrom: aIdx } }
        }
        return { error: 'Selección inválida para MP' }
      }
      if (activeRule==='MT'){
        if (selected.length!==2) return { error: 'MT requiere dos líneas' }
        const [i1, i2] = selected
        const F1 = getF(i1)
        const F2 = getF(i2)
        // (Imp, Neg) or (Neg, Imp)
        if (F1.kind==='imp' && F2.kind==='neg' && equalF(F1.right, F2.inner)){
          return { formula: show({kind:'neg', inner: F1.left}), just: { kind:'MT', imp: i1, not: i2 } }
        }
        if (F2.kind==='imp' && F1.kind==='neg' && equalF(F2.right, F1.inner)){
          return { formula: show({kind:'neg', inner: F2.left}), just: { kind:'MT', imp: i2, not: i1 } }
        }
        return { error: 'Selección inválida para MT' }
      }
      if (activeRule==='HS'){
        if (selected.length!==2) return { error: 'HS requiere dos líneas' }
        const [i1, i2] = selected
        const F1 = getF(i1)
        const F2 = getF(i2)
        if (F1.kind==='imp' && F2.kind==='imp' && equalF(F1.right, F2.left)){
          return { formula: show({kind:'imp', left: F1.left, right: F2.right}), just: { kind:'HS', left: i1, right: i2 } }
        }
        if (F1.kind==='imp' && F2.kind==='imp' && equalF(F2.right, F1.left)){
          return { formula: show({kind:'imp', left: F2.left, right: F1.right}), just: { kind:'HS', left: i2, right: i1 } }
        }
        return { error: 'Selección inválida para HS' }
      }
      if (activeRule==='ADJ'){
        if (selected.length!==2) return { error: 'ADJ requiere dos líneas' }
        const [i1, i2] = selected
        return { formula: show({kind:'and', left: getF(i1), right: getF(i2)}), just: { kind:'ADJ', left: i1, right: i2 } }
      }
      if (activeRule==='SIMP'){
        if (selected.length!==1) return { error: 'SIMP requiere una sola línea X∧Y' }
        const [i1] = selected
        const F1 = getF(i1)
        if (F1.kind!=='and') return { error: 'La línea seleccionada no es una conjunción' }
        const proj = simpPick==='left' ? F1.left : F1.right
        return { formula: show(proj), just: { kind:'SIMP', from: i1, pick: simpPick } }
      }
      if (activeRule==='DS'){
        if (selected.length!==2) return { error: 'DS requiere dos líneas' }
        const [i1, i2] = selected
        const F1 = getF(i1)
        const F2 = getF(i2)
        // (Disj, Neg) or (Neg, Disj)
        if (F1.kind==='or' && F2.kind==='neg'){
          if (equalF(F2.inner, F1.left)) return { formula: show(F1.right), just: { kind:'DS', disj: i1, not: i2 } }
          if (equalF(F2.inner, F1.right)) return { formula: show(F1.left), just: { kind:'DS', disj: i1, not: i2 } }
        }
        if (F2.kind==='or' && F1.kind==='neg'){
          if (equalF(F1.inner, F2.left)) return { formula: show(F2.right), just: { kind:'DS', disj: i2, not: i1 } }
          if (equalF(F1.inner, F2.right)) return { formula: show(F2.left), just: { kind:'DS', disj: i2, not: i1 } }
        }
        return { error: 'Selección inválida para DS' }
      }
      return { error: 'Regla no implementada aún' }
    }catch(e:any){
      return { error: e.message }
    }
  }

  function addStep(){
    const res = computeConclusion()
    if ('error' in res){ setMessage('❌ ' + res.error); return }
    const line = given.length + steps.length + 1
    const newStep: Step = { line, formula: res.formula, just: res.just }
    const snapshot = steps
    const next = [...snapshot, newStep]
    setHistory(h => [...h, snapshot])
    setFuture([])
    setSteps(next)
    setSelected([])
    setMessage(`✔️ ${res.just.kind}: agregada línea ${line}`)
  }

  function confirmAxiom(n: 1|2|3){
    try{
      const subst: Record<string, F> = { 'α': parse(axAlpha), 'β': parse(axBeta) }
      if (n!==1) subst['γ'] = parse(axGamma)
      const inst = instantiate(AXIOMS[n], subst)
      const formula = show(inst)
      const line = given.length + steps.length + 1
      const snapshot = steps
      const newStep: Step = { line, formula, just: { kind:'AX', axiom: n } }
      const next = [...snapshot, newStep]
      setHistory(h => [...h, snapshot])
      setFuture([])
      setSteps(next)
      setAxOpen(null)
      setMessage(`✔️ A${n}: agregada línea ${line}`)
    }catch(e:any){
      setMessage('❌ ' + String(e.message||e))
    }
  }

  function detectContradiction(): boolean {
    // Check if any conjunction is of the form X ∧ ¬X, or if both X and ¬X appear across lines.
    const fs: F[] = allLines.map(l=> parse(l.formula))
    // Direct X ∧ ¬X
    for (const f of fs){
      if (f.kind==='and'){
        if (f.left.kind==='neg' && equalF(f.left.inner, f.right)) return true
        if (f.right.kind==='neg' && equalF(f.right.inner, f.left)) return true
      }
    }
    // Cross-line X, ¬X
    for (let i=0;i<fs.length;i++){
      for (let j=i+1;j<fs.length;j++){
        const a = fs[i], b = fs[j]
        if (a.kind==='neg' && equalF(a.inner, b)) return true
        if (b.kind==='neg' && equalF(b.inner, a)) return true
      }
    }
    return false
  }

  function verify(){
    const result = checkProof(steps, goal, given)
    if (!goalIsContradiction){
      if (result.ok) setMessage('✔️ Demostración válida')
      else setMessage('❌ ' + result.errors.map(e=>`L${e.line}: ${e.msg}`).join(' | '))
      return
    }
    // Contradiction goal mode: proof is valid if steps are all valid and a contradiction appears
    const contradiction = detectContradiction()
    if (result.errors.length>0){ setMessage('❌ ' + result.errors.map(e=>`L${e.line}: ${e.msg}`).join(' | ')); return }
    if (contradiction){ setMessage('✔️ Contradicción derivada') }
    else setMessage('❌ No se derivó una contradicción')
  }

  function reset(){ setSteps([]); setHistory([]); setFuture([]); setSelected([]); setActiveRule(null); setMessage('Reiniciado') }

  function undo(){
    setHistory(h => {
      if (h.length===0) return h
      setFuture(f => [steps, ...f])
      const prev = h[h.length-1]
      setSteps(prev)
      setMessage('↩️ Deshacer')
      return h.slice(0, -1)
    })
  }

  function redo(){
    setFuture(f => {
      if (f.length===0) return f
      setHistory(h => [...h, steps])
      const nxt = f[0]
      setSteps(nxt)
      setMessage('↪️ Rehacer')
      return f.slice(1)
    })
  }

  return (
    <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:12}}>
      <div>
        <header style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
          <select value={exIdx} onChange={e=>{ setExIdx(parseInt(e.target.value)); reset() }}>
            {exercisesData.map((e,i)=> <option key={e.id} value={i}>{e.title}</option>)}
          </select>
          <label><input type="checkbox" checked={ascii} onChange={e=>setAscii(e.target.checked)} /> ASCII</label>
          <label title="Objetivo: derivar contradicción (p.ej., P∧¬P)"><input type="checkbox" checked={goalIsContradiction} onChange={e=>setGoalIsContradiction(e.target.checked)} /> Contradicción</label>
          <button onClick={verify}>Verificar</button>
          <button onClick={undo} disabled={history.length===0}>Deshacer</button>
          <button onClick={redo} disabled={future.length===0}>Rehacer</button>
          <button onClick={reset}>Reiniciar</button>
        </header>
        <div style={{margin:'8px 0', padding:8, border:'1px dashed #999', borderRadius:8}}>{message}</div>
        {!goalIsContradiction && (
          <div style={{marginBottom:8}}>
            <b>Meta:</b> {display(goal)} {ex.hints && ex.hints.length>0 && <span style={{opacity:.7}}> • Pista: {ex.hints[0]}</span>}
          </div>
        )}
        <div>
          <b>Reglas permitidas:</b> {allowedRules.join(', ')} {allowedAxioms.length>0 && <> • <b>Axiomas:</b> {allowedAxioms.map(a=>'A'+a).join(', ')}</>}
        </div>
        <h3>Demostración</h3>
        <div>
          {allLines.map(l => (
            <div key={l.idx}
                 onClick={()=> toggleSelect(l.idx)}
                 onMouseEnter={()=>{ setHoverLine(l.idx); setHoverRefs(refsForLine(l.idx)) }}
                 onMouseLeave={()=>{ setHoverLine(null); setHoverRefs([]) }}
                 style={{
                   display:'grid', gridTemplateColumns:'40px 1fr 120px', gap:8, padding:'6px 8px', margin:'4px 0',
                   border:'1px solid #ddd', borderRadius:6,
                   background: (selected.includes(l.idx) ? '#eef7ff' : (hoverLine===l.idx ? '#fffbe6' : (hoverRefs.includes(l.idx) ? '#f0fff4' : '#fff'))),
                   outline: hoverRefs.includes(l.idx) ? '2px solid #81c784' : undefined,
                   cursor: activeRule? 'pointer':'default'
                 }}>
              <div style={{opacity:.7}}>{l.idx}.</div>
              <div>{display(l.formula)}</div>
              <div style={{textAlign:'right', opacity:.8}}>{l.tag}</div>
            </div>
          ))}
        </div>
        {activeRule==='SIMP' && (
          <div style={{marginTop:8}}>
            <label>Proyección: </label>
            <select value={simpPick} onChange={e=>setSimpPick(e.target.value as any)}>
              <option value='left'>Izquierda</option>
              <option value='right'>Derecha</option>
            </select>
          </div>
        )}
        <div style={{marginTop:8, display:'flex', gap:8}}>
          <button disabled={!activeRule} onClick={addStep}>Agregar línea ({activeRule ?? '—'})</button>
          <button onClick={()=>{ setActiveRule(null); setSelected([]); setMessage('Seleccioná una regla')}}>Cancelar selección</button>
        </div>
      </div>
      <div>
        <h3>Reglas</h3>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:6}}>
          {(['MP','MT','HS','ADJ','SIMP','DS'] as Rule[]).map(r=> (
            <button key={r}
                    disabled={!allowedRules.includes(r as any)}
                    onClick={()=> onPickRule(r)}
                    style={{padding:'6px 8px', border: activeRule===r? '2px solid #1976d2':'1px solid #ccc', borderRadius:6, background: activeRule===r? '#e3f2fd':'#fff'}}>
              {r}
            </button>
          ))}
        </div>
        <h4 style={{marginTop:12}}>Axiomas</h4>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6}}>
          {[1,2,3].map(n=> (
            <button key={n} disabled={!allowedAxioms.includes(n as any)} onClick={()=> onPickRule(('AX'+n) as Rule)}>
              A{n}
            </button>
          ))}
        </div>
        {axOpen && (
          <div style={{marginTop:12, padding:10, border:'1px solid #bbb', borderRadius:8}}>
            <div><b>Instanciar A{axOpen.n}</b></div>
            <div style={{display:'grid', gridTemplateColumns:'40px 1fr', gap:6, marginTop:6}}>
              <label>α</label>
              <input value={axAlpha} onChange={e=>setAxAlpha(e.target.value)} placeholder="ej: P" />
              <label>β</label>
              <input value={axBeta} onChange={e=>setAxBeta(e.target.value)} placeholder="ej: Q" />
              {axOpen.n!==1 && (
                <>
                  <label>γ</label>
                  <input value={axGamma} onChange={e=>setAxGamma(e.target.value)} placeholder="ej: R" />
                </>
              )}
            </div>
            <AxiomPreview n={axOpen.n} α={axAlpha} β={axBeta} γ={axGamma} ascii={ascii} />
            <div style={{display:'flex', gap:8, marginTop:8}}>
              <button onClick={() => confirmAxiom(axOpen.n)}>Agregar</button>
              <button onClick={() => setAxOpen(null)}>Cancelar</button>
            </div>
          </div>
        )}
        <div style={{marginTop:12, fontSize:12, opacity:.8}}>
          <div><b>MP:</b> X→Y, X ⟹ Y</div>
          <div><b>MT:</b> X→Y, ¬Y ⟹ ¬X</div>
          <div><b>HS:</b> X→Y, Y→Z ⟹ X→Z</div>
          <div><b>ADJ:</b> X, Y ⟹ X∧Y</div>
          <div><b>SIMP:</b> X∧Y ⟹ X | Y</div>
          <div><b>DS:</b> X∨Y, ¬X ⟹ Y (o simétrico)</div>
        </div>
      </div>
    </div>
  )
}

function AxiomPreview({n, α, β, γ, ascii}:{n:1|2|3, α:string, β:string, γ:string, ascii:boolean}){
  try{
    const subst: Record<string, F> = { 'α': parse(α), 'β': parse(β) }
    if (n!==1) subst['γ'] = parse(γ)
    const inst = instantiate(AXIOMS[n], subst)
    const text = show(inst)
    const displayed = ascii
      ? text.split('¬').join('~').split('∧').join('^').split('∨').join('v').split('↔').join('<->')
      : text
    return <div style={{marginTop:8, fontSize:13, background:'#fafafa', padding:8, borderRadius:6}}>Previsualización: {displayed}</div>
  }catch(e:any){
    return <div style={{marginTop:8, fontSize:13, color:'#b71c1c'}}>Error: {String(e.message||e)}</div>
  }
}
