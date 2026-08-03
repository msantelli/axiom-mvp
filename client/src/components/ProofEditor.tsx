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
      // show() emite '->' para la implicación; en pantalla va la flecha
      if (!ascii) return normalized.split('->').join('→')
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

  const bannerClase = message.includes('❌') ? 'banner banner-error'
    : (message.includes('✔') ? 'banner banner-ok' : 'banner')

  return (
    <div className="tablero">
      <div>
        <header className="barra">
          <select className="selector-ejercicio" value={exIdx} onChange={e=>{ setExIdx(parseInt(e.target.value)); reset() }}>
            {exercisesData.map((e,i)=> <option key={e.id} value={i}>{e.title}</option>)}
          </select>
          <label className="check"><input type="checkbox" checked={ascii} onChange={e=>setAscii(e.target.checked)} /> ascii</label>
          <label className="check" title="Objetivo: derivar contradicción (p.ej., P∧¬P)"><input type="checkbox" checked={goalIsContradiction} onChange={e=>setGoalIsContradiction(e.target.checked)} /> contradicción</label>
          <label className="check" title="Mostrar ayudas semánticas"><input type="checkbox" checked={semanticsOn} onChange={e=>setSemanticsOn(e.target.checked)} /> semántica</label>
          <button className="boton boton-primario" onClick={verify}>verificar</button>
          <button className="boton" onClick={undo} disabled={history.length===0}>deshacer</button>
          <button className="boton" onClick={redo} disabled={future.length===0}>rehacer</button>
          <button className="boton" onClick={()=> deleteLast()} disabled={steps.length===0}>borrar última</button>
          <button className="boton" onClick={()=> copyProof()} disabled={allLines.length===0}>copiar texto</button>
          <button className="boton" onClick={reset}>reiniciar</button>
        </header>
        <div className={bannerClase} role="status" aria-live="polite">{message}</div>
        {(!goalIsContradiction && goal && goal.trim()!=='') && (
          <div className="meta-fila">
            <span className="meta-etiqueta">meta</span>
            <span className="meta-formula">{display(goal)}</span>
            {ex.hints && ex.hints.length>0 && <span className="meta-pista">· Pista: {ex.hints[0]}</span>}
          </div>
        )}
        <div className="reglas-permitidas">
          reglas permitidas: {allowedRules.join(', ')}{allowedAxioms.length>0 && <> · axiomas: {allowedAxioms.map(a=>'A'+a).join(', ')}</>}
        </div>
        <h3 className="hoja-titulo">Demostración</h3>
        <div className="hoja">
          {allLines.length===0 && (
            <div className="hoja-vacia">Todavía no hay líneas: instanciá un axioma para empezar.</div>
          )}
          {allLines.map(l => (
            <div key={l.idx}
                 onClick={()=> toggleSelect(l.idx)}
                 onMouseEnter={()=>{ setHoverLine(l.idx); setHoverRefs(refsForLine(l.idx)) }}
                 onMouseLeave={()=>{ setHoverLine(null); setHoverRefs([]) }}
                 className={'linea'
                   + (activeRule ? ' linea-clickeable' : '')
                   + (selected.includes(l.idx) ? ' linea-sel' : '')
                   + (hoverRefs.includes(l.idx) ? ' linea-ref' : '')}>
              <div className="linea-num">{l.idx}.</div>
              <div className="linea-formula">{display(l.formula)}</div>
              <div className="linea-tag">
                {l.tag}
                {semanticsOn && l.idx>given.length && (
                  <button
                    className="boton-porque"
                    onClick={(e)=>{ e.stopPropagation(); setExplainLine(l.idx) }}
                    title="Explicar (verdad-tabla)">∵</button>
                )}
              </div>
            </div>
          ))}
        </div>
        {(activeRule==='SIMP' || activeRule==='IFF') && (
          <div className="fila-opciones">
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
        <div className="fila-acciones">
          <button className="boton boton-primario" disabled={!activeRule} onClick={addStep}>agregar línea ({activeRule ?? '—'})</button>
          <button className="boton" onClick={()=>{ setActiveRule(null); setSelected([]); setMessage('Seleccioná una regla')}}>cancelar selección</button>
        </div>
      </div>
      <div className="panel">
        <section>
          <h3 className="panel-titulo">Reglas</h3>
          <div className="grilla-reglas">
            {[{rule:'MP', label:'MP'},{rule:'MT', label:'MT'},{rule:'SH', label:'SH'},{rule:'ADJ', label:'ADJ'},{rule:'SIMP', label:'SIMP'},{rule:'SD', label:'SD'},{rule:'IFF', label:'↔E'}].map(({rule,label})=> (
              <button key={rule}
                      className={'tecla-regla' + (activeRule===rule ? ' tecla-activa' : '')}
                      disabled={!allowedRules.includes(rule as any)}
                      onClick={()=> onPickRule(rule as Rule)}
                      title={instructionFor(rule as Rule)}>
                {label}
              </button>
            ))}
          </div>
        </section>
        <section>
          <h3 className="panel-titulo">Axiomas</h3>
          <div className="grilla-axiomas">
            {[1,2,3].map(n=> (
              <button key={n} className="tecla-regla" disabled={!allowedAxioms.includes(n as any)} onClick={()=> onPickRule(('AX'+n) as Rule)}>
                A{n}
              </button>
            ))}
          </div>
        </section>
        {axOpen && (
          <div className="caja-axioma">
            <div className="caja-axioma-titulo">Instanciar A{axOpen.n}</div>
            <div className="grilla-griegas">
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
            <div className="fila-acciones">
              <button className="boton boton-primario" onClick={() => confirmAxiom(axOpen.n)}>agregar</button>
              <button className="boton" onClick={() => setAxOpen(null)}>cancelar</button>
            </div>
          </div>
        )}
        <section>
          <button
            className="boton"
            onClick={()=> setExplainLine(-1)}
            title="Ver definiciones de axioma y teorema"
            style={{marginBottom:10}}
          >
            definiciones
          </button>
          <div className="chuleta">
            <div><b>Modus Ponens:</b> <span className="esquema">X→Y, X ⟹ Y</span></div>
            <div><b>Modus Tollens:</b> <span className="esquema">X→Y, ¬Y ⟹ ¬X</span></div>
            <div><b>Silogismo hipotético:</b> <span className="esquema">X→Y, Y→Z ⟹ X→Z</span></div>
            <div><b>Adjunción:</b> <span className="esquema">X, Y ⟹ X∧Y</span></div>
            <div><b>Simplificación:</b> <span className="esquema">X∧Y ⟹ X | Y</span></div>
            <div><b>Silogismo disyuntivo:</b> <span className="esquema">X∨Y, ¬X ⟹ Y (o simétrico)</span></div>
            <div><b>↔ Eliminación:</b> <span className="esquema">X↔Y ⟹ (X→Y) | (Y→X)</span></div>
          </div>
        </section>
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
      : text.split('->').join('→')
    return <div className="previsualizacion">{displayed}</div>
  }catch(e:any){
    return <div className="previsualizacion-error">Error: {String(e.message||e)}</div>
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
    // normaliza el esquema con el parser propio (los esquemas son fórmulas
    // válidas); si no parsea (p.ej. texto libre), se muestra tal cual
    let u = s
    try{ u = show(parse(s)) }catch{ /* texto libre */ }
    if (!ascii) return u.split('->').join('→')
    return u.split('¬').join('~').split('∧').join('^').split('∨').join('v').split('↔').join('<->')
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
    <div className="velo" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-encabezado">
          <h3 className="modal-titulo">Explicación semántica — L{lineIdx}</h3>
          <button className="boton" onClick={onClose}>cerrar</button>
        </div>
        <div className="modal-cuerpo">
          {schemaInfo && (
            <div>
              <p><b>Regla:</b> {schemaInfo.name}</p>
              <p><b>Esquema (tautología):</b> <span className="meta-formula">{fmt(schemaInfo.schema)}</span> {typeof schemaValid==='boolean' && (
                <span className={schemaValid ? 'veredicto-ok' : 'veredicto-error'} style={{marginLeft:8}}>{schemaValid? 'Tautología':'No es tautología'}</span>
              )}</p>
              {schemaTable && (
                <TT table={schemaTable} />
              )}
            </div>
          )}
          <div style={{marginTop:14}}>
            <p><b>Este paso:</b> {prem.length>0 ? '¿Premisas ⊨ Conclusión?' : 'Axioma / línea básica'}</p>
            {prem.length>0 && (
              <div>
                <div style={{marginTop:6}}>
                  {entail.valid
                    ? <span className="veredicto-ok">Válido: no hay contramodelo</span>
                    : <span className="veredicto-error">No válido: contramodelo encontrado</span>}
                </div>
                {!entail.valid && (entail as any).countermodels && (
                  <div style={{marginTop:6}}>
                    {(entail as any).countermodels.slice(0,1).map((rho: Record<string, boolean>, i:number)=> (
                      <div key={i} className="contramodelo">• {Object.entries(rho).map(([k,v])=> `${k}:${v?'T':'F'}`).join('  ')}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DefinitionsModal({onClose}:{onClose: ()=>void}){
  return (
    <div className="velo" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-encabezado">
          <h3 className="modal-titulo">Definiciones — Guía 6</h3>
          <button className="boton" onClick={onClose}>cerrar</button>
        </div>
        <div className="modal-cuerpo">
          <div>
            <h4 className="modal-seccion-titulo">Axiomas</h4>
            <p>
              Los <strong>axiomas</strong> son principios fundacionales que se aceptan como
              verdades evidentes sobre algún dominio. Constituyen las premisas básicas
              de un sistema axiomático.
            </p>
            <p className="nota-suave">
              <em>Ejemplos:</em> los cinco axiomas de Euclides para la geometría,
              o los axiomas de Peano para los números naturales.
            </p>
          </div>
          <div>
            <h4 className="modal-seccion-titulo">Teoremas</h4>
            <p>
              Los <strong>teoremas</strong> son otras verdades sobre el dominio que se
              infieren deductivamente a partir de los axiomas mediante reglas de inferencia.
              A su vez, estos teoremas pueden tratarse como premisas en nuevos argumentos
              destinados a deducir válidamente nuevos teoremas.
            </p>
            <p className="nota-suave">
              <em>Ejemplo:</em> del axioma 3 de Peano se puede deducir el teorema
              "el cero no tiene antecesor en ℕ".
            </p>
          </div>
          <div>
            <h4 className="modal-seccion-titulo">Reglas de Inferencia</h4>
            <p>
              Las <strong>reglas de inferencia</strong> son patrones válidos de razonamiento
              deductivo que permiten derivar nuevas conclusiones a partir de premisas conocidas.
            </p>
            <div className="bloque-mono">
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
  if (vars.length>6) return <div className="nota-suave">Tabla omitida por tamaño (demasiadas variables).</div>
  return (
    <div className="tabla-marco">
      <table className="tabla-verdad">
        <thead>
          <tr>
            {vars.map(v=> <th key={v}>{v}</th>)}
            <th>φ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r,i)=> (
            <tr key={i}>
              {vars.map(v=> <td key={v}>{r.valuation[v]?'T':'F'}</td>)}
              <td>{r.values[0]?'T':'F'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
