// Propositional logic core: parser/pretty-printer, axiom matcher, and checker.
// Supports implication (->), negation (¬ or ~), conjunction (∧, ^, &),
// disjunction (∨, v, ||), and biconditional (↔, <->, <=>).
// Variables: uppercase identifiers (including Greek) like A, B, P, Q, α, β...
//
// Grammar (precedence high→low):
//   Formula := Iff
//   Iff := Imp ((↔|<->|<=>) Iff)?
//   Imp := Or ('->' Imp)?
//   Or := And ((∨|v|\|\|) And)*
//   And := Neg ((∧|\^|&) Neg)*
//   Neg := (¬|~) Neg | Atom
//   Atom := Var | '(' Formula ')'

export type F =
  | { kind: 'var', name: string }
  | { kind: 'imp', left: F, right: F }
  | { kind: 'neg', inner: F }
  | { kind: 'and', left: F, right: F }
  | { kind: 'or', left: F, right: F }
  | { kind: 'iff', left: F, right: F };

export function parse(input: string): F {
  const s = input.replace(/\s+/g,'')
  let i = 0
  function peek(n=0){ return s[i+n] }
  function eat(c?: string){ if (c && s[i]!==c) throw new Error(`Esperaba '${c}' en pos ${i}`); return s[i++] }
  function parseFormula(): F { return parseIff() }
  function parseIff(): F {
    let left = parseImp()
    if (s.slice(i, i+3)==='<->'){ i+=3; const right = parseIff(); return {kind:'iff', left, right} }
    if (s.slice(i, i+3)==='<=>'){ i+=3; const right = parseIff(); return {kind:'iff', left, right} }
    if (peek()==='↔'){ eat(); const right = parseIff(); return {kind:'iff', left, right} }
    return left
  }
  function parseImp(): F {
    let left = parseOr()
    if (s.slice(i, i+2) === '->') { i+=2; const right = parseImp(); return {kind:'imp', left, right} }
    return left
  }
  function parseOr(): F {
    let left = parseAnd()
    while (true){
      if (peek()==='∨'){ eat(); const right = parseAnd(); left = {kind:'or', left, right}; continue }
      if (peek()==='v'){ eat(); const right = parseAnd(); left = {kind:'or', left, right}; continue }
      if (s.slice(i, i+2)==='||'){ i+=2; const right = parseAnd(); left = {kind:'or', left, right}; continue }
      break
    }
    return left
  }
  function parseAnd(): F {
    let left = parseNeg()
    while (true){
      if (peek()==='∧'){ eat(); const right = parseNeg(); left = {kind:'and', left, right}; continue }
      if (peek()==='^'){ eat(); const right = parseNeg(); left = {kind:'and', left, right}; continue }
      if (peek()==='&'){ eat(); const right = parseNeg(); left = {kind:'and', left, right}; continue }
      break
    }
    return left
  }
  function parseNeg(): F {
    if (peek()==='¬' || peek()==='~'){ eat(); return {kind:'neg', inner: parseNeg()} }
    return parseAtom()
  }
  function parseAtom(): F {
    if (peek()==='('){ eat('('); const f = parseFormula(); eat(')'); return f }
    // Accept Latin uppercase first char (A..Z) and Greek letters; tail excludes lowercase Latin to avoid merging 'A v B' -> 'AvB'
    const m = /^[A-Z\u03B1-\u03C9][A-Z0-9_\u03B1-\u03C9]*/.exec(s.slice(i))
    if (!m) throw new Error(`Variable inválida en pos ${i}`)
    i += m[0].length
    return {kind:'var', name:m[0]}
  }
  const f = parseFormula()
  if (i!==s.length) throw new Error(`Entrada extra a partir de pos ${i}`)
  return f
}

function prec(f: F): number {
  switch (f.kind){
    case 'var': return 5
    case 'neg': return 4
    case 'and': return 3
    case 'or': return 2
    case 'imp': return 1
    case 'iff': return 0
  }
}

export function show(f: F): string {
  function render(node: F, parentPrec: number): string {
    switch (node.kind){
      case 'var': return node.name
      case 'neg': {
        const inner = render(node.inner, prec(node))
        const wrap = prec(node.inner) < prec(node)
        return '¬' + (wrap ? '('+inner+')' : inner)
      }
      case 'and': {
        const L = render(node.left, prec(node))
        const R = render(node.right, prec(node)-1)
        const s = `${L}∧${R}`
        return prec(node) < parentPrec ? `(${s})` : s
      }
      case 'or': {
        const L = render(node.left, prec(node))
        const R = render(node.right, prec(node)-1)
        const s = `${L}∨${R}`
        return prec(node) < parentPrec ? `(${s})` : s
      }
      case 'imp': {
        const L = render(node.left, prec(node))
        const R = render(node.right, prec(node)-1)
        const s = `${L}->${R}`
        return prec(node) < parentPrec ? `(${s})` : s
      }
      case 'iff': {
        const L = render(node.left, prec(node))
        const R = render(node.right, prec(node)-1)
        const s = `${L}↔${R}`
        return prec(node) < parentPrec ? `(${s})` : s
      }
    }
  }
  return render(f, -1)
}

// Axiom schemas (Hilbert):
// A1: α -> (β -> α)
// A2: (α -> (β -> γ)) -> ((α -> β) -> (α -> γ))
// A3: (¬β -> ¬α) -> ((¬β -> α) -> β)
export const AXIOMS = {
  1: parse("α->(β->α)"),
  2: parse("(α->(β->γ))->((α->β)->(α->γ))"),
  3: parse("(¬β->¬α)->((¬β->α)->β)")
} as const;

// Metavariables are lowercase greek letters (α,β,γ,...). We'll treat them as 'var' nodes with greek names.
function isMetaVar(name: string): boolean {
  return /[α-ω]/i.test(name)
}

export type Subst = Record<string, F>

export function matchSchema(schema: F, target: F, subst: Subst = {}): Subst | null {
  if (schema.kind === 'var' && isMetaVar(schema.name)) {
    const was = subst[schema.name]
    if (!was) { subst[schema.name] = target; return subst }
    // must be structurally equal
    return equalF(was, target) ? subst : null
  }
  if (schema.kind !== target.kind) return null
  switch (schema.kind){
    case 'var': return schema.name===(target as any).name ? subst : null
    case 'neg': return matchSchema(schema.inner, (target as any).inner, subst)
    case 'imp': {
      const s1 = matchSchema(schema.left, (target as any).left, subst); if (!s1) return null
      return matchSchema(schema.right, (target as any).right, s1)
    }
    case 'and': {
      const s1 = matchSchema(schema.left, (target as any).left, subst); if (!s1) return null
      return matchSchema(schema.right, (target as any).right, s1)
    }
    case 'or': {
      const s1 = matchSchema(schema.left, (target as any).left, subst); if (!s1) return null
      return matchSchema(schema.right, (target as any).right, s1)
    }
    case 'iff': {
      const s1 = matchSchema(schema.left, (target as any).left, subst); if (!s1) return null
      return matchSchema(schema.right, (target as any).right, s1)
    }
  }
}

export function instantiate(schema: F, subst: Subst): F {
  if (schema.kind==='var' && isMetaVar(schema.name)){
    const v = subst[schema.name]
    if (!v) throw new Error(`Falta instanciación para ${schema.name}`)
    return v
  }
  switch (schema.kind){
    case 'var': return { kind:'var', name: schema.name }
    case 'neg': return { kind:'neg', inner: instantiate(schema.inner, subst) }
    case 'imp': return { kind:'imp', left: instantiate(schema.left, subst), right: instantiate(schema.right, subst) }
    case 'and': return { kind:'and', left: instantiate(schema.left, subst), right: instantiate(schema.right, subst) }
    case 'or': return { kind:'or', left: instantiate(schema.left, subst), right: instantiate(schema.right, subst) }
    case 'iff': return { kind:'iff', left: instantiate(schema.left, subst), right: instantiate(schema.right, subst) }
  }
}

export function equalF(a: F, b: F): boolean {
  if (a.kind!==b.kind) return false
  switch (a.kind){
    case 'var': return a.name=== (b as any).name
    case 'neg': return equalF(a.inner, (b as any).inner)
    case 'imp': return equalF(a.left, (b as any).left) && equalF(a.right, (b as any).right)
    case 'and': return equalF(a.left, (b as any).left) && equalF(a.right, (b as any).right)
    case 'or': return equalF(a.left, (b as any).left) && equalF(a.right, (b as any).right)
    case 'iff': return equalF(a.left, (b as any).left) && equalF(a.right, (b as any).right)
  }
}

export type Just =
  | { kind: 'AX', axiom: 1|2|3 }
  | { kind: 'MP', from: number, impliesFrom: number }
  | { kind: 'MT', imp: number, not: number }
  | { kind: 'HS', left: number, right: number }
  | { kind: 'ADJ', left: number, right: number }
  | { kind: 'SIMP', from: number, pick: 'left'|'right' }
  | { kind: 'DS', disj: number, not: number }
  | { kind: 'IFF', from: number, dir: 'LtoR'|'RtoL' }

export type Step = { line: number, formula: string, just: Just }
export type CheckResult = { ok: boolean, errors: { line: number, msg: string }[] }

export function checkProof(steps: Step[], goal: string, given: string[] = []): CheckResult {
  const givenParsed = given.map(parse)
  const parsed: F[] = [...givenParsed]
  const errors: {line:number,msg:string}[] = []

  function getFormulaAt(line: number): F | null {
    if (line<=0 || line>parsed.length) return null
    return parsed[line-1]
  }

  for (let s of steps){
    try{
      const f = parse(s.formula)
      if (s.just.kind==='AX'){
        const schema = AXIOMS[s.just.axiom]
        const m = matchSchema(schema, f, {})
        if (!m) { errors.push({line: s.line, msg: `No es instancia del axioma A${s.just.axiom}`}); parsed.push(f); continue }
      }else if (s.just.kind==='MP'){
        const a = getFormulaAt(s.just.from)
        const imp = getFormulaAt(s.just.impliesFrom)
        if (!a || !imp){ errors.push({line:s.line, msg:"Referencias de líneas inválidas"}); parsed.push(f); continue }
        if (imp.kind!=='imp'){ errors.push({line:s.line, msg:`La línea ${s.just.impliesFrom} no es una implicación`}); parsed.push(f); continue }
        if (!equalF(a, (imp as any).left)){ errors.push({line:s.line, msg:`El antecedente no coincide con la línea ${s.just.from}`}); parsed.push(f); continue }
        const rhs = (imp as any).right
        if (!equalF(rhs, f)){ errors.push({line:s.line, msg:`La conclusión no coincide; debería ser ${show(rhs)}`}); parsed.push(f); continue }
      }else if (s.just.kind==='MT'){
        const imp = getFormulaAt(s.just.imp)
        const n = getFormulaAt(s.just.not)
        if (!imp || !n){ errors.push({line:s.line, msg:"Referencias de líneas inválidas"}); parsed.push(f); continue }
        if (imp.kind!=='imp'){ errors.push({line:s.line, msg:`La línea ${s.just.imp} no es una implicación`}); parsed.push(f); continue }
        if (n.kind!=='neg'){ errors.push({line:s.line, msg:`La línea ${s.just.not} no es una negación`}); parsed.push(f); continue }
        if (!equalF(imp.right, n.inner)){ errors.push({line:s.line, msg:`No coincide ¬Y con el consecuente de X->Y`}); parsed.push(f); continue }
        const expect: F = { kind:'neg', inner: imp.left }
        if (!equalF(expect, f)){ errors.push({line:s.line, msg:`La conclusión debería ser ${show(expect)}`}); parsed.push(f); continue }
      }else if (s.just.kind==='HS'){
        const l = getFormulaAt(s.just.left)
        const r = getFormulaAt(s.just.right)
        if (!l || !r){ errors.push({line:s.line, msg:"Referencias de líneas inválidas"}); parsed.push(f); continue }
        if (l.kind!=='imp' || r.kind!=='imp'){ errors.push({line:s.line, msg:`Se requieren dos implicaciones`}); parsed.push(f); continue }
        if (!equalF(l.right, r.left)){ errors.push({line:s.line, msg:`Las implicaciones no encadenan (Y no coincide)`}); parsed.push(f); continue }
        const expect: F = { kind:'imp', left: l.left, right: r.right }
        if (!equalF(expect, f)){ errors.push({line:s.line, msg:`La conclusión debería ser ${show(expect)}`}); parsed.push(f); continue }
      }else if (s.just.kind==='ADJ'){
        const l = getFormulaAt(s.just.left)
        const r = getFormulaAt(s.just.right)
        if (!l || !r){ errors.push({line:s.line, msg:"Referencias de líneas inválidas"}); parsed.push(f); continue }
        const expect: F = { kind:'and', left: l, right: r }
        if (!equalF(expect, f)){ errors.push({line:s.line, msg:`La conclusión debería ser ${show(expect)}`}); parsed.push(f); continue }
      }else if (s.just.kind==='SIMP'){
        const c = getFormulaAt(s.just.from)
        if (!c){ errors.push({line:s.line, msg:"Referencia de línea inválida"}); parsed.push(f); continue }
        if (c.kind!=='and'){ errors.push({line:s.line, msg:`La línea ${s.just.from} no es una conjunción`}); parsed.push(f); continue }
        const expect = s.just.pick==='left' ? c.left : c.right
        if (!equalF(expect, f)){ errors.push({line:s.line, msg:`La conclusión debería ser ${show(expect)}`}); parsed.push(f); continue }
      }else if (s.just.kind==='DS'){
        const disj = getFormulaAt(s.just.disj)
        const n = getFormulaAt(s.just.not)
        if (!disj || !n){ errors.push({line:s.line, msg:"Referencias de líneas inválidas"}); parsed.push(f); continue }
        if (disj.kind!=='or'){ errors.push({line:s.line, msg:`La línea ${s.just.disj} no es una disyunción`}); parsed.push(f); continue }
        if (n.kind!=='neg'){ errors.push({line:s.line, msg:`La línea ${s.just.not} no es una negación`}); parsed.push(f); continue }
        if (equalF(n.inner, disj.left)){
          if (!equalF(f, disj.right)){ errors.push({line:s.line, msg:`La conclusión debería ser ${show(disj.right)}`}); parsed.push(f); continue }
        }else if (equalF(n.inner, disj.right)){
          if (!equalF(f, disj.left)){ errors.push({line:s.line, msg:`La conclusión debería ser ${show(disj.left)}`}); parsed.push(f); continue }
        }else{
          errors.push({line:s.line, msg:`La negación no coincide con ningún disyunto`}); parsed.push(f); continue
        }
      }else if (s.just.kind==='IFF'){
        const bic = getFormulaAt(s.just.from)
        if (!bic){ errors.push({line:s.line, msg:"Referencia de línea inválida"}); parsed.push(f); continue }
        if (bic.kind!=='iff'){ errors.push({line:s.line, msg:`La línea ${s.just.from} no es una bicondicional`}); parsed.push(f); continue }
        const expect: F = s.just.dir==='LtoR'
          ? { kind:'imp', left: bic.left, right: bic.right }
          : { kind:'imp', left: bic.right, right: bic.left }
        if (!equalF(expect, f)){
          errors.push({line:s.line, msg:`La conclusión debería ser ${show(expect)}`}); parsed.push(f); continue
        }
      }
      parsed.push(f)
    }catch(e:any){
      errors.push({line:s.line, msg:e.message})
      parsed.push({kind:'var', name:'ERR'} as any)
    }
  }

  // Final goal check
  try{
    const g = parse(goal)
    const last = parsed[parsed.length-1]
    if (!last || !equalF(last, g)) errors.push({line: steps.length, msg:`La última línea no coincide con la meta ${goal}`})
  }catch{ /* ignore */ }

  return { ok: errors.length===0, errors }
}
