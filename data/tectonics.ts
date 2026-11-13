/**
 * Tectonic plates layer.
 *
 * Plate shapes and boundaries come from the PB2002 plate model (Bird, 2003), prepared by
 * scripts/build-geodata.mjs into data/geo/plates.json. This file holds everything that is
 * meant to be edited: names, descriptions, boundary styles and notes.
 */
import type { BoundaryKind, BoundaryType, TectonicPlate } from '@/lib/types';

export const PLATE_LABEL_COLOR = '#6b2f0f';

/**
 * Named plates, keyed by PB2002 code. Plates not listed here (about 40 small microplates)
 * are still drawn and hoverable, as "<name> Plate · microplate".
 * PB2002 splits the classic Indo-Australian Plate into the Indian and Australian plates,
 * and Africa into the Nubian (AF) and Somali (SO) plates.
 */
export const TECTONIC_PLATES: Record<string, TectonicPlate> = {
  PA: { name: 'Pacific Plate', rank: 'Major plate', label: [-150, 12], region: 'Most of the Pacific Ocean floor',
    desc: 'The largest tectonic plate and almost entirely oceanic. Subduction along its edges forms the volcanic and earthquake-prone "Ring of Fire".' },
  NA: { name: 'North American Plate', rank: 'Major plate', label: [-100, 47], region: 'North America, Greenland, western North Atlantic, north-east Siberia',
    desc: 'Carries North America, Greenland and the western half of the North Atlantic. Its eastern edge is the Mid-Atlantic Ridge; its western edge includes the San Andreas Fault.' },
  EU: { name: 'Eurasian Plate', rank: 'Major plate', label: [60, 55], region: 'Europe and most of Asia',
    desc: 'Carries most of Europe and Asia. It collides with the African, Arabian and Indian plates along the Alpine–Himalayan mountain belt.' },
  AF: { name: 'African (Nubian) Plate', rank: 'Major plate', label: [15, 5], region: 'Most of Africa and surrounding ocean floor',
    desc: 'Carries most of Africa and the surrounding sea floor. It is slowly splitting from the Somali Plate along the East African Rift.' },
  SO: { name: 'Somali Plate', rank: 'Minor plate', label: [45, -8], region: 'Eastern Africa and the western Indian Ocean',
    desc: 'The eastern part of Africa, pulling away from the rest of the continent along the East African Rift.' },
  IN: { name: 'Indian Plate', rank: 'Major plate', label: [78, 10], region: 'India and the central Indian Ocean',
    desc: 'Carries the Indian subcontinent. Its northward push into Asia built the Himalaya. Together with the Australian Plate it is traditionally called the Indo-Australian Plate.' },
  AU: { name: 'Australian Plate', rank: 'Major plate', label: [130, -25], region: 'Australia, New Guinea and surrounding ocean',
    desc: 'Carries Australia and much of the eastern Indian Ocean. Together with the Indian Plate it is traditionally called the Indo-Australian Plate.' },
  AN: { name: 'Antarctic Plate', rank: 'Major plate', label: [45, -74], region: 'Antarctica and the Southern Ocean',
    desc: 'Carries Antarctica and the surrounding Southern Ocean floor. It is almost completely ringed by spreading ridges.' },
  SA: { name: 'South American Plate', rank: 'Major plate', label: [-50, -14], region: 'South America and the western South Atlantic',
    desc: 'Carries South America and the western South Atlantic. The Nazca Plate dives beneath its western edge, raising the Andes.' },
  NZ: { name: 'Nazca Plate', rank: 'Minor plate', label: [-93, -19], region: 'South-east Pacific, off South America',
    desc: 'Oceanic plate that is subducting beneath South America along the Peru–Chile Trench.' },
  AR: { name: 'Arabian Plate', rank: 'Minor plate', label: [47, 23], region: 'Arabian Peninsula',
    desc: 'Pulling away from Africa along the Red Sea and pushing into Eurasia, raising the Zagros Mountains.' },
  CO: { name: 'Cocos Plate', rank: 'Minor plate', label: [-97, 8.5], region: 'Eastern Pacific, off Central America',
    desc: 'Small oceanic plate subducting beneath Central America, feeding its chain of volcanoes.' },
  CA: { name: 'Caribbean Plate', rank: 'Minor plate', label: [-74, 15], region: 'Caribbean Sea and Central America',
    desc: 'Small plate between North and South America, bounded by the Lesser Antilles volcanic arc in the east.' },
  PS: { name: 'Philippine Sea Plate', rank: 'Minor plate', label: [133, 17], region: 'Western Pacific, east of the Philippines',
    desc: 'Oceanic plate wedged between the Pacific and Eurasian plates and bordered by deep trenches on both sides.' },
  SU: { name: 'Sunda Plate', rank: 'Minor plate', region: 'South-east Asia: Indochina, Malaysia, Sumatra, Java, Borneo',
    desc: 'Often treated as part of the Eurasian Plate. The Indian and Australian plates subduct beneath its southern edge along the Sunda (Java) Trench.' },
  YA: { name: 'Yangtze Plate', rank: 'Minor plate', region: 'Southern China',
    desc: 'Small block of southern China that moves slightly differently from the rest of Eurasia.' },
  AM: { name: 'Amur Plate', rank: 'Minor plate', region: 'North-east China, Korea, south-west Japan',
    desc: 'Small plate in north-east Asia, often treated as part of the Eurasian Plate.' },
  OK: { name: 'Okhotsk Plate', rank: 'Minor plate', region: 'Kamchatka, Sea of Okhotsk, northern Japan',
    desc: 'Small plate often treated as part of the North American Plate. The Pacific Plate subducts beneath it along the Kuril–Japan Trench.' },
  JF: { name: 'Juan de Fuca Plate', rank: 'Minor plate', region: 'Off the coast of Oregon and Washington',
    desc: 'Small oceanic plate sinking beneath North America along the Cascadia subduction zone.' },
  SC: { name: 'Scotia Plate', rank: 'Minor plate', region: 'Between South America and Antarctica',
    desc: 'Small plate whose edges form the Scotia Arc between Tierra del Fuego and the Antarctic Peninsula.' },
  AT: { name: 'Anatolian Plate', rank: 'Minor plate', region: 'Turkey',
    desc: 'Squeezed westward between the Arabian and Eurasian plates along the North Anatolian Fault.' }
};

/** How each kind of plate boundary is drawn and described. `classes` are PB2002 step classes. */
export const BOUNDARY_TYPES: Record<BoundaryKind, BoundaryType> = {
  divergent:  { label: 'Plate boundary — divergent (ridge / rift)', short: 'spreading ridge or rift', color: '#c2185b', dash: null, classes: ['OSR', 'CRB'],
    desc: 'Divergent boundary: the plates move apart and new crust forms along a spreading ridge or rift valley.' },
  convergent: { label: 'Plate boundary — convergent (collision)', short: 'collision zone', color: '#b45309', dash: null, classes: ['OCB', 'CCB'],
    desc: 'Convergent boundary: the plates push into each other, folding the crust into mountain ranges, with frequent earthquakes.' },
  subduction: { label: 'Plate boundary — subduction zone', short: 'subduction zone', color: '#7f1d1d', dash: null, classes: ['SUB'],
    desc: 'Subduction zone: one plate dives beneath the other, forming a deep trench, a chain of volcanoes and the strongest earthquakes on Earth.' },
  transform:  { label: 'Plate boundary — transform fault', short: 'transform fault', color: '#4d7c0f', dash: '5 3', classes: ['OTF', 'CTF'],
    desc: 'Transform boundary: the plates slide past each other along faults, causing frequent earthquakes.' }
};

/** Names of the PB2002 step classes, shown in tooltips. */
export const BOUNDARY_CLASS_NAMES: Record<string, string> = {
  OSR: 'Oceanic spreading ridge', CRB: 'Continental rift', OTF: 'Oceanic transform fault',
  CTF: 'Continental transform fault', OCB: 'Oceanic convergent boundary', CCB: 'Continental collision', SUB: 'Subduction zone'
};

/** Notes added to the boundary between two plates (key: the two codes in alphabetical order). */
export const BOUNDARY_NOTES: Record<string, string> = {
  'EU-IN': 'The collision of India with Asia raised the Himalaya and the Tibetan Plateau.',
  'EU-NA': 'Includes the Mid-Atlantic Ridge, which rises above sea level in Iceland.',
  'AF-NA': 'Part of the Mid-Atlantic Ridge.',
  'AF-SA': 'The South Atlantic ridge: South America and Africa have been separating here for about 130 million years.',
  'NA-PA': 'Includes the Aleutian Trench and, in California, the San Andreas Fault.',
  'NZ-SA': 'The Peru–Chile Trench: subduction here raised the Andes and causes some of the largest earthquakes ever recorded.',
  'AU-PA': 'Includes the Alpine Fault, which crosses New Zealand.',
  'PA-TO': 'The Tonga Trench, the second-deepest trench on Earth.',
  'MA-PA': 'The Mariana Trench — the deepest point in the oceans, about 10,900 m.',
  'OK-PA': 'The Kuril–Japan Trench, source of the 2011 Tōhoku earthquake and tsunami.',
  'BU-IN': 'The Sunda megathrust, source of the 2004 Indian Ocean earthquake and tsunami.',
  'AU-SU': 'The Java Trench.',
  'AF-SO': 'The East African Rift, where Africa is slowly splitting apart.',
  'AF-AR': 'The Red Sea Rift and the Dead Sea Transform.',
  'AR-EU': 'The Zagros–Makran zone, where Arabia pushes into Asia.',
  'AF-EU': 'The Africa–Eurasia collision: the Alps, the Atlas Mountains and the earthquakes and volcanoes of the Mediterranean.',
  'CO-PA': 'The East Pacific Rise, the fastest-spreading ridge system on Earth.',
  'NZ-PA': 'The East Pacific Rise, the fastest-spreading ridge system on Earth.',
  'AN-PA': 'The Pacific–Antarctic Ridge.',
  'CO-NA': 'The Middle America Trench.',
  'CA-NA': 'The Cayman Trough and the Puerto Rico Trench.',
  'AR-SO': 'The Gulf of Aden ridge.',
  'IN-SO': 'The Carlsberg and Central Indian ridges.',
  'AN-AU': 'The Southeast Indian Ridge.',
  'AN-SO': 'The Southwest Indian Ridge.',
  'JF-NA': 'The Cascadia subduction zone.',
  'AT-EU': 'The North Anatolian Fault.'
};
