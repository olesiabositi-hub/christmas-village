export type District = { id: string; name: string; p: [number, number, number]; objects: string[] };

export const DISTRICTS: District[] = [
  { id: "nw", name: "Рудольф-штрассе", p: [-12, 0.6, -6], objects: ["Department of Magic tower", "rune rings", "small snowy houses", "pine trees"] },
  { id: "n", name: "Озеро Бэклог", p: [-2, 0.6, -13], objects: ["frozen lake", "Santa's Executive Office castle", "smoking chimney"] },
  { id: "ne", name: "Лес Легаси", p: [12, 0.6, -9], objects: ["pine forest", "QA Gift factory conveyor", "tall towers"] },
  { id: "w", name: "Снежная горка", p: [-14, 0.6, 5], objects: ["reindeer barn", "Reindeer Engineering hangar", "hay", "sleigh runway"] },
  { id: "e", name: "Пало-Холодно", p: [11, 0.6, 9], objects: ["ElfOps command center", "candy radar", "gingerbread elf houses"] },
  { id: "s", name: "Гараж", p: [-6, 0.6, 13], objects: ["grazing reindeer", "garage hangars", "snowdrifts"] },
  { id: "se", name: "Пряничный квартал", p: [4, 0.6, 14], objects: ["gingerbread men", "gingerbread houses", "hot cocoa cafe", "mail deck"] },
];
