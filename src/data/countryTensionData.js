export const countryTensionData = [
  { id: "RUS", name: "Russia",        score: 78, commodities: ["CRUDE", "GAS", "WHEAT"],    region: "Europe"   },
  { id: "IRN", name: "Iran",          score: 82, commodities: ["CRUDE"],                     region: "Mid East" },
  { id: "ISR", name: "Israel",        score: 74, commodities: ["CRUDE"],                     region: "Mid East" },
  { id: "SAU", name: "Saudi Arabia",  score: 45, commodities: ["CRUDE"],                     region: "Mid East" },
  { id: "CHN", name: "China",         score: 61, commodities: ["COPPER", "COAL", "GOLD"],    region: "Asia Pac" },
  { id: "PAK", name: "Pakistan",      score: 69, commodities: ["WHEAT"],                     region: "Asia Pac" },
  { id: "USA", name: "United States", score: 42, commodities: ["GOLD", "DXY"],               region: "Americas" },
  { id: "UKR", name: "Ukraine",       score: 71, commodities: ["WHEAT"],                     region: "Europe"   },
  { id: "ARE", name: "UAE",           score: 28, commodities: ["GOLD"],                      region: "Mid East" },
  { id: "IDN", name: "Indonesia",     score: 33, commodities: ["COAL", "PALM OIL"],          region: "Asia Pac" },
];

const countryNameToISO = {
  'russia': 'RUS',
  'iran': 'IRN',
  'israel': 'ISR',
  'saudi arabia': 'SAU',
  'china': 'CHN',
  'pakistan': 'PAK',
  'united states': 'USA',
  'united states of america': 'USA',
  'ukraine': 'UKR',
  'uae': 'ARE',
  'united arab emirates': 'ARE',
  'indonesia': 'IDN',
  // Additional countries for sectorCountryMap
  'united kingdom': 'GBR',
  'great britain': 'GBR',
  'germany': 'DEU',
  'japan': 'JPN',
  'australia': 'AUS',
  'south korea': 'KOR',
  'republic of korea': 'KOR',
  'brazil': 'BRA',
  'turkey': 'TUR',
  'türkiye': 'TUR',
  'canada': 'CAN',
};

export function getTensionByISO(iso) {
  return countryTensionData.find(c => c.id === iso) || null;
}

export function getTensionByName(name) {
  if (!name) return null;
  const normalized = name.trim().toLowerCase();
  const iso = countryNameToISO[normalized];
  return iso ? getTensionByISO(iso) : null;
}

export function getISOByName(name) {
  if (!name) return null;
  return countryNameToISO[name.trim().toLowerCase()] || null;
}

export function getTensionColor(score) {
  if (score > 65) return "#e05c5c";
  if (score > 35) return "#e09a3c";
  return "#3a7d44";
}
