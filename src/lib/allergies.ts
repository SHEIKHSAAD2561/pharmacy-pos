/**
 * Simple allergy screening. A medicine is flagged when one of the patient's
 * recorded allergies (or a known member of that drug class) appears in its
 * brand or generic name. This is a safety prompt for the pharmacist, not a
 * clinical decision system — professional judgement always applies.
 */
const DRUG_CLASSES: Record<string, string[]> = {
  penicillin: ["penicillin", "amoxicillin", "ampicillin", "augmentin", "amoxil", "flucloxacillin", "cloxacillin", "piperacillin", "clavulan"],
  cephalosporin: ["cef", "ceph"],
  sulfa: ["sulfa", "sulfamethoxazole", "sulfasalazine", "co-trimoxazole", "trimethoprim/sulfa", "septrin", "bactrim"],
  sulfonamide: ["sulfa", "sulfamethoxazole", "sulfasalazine", "co-trimoxazole"],
  aspirin: ["aspirin", "acetylsalicylic"],
  nsaid: ["ibuprofen", "diclofenac", "naproxen", "aspirin", "acetylsalicylic", "ketoprofen", "mefenamic", "celecoxib", "brufen", "voltaren"],
  macrolide: ["azithromycin", "clarithromycin", "erythromycin", "zithromax"],
  quinolone: ["ciprofloxacin", "levofloxacin", "moxifloxacin", "ofloxacin", "ciprobay"],
  tetracycline: ["tetracycline", "doxycycline", "minocycline"],
  codeine: ["codeine"],
  opioid: ["codeine", "tramadol", "morphine", "oxycodone", "fentanyl"],
  statin: ["atorvastatin", "simvastatin", "rosuvastatin", "pravastatin", "lipitor"],
  paracetamol: ["paracetamol", "acetaminophen", "panadol", "calpol"],
  acetaminophen: ["paracetamol", "acetaminophen", "panadol", "calpol"],
  iodine: ["iodine", "povidone"],
  latex: ["latex"],
};

export function allergyWarnings(
  allergies: string | null | undefined,
  items: { name: string; genericName?: string | null }[],
): string[] {
  const terms = (allergies ?? "")
    .split(/[,;\n]/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 3);
  if (!terms.length) return [];
  const warnings: string[] = [];
  for (const item of items) {
    const haystack = `${item.name} ${item.genericName ?? ""}`.toLowerCase();
    for (const term of terms) {
      const key = term.replace(/s$/, "").replace(/ allergy$/, "");
      const related = DRUG_CLASSES[key] ?? DRUG_CLASSES[term] ?? [];
      if ([term, ...related].some((needle) => haystack.includes(needle))) {
        warnings.push(`${item.name} may conflict with the patient's recorded allergy: ${term}`);
      }
    }
  }
  return [...new Set(warnings)];
}
