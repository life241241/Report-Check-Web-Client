export interface Fine {
  number?: string
  amount?: number
  price_display?: string
  date?: string
  time?: string
}

export interface MunicipalityResult {
  name: string
  status: 'clean' | 'fine' | 'failed'
  count?: number
  amount?: string
  person_name?: string
  fines?: Fine[]
  error?: string
}

export interface CheckResponse {
  results: MunicipalityResult[]
  summary: {
    clean: number
    fine: number
    failed: number
  }
}

const BASE = import.meta.env.VITE_API_URL ?? ''

export async function checkFines(idNumber: string, carNumber: string): Promise<CheckResponse> {
  const res = await fetch(`${BASE}/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_number: idNumber.trim(), car_number: carNumber.trim() }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? `שגיאת שרת ${res.status}`)
  }
  return res.json() as Promise<CheckResponse>
}
