// Minimal propositional logic parser/pretty-printer and axiom matcher for (->) and (¬).
// Variables: uppercase identifiers like A, B, P, Q, R... plus parentheses.
// Grammar:
//   Formula := Imp
//   Imp := Neg ('->' Imp)?
//   Neg := '¬' Neg | Atom
//   Atom := Var | '(' Formula ')'
//
// Tree nodes: { kind: 'var'|'imp'|'neg', name?, left?, right?, inner? }
export type F =
  | { kind: 'var', name: string }
  | { kind: 'imp', left: F, right: F }
  | { kind: 'neg', inner: F };

export function parse(input: string): F {
  const s = input.replace(/\s+/g,'')
  let i = 0
  function peek(n=0){ return s[i+n] }
  function eat(c?: string){ if (c && s[i]!==c) throw new Error(`Esperaba '${c}' en pos ${i}`); return s[i++] }
  function parseFormula(): F { return parseImp() }
  function parseImp(): F {
    let left = parseNeg()
    if (s.slice(i, i+2) === '->') { i+=2; const right = parseImp(); return {kind:'imp', left, right} }
    return left
  }
  function parseNeg(): F {
    if (peek()==='¬'){ eat(); return {kind:'neg', inner: parseNeg()} }
    return parseAtom()
  }
  function parseAtom(): F {
    if (peek()==='('){ eat('('); const f = parseFormula(); eat(')'); return f }
    const m = /^[A-Z\u03B1-\u03C9][A-Za-z0-9_\u03B1-\u03C9]*/.exec(s.slice(i))
    if (!m) throw new Error(`Variable inválida en pos ${i}`)
    i += m[0].length
    return {kind:'var', name:m[0]}
  }
  const f = parseFormula()
  if (i!==s.length) throw new Error(`Entrada extra a partir de pos ${i}`)
  return f
}

export function show(f: F): string {
  switch (f.kind){
    case 'var': return f.name
    case 'neg': {
      const inner = f.inner.kind==='var' ? show(f.inner) : '('+show(f.inner)+')'
      return '¬'+inner
    }
    case 'imp': {
      const L = f.left.kind==='var' || f.left.kind==='neg' ? show(f.left) : '('+show(f.left)+')'
      const R = show(f.right)
      return `${L}->${R}`
    }
  }
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
  }
}

export function equalF(a: F, b: F): boolean {
  if (a.kind!==b.kind) return false
  switch (a.kind){
    case 'var': return a.name=== (b as any).name
    case 'neg': return equalF(a.inner, (b as any).inner)
    case 'imp': return equalF(a.left, (b as any).left) && equalF(a.right, (b as any).right)
  }
}

export type Just =
  | { kind: 'AX', axiom: 1|2|3 }
  | { kind: 'MP', from: number, impliesFrom: number }

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
      let ok = false
      if (s.just.kind==='AX'){
        const schema = AXIOMS[s.just.axiom]
        const m = matchSchema(schema, f, {})
        ok = !!m
        if (!ok) {
          errors.push({line: s.line, msg: `No es instancia del axioma A${s.just.axiom}`})
          parsed.push(f)
          continue
        }
      }else if (s.just.kind==='MP'){
        const a = getFormulaAt(s.just.from)
        const imp = getFormulaAt(s.just.impliesFrom)
        if (!a || !imp){ errors.push({line:s.line, msg:"Referencias de líneas inválidas"}); parsed.push(f); continue }
        if (imp.kind!=='imp'){ errors.push({line:s.line, msg:`La línea ${s.just.impliesFrom} no es una implicación`}); parsed.push(f); continue }
        if (!equalF(a, (imp as any).left)){ errors.push({line:s.line, msg:`El antecedente no coincide con la línea ${s.just.from}`}); parsed.push(f); continue }
        const rhs = (imp as any).right
        if (!equalF(rhs, f)){ errors.push({line:s.line, msg:`La conclusión no coincide; debería ser ${show(rhs)}`}); parsed.push(f); continue }
        ok = true
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