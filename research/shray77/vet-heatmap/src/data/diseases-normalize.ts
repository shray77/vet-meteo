/**
 * Disease normalization: map free-form disease names from sources to
 * canonical DiseaseKey + standard labels.
 *
 * Sources use a wild variety of spellings — "АЧС", "Африканская чума свиней",
 * "African Swine Fever", "ASF", "HPAI H5N1", "Грипп птиц H5", etc.
 * This module collapses all aliases to a single canonical key.
 */

import type { DiseaseKey, DiseaseGroup } from "@/types/domain";

/** Mapping: any alias (RU/EN, abbreviations) -> canonical DiseaseKey. */
const DISEASE_ALIASES: Record<string, DiseaseKey> = {
  // ─── ASF ─────────────────────────────────────────────────────────────
  "африканская чума свиней": "asf",
  "ачс": "asf",
  "african swine fever": "asf",
  "asf": "asf",
  // ─── CSF ─────────────────────────────────────────────────────────────
  "классическая чума свиней": "csf",
  "классическая чума свиней (ксс)": "csf",
  "ксс": "csf",
  "classical swine fever": "csf",
  "csf": "csf",
  "hog cholera": "csf",
  // ─── PRRS ────────────────────────────────────────────────────────────
  "репродуктивно-респираторный синдром свиней": "prrs",
  "репродуктивно-респираторный синдром свиней (ррсс)": "prrs",
  "ррсс": "prrs",
  "порсин репродуктивный и респираторный синдром": "prrs",
  "porcine reproductive and respiratory syndrome": "prrs",
  "prrs": "prrs",
  "porcine reproductive & respiratory syndrome": "prrs",
  // ─── Erysipelas (Рожа свиней) ───────────────────────────────────────
  "рожа свиней": "erysipelas",
  "рожа": "erysipelas",
  "эризипелоид свиней": "erysipelas",
  "erysipelas": "erysipelas",
  "erysipelas suum": "erysipelas",
  // ─── Teschen disease ───────────────────────────────────────────────
  "энтеровирусный энцефаломиелит свиней": "tesch",
  "энтеровирусный энцефаломиелит свиней (болезнь тешена)": "tesch",
  "болезнь тешена": "tesch",
  "tesch disease": "tesch",
  "teschen disease": "tesch",
  "porcine enteroviral encephalomyelitis": "tesch",
  // ─── SVD (Везикулярная болезнь свиней) ─────────────────────────────
  "везикулярная болезнь свиней": "svd",
  "вбс": "svd",
  "swine vesicular disease": "svd",
  "svd": "svd",
  // ─── TGE (Трансмиссивный гастроэнтерит свиней) ─────────────────────
  "трансмиссивный гастроэнтерит свиней": "tge",
  "тгс свиней": "tge",
  "тгс": "tge",
  "transmissible gastroenteritis of swine": "tge",
  "transmissible gastroenteritis": "tge",
  "tge": "tge",
  "tgev": "tge",
  // ─── FMD ────────────────────────────────────────────────────────────
  "ящур": "fmd",
  "ящур типа o": "fmd",
  "ящур типа a": "fmd",
  "foot and mouth disease": "fmd",
  "foot and mouth disease (fmd) o": "fmd",
  "foot and mouth disease (fmd) a": "fmd",
  "fmd": "fmd",
  // ─── Anthrax ────────────────────────────────────────────────────────
  "сибирская язва": "anthrax",
  "anthrax": "anthrax",
  // ─── Rabies ────────────────────────────────────────────────────────
  "бешенство": "rabies",
  "бешенства": "rabies",
  "бешенству": "rabies",
  "бешенстве": "rabies",
  "бешеных": "rabies",
  "rabies": "rabies",
  // ─── HPAI ───────────────────────────────────────────────────────────
  "грипп птиц": "hpai",
  "грипп птиц h5n1": "hpai",
  "грипп птиц h5n8": "hpai",
  "грипп птиц hpai h5": "hpai",
  "высокопатогенный грипп птиц": "hpai",
  "avian influenza (hpai h5n1)": "hpai",
  "avian influenza (hpai h5n8)": "hpai",
  "avian influenza (hpai h5)": "hpai",
  "avian influenza": "hpai",
  "hpai": "hpai",
  // ─── Newcastle ──────────────────────────────────────────────────────
  "болезнь ньюкасла": "newcastle",
  "newcastle disease": "newcastle",
  // ─── Bluetongue ─────────────────────────────────────────────────────
  "блютунг": "bluetongue",
  "катаральная лихорадка овец": "bluetongue",
  "bluetongue (btv-8)": "bluetongue",
  "bluetongue (btv-4)": "bluetongue",
  "bluetongue (btv)": "bluetongue",
  "bluetongue": "bluetongue",
  // ─── Brucellosis ────────────────────────────────────────────────────
  "бруцеллёз": "brucellosis",
  "бруцеллез": "brucellosis",
  "бруцеллез (включая инфекционный эпидидимит баранов)": "brucellosis",
  "brucellosis (b. melitensis)": "brucellosis",
  "brucellosis (b. abortus)": "brucellosis",
  "brucellosis": "brucellosis",
  // ─── Bovine TB ──────────────────────────────────────────────────────
  "туберкулёз крупного рогатого скота": "btb",
  "туберкулез крс": "btb",
  "туберкулез": "btb",
  "туберкулёз": "btb",
  "bovine tuberculosis": "btb",
  // ─── PPR ────────────────────────────────────────────────────────────
  "чума мелких жвачных животных": "ppr",
  "чума мелких жвачных": "ppr",
  "peste des petits ruminants (ppr)": "ppr",
  "ppr": "ppr",
  // ─── LSD ────────────────────────────────────────────────────────────
  "узелковый дерматит": "lsd",
  "узелковый дерматит крс": "lsd",
  "заразный узелковый дерматит крупного рогатого скота": "lsd",
  "lumpy skin disease": "lsd",
  // ─── BVD (Вирусная диарея КРС) ─────────────────────────────────────
  "вирусная диарея": "bvd",
  "вирусная диарея крупного рогатого скота": "bvd",
  "вирусная диарея крс": "bvd",
  "bovine viral diarrhea": "bvd",
  "bovine virus diarrhea": "bvd",
  "bvd": "bvd",
  "bvdv": "bvd",
  // ─── IBR (ИРТ) ──────────────────────────────────────────────────────
  "инфекционный ринотрахеит": "ibr",
  "инфекционный ринотрахеит крупного рогатого скота": "ibr",
  "инфекционный ринотрахеит (ирт)": "ibr",
  "ирт": "ibr",
  "infectious bovine rhinotracheitis": "ibr",
  "ibr": "ibr",
  "bovine herpesvirus 1": "ibr",
  "bhv-1": "ibr",
  // ─── Paratuberculosis ──────────────────────────────────────────────
  "паратуберкулёз": "paratub",
  "паратуберкулез": "paratub",
  "паратуберкулез крупного рогатого скота": "paratub",
  "болезнь йоне": "paratub",
  "paratuberculosis": "paratub",
  "johne's disease": "paratub",
  "johne disease": "paratub",
  // ─── Blackleg (эмкар) ──────────────────────────────────────────────
  "эмфизематозный карбункул": "blackleg",
  "эмфизематозный карбункул (эмкар)": "blackleg",
  "эмкар": "blackleg",
  "blackleg": "blackleg",
  "black quarter": "blackleg",
  "clostridium chauvoei infection": "blackleg",
  // ─── Sheep/Goat Pox ────────────────────────────────────────────────
  "оспа овец и коз": "sgp",
  "оспа овец": "sgp",
  "оспа коз": "sgp",
  "sheep pox": "sgp",
  "goat pox": "sgp",
  "sheep/goat pox": "sgp",
  "sgp": "sgp",
  // ─── CBPP (Контагиозная плевропневмония КРС) ──────────────────────
  "контагиозная плевропневмония крупного рогатого скота": "cbpp",
  "контагиозная плевропневмония крс": "cbpp",
  "кпп крс": "cbpp",
  "кпп": "cbpp",
  "contagious bovine pleuropneumonia": "cbpp",
  "cbpp": "cbpp",
  // ─── MCF (ЗКГ) ─────────────────────────────────────────────────────
  "злокачественная катаральная горячка": "mcf",
  "злокачественная катаральная горячка крупного рогатого скота": "mcf",
  "зкг": "mcf",
  "malignant catarrhal fever": "mcf",
  "mcf": "mcf",
  // ─── Pasteurellosis ────────────────────────────────────────────────
  "пастереллёз": "pasteurellosis",
  "пастереллез": "pasteurellosis",
  "пастереллез разных видов": "pasteurellosis",
  "pasteurellosis": "pasteurellosis",
  // ─── BSE ────────────────────────────────────────────────────────────
  "губкообразная энцефалопатия крупного рогатого скота": "bse",
  "губкообразная энцефалопатия крс": "bse",
  "гэбс": "bse",
  "bovine spongiform encephalopathy": "bse",
  "bse": "bse",
  // ─── Scrapie ────────────────────────────────────────────────────────
  "скрепи овец и коз": "scrapie",
  "скрепи": "scrapie",
  "scrapie": "scrapie",
  // ─── WNV ────────────────────────────────────────────────────────────
  "лихорадка западного нила": "wnv",
  "западный нил": "wnv",
  "west nile virus": "wnv",
  // ─── Leptospirosis ──────────────────────────────────────────────────
  "лептоспироз": "lepto",
  "leptospirosis": "lepto",
  // ─── EIA ────────────────────────────────────────────────────────────
  "инфекционная анемия лошадей": "eia",
  "инфекционная анемия лошадей (инан)": "eia",
  "инан": "eia",
  "инанн": "eia",
  "equine infectious anemia": "eia",
  "eia": "eia",
  // ─── Leukosis ──────────────────────────────────────────────────────
  "лейкоз крупного рогатого скота": "leukosis",
  "энзоотический лейкоз крс": "leukosis",
  "лейкоз крс": "leukosis",
  "лейкоз": "leukosis",
  "enzootic bovine leukosis": "leukosis",
  // ─── Glanders (Сап) ────────────────────────────────────────────────
  "сап": "glanders",
  "сап лошадей": "glanders",
  "glanders": "glanders",
  "farcy": "glanders",
  // ─── EVA (Вирусный артериит лошадей) ──────────────────────────────
  "вирусный артериит лошадей": "eva",
  "артериит лошадей": "eva",
  "equine viral arteritis": "eva",
  "eva": "eva",
  // ─── Equine flu ────────────────────────────────────────────────────
  "грипп лошадей": "equine_flu",
  "equine influenza": "equine_flu",
  "equine flu": "equine_flu",
  // ─── Strangles (Мыт) ───────────────────────────────────────────────
  "мыт": "strangles",
  "мыт лошадей": "strangles",
  "strangles": "strangles",
  "equine strangles": "strangles",
  // ─── Dourine (Случная болезнь) ────────────────────────────────────
  "случная болезнь лошадей": "dourine",
  "случная болезнь": "dourine",
  "трипаносомоз лошадей": "dourine",
  "dourine": "dourine",
  // ─── Varroosis ─────────────────────────────────────────────────────
  "варроатоз пчёл": "varroosis",
  "варроатоз пчел": "varroosis",
  "варроатоз": "varroosis",
  "varroosis": "varroosis",
  // ─── Nosemosis ─────────────────────────────────────────────────────
  "нозематоз пчёл": "nosemosis",
  "нозематоз пчел": "nosemosis",
  "нозематоз": "nosemosis",
  "nosemosis": "nosemosis",
  // ─── American Foulbrood (Американский гнилец) ──────────────────────
  "американский гнилец пчел": "afb",
  "американский гнилец": "afb",
  "американский гнилец пчёл": "afb",
  "american foulbrood": "afb",
  "afb": "afb",
  // ─── European Foulbrood (Европейский гнилец) ───────────────────────
  "европейский гнилец пчел": "efb",
  "европейский гнилец": "efb",
  "европейский гнилец пчёл": "efb",
  "european foulbrood": "efb",
  "efb": "efb",
  // ─── Trichinellosis ────────────────────────────────────────────────
  "трихинеллёз": "trichinellosis",
  "трихинеллез": "trichinellosis",
  "trichinellosis": "trichinellosis",
  // ─── SVC ────────────────────────────────────────────────────────────
  "весенняя виремия карпов": "svc",
  "весенняя виремия карпов (ввк)": "svc",
  "ввк": "svc",
  "spring viraemia of carp": "svc",
  "svc": "svc",
  // ─── Avian salmonellosis ──────────────────────────────────────────
  "сальмонеллёз птицы": "avian_salmonellosis",
  "сальмонеллез птицы": "avian_salmonellosis",
  "сальмонеллёз": "avian_salmonellosis",
  "сальмонеллез": "avian_salmonellosis",
  "сальмонеллезы": "avian_salmonellosis",
  "avian salmonellosis": "avian_salmonellosis",
  // ─── Gumboro (Болезнь Гамборо) ────────────────────────────────────
  "инфекционный бурсит": "gumboro",
  "инфекционный бурсит (болезнь гамборо)": "gumboro",
  "болезнь гамборо": "gumboro",
  "gumboro disease": "gumboro",
  "infectious bursal disease": "gumboro",
  "ibd": "gumboro",
  // ─── Marek ──────────────────────────────────────────────────────────
  "болезнь марека": "marek",
  "marek's disease": "marek",
  "marek disease": "marek",
  // ─── ILT (Инфекционный ларинготрахеит кур) ────────────────────────
  "инфекционный ларинготрахеит кур": "ilt",
  "инфекционный ларинготрахеит": "ilt",
  "илт": "ilt",
  "infectious laryngotracheitis": "ilt",
  "ilt": "ilt",
  // ─── IB (Инфекционный бронхит кур) ────────────────────────────────
  "инфекционный бронхит кур": "ib",
  "инфекционный бронхит": "ib",
  "иб кур": "ib",
  "infectious bronchitis": "ib",
  "ib (avian)": "ib",
  // ─── EDS (ССЯ-76) ──────────────────────────────────────────────────
  "синдром снижения яйценоскости": "eds",
  "синдром снижения яйценоскости (сся-76)": "eds",
  "сся-76": "eds",
  "сся 76": "eds",
  "egg drop syndrome": "eds",
  "eds": "eds",
  // ─── Pullorum (Тиф-пуллороз) ──────────────────────────────────────
  "тиф-пуллороз птиц": "pullorum",
  "тиф пуллороз": "pullorum",
  "пуллороз": "pullorum",
  "pullorum disease": "pullorum",
  "fowl typhoid": "pullorum",
  // ─── RHD (ВГБК) ────────────────────────────────────────────────────
  "вирусная геморрагическая болезнь кроликов": "rhd",
  "вгбк": "rhd",
  "геморрагическая болезнь кроликов": "rhd",
  "rabbit hemorrhagic disease": "rhd",
  "rhd": "rhd",
  "rhvd": "rhd",
  // ─── Myxomatosis ──────────────────────────────────────────────────
  "миксоматоз": "myxomatosis",
  "миксоматоз кроликов": "myxomatosis",
  "myxomatosis": "myxomatosis",
  // ─── Q Fever (Лихорадка Ку) ────────────────────────────────────────
  "лихорадка ку": "qfever",
  "ку-лихорадка": "qfever",
  "ку лихорадка": "qfever",
  "q fever": "qfever",
  "qfever": "qfever",
  "query fever": "qfever",
  "coxiella burnetii infection": "qfever",
  // ─── Tularaemia ────────────────────────────────────────────────────
  "туляремия": "tularaemia",
  "туляремия животных": "tularaemia",
  "tularaemia": "tularaemia",
  "tularemia": "tularaemia",
  // ─── Listeriosis ──────────────────────────────────────────────────
  "листериоз": "listeriosis",
  "listeriosis": "listeriosis",
  // ─── Echinococcosis ────────────────────────────────────────────────
  "эхинококкоз": "echinococcosis",
  "эхинококкоз животных": "echinococcosis",
  "echinococcosis": "echinococcosis",
  "hydatid disease": "echinococcosis",
  // ─── Toxoplasmosis ────────────────────────────────────────────────
  "токсоплазмоз": "toxoplasmosis",
  "toxoplasmosis": "toxoplasmosis",
  // ─── Yersiniosis ──────────────────────────────────────────────────
  "иерсиниоз": "yersiniosis",
  "иерсиниозы": "yersiniosis",
  "yersiniosis": "yersiniosis",
};

/** Default human-readable labels (RU + EN) per canonical key. */
export const DISEASE_LABELS: Record<DiseaseKey, { ru: string; en: string; short_ru: string; group: DiseaseGroup }> = {
  // ─── Swine ──────────────────────────────────────────────────────────
  asf: { ru: "Африканская чума свиней", en: "African Swine Fever", short_ru: "АЧС", group: "Swine" },
  csf: { ru: "Классическая чума свиней", en: "Classical Swine Fever", short_ru: "КЧС", group: "Swine" },
  prrs: { ru: "Репродуктивно-респираторный синдром свиней", en: "Porcine Reproductive & Respiratory Syndrome", short_ru: "РРСС", group: "Swine" },
  erysipelas: { ru: "Рожа свиней", en: "Erysipelas", short_ru: "Рожа", group: "Swine" },
  tesch: { ru: "Энтеровирусный энцефаломиелит свиней (болезнь Тешена)", en: "Teschen Disease", short_ru: "Тешен", group: "Swine" },
  svd: { ru: "Везикулярная болезнь свиней", en: "Swine Vesicular Disease", short_ru: "ВБС", group: "Swine" },
  tge: { ru: "Трансмиссивный гастроэнтерит свиней", en: "Transmissible Gastroenteritis of Swine", short_ru: "ТГС", group: "Swine" },
  // ─── Ruminant ───────────────────────────────────────────────────────
  fmd: { ru: "Ящур", en: "Foot and Mouth Disease", short_ru: "Ящур", group: "Ruminant" },
  anthrax: { ru: "Сибирская язва", en: "Anthrax", short_ru: "Сиб. язва", group: "Ruminant" },
  bluetongue: { ru: "Блютунг", en: "Bluetongue", short_ru: "Блютунг", group: "Ruminant" },
  brucellosis: { ru: "Бруцеллёз", en: "Brucellosis", short_ru: "Бруцеллёз", group: "Ruminant" },
  btb: { ru: "Туберкулёз КРС", en: "Bovine Tuberculosis", short_ru: "Туб. КРС", group: "Ruminant" },
  ppr: { ru: "Чума мелких жвачных", en: "PPR", short_ru: "ЧМЖ", group: "Ruminant" },
  lsd: { ru: "Узелковый дерматит", en: "Lumpy Skin Disease", short_ru: "УЗД", group: "Ruminant" },
  leukosis: { ru: "Лейкоз КРС", en: "Enzootic Bovine Leukosis", short_ru: "Лейкоз", group: "Ruminant" },
  bvd: { ru: "Вирусная диарея КРС", en: "Bovine Viral Diarrhea", short_ru: "BVD", group: "Ruminant" },
  ibr: { ru: "Инфекционный ринотрахеит КРС", en: "Infectious Bovine Rhinotracheitis", short_ru: "ИРТ", group: "Ruminant" },
  paratub: { ru: "Паратуберкулёз", en: "Paratuberculosis", short_ru: "Паратуб.", group: "Ruminant" },
  blackleg: { ru: "Эмфизематозный карбункул (эмкар)", en: "Blackleg", short_ru: "Эмкар", group: "Ruminant" },
  sgp: { ru: "Оспа овец и коз", en: "Sheep/Goat Pox", short_ru: "Оспа", group: "Ruminant" },
  cbpp: { ru: "Контагиозная плевропневмония КРС", en: "Contagious Bovine Pleuropneumonia", short_ru: "КПП", group: "Ruminant" },
  mcf: { ru: "Злокачественная катаральная горячка", en: "Malignant Catarrhal Fever", short_ru: "ЗКГ", group: "Ruminant" },
  pasteurellosis: { ru: "Пастереллёз", en: "Pasteurellosis", short_ru: "Пастер.", group: "Ruminant" },
  bse: { ru: "Губкообразная энцефалопатия КРС", en: "Bovine Spongiform Encephalopathy", short_ru: "BSE", group: "Ruminant" },
  scrapie: { ru: "Скрепи овец и коз", en: "Scrapie", short_ru: "Скрепи", group: "Ruminant" },
  // ─── Avian ──────────────────────────────────────────────────────────
  hpai: { ru: "Грипп птиц", en: "Avian Influenza (HPAI)", short_ru: "Грипп птиц", group: "Avian" },
  newcastle: { ru: "Болезнь Ньюкасла", en: "Newcastle Disease", short_ru: "Ньюкасл", group: "Avian" },
  avian_salmonellosis: { ru: "Сальмонеллёз птицы", en: "Avian Salmonellosis", short_ru: "Сальм.", group: "Avian" },
  gumboro: { ru: "Инфекционный бурсит (болезнь Гамборо)", en: "Infectious Bursal Disease", short_ru: "Гамборо", group: "Avian" },
  marek: { ru: "Болезнь Марека", en: "Marek's Disease", short_ru: "Марек", group: "Avian" },
  ilt: { ru: "Инфекционный ларинготрахеит кур", en: "Infectious Laryngotracheitis", short_ru: "ИЛТ", group: "Avian" },
  ib: { ru: "Инфекционный бронхит кур", en: "Infectious Bronchitis", short_ru: "ИБ", group: "Avian" },
  eds: { ru: "Синдром снижения яйценоскости", en: "Egg Drop Syndrome", short_ru: "ССЯ-76", group: "Avian" },
  pullorum: { ru: "Тиф-пуллороз птиц", en: "Pullorum Disease", short_ru: "Пуллороз", group: "Avian" },
  rhd: { ru: "Вирусная геморрагическая болезнь кроликов", en: "Rabbit Hemorrhagic Disease", short_ru: "ВГБК", group: "Avian" },
  myxomatosis: { ru: "Миксоматоз", en: "Myxomatosis", short_ru: "Миксом.", group: "Avian" },
  // ─── Equine / Wildlife ──────────────────────────────────────────────
  rabies: { ru: "Бешенство", en: "Rabies", short_ru: "Бешенство", group: "Wildlife" },
  wnv: { ru: "Лихорадка Западного Нила", en: "West Nile Virus", short_ru: "ЛЗН", group: "Equine/Wildlife" },
  eia: { ru: "Инфекционная анемия лошадей", en: "Equine Infectious Anemia", short_ru: "ИАЛ", group: "Equine/Wildlife" },
  trichinellosis: { ru: "Трихинеллёз", en: "Trichinellosis", short_ru: "Трихин.", group: "Wildlife" },
  svc: { ru: "Весенняя виремия карпов", en: "Spring Viraemia of Carp", short_ru: "ВВК", group: "Wildlife" },
  glanders: { ru: "Сап", en: "Glanders", short_ru: "Сап", group: "Equine/Wildlife" },
  eva: { ru: "Вирусный артериит лошадей", en: "Equine Viral Arteritis", short_ru: "ВАЛ", group: "Equine/Wildlife" },
  equine_flu: { ru: "Грипп лошадей", en: "Equine Influenza", short_ru: "Грипп лош.", group: "Equine/Wildlife" },
  strangles: { ru: "Мыт", en: "Strangles", short_ru: "Мыт", group: "Equine/Wildlife" },
  dourine: { ru: "Случная болезнь лошадей", en: "Dourine", short_ru: "Дурина", group: "Equine/Wildlife" },
  // ─── Bees ───────────────────────────────────────────────────────────
  varroosis: { ru: "Варроатоз пчёл", en: "Varroosis", short_ru: "Варроатоз", group: "Multi-species" },
  nosemosis: { ru: "Нозематоз пчёл", en: "Nosemosis", short_ru: "Нозематоз", group: "Multi-species" },
  afb: { ru: "Американский гнилец пчёл", en: "American Foulbrood", short_ru: "АГ", group: "Multi-species" },
  efb: { ru: "Европейский гнилец пчёл", en: "European Foulbrood", short_ru: "ЕГ", group: "Multi-species" },
  // ─── Multi-species / Zoonotic ───────────────────────────────────────
  lepto: { ru: "Лептоспироз", en: "Leptospirosis", short_ru: "Лепто", group: "Multi-species" },
  qfever: { ru: "Лихорадка Ку", en: "Q Fever", short_ru: "Ку-лих.", group: "Multi-species" },
  tularaemia: { ru: "Туляремия", en: "Tularaemia", short_ru: "Туляр.", group: "Wildlife" },
  listeriosis: { ru: "Листериоз", en: "Listeriosis", short_ru: "Листер.", group: "Multi-species" },
  echinococcosis: { ru: "Эхинококкоз", en: "Echinococcosis", short_ru: "Эхинок.", group: "Wildlife" },
  toxoplasmosis: { ru: "Токсоплазмоз", en: "Toxoplasmosis", short_ru: "Токсопл.", group: "Multi-species" },
  yersiniosis: { ru: "Иерсиниоз", en: "Yersiniosis", short_ru: "Иерсин.", group: "Multi-species" },
  other: { ru: "Прочее", en: "Other", short_ru: "Прочее", group: "Multi-species" },
};

/**
 * Normalize a free-form disease string to a canonical DiseaseKey.
 * Falls back to "other" if no match.
 */
export function normalizeDisease(raw: string): DiseaseKey {
  if (!raw) return "other";
  const lower = raw.trim().toLowerCase();
  if (DISEASE_ALIASES[lower]) return DISEASE_ALIASES[lower];

  // Substring match (e.g. "Avian Influenza (HPAI H5N1) — details" → "hpai")
  for (const [alias, key] of Object.entries(DISEASE_ALIASES)) {
    if (lower.includes(alias)) return key;
  }

  return "other";
}

/** Get standard labels for a disease key. */
export function getDiseaseLabels(key: DiseaseKey) {
  return DISEASE_LABELS[key] ?? DISEASE_LABELS.other;
}
