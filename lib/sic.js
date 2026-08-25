/**
 * SIC code → readable industry label.
 *
 * Apollo gives a SIC code and no industry name, and "7992" is not something a
 * segment builder, an ad-sales conversation or a merge tag can use. The code
 * stays stored as the machine handle; this is the human half of the same fact.
 *
 * Two levels, most specific first:
 *   SPECIFIC  four-digit codes that carry real weight in our verticals, where
 *             the major group is too coarse to be worth having — "Golf Courses"
 *             rather than "Amusement & Recreation", "Airport Services" rather
 *             than "Air Transportation".
 *   MAJOR     the standard two-digit SIC major groups, which cover everything
 *             else. Coarse but never wrong, and always populated.
 *
 * A contact whose SIC is blank gets "" rather than "Unknown": an empty merge
 * field is obviously missing, whereas "Unknown" reads like a finding.
 */

// Four-digit overrides. Only where the extra precision earns its place.
const SPECIFIC = {
  // golf and resorts
  "7992": "Golf Courses",
  "7997": "Membership Sports & Recreation Clubs",
  "7011": "Hotels & Resorts",
  "7999": "Recreation Services",
  "6552": "Land Subdivision & Development",
  // airports and aviation
  "4512": "Airlines — Scheduled Air Transport",
  "4581": "Airport Services & Terminals",
  "4522": "Air Transport — Non-scheduled",
  "3721": "Aircraft Manufacturing",
  "3728": "Aircraft Parts & Equipment",
  "4724": "Travel Agencies",
  "4725": "Tour Operators",
  // fleet, freight and logistics
  "4731": "Freight Forwarding & Logistics",
  "4213": "Trucking — Long Distance",
  "4212": "Trucking — Local",
  "4225": "Warehousing & Storage",
  "4011": "Railroads",
  "4111": "Local & Suburban Transit",
  "4119": "Passenger Transport",
  "4131": "Intercity Bus Transport",
  "4214": "Trucking with Storage",
  "4215": "Courier Services",
  "4311": "Postal Service",
  "4412": "Deep Sea Freight Transport",
  "4491": "Marine Cargo Handling",
  "4953": "Waste Management",
  "5511": "Motor Vehicle Dealers",
  "7359": "Equipment Rental & Leasing",
  "7513": "Truck Rental & Leasing",
  "7514": "Car Rental",
  "3711": "Motor Vehicle Manufacturing",
  "3713": "Truck & Bus Body Manufacturing",
  "3731": "Shipbuilding & Repair",
};

// The standard two-digit SIC major groups.
const MAJOR = {
  "01": "Agricultural Production — Crops",
  "02": "Agricultural Production — Livestock",
  "07": "Agricultural Services",
  "08": "Forestry",
  "09": "Fishing, Hunting & Trapping",
  "10": "Metal Mining",
  "12": "Coal Mining",
  "13": "Oil & Gas Extraction",
  "14": "Nonmetallic Minerals Mining",
  "15": "Building Construction",
  "16": "Heavy Construction",
  "17": "Specialty Trade Contractors",
  "20": "Food & Kindred Products",
  "21": "Tobacco Products",
  "22": "Textile Mill Products",
  "23": "Apparel & Textile Products",
  "24": "Lumber & Wood Products",
  "25": "Furniture & Fixtures",
  "26": "Paper & Allied Products",
  "27": "Printing & Publishing",
  "28": "Chemicals & Allied Products",
  "29": "Petroleum & Coal Products",
  "30": "Rubber & Plastics",
  "31": "Leather Products",
  "32": "Stone, Clay & Glass Products",
  "33": "Primary Metal Industries",
  "34": "Fabricated Metal Products",
  "35": "Industrial & Commercial Machinery",
  "36": "Electronic & Electrical Equipment",
  "37": "Transportation Equipment",
  "38": "Instruments & Related Products",
  "39": "Miscellaneous Manufacturing",
  "40": "Railroad Transportation",
  "41": "Passenger Transit",
  "42": "Motor Freight & Warehousing",
  "43": "Postal Service",
  "44": "Water Transportation",
  "45": "Air Transportation",
  "46": "Pipelines",
  "47": "Transportation Services",
  "48": "Communications",
  "49": "Utilities & Sanitary Services",
  "50": "Wholesale Trade — Durable Goods",
  "51": "Wholesale Trade — Nondurable Goods",
  "52": "Building Materials & Garden Supply",
  "53": "General Merchandise Stores",
  "54": "Food Stores",
  "55": "Automotive Dealers & Service Stations",
  "56": "Apparel & Accessory Stores",
  "57": "Furniture & Home Furnishings Stores",
  "58": "Restaurants & Bars",
  "59": "Miscellaneous Retail",
  "60": "Banking",
  "61": "Non-depository Credit Institutions",
  "62": "Securities & Commodity Brokers",
  "63": "Insurance Carriers",
  "64": "Insurance Agents & Brokers",
  "65": "Real Estate",
  "67": "Holding & Investment Offices",
  "70": "Hotels & Lodging",
  "72": "Personal Services",
  "73": "Business Services",
  "75": "Automotive Repair & Services",
  "76": "Miscellaneous Repair Services",
  "78": "Motion Pictures",
  "79": "Amusement & Recreation Services",
  "80": "Health Services",
  "81": "Legal Services",
  "82": "Educational Services",
  "83": "Social Services",
  "84": "Museums & Galleries",
  "86": "Membership Organisations",
  "87": "Engineering, Accounting & Management",
  "88": "Private Households",
  "89": "Miscellaneous Services",
  "91": "Executive & Legislative Government",
  "92": "Justice, Public Order & Safety",
  "93": "Public Finance",
  "94": "Administration of Human Resources",
  "95": "Environmental Quality & Housing",
  "96": "Administration of Economic Programs",
  "97": "National Security & International Affairs",
  "99": "Non-classifiable Establishments",
};

/**
 * The industry for a stored `sic` value.
 *
 * The field holds whatever Apollo supplied, which is often several codes
 * ("6512, 7011, 7997, 6531") and occasionally padded or short.
 *
 * The order Apollo lists them in is NOT significance order, so taking the first
 * is wrong: Monte Rei Golf & Country Club leads with 6512 and came out of the
 * first import labelled "Real Estate". A code with a SPECIFIC mapping is one we
 * decided matters to these titles, so any of those beats a generic major group
 * regardless of position — which picks the golf club out of that same list.
 * Only when nothing specific matches does the first code's major group stand.
 */
export function industryFromSic(sic) {
  const codes = String(sic ?? "")
    .split(",")
    .map((c) => c.trim().replace(/\D/g, ""))
    .filter(Boolean)
    // Three-digit codes are a leading zero lost to a spreadsheet.
    .map((c) => (c.length === 3 ? `0${c}` : c));

  if (!codes.length) return "";
  const specific = codes.find((c) => SPECIFIC[c]);
  if (specific) return SPECIFIC[specific];
  return MAJOR[codes[0].slice(0, 2)] ?? "";
}
