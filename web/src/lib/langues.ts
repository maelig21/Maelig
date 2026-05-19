/**
 * Langues supportées par DEP — équipes BTP multiculturelles.
 * Liste resserrée sur les langues effectivement parlées sur les chantiers FR :
 *  - Maghreb (arabe, kabyle)
 *  - Sahel et Afrique francophone (wolof, bambara, soninké, fulani)
 *  - Lusophones (portugais)
 *  - Hispanophones (espagnol)
 *  - Europe de l'Est (polonais, roumain, bulgare)
 *  - Turquie (turc)
 *  - Italie (italien)
 *  - Asie (chinois mandarin)
 *  - Pays anglophones
 */
export interface Langue {
  code: string
  name_fr: string
  native: string
  flag: string
  rtl?: boolean
}

export const LANGUES: Langue[] = [
  { code: "fr", name_fr: "Français", native: "Français", flag: "🇫🇷" },
  { code: "ar", name_fr: "Arabe", native: "العربية", flag: "🇲🇦", rtl: true },
  { code: "pt", name_fr: "Portugais", native: "Português", flag: "🇵🇹" },
  { code: "es", name_fr: "Espagnol", native: "Español", flag: "🇪🇸" },
  { code: "it", name_fr: "Italien", native: "Italiano", flag: "🇮🇹" },
  { code: "en", name_fr: "Anglais", native: "English", flag: "🇬🇧" },
  { code: "tr", name_fr: "Turc", native: "Türkçe", flag: "🇹🇷" },
  { code: "pl", name_fr: "Polonais", native: "Polski", flag: "🇵🇱" },
  { code: "ro", name_fr: "Roumain", native: "Română", flag: "🇷🇴" },
  { code: "bg", name_fr: "Bulgare", native: "Български", flag: "🇧🇬" },
  { code: "wo", name_fr: "Wolof", native: "Wolof", flag: "🇸🇳" },
  { code: "bm", name_fr: "Bambara", native: "Bamanankan", flag: "🇲🇱" },
  { code: "ff", name_fr: "Peul", native: "Fulfulde", flag: "🇸🇳" },
  { code: "soninke", name_fr: "Soninké", native: "Sooninke", flag: "🇲🇱" },
  { code: "kab", name_fr: "Kabyle", native: "Taqbaylit", flag: "🇩🇿" },
  { code: "zh", name_fr: "Chinois", native: "中文", flag: "🇨🇳" },
  { code: "de", name_fr: "Allemand", native: "Deutsch", flag: "🇩🇪" },
  { code: "nl", name_fr: "Néerlandais", native: "Nederlands", flag: "🇳🇱" },
  { code: "ru", name_fr: "Russe", native: "Русский", flag: "🇷🇺" },
  { code: "uk", name_fr: "Ukrainien", native: "Українська", flag: "🇺🇦" },
]

export const LANGUES_BY_CODE: Record<string, Langue> = Object.fromEntries(LANGUES.map((l) => [l.code, l]))

export function getLangue(code: string | null | undefined): Langue {
  return LANGUES_BY_CODE[code ?? "fr"] ?? LANGUES_BY_CODE.fr
}
