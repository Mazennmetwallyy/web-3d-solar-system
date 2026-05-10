

const API_BASE = 'php/api.php';

const STATIC_PLANETS = [
  {
    id: 1, name: 'Sun', type: 'Star',
    radius_km: 696340, distance_au: 0, orbital_period: 0, rotation_hours: 609.12,
    color_hex: '#FDB813', atmosphere: false, atmosphere_color: null,
    num_moons: 0, has_rings: false, tilt_deg: 7.25, surface_temp_c: 5500,
    description: 'The Sun is the star at the centre of our Solar System. It is a nearly perfect sphere of hot plasma, generating energy via nuclear fusion of hydrogen into helium at its core.',
    fun_fact: 'The Sun accounts for 99.86% of the total mass of the Solar System.'
  },
  {
    id: 2, name: 'Mercury', type: 'Terrestrial',
    radius_km: 2439.7, distance_au: 0.39, orbital_period: 87.97, rotation_hours: 1407.6,
    color_hex: '#B5B5B5', atmosphere: false, atmosphere_color: null,
    num_moons: 0, has_rings: false, tilt_deg: 0.034, surface_temp_c: 167,
    description: 'Mercury is the smallest planet and the closest to the Sun. Its surface is heavily cratered, resembling our Moon, and it has no atmosphere to retain heat.',
    fun_fact: 'A day on Mercury lasts longer than its year — 176 Earth days vs 88 Earth days for its orbit.'
  },
  {
    id: 3, name: 'Venus', type: 'Terrestrial',
    radius_km: 6051.8, distance_au: 0.72, orbital_period: 224.7, rotation_hours: -5832,
    color_hex: '#E8C56C', atmosphere: true, atmosphere_color: '#E8D5A0',
    num_moons: 0, has_rings: false, tilt_deg: 177.4, surface_temp_c: 465,
    description: 'Venus is the hottest planet in the Solar System, with surface temperatures reaching 465 °C. Its thick atmosphere of CO₂ creates an extreme greenhouse effect.',
    fun_fact: 'Venus rotates backwards compared to most planets, so the Sun rises in the west and sets in the east.'
  },
  {
    id: 4, name: 'Earth', type: 'Terrestrial',
    radius_km: 6371, distance_au: 1.0, orbital_period: 365.25, rotation_hours: 23.93,
    color_hex: '#2E86AB', atmosphere: true, atmosphere_color: '#4AACFF',
    num_moons: 1, has_rings: false, tilt_deg: 23.44, surface_temp_c: 15,
    description: 'Earth is the only known planet to harbour life. It has liquid water on its surface, a protective magnetic field, and an atmosphere rich in nitrogen and oxygen.',
    fun_fact: 'Earth is the densest planet in the Solar System and the largest of the four terrestrial planets.'
  },
  {
    id: 5, name: 'Mars', type: 'Terrestrial',
    radius_km: 3389.5, distance_au: 1.52, orbital_period: 686.97, rotation_hours: 24.62,
    color_hex: '#C1440E', atmosphere: true, atmosphere_color: '#FFAA66',
    num_moons: 2, has_rings: false, tilt_deg: 25.19, surface_temp_c: -65,
    description: 'Mars is known as the Red Planet due to iron oxide on its surface. It hosts Olympus Mons, the tallest volcano in the Solar System, and Valles Marineris, a vast canyon system.',
    fun_fact: 'Mars has the largest dust storms in the Solar System, which can engulf the entire planet for months.'
  },
  {
    id: 6, name: 'Jupiter', type: 'Gas Giant',
    radius_km: 69911, distance_au: 5.2, orbital_period: 4332.59, rotation_hours: 9.93,
    color_hex: '#C88B3A', atmosphere: true, atmosphere_color: '#D4AA7D',
    num_moons: 95, has_rings: false, tilt_deg: 3.13, surface_temp_c: -110,
    description: "Jupiter is the largest planet in the Solar System — more than twice as massive as all other planets combined. Its Great Red Spot is a storm that has raged for over 350 years.",
    fun_fact: "Jupiter's magnetic field is 20,000 times stronger than Earth's and extends millions of kilometres into space."
  },
  {
    id: 7, name: 'Saturn', type: 'Gas Giant',
    radius_km: 58232, distance_au: 9.58, orbital_period: 10759.22, rotation_hours: 10.7,
    color_hex: '#E8D191', atmosphere: true, atmosphere_color: '#E8D5B0',
    num_moons: 146, has_rings: true, tilt_deg: 26.73, surface_temp_c: -140,
    description: 'Saturn is famous for its spectacular ring system, composed mainly of ice and rock. It is the least dense planet — less dense than water — and could theoretically float in a giant ocean.',
    fun_fact: "Saturn's rings span up to 282,000 km in diameter but are only about 20 metres thick on average."
  },
  {
    id: 8, name: 'Uranus', type: 'Ice Giant',
    radius_km: 25362, distance_au: 19.22, orbital_period: 30688.5, rotation_hours: -17.24,
    color_hex: '#7DE8E8', atmosphere: true, atmosphere_color: '#A0F0F0',
    num_moons: 28, has_rings: true, tilt_deg: 97.77, surface_temp_c: -195,
    description: 'Uranus is an ice giant that rotates on its side, with an axial tilt of 97.77°. This extreme tilt means its poles experience 42 years of continuous sunlight followed by 42 years of darkness.',
    fun_fact: 'Uranus was the first planet discovered with a telescope, found by William Herschel in 1781.'
  },
  {
    id: 9, name: 'Neptune', type: 'Ice Giant',
    radius_km: 24622, distance_au: 30.05, orbital_period: 60182, rotation_hours: 16.11,
    color_hex: '#4B70DD', atmosphere: true, atmosphere_color: '#6080FF',
    num_moons: 16, has_rings: false, tilt_deg: 28.32, surface_temp_c: -200,
    description: 'Neptune is the most distant planet and has the strongest winds in the Solar System, reaching speeds of 2,100 km/h. Its moon Triton orbits backwards and is slowly spiralling inward.',
    fun_fact: 'Neptune was predicted mathematically before it was ever observed — its position was calculated from perturbations in Uranus\'s orbit.'
  },
];

function fetchWithTimeout(url, ms = 2500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal })
    .finally(() => clearTimeout(timer));
}

export async function fetchPlanets() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}?action=planets`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.status === 'ok') return json.data;
    throw new Error(json.message);
  } catch (err) {
    console.warn('api unavailable, using fallback data:', err.message);
    return STATIC_PLANETS;
  }
}

export async function fetchPlanet(name) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}?action=planet&name=${encodeURIComponent(name)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.status === 'ok') return json.data;
    throw new Error(json.message);
  } catch (err) {
    console.warn(`[api.js] Falling back to static data for "${name}":`, err.message);
    return STATIC_PLANETS.find(p => p.name.toLowerCase() === name.toLowerCase()) ?? null;
  }
}

export function fmt(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('en-GB');
}
