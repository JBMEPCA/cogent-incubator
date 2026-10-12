// Brand types: the broad groups the advertiser list is browsed by.
//
// Researchers wrote free-text categories, about 1,700 different labels across
// the fleet ("Gym management software", "Rural solicitors", "Turf nutrition and
// protection"). Nobody can browse that, so each label is folded into one of a
// dozen groups by keyword. Order matters: the first group whose pattern matches
// wins, so the specific groups come before the broad ones ("accounting
// software" is software, not accountancy; "baggage handling systems" falls
// through to equipment).
//
// No imports: shared by the page and any script.

export const BRAND_TYPES = [
  { key: "franchise", label: "Franchise brands", re: /franchis/ },
  {
    key: "software",
    label: "Software & tech",
    re: /software|\bapps?\b|platform|saas|\bcrm\b|\berp\b|\bit\b|\bit services|cyber|\bai\b|digital|technolog|\btech\b|ag-?tech|telematics|biometric|wi-?fi|connectivity|telecom|telephony|voip|website|\bweb\b|hosting|broadband|mobile|\bdata\b|booking|\bpos\b|\bepos\b|point of sale|resident (app|engagement)|online|ecommerce|e-commerce|workflow|automation|project management|collaboration|scheduling|member experience|retention|tracking|kiosk|queue|passenger|air traffic|dash ?cam|scanner|virtual assistant|lead generation/,
  },
  { key: "insurance", label: "Insurance", re: /insur|indemn|warranty/ },
  {
    key: "finance",
    label: "Finance & banking",
    re: /bank|financ|lend|invest|payment|card|\bfx\b|foreign exchange|currency|invoice|funding|pension|wealth|mortgage|capital|r&d|grant|accounts payable|credit|fuel cards?|expense|spend management|cash-?flow|earned wage|membership plan|dental plan|barter/,
  },
  { key: "legal", label: "Legal & accountancy", re: /\blaw\b|lawyer|legal|solicit|accountan|accounting|\btax\b|audit|bookkeep/ },
  {
    key: "people",
    label: "Recruitment, HR & training",
    re: /recruit|training|academ|\bcpd\b|educat|apprentic|qualification|\bhr\b|payroll|employee|wellbeing|executive search|staff|locum|people|learning|workforce|\bdbs\b|outsourced reception/,
  },
  {
    key: "energy",
    label: "Energy & sustainability",
    re: /energy|renewabl|solar|\bev\b|charg|utilit|carbon|natural capital|sustainab|\bsaf\b|biogas|anaerobic|water retail|environment|emissions|forestry|woodland/,
  },
  {
    key: "marketing",
    label: "Marketing, media & sales",
    re: /marketing|\bpr\b|media|agency|advertis|signage|\bprint|photograph|loyalty|brand(ing)?\b|video|display|promotion|\bsales\b|merchandis|market research|exhibition stand|music and av|music licensing|books/,
  },
  {
    key: "vehicle-parts",
    label: "Vehicle parts & accessories",
    re: /(vehicle|\bvans?\b|truck|trailer|motor|\bauto|fleet|\bcars?\b)[^,]*\b(parts|accessor|component)|components supplier|tyre|wheels?\b|lubricant|\boils?\b|\bengines?\b|transmission|racking|conversion|body ?builder|bodies|tail ?lift|refrigerat|livery|lights|sidebar|tipper|towbar|windscreen|\bdpf\b|adblue/,
  },
  {
    key: "vehicles",
    label: "Vehicles, leasing & transport",
    re: /vehicle|\bcars?\b|fleet|truck|\bvans?\b|trailer|tyre|leasing|rental|\bfuel|parking|ground transport|logistic|courier|parcel|haulage|haulier|freight|golf cars?|buggies|\batvs?\b|tipper|body ?builder|remarketing|auction|breakdown|pallet|lubricant|\bengines?\b|transmission|minibus|tachograph|mileage|windscreen|refrigeration unit|\bdpf\b|tolls/,
  },
  {
    key: "property",
    label: "Property, design & construction",
    re: /architect|design|construct|contractor|build|fit-?out|interior|landscap|planning|property|valuer|surveyor|land agent|land promot|flooring|\blifts?\b|bathroom|bathing|modular|drainage|cost and project|project and cost|engineering|premises|canop|estate|bridge|artificial grass|\bpaint|virtual office|move management|downsizing/,
  },
  {
    key: "facilities",
    label: "Facilities & services",
    re: /clean|facilit|waste|hygien|laundry|catering|\bfood\b|beverage|dining|pest|maintenance|repair|ground handling|security services|lounge|concession|retail|hospitality|servicing|washroom|restoration|fire safety|key management/,
  },
  {
    key: "health",
    label: "Health, wellbeing & activities",
    re: /telecare|(?<!clipper |hair |skin |beard |lawn |turf )\bcare\b|health|wellness|clinical|laborator|\blabs?\b|\bvets?\b|veterinar|animal health|nurse|implant|orthodont|aligner|\boral\b|aesthetic|infection|decontaminat|medical|diagnostic|fall detection|assistive|emergency response|enrichment|classes|programm|exercise|music for fitness|on-demand|body composition|heart-rate|testing|sunbed|tanning|red light|recovery|\bsend\b|sensory|speech|hair loss|scalp|first aid|injury|indoor cycling|fitness racing|events|arts and crafts/,
  },
  {
    key: "consultancy",
    label: "Consultancy & advice",
    re: /consult|advis|coach|professional services|business services|broker|valuation|m&a|strategy|company formation|patent|trade mark|translation|business sale|exit|procurement|purchasing|buying group|business travel|workspace|management company/,
  },
  {
    key: "equipment",
    label: "Equipment & supplies",
    re: /equipment|machiner|suppl|product|consumabl|material|tool|clipper|scissor|razor|dryer|electrical|waxing|furniture|imaging|manufactur|seed|feed|fertil|crop|nutrition|turf|irrigation|groom|merchandise|apparel|uniform|workwear|resource|toy|play|locker|sauna|vending|system|baggage|security|screening|lighting|\bgse\b|component|parts|wholesal|distribut|\bkit\b|instrument|hardware|livestock|dairy|fenc|handling|grain|drying|storage|bunker|\bsands?\b|brush|comb|upholster|textile|wall protection|finishes|synthetic green|mini golf|simulator|loupe|microscope|skincare|beard|\bcapes?\b|lake|pond|water|de-icing|fire and rescue|drone|counter-uas|navaids|weather|packaging|breeding|genetic|artwork|access control|wildlife|wayfinding|agronom|soil|weighing|workshop|accessor/,
  },
];

export const OTHER = { key: "other", label: "Other" };

const byKey = new Map([...BRAND_TYPES, OTHER].map((t) => [t.key, t]));

/** The brand type for a free-text category. Always returns one. */
export function brandType(category) {
  const c = String(category || "").toLowerCase();
  if (!c) return OTHER;
  return BRAND_TYPES.find((t) => t.re.test(c)) || OTHER;
}

export const brandTypeLabel = (key) => byKey.get(key)?.label || OTHER.label;
export const isBrandType = (key) => byKey.has(key);
