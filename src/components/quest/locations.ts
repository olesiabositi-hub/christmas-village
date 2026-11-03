export type QuestLocation = {
  id: string;
  name: string; // English campus name (kept untranslated)
  subtitle: string;
  description: string;
  quest: { title: string; steps: string[]; reward: string };
  position: [number, number, number]; // marker position
  camera: [number, number, number];
};

export const LOCATIONS: QuestLocation[] = [
  {
    id: "office",
    name: "Santa's Executive Office",
    subtitle: "Резиденция Санты",
    description:
      "Главная резиденция Санты. Здесь хранятся списки хороших детей и принимаются стратегические решения Рождества. Начни квест здесь!",
    quest: {
      title: "Совет у камина",
      steps: ["Найди золотой список хороших детей", "Разожги главный камин", "Подпиши указ о начале Рождества"],
      reward: "Печать Санты",
    },
    position: [0, 4.6, -6],
    camera: [4, 5.5, 0.5],
  },
  {
    id: "magic",
    name: "Department of Magic",
    subtitle: "Башня заклинаний",
    description: "Мистическая башня, где ИИ-заклинания плетут праздничное волшебство. Твоя магия начнется здесь.",
    quest: {
      title: "Праздничный хор",
      steps: ["Послушай рождественский хор", "Запомни, кто поёт по очереди", "Спой песню без ошибок"],
      reward: "Посох северного сияния",
    },
    position: [-6.5, 5.6, -2.5],
    camera: [-2, 5, 3],
  },
  {
    id: "qa",
    name: "QA Gift",
    subtitle: "Фабрика проверки подарков",
    description: "Конвейер тестирования подарков. Проверь игрушки на баги, чтобы ни один ребенок не расстроился!",
    quest: {
      title: "Охота на баги",
      steps: ["Осмотри ленту конвейера", "Найди три сломанные игрушки", "Поставь печать «Проверено»"],
      reward: "Золотая лупа",
    },
    position: [6.5, 3.2, -2.5],
    camera: [10.5, 4, 2.5],
  },
  {
    id: "reindeer",
    name: "Reindeer Engineering",
    subtitle: "Ангар сверхзвуковых саней",
    description: "Высокотехнологичные ангары сверхзвуковых саней. Настрой навигацию и заправь оленей магическим топливом.",
    quest: {
      title: "Предполётная проверка",
      steps: ["Откалибруй компас саней", "Накорми оленей звёздным мхом", "Зажги посадочную полосу"],
      reward: "Колокольчик Рудольфа",
    },
    position: [-5.5, 2.8, 5],
    camera: [-6, 4, 10.5],
  },
  {
    id: "elfops",
    name: "ElfOps",
    subtitle: "Командный центр",
    description: "Командный центр инфраструктуры. Управляй логистикой праздника и следи за датчиками рождественского духа.",
    quest: {
      title: "Датчики духа Рождества",
      steps: ["Настрой радар из леденцов", "Проверь маршруты эльфов", "Подними уровень праздничного духа до 100%"],
      reward: "Карамельная антенна",
    },
    position: [5.5, 3.2, 5],
    camera: [8, 4.5, 10.5],
  },
];
