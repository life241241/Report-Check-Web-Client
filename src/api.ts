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

export interface VehicleInfo {
  found: boolean
  car_number?: number
  manufacturer?: string
  model?: string
  model_code?: string
  trim?: string
  year?: number
  color?: string
  fuel?: string
  ownership?: string
  engine?: string
  last_test?: string
  test_expiry?: string
  on_road_since?: string
  front_tire?: string
  rear_tire?: string
  chassis?: string
}

export async function fetchVehicleInfo(carNumber: string): Promise<VehicleInfo> {
  const num = carNumber.trim()
  const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=053cea08-09bc-40ec-8f7a-156f0677aff3&filters={"mispar_rechev":${num}}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`שגיאת שרת ${res.status}`)
  const data = await res.json()
  if (!data.success || !data.result?.records?.length) {
    throw new Error('רכב לא נמצא במאגר')
  }
  const rec = data.result.records[0]
  return {
    found: true,
    car_number: rec.mispar_rechev,
    manufacturer: rec.tozeret_nm,
    model: rec.kinuy_mishari,
    model_code: rec.degem_nm,
    trim: rec.ramat_gimur,
    year: rec.shnat_yitzur,
    color: rec.tzeva_rechev,
    fuel: rec.sug_delek_nm,
    ownership: rec.baalut,
    engine: rec.degem_manoa,
    last_test: rec.mivchan_acharon_dt,
    test_expiry: rec.tokef_dt,
    on_road_since: rec.moed_aliya_lakvish,
    front_tire: rec.zmig_kidmi,
    rear_tire: rec.zmig_ahori,
    chassis: rec.misgeret,
  }
}
