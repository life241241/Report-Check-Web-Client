export interface Fine {
  number?: string
  amount?: number
  price_display?: string
  date?: string
  time?: string
  location?: string
  comments?: string
}

export interface MunicipalityResult {
  name: string
  status: 'clean' | 'fine' | 'failed'
  count?: number
  amount?: string
  person_name?: string
  fines?: Fine[]
  error?: string
  payment_url?: string
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

// ─── Geolocation helper (silent — only if already permitted) ───
let _cachedGeo: { latitude: number; longitude: number } | null = null

export function getUserLocation(): Promise<{ latitude: number; longitude: number } | null> {
  if (_cachedGeo) return Promise.resolve(_cachedGeo)
  if (!navigator.geolocation || !navigator.permissions) return Promise.resolve(null)
  return navigator.permissions.query({ name: 'geolocation' }).then(perm => {
    if (perm.state !== 'granted') return null          // don't prompt — only use if already allowed
    return new Promise<{ latitude: number; longitude: number } | null>(resolve => {
      navigator.geolocation.getCurrentPosition(
        pos => {
          _cachedGeo = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
          resolve(_cachedGeo)
        },
        () => resolve(null),
        { timeout: 3000, maximumAge: 300_000 },
      )
    })
  }).catch(() => null)
}

export interface MunicipalityInfo {
  name: string
  id: string
  initials: string
  color: string
}

export async function fetchMunicipalities(): Promise<MunicipalityInfo[]> {
  const res = await fetch(`${BASE}/municipalities`)
  if (!res.ok) throw new Error(`שגיאת שרת ${res.status}`)
  const data = await res.json()
  return data.municipalities
}

export async function checkFines(idNumber: string, carNumber: string): Promise<CheckResponse> {
  const geo = await getUserLocation()
  const res = await fetch(`${BASE}/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id_number: idNumber.trim(),
      car_number: carNumber.trim(),
      ...(geo && { latitude: geo.latitude, longitude: geo.longitude }),
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? `שגיאת שרת ${res.status}`)
  }
  return res.json() as Promise<CheckResponse>
}

export async function checkFinesStream(
  idNumber: string,
  carNumber: string,
  onResult: (result: MunicipalityResult) => void,
  onDone: (summary: CheckResponse['summary']) => void,
): Promise<void> {
  const geo = await getUserLocation()
  const res = await fetch(`${BASE}/check-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id_number: idNumber.trim(),
      car_number: carNumber.trim(),
      ...(geo && { latitude: geo.latitude, longitude: geo.longitude }),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? `שגיאת שרת ${res.status}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))
          if (data.type === 'result') {
            onResult(data.result)
          } else if (data.type === 'done') {
            onDone(data.summary)
          }
        } catch { /* ignore parse errors */ }
      }
    }
  }
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

/**
 * Fetch municipality images from Hebrew Wikipedia in a single batch request.
 * Returns a map of municipality name -> thumbnail URL.
 */
export async function fetchMunicipalityImages(names: string[]): Promise<Record<string, string>> {
  // Hardcoded overrides for municipalities with better/specific logos
  const overrides: Record<string, string> = {
    'עיריית הרצליה': 'https://www.herzliya.muni.il/content/images/logo_he_if.png',
    'עיריית רמת גן': 'https://forms.ramat-gan.muni.il/content/images/wide-logo.png',
    'עיריית ערד': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTab2VSREY1MOVhSE1Bm9Pi0YC-EJ5vROFL9A&s',
    'מועצה אזורית גוש עציון': 'https://upload.wikimedia.org/wikipedia/he/9/91/%D7%9E%D7%95%D7%A2%D7%A6%D7%94_%D7%90%D7%96%D7%95%D7%A8%D7%99%D7%AA_%D7%92%D7%95%D7%A9_%D7%A2%D7%A6%D7%99%D7%95%D7%9F.jpg',
    'עיריית גני תקווה': 'https://www.ganeytikva.org.il/content/images/logo2020.png?v=1a',
    'מ.מ. מזכרת בתיה': 'https://mazkeret-batya.muni.il/wp-content/uploads/2024/01/Capture.png',
    'מ.א עמק יזרעאל': 'https://www.emekyizrael.org.il/content/images/logo.png',
    'עיריית שדרות': 'https://sderot.muni.gov.il/media/wablgxsq/logo.png',
  }

  // Start with overrides
  const result: Record<string, string> = {}
  const wikiNames: string[] = []
  for (const name of names) {
    if (overrides[name]) {
      result[name] = overrides[name]
    } else {
      wikiNames.push(name)
    }
  }

  // Fetch the rest from Wikipedia
  if (wikiNames.length === 0) return result

  const stripPrefix = (n: string) =>
    n.replace(/^(עיריית |מועצה מקומית |מועצה אזורית |מ\.א\.? |מ\.מ\.? |רשות )/, '')

  const nameToSearch: Record<string, string> = {}
  for (const name of wikiNames) {
    nameToSearch[name] = stripPrefix(name)
  }

  const searchTerms = Object.values(nameToSearch)
  const titles = searchTerms.map(t => encodeURIComponent(t)).join('|')

  try {
    const url = `https://he.wikipedia.org/w/api.php?action=query&titles=${titles}&prop=pageimages&format=json&pithumbsize=200&origin=*`
    const res = await fetch(url)
    if (!res.ok) return result
    const data = await res.json()
    const pages = data?.query?.pages ?? {}

    // Build a reverse map: search term -> original municipality name
    const searchToName: Record<string, string> = {}
    for (const [name, search] of Object.entries(nameToSearch)) {
      searchToName[search] = name
    }

    for (const page of Object.values(pages) as Array<{ title?: string; thumbnail?: { source?: string } }>) {
      if (page.thumbnail?.source) {
        // Find which municipality this page matches
        const matchedName = searchToName[page.title ?? '']
        if (matchedName) {
          result[matchedName] = page.thumbnail.source
        }
      }
    }
  } catch { /* silently fail — we'll just show initials as fallback */ }

  return result
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
