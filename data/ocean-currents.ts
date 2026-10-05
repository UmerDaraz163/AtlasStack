/** Ocean currents layer: major warm and cold surface currents. */
import type { CurrentTemp, OceanCurrent } from '@/lib/types';

/** Ocean currents: waypoints are [lon, lat] in flow direction; `anchor` (and optional `labelIndex`, the waypoint to label) position the label. */
export const CURRENT_STYLE: Record<CurrentTemp, { label: string; color: string }> = {
  warm: { label: 'Warm ocean current', color: '#e8590c' },
  cold: { label: 'Cold ocean current', color: '#1c7ed6' }
};
export const OCEAN_CURRENTS: OceanCurrent[] = [
  { name: 'Gulf Stream', temp: 'warm', region: 'North Atlantic · Florida to Newfoundland', anchor: 'start',
    points: [[-80, 25], [-79.5, 27], [-78, 32], [-74, 36], [-65, 39], [-52, 42], [-45, 44]],
    desc: 'Fast, warm current carrying tropical water up the east coast of North America and out across the Atlantic. It warms the eastern seaboard and, through the North Atlantic Drift, north-western Europe.' },
  { name: 'North Atlantic Drift', temp: 'warm', region: 'North Atlantic · toward the British Isles and Norway', anchor: 'end',
    points: [[-42, 45], [-30, 49], [-18, 54], [-8, 60], [3, 65], [10, 69]],
    desc: 'North-eastward extension of the Gulf Stream. It keeps the British Isles and Norway far milder than other places at the same latitude and keeps Norwegian ports ice-free.' },
  { name: 'Kuroshio Current', temp: 'warm', region: 'North-west Pacific · Taiwan to Japan', anchor: 'start',
    points: [[124, 21], [126, 26], [131, 30], [136, 32.5], [142, 35], [152, 37]],
    desc: 'The Pacific counterpart of the Gulf Stream. It carries warm water north past Taiwan and Japan, warming southern Japan; rich fishing grounds form where it meets the cold Oyashio.' },
  { name: 'Brazil Current', temp: 'warm', region: 'South-west Atlantic · coast of Brazil', anchor: 'start',
    points: [[-34, -9], [-37, -17], [-40, -24], [-46, -30], [-51, -37]],
    desc: 'Warm current flowing south along the coast of Brazil, bringing warm, humid conditions to the shore.' },
  { name: 'Agulhas Current', temp: 'warm', region: 'South-west Indian Ocean · south-east Africa', anchor: 'start',
    points: [[42, -16], [38, -22], [35, -27], [30, -32], [24, -36], [19, -38]],
    desc: 'One of the strongest currents in the world, flowing down the south-east coast of Africa. It brings warmth and rainfall to Mozambique and eastern South Africa.' },
  { name: 'East Australian Current', temp: 'warm', region: 'South-west Pacific · eastern Australia', anchor: 'start',
    points: [[155, -17], [155, -24], [154.5, -30], [152, -36], [150, -41]],
    desc: 'Carries warm Coral Sea water south along eastern Australia, warming the coast as far as Tasmania.' },
  { name: 'California Current', temp: 'cold', region: 'North-east Pacific · west coast of North America', anchor: 'end',
    points: [[-128, 47], [-127, 41], [-124, 35], [-119, 29], [-114, 22]],
    desc: 'Cold current flowing south along the west coast of North America. It cools the coast, produces summer fog, keeps rainfall low and, through upwelling, supports rich fisheries.' },
  { name: 'Humboldt (Peru) Current', temp: 'cold', region: 'South-east Pacific · Chile and Peru', anchor: 'end',
    points: [[-77, -43], [-75, -34], [-73, -25], [-75, -17], [-80, -9], [-84, -3]],
    desc: 'Cold, nutrient-rich current flowing north along Chile and Peru. Upwelling feeds one of the most productive fisheries on Earth, and the cool, stable air helps create the Atacama Desert.' },
  { name: 'Canary Current', temp: 'cold', region: 'North-east Atlantic · north-west Africa', anchor: 'end',
    points: [[-12, 38], [-13, 32], [-17, 26], [-19.5, 20], [-21, 14]],
    desc: 'Cold current flowing south-west past Portugal and north-west Africa. It cools the Canary Islands and the Moroccan coast and reinforces the dryness of the western Sahara.' },
  { name: 'Benguela Current', temp: 'cold', region: 'South-east Atlantic · south-west Africa', anchor: 'end',
    points: [[16, -34], [13, -28], [11, -22], [9, -15], [6, -8]],
    desc: 'Cold current flowing north along south-west Africa. Upwelling sustains rich fisheries, while the cool, dry air contributes to the Namib Desert and its coastal fogs.' },
  { name: 'Labrador Current', temp: 'cold', region: 'North-west Atlantic · Labrador and Newfoundland', anchor: 'start',
    points: [[-60, 62], [-58, 57], [-53, 52], [-50, 47], [-52, 43]],
    desc: 'Cold current flowing south from the Arctic. It carries icebergs into shipping lanes and creates dense fog where it meets the Gulf Stream off Newfoundland.' },
  { name: 'Oyashio Current', temp: 'cold', region: 'North-west Pacific · Kamchatka to northern Japan', anchor: 'start',
    points: [[165, 56], [160, 50], [153, 46], [148, 42], [144, 38.5]],
    desc: 'Cold subarctic current flowing south-west past Kamchatka and the Kuril Islands. Its nutrient-rich water meets the Kuroshio east of Japan, creating a very productive fishing ground.' },
  { name: 'West Australian Current', temp: 'cold', region: 'South-east Indian Ocean · western Australia', anchor: 'end',
    points: [[108, -38], [108, -31], [107, -25], [104, -19], [98, -14]],
    desc: 'Cool current flowing north off the west coast of Australia; associated with the dry climate of Western Australia.' },
  { name: 'Antarctic Circumpolar Current', temp: 'cold', region: 'Southern Ocean · circles Antarctica near 50°–60°S', anchor: 'middle', labelIndex: 5,
    points: [[-170, -58], [-120, -60], [-70, -59], [-20, -53], [40, -50], [100, -52], [165, -57]],
    desc: 'Cold current driven eastward around Antarctica by the westerlies. The largest current on Earth, it links the Atlantic, Pacific and Indian Oceans and keeps Antarctica thermally isolated.' }
];
