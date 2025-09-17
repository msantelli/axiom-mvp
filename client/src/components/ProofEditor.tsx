import React, { useEffect, useMemo, useState } from 'react'
import exercisesData from '../exercises.json'
import { parse, show, equalF, checkProof, instantiate, AXIOMS, type F, type Step, type Just } from '../lib/logic'
import { entails, isTautology, truthTable } from '../lib/semantics'

type Rule = 'MP'|'MT'|'SH'|'ADJ'|'SIMP'|'SD'|'IFF'|'AX1'|'AX2'|'AX3'

export default function ProofEditor(){
  const [exIdx, setExIdx] = useState(0)
  const ex = exercisesData[exIdx]
  const given = ex.given ?? []
  const goal = ex.goal
  const allowedRules: Rule[] = ((ex.allowed?.rules as Rule[]) ?? ['MP'])
  const allowedAxioms: number[] = (ex.allowed?.axioms as any) ?? [1,2,3]

  const [steps, setSteps] = useState<Step[]>([])
  const [history, setHistory] = useState<Step[][]>([])
  const [future, setFuture] = useState<Step[][]>([])
  const [activeRule, setActiveRule] = useState<Rule|null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [simpPick, setSimpPick] = useState<'left'|'right'>('left')
  const [iffDir, setIffDir] = useState<'LtoR'|'RtoL'>('LtoR')
  const [ascii, setAscii] = useState<boolean>(false)
  const [message, setMessage] = useState<string>('Seleccioná una regla y luego las líneas referenciadas')
  const [hoverLine, setHoverLine] = useState<number|null>(null)
  const [hoverRefs, setHoverRefs] = useState<number[]>([])
  const [goalIsContradiction, setGoalIsContradiction] = useState<boolean>((ex as any).goalMode === 'contradiction')
  const [axOpen, setAxOpen] = useState<{n:1|2|3}|null>(null)
  const [axAlpha, setAxAlpha] = useState('A')
  const [axBeta, setAxBeta] = useState('B')
  const [axGamma, setAxGamma] = useState('C')
  const [semanticsOn, setSemanticsOn] = useState<boolean>(false)
  const [explainLine, setExplainLine] = useState<number|null>(null)
  const exId = ex.id

  const allLines = useMemo(()=>{
    const lines: { idx:number, formula:string, tag:string }[] = []
    // Determinar si son axiomas o premisas según el contexto del ejercicio
    const givenLabel = (ex as any).givenLabel ?? (given.length === 0 ? 'Axioma' : 
      ex.title.includes('Axioma') || ex.title.includes('A1') || ex.title.includes('A2') || ex.title.includes('A3') ? 'Axioma' : 'Premisa')
    given.forEach((g, i)=> lines.push({ idx: i+1, formula: g, tag: givenLabel }))
    steps.forEach((s, j)=> lines.push({ idx: given.length + j + 1, formula: s.formula, tag: justToTag(s.just) }))
    return lines
  }, [given, steps, ex])

  useEffect(()=>{
    // Default contradiction mode per exercise setting, if present
    setGoalIsContradiction((ex as any).goalMode === 'contradiction')
    // Load autosaved steps
    try{
      const raw = localStorage.getItem(`proof:${exId}`)
      if (raw){
        const parsed = JSON.parse(raw) as Step[]
        if (Array.isArray(parsed)) setSteps(parsed)
      }else{
        setSteps([])
      }
      setHistory([]); setFuture([]); setSelected([]); setActiveRule(null)
    }catch{ /* ignore */ }
  }, [exIdx])

  useEffect(()=>{
    try{
      localStorage.setItem(`proof:${exId}` , JSON.stringify(steps))
    }catch{ /* ignore */ }
  }, [exId, steps])

  useEffect(()=>{
    function onKey(e: KeyboardEvent){
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      const isTyping = tag==='input' || tag==='textarea'
      if (isTyping || axOpen || explainLine) return
      // Axioms
      if (e.key==='1' && allowedAxioms.includes(1)){ onPickRule('AX1'); e.preventDefault(); return }
      if (e.key==='2' && allowedAxioms.includes(2)){ onPickRule('AX2'); e.preventDefault(); return }
      if (e.key==='3' && allowedAxioms.includes(3)){ onPickRule('AX3'); e.preventDefault(); return }
      // Rules
      const k = e.key.toLowerCase()
      if (k==='m' && allowedRules.includes('MP')){ onPickRule('MP'); e.preventDefault(); return }
      if (k==='t' && allowedRules.includes('MT')){ onPickRule('MT'); e.preventDefault(); return }
      if (k==='h' && allowedRules.includes('SH')){ onPickRule('SH'); e.preventDefault(); return }
      if (k==='a' && allowedRules.includes('ADJ')){ onPickRule('ADJ'); e.preventDefault(); return }
      if (k==='s' && allowedRules.includes('SIMP')){ onPickRule('SIMP'); e.preventDefault(); return }
      if (k==='d' && allowedRules.includes('SD')){ onPickRule('SD'); e.preventDefault(); return }
      if (k==='enter' && activeRule){ addStep(); e.preventDefault(); return }
      if (k==='escape'){ setActiveRule(null); setSelected([]); e.preventDefault(); return }
      if (k==='z' && (e.ctrlKey||e.metaKey)){ undo(); e.preventDefault(); return }
      if (k==='y' && (e.ctrlKey||e.metaKey)){ redo(); e.preventDefault(); return }
    }
    window.addEventListener('keydown', onKey)
    return ()=> window.removeEventListener('keydown', onKey)
  }, [allowedAxioms, allowedRules, axOpen, explainLine, activeRule, steps])

  function justToTag(j: Just): string {
    switch(j.kind){
      case 'AX': return `A${j.axiom}`
      case 'MP': return `MP ${j.from},${j.impliesFrom}`
      case 'MT': return `MT ${j.imp},${j.not}`
      case 'SH': return `SH ${j.left},${j.right}`
      case 'ADJ': return `ADJ ${j.left},${j.right}`
      case 'SIMP': return `SIMP ${j.from}.${j.pick==='left'?'L':'R'}`
      case 'SD': return `SD ${j.disj},${j.not}`
      case 'IFF': return `↔E ${j.from}.${j.dir==='LtoR'?'→':'←'}`
      default: return '—'
    }
  }

  function display(formula: string): string {
    try{
      if (!formula || formula.trim()==='') return '—'
      const normalized = show(parse(formula))
      if (!ascii) return normalized
      return normalized
        .split('¬').join('~')
        .split('∧').join('^')
        .split('∨').join('v')
        .split('↔').join('<->')
    }catch{
      return formula || '—'
    }
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
      case 'MP': return 'Modus Ponens: seleccioná dos líneas: X y (X→Y)'
      case 'MT': return 'Modus Tollens: seleccioná dos líneas: (X→Y) y ¬Y'
      case 'SH': return 'Silogismo hipotético: seleccioná dos líneas: (X→Y) y (Y→Z)'
      case 'ADJ': return 'Adjunción: seleccioná dos líneas: X y Y'
      case 'SIMP': return 'Simplificación: seleccioná una conjunción X∧Y y elegí lado'
      case 'SD': return 'Silogismo disyuntivo: seleccioná dos líneas: (X∨Y) y ¬X o ¬Y'
      case 'IFF': return '↔ Eliminación: seleccioná una bicondicional X↔Y y elegí dirección'
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
      case 'SH': return [j.left, j.right]
      case 'ADJ': return [j.left, j.right]
      case 'SIMP': return [j.from]
      case 'SD': return [j.disj, j.not]
      case 'IFF': return [j.from]
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
      if (activeRule==='SH'){
        if (selected.length!==2) return { error: 'SH requiere dos líneas' }
        const [i1, i2] = selected
        const F1 = getF(i1)
        const F2 = getF(i2)
        if (F1.kind==='imp' && F2.kind==='imp' && equalF(F1.right, F2.left)){
          return { formula: show({kind:'imp', left: F1.left, right: F2.right}), just: { kind:'SH', left: i1, right: i2 } }
        }
        if (F1.kind==='imp' && F2.kind==='imp' && equalF(F2.right, F1.left)){
          return { formula: show({kind:'imp', left: F2.left, right: F1.right}), just: { kind:'SH', left: i2, right: i1 } }
        }
        return { error: 'Selección inválida para SH' }
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
      if (activeRule==='SD'){
        if (selected.length!==2) return { error: 'SD requiere dos líneas' }
        const [i1, i2] = selected
        const F1 = getF(i1)
        const F2 = getF(i2)
        // (Disj, Neg) or (Neg, Disj)
        if (F1.kind==='or' && F2.kind==='neg'){
          if (equalF(F2.inner, F1.left)) return { formula: show(F1.right), just: { kind:'SD', disj: i1, not: i2 } }
          if (equalF(F2.inner, F1.right)) return { formula: show(F1.left), just: { kind:'SD', disj: i1, not: i2 } }
        }
        if (F2.kind==='or' && F1.kind==='neg'){
          if (equalF(F1.inner, F2.left)) return { formula: show(F2.right), just: { kind:'SD', disj: i2, not: i1 } }
          if (equalF(F1.inner, F2.right)) return { formula: show(F2.left), just: { kind:'SD', disj: i2, not: i1 } }
        }
        return { error: 'Selección inválida para SD' }
      }
      if (activeRule==='IFF'){
        if (selected.length!==1) return { error: '↔ Eliminación requiere una sola bicondicional' }
        const [i1] = selected
        const F1 = getF(i1)
        if (F1.kind!=='iff') return { error: 'La línea seleccionada no es una bicondicional' }
        const imp = iffDir==='LtoR' ? {kind:'imp', left: F1.left, right: F1.right as F} : {kind:'imp', left: F1.right, right: F1.left as F}
        return { formula: show(imp as any), just: { kind:'IFF', from: i1, dir: iffDir } as any }
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

  function detectContradiction(): { ok: true, msg: string } | { ok: false }{
    // Check if any conjunction is of the form X ∧ ¬X, or if both X and ¬X appear across lines.
    const fs: { f:F, idx:number }[] = allLines.map(l=> ({ f: parse(l.formula), idx: l.idx }))
    // Direct X ∧ ¬X
    for (const row of fs){
      const f = row.f
      if (f.kind==='and'){
        if (f.left.kind==='neg' && equalF(f.left.inner, f.right)) return { ok: true, msg: `(línea ${row.idx}: X∧¬X)` }
        if (f.right.kind==='neg' && equalF(f.right.inner, f.left)) return { ok: true, msg: `(línea ${row.idx}: X∧¬X)` }
      }
    }
    // Cross-line X, ¬X
    for (let i=0;i<fs.length;i++){
      for (let j=i+1;j<fs.length;j++){
        const a = fs[i], b = fs[j]
        if (a.f.kind==='neg' && equalF(a.f.inner, b.f)) return { ok: true, msg: `(líneas ${a.idx} y ${b.idx})` }
        if (b.f.kind==='neg' && equalF(b.f.inner, a.f)) return { ok: true, msg: `(líneas ${a.idx} y ${b.idx})` }
      }
    }
    return { ok: false }
  }

  function deleteLast(){
    if (steps.length===0) return
    const snapshot = steps
    const next = snapshot.slice(0, -1)
    setHistory(h => [...h, snapshot])
    setFuture([])
    setSteps(next)
    setMessage('🗑️ Última línea eliminada')
  }

  function copyProof(){
    const lines = allLines.map(l => `${l.idx}. ${display(l.formula)}  [${l.tag}]`).join('\n')
    const header = `Ejercicio: ${ex.title}\nMeta: ${goalIsContradiction? 'Contradicción' : display(goal)}\n\n`
    const text = header + lines
    try{
      navigator.clipboard.writeText(text)
      setMessage('📋 Copiado al portapapeles')
    }catch{
      // Fallback
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setMessage('📋 Copiado (fallback)')
    }
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
    if (contradiction.ok){ setMessage(`✔️ Contradicción derivada ${contradiction.msg}`) }
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
          <label title="Mostrar ayudas semánticas"><input type="checkbox" checked={semanticsOn} onChange={e=>setSemanticsOn(e.target.checked)} /> Semántica</label>
          <button onClick={verify}>Verificar</button>
          <button onClick={undo} disabled={history.length===0}>Deshacer</button>
          <button onClick={redo} disabled={future.length===0}>Rehacer</button>
          <button onClick={()=> deleteLast()} disabled={steps.length===0}>Borrar última</button>
          <button onClick={()=> copyProof()} disabled={allLines.length===0}>Copiar texto</button>
          <button onClick={reset}>Reiniciar</button>
        </header>
        <div className="banner" style={{margin:'8px 0', padding:10}}>{message}</div>
        {(!goalIsContradiction && goal && goal.trim()!=='') && (
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
                   display:'grid', gridTemplateColumns:'40px 1fr 120px', gap:8, padding:'8px 10px', margin:'6px 0',
                   border:'1px solid #e2e8f0', borderRadius:8, boxShadow:'0 1px 2px rgba(0,0,0,.04)',
                   background: (selected.includes(l.idx) ? '#e3f2fd' : (hoverLine===l.idx ? '#fff8e1' : (hoverRefs.includes(l.idx) ? '#e8f5e9' : '#fff'))),
                   outline: hoverRefs.includes(l.idx) ? '2px solid #a5d6a7' : undefined,
                   cursor: activeRule? 'pointer':'default'
                 }}>
              <div style={{opacity:.7}}>{l.idx}.</div>
              <div>{display(l.formula)}</div>
              <div style={{textAlign:'right', opacity:.8}}>
                {l.tag}
                {semanticsOn && l.idx>given.length && (
                  <button
                    onClick={(e)=>{ e.stopPropagation(); setExplainLine(l.idx) }}
                    title="Explicar (verdad-tabla)"
                    style={{marginLeft:8, padding:'2px 6px', fontSize:12}}>∵</button>
                )}
              </div>
            </div>
          ))}
        </div>
        {(activeRule==='SIMP' || activeRule==='IFF') && (
          <div style={{marginTop:8}}>
            {activeRule==='SIMP' && (
              <>
                <label>Proyección: </label>
                <select value={simpPick} onChange={e=>setSimpPick(e.target.value as any)}>
                  <option value='left'>Izquierda</option>
                  <option value='right'>Derecha</option>
                </select>
              </>
            )}
            {activeRule==='IFF' && (
              <>
                <label>Dirección: </label>
                <select value={iffDir} onChange={e=>setIffDir(e.target.value as any)}>
                  <option value='LtoR'>X→Y</option>
                  <option value='RtoL'>Y→X</option>
                </select>
              </>
            )}
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
          {[{rule:'MP', label:'MP'},{rule:'MT', label:'MT'},{rule:'SH', label:'SH'},{rule:'ADJ', label:'ADJ'},{rule:'SIMP', label:'SIMP'},{rule:'SD', label:'SD'},{rule:'IFF', label:'↔E'}].map(({rule,label})=> (
            <button key={rule}
                    disabled={!allowedRules.includes(rule as any)}
                    onClick={()=> onPickRule(rule as Rule)}
                    title={instructionFor(rule as Rule)}
                    style={{padding:'6px 8px', border: activeRule===rule? '2px solid #1976d2':'1px solid #ccc', borderRadius:6, background: activeRule===rule? '#e3f2fd':'#fff', fontSize:11}}>
              {label}
            </button>
          ))}
        </div>
        <h4 style={{marginTop:12}}>Axiomas</h4>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6}}>
          {[1,2,3].map(n=> (
            <button key={n} disabled={!allowedAxioms.includes(n as any)} onClick={()=> onPickRule(('AX'+n) as Rule)} style={{fontSize:11}}>
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
        <div style={{marginTop:12}}>
          <button 
            onClick={()=> setExplainLine(-1)} 
            style={{marginBottom:8, padding:'4px 8px', fontSize:11, cursor:'pointer'}}
            title="Ver definiciones de axioma y teorema"
          >
            📖 Definiciones
          </button>
          <div style={{fontSize:12, opacity:.8}}>
            <div><b>Modus Ponens:</b> X→Y, X ⟹ Y</div>
            <div><b>Modus Tollens:</b> X→Y, ¬Y ⟹ ¬X</div>
            <div><b>Silogismo hipotético:</b> X→Y, Y→Z ⟹ X→Z</div>
            <div><b>Adjunción:</b> X, Y ⟹ X∧Y</div>
            <div><b>Simplificación:</b> X∧Y ⟹ X | Y</div>
            <div><b>Silogismo disyuntivo:</b> X∨Y, ¬X ⟹ Y (o simétrico)</div>
            <div><b>↔ Eliminación:</b> X↔Y ⟹ (X→Y) | (Y→X)</div>
          </div>
        </div>
      </div>
      {explainLine === -1 && (
        <DefinitionsModal onClose={()=> setExplainLine(null)} />
      )}
      {explainLine && explainLine > 0 && (
        <SemanticsModal
          ascii={ascii}
          lineIdx={explainLine}
          getF={getF}
          just={steps[explainLine - given.length - 1]?.just}
          formula={allLines.find(l=>l.idx===explainLine)!.formula}
          onClose={()=> setExplainLine(null)}
        />
      )}
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

function SemanticsModal({ascii, lineIdx, getF, just, formula, onClose}:{
  ascii: boolean,
  lineIdx: number,
  getF: (i:number)=>F,
  just: Just|undefined,
  formula: string,
  onClose: ()=>void,
}){
  function fmt(s: string){
    if (!ascii) return s
    return s.split('¬').join('~').split('∧').join('^').split('∨').join('v').split('↔').join('<->')
  }
  function ruleSchema(j: Just|undefined): { name: string, schema: string }|null{
    if (!j) return null
    switch(j.kind){
      case 'MP': return { name:'Modus Ponens', schema: '(X^ (X->Y)) -> Y' }
      case 'MT': return { name:'Modus Tollens', schema: '((X->Y) ^ ¬Y) -> ¬X' }
      case 'SH': return { name:'Silogismo hipotético', schema: '((X->Y) ^ (Y->Z)) -> (X->Z)' }
      case 'ADJ': return { name:'Adjunción', schema: '(X ^ Y) -> (X ^ Y)' }
      case 'SIMP': return { name:'Simplificación', schema: '(X ^ Y) -> X' }
      case 'SD': return { name:'Silogismo disyuntivo', schema: '((X v Y) ^ ¬X) -> Y' }
      case 'IFF': return { name:'↔ Eliminación', schema: '((X <-> Y) -> (X -> Y))' }
      case 'AX': return { name:`Axioma A${j.axiom}`, schema: 'Instancia de esquema axiomático' }
    }
  }
  const schemaInfo = ruleSchema(just)
  let schemaValid: boolean|undefined
  let schemaTable: ReturnType<typeof truthTable>|undefined
  if (schemaInfo && schemaInfo.schema.includes('->')){
    const f = parse(schemaInfo.schema)
    schemaValid = isTautology(f)
    schemaTable = truthTable([f])
  }

  // Concrete entailment check
  const prem: F[] = []
  if (just){
    if (just.kind==='MP'){ prem.push(getF(just.from)!, getF(just.impliesFrom)!) }
    else if (just.kind==='MT'){ prem.push(getF(just.imp)!, getF(just.not)!) }
    else if (just.kind==='SH'){ prem.push(getF(just.left)!, getF(just.right)!) }
    else if (just.kind==='ADJ'){ prem.push(getF(just.left)!, getF(just.right)!) }
    else if (just.kind==='SIMP'){ prem.push(getF(just.from)!) }
    else if (just.kind==='SD'){ prem.push(getF(just.disj)!, getF(just.not)!) }
  }
  const concl = parse(formula)
  const entail = prem.length>0 ? entails(prem, concl) : { valid: true as const }

  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000}} onClick={onClose}>
      <div style={{background:'#fff', padding:16, borderRadius:8, width:'min(720px, 96vw)', maxHeight:'80vh', overflow:'auto'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <h3 style={{margin:0}}>Explicación semántica — L{lineIdx}</h3>
          <button onClick={onClose}>Cerrar</button>
        </div>
        {schemaInfo && (
          <div style={{marginTop:10}}>
            <div><b>Regla:</b> {schemaInfo.name}</div>
            <div><b>Esquema (tautología):</b> {fmt(schemaInfo.schema)} {typeof schemaValid==='boolean' && (
              <span style={{marginLeft:8, color: schemaValid? '#1b5e20':'#b71c1c'}}>{schemaValid? 'Tautología':'No es tautología'}</span>
            )}</div>
            {schemaTable && (
              <TT table={schemaTable} />
            )}
          </div>
        )}
        <div style={{marginTop:14}}>
          <div><b>Este paso:</b> {prem.length>0 ? '¿Premisas ⊨ Conclusión?' : 'Axioma / línea básica'}</div>
          {prem.length>0 && (
            <div>
              <div style={{marginTop:6}}>
                {entail.valid
                  ? <span style={{color:'#1b5e20'}}>Válido: no hay contramodelo</span>
                  : <span style={{color:'#b71c1c'}}>No válido: contramodelo encontrado</span>}
              </div>
              {!entail.valid && (entail as any).countermodels && (
                <div style={{marginTop:6}}>
                  {(entail as any).countermodels.slice(0,1).map((rho: Record<string, boolean>, i:number)=> (
                    <div key={i} style={{fontFamily:'monospace'}}>• {Object.entries(rho).map(([k,v])=> `${k}:${v?'T':'F'}`).join('  ')}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DefinitionsModal({onClose}:{onClose: ()=>void}){
  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000}} onClick={onClose}>
      <div style={{background:'#fff', padding:16, borderRadius:8, width:'min(720px, 96vw)', maxHeight:'80vh', overflow:'auto'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <h3 style={{margin:0}}>Definiciones — Guía 6</h3>
          <button onClick={onClose}>Cerrar</button>
        </div>
        <div style={{marginTop:12, lineHeight:1.45}}>
          <div style={{marginBottom:16}}>
            <h4 style={{margin:'0 0 8px 0', color:'#1976d2'}}>Axiomas</h4>
            <p style={{margin:'0 0 8px 0'}}>
              Los <strong>axiomas</strong> son principios fundacionales que se aceptan como 
              verdades evidentes sobre algún dominio. Constituyen las premisas básicas 
              de un sistema axiomático.
            </p>
            <p style={{margin:0, opacity:.8, fontSize:13}}>
              <em>Ejemplos:</em> los cinco axiomas de Euclides para la geometría, 
              o los axiomas de Peano para los números naturales.
            </p>
          </div>
          <div style={{marginBottom:16}}>
            <h4 style={{margin:'0 0 8px 0', color:'#1976d2'}}>Teoremas</h4>
            <p style={{margin:'0 0 8px 0'}}>
              Los <strong>teoremas</strong> son otras verdades sobre el dominio que se 
              infieren deductivamente a partir de los axiomas mediante reglas de inferencia. 
              A su vez, estos teoremas pueden tratarse como premisas en nuevos argumentos 
              destinados a deducir válidamente nuevos teoremas.
            </p>
            <p style={{margin:0, opacity:.8, fontSize:13}}>
              <em>Ejemplo:</em> del axioma 3 de Peano se puede deducir el teorema 
              "el cero no tiene antecesor en ℕ".
            </p>
          </div>
          <div>
            <h4 style={{margin:'0 0 8px 0', color:'#1976d2'}}>Reglas de Inferencia</h4>
            <p style={{margin:'0 0 8px 0'}}>
              Las <strong>reglas de inferencia</strong> son patrones válidos de razonamiento 
              deductivo que permiten derivar nuevas conclusiones a partir de premisas conocidas.
            </p>
            <div style={{fontSize:12, fontFamily:'monospace', background:'#f5f5f5', padding:8, borderRadius:4}}>
              <div><strong>Modus Ponens:</strong> X → Y, X ⟹ Y</div>
              <div><strong>Modus Tollens:</strong> X → Y, ¬Y ⟹ ¬X</div>
              <div><strong>Silogismo hipotético:</strong> X → Y, Y → Z ⟹ X → Z</div>
              <div><strong>Adjunción:</strong> X, Y ⟹ X ∧ Y</div>
              <div><strong>Simplificación:</strong> X ∧ Y ⟹ X, Y</div>
              <div><strong>Silogismo disyuntivo:</strong> X ∨ Y, ¬X ⟹ Y</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TT({table}:{table: ReturnType<typeof truthTable>}){
  const { vars, rows } = table
  if (vars.length>6) return <div style={{fontSize:12, opacity:.8}}>Tabla omitida por tamaño (demasiadas variables).</div>
  return (
    <div style={{overflowX:'auto', marginTop:8}}>
      <table style={{borderCollapse:'collapse', fontFamily:'monospace', fontSize:12}}>
        <thead>
          <tr>
            {vars.map(v=> <th key={v} style={{border:'1px solid #ddd', padding:'2px 6px'}}>{v}</th>)}
            <th style={{border:'1px solid #ddd', padding:'2px 6px'}}>φ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r,i)=> (
            <tr key={i}>
              {vars.map(v=> <td key={v} style={{border:'1px solid #eee', textAlign:'center', padding:'2px 6px'}}>{r.valuation[v]?'T':'F'}</td>)}
              <td style={{border:'1px solid #eee', textAlign:'center', padding:'2px 6px'}}>{r.values[0]?'T':'F'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
