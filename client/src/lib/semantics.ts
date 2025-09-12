import type { F } from './logic'

export function collectVars(f: F, acc: Set<string> = new Set()): string[] {
  switch (f.kind){
    case 'var': acc.add(f.name); break
    case 'neg': collectVars(f.inner, acc); break
    case 'imp': collectVars(f.left, acc); collectVars(f.right, acc); break
    case 'and': collectVars(f.left, acc); collectVars(f.right, acc); break
    case 'or': collectVars(f.left, acc); collectVars(f.right, acc); break
    case 'iff': collectVars(f.left, acc); collectVars(f.right, acc); break
  }
  return Array.from(acc)
}

export function evaluate(f: F, v: Record<string, boolean>): boolean {
  switch (f.kind){
    case 'var': return !!v[f.name]
    case 'neg': return !evaluate(f.inner, v)
    case 'and': return evaluate(f.left, v) && evaluate(f.right, v)
    case 'or': return evaluate(f.left, v) || evaluate(f.right, v)
    case 'imp': return (!evaluate(f.left, v)) || evaluate(f.right, v)
    case 'iff': return evaluate(f.left, v) === evaluate(f.right, v)
  }
}

function enumerate(vals: string[]): Record<string, boolean>[] {
  const n = vals.length
  const out: Record<string, boolean>[] = []
  const total = 1 << n
  for (let mask=0; mask<total; mask++){
    const row: Record<string, boolean> = {}
    for (let i=0;i<n;i++) row[vals[i]] = ((mask >> (n-1-i)) & 1) === 1
    out.push(row)
  }
  return out
}

export function isTautology(f: F): boolean {
  const vars = collectVars(f)
  if (vars.length>10) return false // guard against explosion
  for (const rho of enumerate(vars)){
    if (!evaluate(f, rho)) return false
  }
  return true
}

export function entails(prem: F[], concl: F): { valid: true } | { valid: false, countermodels: Array<Record<string, boolean>> } {
  const vs = new Set<string>()
  prem.forEach(p => collectVars(p, vs as any))
  collectVars(concl, vs as any)
  const vars = Array.from(vs)
  const cms: Array<Record<string, boolean>> = []
  if (vars.length>12){
    // sample a few valuations to avoid worst-case blowup
    for (let mask=0; mask<4096; mask++){
      const row: Record<string, boolean> = {}
      for (let i=0;i<vars.length;i++) row[vars[i]] = ((mask >> (i%12)) & 1)===1
      if (prem.every(p=> evaluate(p,row)) && !evaluate(concl,row)) cms.push(row)
      if (cms.length>=3) break
    }
  }else{
    for (const row of enumerate(vars)){
      if (prem.every(p=> evaluate(p,row)) && !evaluate(concl,row)) cms.push(row)
      if (cms.length>=3) break
    }
  }
  return cms.length===0 ? { valid: true } : { valid: false, countermodels: cms }
}

export function truthTable(formulas: F[]): { vars: string[], rows: { valuation: Record<string, boolean>, values: boolean[] }[] } {
  const vs = new Set<string>()
  formulas.forEach(f => collectVars(f, vs as any))
  const vars = Array.from(vs).sort()
  const rows = enumerate(vars).map(val => ({ valuation: val, values: formulas.map(f=> evaluate(f,val)) }))
  return { vars, rows }
}

