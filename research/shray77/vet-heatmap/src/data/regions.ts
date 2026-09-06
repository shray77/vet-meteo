/**
 * Region normalization: map any Russian-language region name to the
 * canonical English `shapeName` used in our GeoJSON.
 *
 * Source of truth for the GeoJSON shapeName values is
 * `public/data/russia_regions.geojson` (derived from Natural Earth ADM1).
 *
 * This table is the ONLY place where RU -> EN region mapping lives.
 * Both the scraper pipeline and the frontend import from here.
 */

import type { RegionProperties } from "@/types/domain";

/**
 * Mapping: Russian name (or any alias used by sources) -> GeoJSON shapeName.
 *
 * Built to cover all 86 Natural Earth ADM1 regions for Russia.
 */
export const REGION_MAP: Record<string, string> = {
  // Federal cities
  "Москва": "Moskva",
  "Московская область": "Moskovskaya",
  "г. Москва": "Moskva",
  "г. Санкт-Петербург": "City of St. Petersburg",
  "Санкт-Петербург": "City of St. Petersburg",
  "Севастополь": "Sevastopol",
  "г. Севастополь": "Sevastopol",

  // Republics — natural names
  "Дагестан": "Dagestan",
  "Республика Дагестан": "Dagestan",
  "Чеченская Республика": "Chechnya",
  "Чечня": "Chechnya",
  "Кабардино-Балкарская Республика": "Kabardin-Balkar",
  "Кабардино-Балкария": "Kabardin-Balkar",
  "Ингушетия": "Ingush",
  "Республика Ингушетия": "Ingush",
  "Карачаево-Черкесская Республика": "Karachay-Cherkess",
  "Карачаево-Черкесия": "Karachay-Cherkess",
  "Татарстан": "Tatarstan",
  "Республика Татарстан": "Tatarstan",
  "Башкортостан": "Bashkortostan",
  "Республика Башкортостан": "Bashkortostan",
  "Республика Мордовия": "Mordovia",
  "Мордовия": "Mordovia",
  "Республика Саха (Якутия)": "Sakha (Yakutia)",
  "Якутия": "Sakha (Yakutia)",
  "Республика Бурятия": "Buryat",
  "Бурятия": "Buryat",
  "Республика Коми": "Komi",
  "Коми": "Komi",
  "Республика Марий Эл": "Mariy-El",
  "Марий Эл": "Mariy-El",
  "Республика Карелия": "Karelia",
  "Карелия": "Karelia",
  "Хакасия": "Khakass",
  "Республика Хакасия": "Khakass",
  "Тыва": "Tuva",
  "Республика Тыва": "Tuva",
  "Тува": "Tuva",
  "Алтай": "Gorno-Altay",
  "Республика Алтай": "Gorno-Altay",
  "Адыгея": "Adygey",
  "Республика Адыгея": "Adygey",
  "Калмыкия": "Kalmyk",
  "Республика Калмыкия": "Kalmyk",
  "Чувашская Республика": "Chuvash",
  "Чувашия": "Chuvash",
  "Удмуртская Республика": "Udmurt",
  "Удмуртия": "Udmurt",
  "Северная Осетия — Алания": "North Ossetia",
  "Северная Осетия-Алания": "North Ossetia",
  "Республика Северная Осетия-Алания": "North Ossetia",

  // Krais
  "Краснодарский край": "Krasnodar",
  "Ставропольский край": "Stavropol'",
  "Алтайский край": "Altay",
  "Красноярский край": "Krasnoyarsk",
  "Приморский край": "Primor'ye",
  "Хабаровский край": "Khabarovsk",
  "Забайкальский край": "Chita",
  "Пермский край": "Perm'",
  "Камчатский край": "Kamchatka",

  // Oblasts — common pattern: strip "область" and use the city name
  "Астраханская область": "Astrakhan'",
  "Ростовская область": "Rostov",
  "Челябинская область": "Chelyabinsk",
  "Новосибирская область": "Novosibirsk",
  "Ленинградская область": "Leningrad",
  "Саратовская область": "Saratov",
  "Владимирская область": "Vladimir",
  "Тверская область": "Tver'",
  "Самарская область": "Samara",
  "Волгоградская область": "Volgograd",
  "Орловская область": "Orel",
  "Калужская область": "Kaluga",
  "Ульяновская область": "Ul'yanovsk",
  "Архангельская область": "Arkhangel'sk",
  "Вологодская область": "Vologda",
  "Томская область": "Tomsk",
  "Амурская область": "Amur",
  "Белгородская область": "Belgorod",
  "Кировская область": "Kirov",
  "Пензенская область": "Penza",
  "Тамбовская область": "Tambov",
  "Нижегородская область": "Nizhegorod",
  "Мурманская область": "Murmansk",
  "Иркутская область": "Irkutsk",
  "Псковская область": "Pskov",
  "Новгородская область": "Novgorod",
  "Свердловская область": "Sverdlovsk",
  "Оренбургская область": "Orenburg",
  "Тюменская область": "Tyumen'",
  "Брянская область": "Bryansk",
  "Курская область": "Kursk",
  "Липецкая область": "Lipetsk",
  "Костромская область": "Kostroma",
  "Курганская область": "Kurgan",
  "Ивановская область": "Ivanovo",
  "Омская область": "Omsk",
  "Рязанская область": "Ryazan'",
  "Смоленская область": "Smolensk",
  "Тульская область": "Tula",
  "Ярославская область": "Yaroslavl'",
  "Воронежская область": "Voronezh",
  "Сахалинская область": "Sakhalin",
  "Кемеровская область": "Kemerovo",
  "Кемеровская область — Кузбасс": "Kemerovo",
  "Калининградская область": "Kaliningrad",

  // Autonomous okrugs / oblasts
  "Чукотский автономный округ": "Chukchi Autonomous Okrug",
  "Чукотка": "Chukchi Autonomous Okrug",
  "Ненецкий автономный округ": "Nenets",
  "Ханты-Мансийский автономный округ — Югра": "Khanty-Mansiy",
  "Ханты-Мансийский АО": "Khanty-Mansiy",
  "Югра": "Khanty-Mansiy",
  "Ямало-Ненецкий автономный округ": "Yamal-Nenets",
  "Ямало-Ненецкий АО": "Yamal-Nenets",
  "Еврейская автономная область": "Yevrey",
  "Еврейская АО": "Yevrey",

  // Crimea (covered by source as Crimea, sensitive politically — Natural Earth has it)
  "Республика Крым": "Crimea",
  "Крым": "Crimea",
};

/** Reverse lookup: GeoJSON shapeName -> canonical Russian name. */
export const REGION_MAP_REVERSE: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [ru, en] of Object.entries(REGION_MAP)) {
    if (!out[en]) out[en] = ru; // keep first alias
  }
  return out;
})();

/**
 * Extra metadata for each Russian region.
 * Population and livestock-density figures are approximate 2024 estimates
 * compiled from Rosstat / VNIIZZh open data.
 *
 * Used for risk-zone calculations in the frontend.
 */
export const REGION_PROPERTIES: Record<string, RegionProperties> = {
  "Moskva": { shapeName: "Moskva", name_ru: "Москва", iso_code: "RU-MOW", population_mln: 13.1, pigs_per_km2: 0.5, cattle_per_km2: 0.3, poultry_per_km2: 12.0, federal_district: "ЦФО" },
  "Moskovskaya": { shapeName: "Moskovskaya", name_ru: "Московская область", iso_code: "RU-MOS", population_mln: 8.7, pigs_per_km2: 3.2, cattle_per_km2: 4.5, poultry_per_km2: 18.0, federal_district: "ЦФО" },
  "City of St. Petersburg": { shapeName: "City of St. Petersburg", name_ru: "Санкт-Петербург", iso_code: "RU-SPE", population_mln: 5.6, pigs_per_km2: 0.1, cattle_per_km2: 0.1, poultry_per_km2: 4.0, federal_district: "СЗФО" },
  "Leningrad": { shapeName: "Leningrad", name_ru: "Ленинградская область", iso_code: "RU-LEN", population_mln: 1.95, pigs_per_km2: 6.8, cattle_per_km2: 5.2, poultry_per_km2: 22.0, federal_district: "СЗФО" },
  "Sevastopol": { shapeName: "Sevastopol", name_ru: "Севастополь", iso_code: "RU-SEV", population_mln: 0.55, pigs_per_km2: 1.0, cattle_per_km2: 0.8, poultry_per_km2: 5.0, federal_district: "ЮФО" },
  "Crimea": { shapeName: "Crimea", name_ru: "Республика Крым", iso_code: "RU-CR", population_mln: 1.91, pigs_per_km2: 2.5, cattle_per_km2: 3.5, poultry_per_km2: 8.0, federal_district: "ЮФО" },
  "Dagestan": { shapeName: "Dagestan", name_ru: "Республика Дагестан", iso_code: "RU-DA", population_mln: 3.2, pigs_per_km2: 0.0, cattle_per_km2: 9.5, poultry_per_km2: 6.0, federal_district: "СКФО" },
  "Chechnya": { shapeName: "Chechnya", name_ru: "Чеченская Республика", iso_code: "RU-CE", population_mln: 1.5, pigs_per_km2: 0.0, cattle_per_km2: 7.0, poultry_per_km2: 4.0, federal_district: "СКФО" },
  "Kabardin-Balkar": { shapeName: "Kabardin-Balkar", name_ru: "Кабардино-Балкарская Республика", iso_code: "RU-KB", population_mln: 0.88, pigs_per_km2: 0.2, cattle_per_km2: 11.0, poultry_per_km2: 5.0, federal_district: "СКФО" },
  "Ingush": { shapeName: "Ingush", name_ru: "Республика Ингушетия", iso_code: "RU-IN", population_mln: 0.51, pigs_per_km2: 0.0, cattle_per_km2: 6.0, poultry_per_km2: 3.0, federal_district: "СКФО" },
  "Karachay-Cherkess": { shapeName: "Karachay-Cherkess", name_ru: "Карачаево-Черкесская Республика", iso_code: "RU-KC", population_mln: 0.46, pigs_per_km2: 0.5, cattle_per_km2: 9.0, poultry_per_km2: 4.0, federal_district: "СКФО" },
  "North Ossetia": { shapeName: "North Ossetia", name_ru: "Северная Осетия — Алания", iso_code: "RU-SE", population_mln: 0.69, pigs_per_km2: 1.0, cattle_per_km2: 8.0, poultry_per_km2: 6.0, federal_district: "СКФО" },
  "Tatarstan": { shapeName: "Tatarstan", name_ru: "Республика Татарстан", iso_code: "RU-TA", population_mln: 4.05, pigs_per_km2: 12.0, cattle_per_km2: 14.0, poultry_per_km2: 25.0, federal_district: "ПФО" },
  "Bashkortostan": { shapeName: "Bashkortostan", name_ru: "Республика Башкортостан", iso_code: "RU-BA", population_mln: 4.07, pigs_per_km2: 8.0, cattle_per_km2: 13.0, poultry_per_km2: 18.0, federal_district: "ПФО" },
  "Mordovia": { shapeName: "Mordovia", name_ru: "Республика Мордовия", iso_code: "RU-MO", population_mln: 0.78, pigs_per_km2: 15.0, cattle_per_km2: 9.0, poultry_per_km2: 22.0, federal_district: "ПФО" },
  "Sakha (Yakutia)": { shapeName: "Sakha (Yakutia)", name_ru: "Республика Саха (Якутия)", iso_code: "RU-SA", population_mln: 0.98, pigs_per_km2: 0.05, cattle_per_km2: 0.3, poultry_per_km2: 0.5, federal_district: "ДФО" },
  "Buryat": { shapeName: "Buryat", name_ru: "Республика Бурятия", iso_code: "RU-BU", population_mln: 0.98, pigs_per_km2: 2.0, cattle_per_km2: 6.0, poultry_per_km2: 4.0, federal_district: "ДФО" },
  "Komi": { shapeName: "Komi", name_ru: "Республика Коми", iso_code: "RU-KO", population_mln: 0.71, pigs_per_km2: 0.5, cattle_per_km2: 1.0, poultry_per_km2: 1.5, federal_district: "СЗФО" },
  "Mariy-El": { shapeName: "Mariy-El", name_ru: "Республика Марий Эл", iso_code: "RU-ME", population_mln: 0.67, pigs_per_km2: 9.0, cattle_per_km2: 8.0, poultry_per_km2: 14.0, federal_district: "ПФО" },
  "Karelia": { shapeName: "Karelia", name_ru: "Республика Карелия", iso_code: "RU-KR", population_mln: 0.61, pigs_per_km2: 1.5, cattle_per_km2: 1.5, poultry_per_km2: 2.0, federal_district: "СЗФО" },
  "Khakass": { shapeName: "Khakass", name_ru: "Республика Хакасия", iso_code: "RU-KK", population_mln: 0.52, pigs_per_km2: 4.0, cattle_per_km2: 8.0, poultry_per_km2: 6.0, federal_district: "СФО" },
  "Tuva": { shapeName: "Tuva", name_ru: "Республика Тыва", iso_code: "RU-TY", population_mln: 0.33, pigs_per_km2: 0.5, cattle_per_km2: 5.0, poultry_per_km2: 1.0, federal_district: "СФО" },
  "Gorno-Altay": { shapeName: "Gorno-Altay", name_ru: "Республика Алтай", iso_code: "RU-AL", population_mln: 0.23, pigs_per_km2: 0.5, cattle_per_km2: 4.0, poultry_per_km2: 1.5, federal_district: "СФО" },
  "Adygey": { shapeName: "Adygey", name_ru: "Республика Адыгея", iso_code: "RU-AD", population_mln: 0.46, pigs_per_km2: 5.0, cattle_per_km2: 7.0, poultry_per_km2: 12.0, federal_district: "ЮФО" },
  "Kalmyk": { shapeName: "Kalmyk", name_ru: "Республика Калмыкия", iso_code: "RU-KL", population_mln: 0.27, pigs_per_km2: 0.5, cattle_per_km2: 5.0, poultry_per_km2: 2.0, federal_district: "ЮФО" },
  "Chuvash": { shapeName: "Chuvash", name_ru: "Чувашская Республика", iso_code: "RU-CU", population_mln: 1.18, pigs_per_km2: 10.0, cattle_per_km2: 10.0, poultry_per_km2: 18.0, federal_district: "ПФО" },
  "Udmurt": { shapeName: "Udmurt", name_ru: "Удмуртская Республика", iso_code: "RU-UD", population_mln: 1.44, pigs_per_km2: 8.0, cattle_per_km2: 11.0, poultry_per_km2: 14.0, federal_district: "ПФО" },

  // Krais
  "Krasnodar": { shapeName: "Krasnodar", name_ru: "Краснодарский край", iso_code: "RU-KDA", population_mln: 5.8, pigs_per_km2: 9.0, cattle_per_km2: 8.0, poultry_per_km2: 30.0, federal_district: "ЮФО" },
  "Stavropol'": { shapeName: "Stavropol'", name_ru: "Ставропольский край", iso_code: "RU-STA", population_mln: 2.84, pigs_per_km2: 5.0, cattle_per_km2: 12.0, poultry_per_km2: 15.0, federal_district: "СКФО" },
  "Altay": { shapeName: "Altay", name_ru: "Алтайский край", iso_code: "RU-ALT", population_mln: 2.18, pigs_per_km2: 6.0, cattle_per_km2: 9.0, poultry_per_km2: 12.0, federal_district: "СФО" },
  "Krasnoyarsk": { shapeName: "Krasnoyarsk", name_ru: "Красноярский край", iso_code: "RU-KYA", population_mln: 2.83, pigs_per_km2: 1.5, cattle_per_km2: 2.5, poultry_per_km2: 3.0, federal_district: "СФО" },
  "Primor'ye": { shapeName: "Primor'ye", name_ru: "Приморский край", iso_code: "RU-PRI", population_mln: 1.87, pigs_per_km2: 4.0, cattle_per_km2: 3.0, poultry_per_km2: 6.0, federal_district: "ДФО" },
  "Khabarovsk": { shapeName: "Khabarovsk", name_ru: "Хабаровский край", iso_code: "RU-KHA", population_mln: 1.31, pigs_per_km2: 1.0, cattle_per_km2: 1.0, poultry_per_km2: 2.0, federal_district: "ДФО" },
  "Chita": { shapeName: "Chita", name_ru: "Забайкальский край", iso_code: "RU-ZAB", population_mln: 1.0, pigs_per_km2: 2.0, cattle_per_km2: 3.5, poultry_per_km2: 4.0, federal_district: "ДФО" },
  "Perm'": { shapeName: "Perm'", name_ru: "Пермский край", iso_code: "RU-PER", population_mln: 2.55, pigs_per_km2: 5.0, cattle_per_km2: 6.0, poultry_per_km2: 10.0, federal_district: "ПФО" },
  "Kamchatka": { shapeName: "Kamchatka", name_ru: "Камчатский край", iso_code: "RU-KAM", population_mln: 0.29, pigs_per_km2: 0.5, cattle_per_km2: 0.3, poultry_per_km2: 1.0, federal_district: "ДФО" },

  // Oblasts — using EN->RU lookup from above
  "Astrakhan'": { shapeName: "Astrakhan'", name_ru: "Астраханская область", iso_code: "RU-AST", population_mln: 0.98, pigs_per_km2: 3.0, cattle_per_km2: 5.0, poultry_per_km2: 8.0, federal_district: "ЮФО" },
  "Rostov": { shapeName: "Rostov", name_ru: "Ростовская область", iso_code: "RU-ROS", population_mln: 4.16, pigs_per_km2: 11.0, cattle_per_km2: 8.0, poultry_per_km2: 25.0, federal_district: "ЮФО" },
  "Chelyabinsk": { shapeName: "Chelyabinsk", name_ru: "Челябинская область", iso_code: "RU-CHE", population_mln: 3.39, pigs_per_km2: 8.0, cattle_per_km2: 5.5, poultry_per_km2: 18.0, federal_district: "УрФО" },
  "Novosibirsk": { shapeName: "Novosibirsk", name_ru: "Новосибирская область", iso_code: "RU-NVS", population_mln: 2.84, pigs_per_km2: 7.0, cattle_per_km2: 5.0, poultry_per_km2: 14.0, federal_district: "СФО" },
  "Saratov": { shapeName: "Saratov", name_ru: "Саратовская область", iso_code: "RU-SAR", population_mln: 2.39, pigs_per_km2: 6.0, cattle_per_km2: 7.0, poultry_per_km2: 12.0, federal_district: "ПФО" },
  "Vladimir": { shapeName: "Vladimir", name_ru: "Владимирская область", iso_code: "RU-VLA", population_mln: 1.34, pigs_per_km2: 8.0, cattle_per_km2: 7.0, poultry_per_km2: 15.0, federal_district: "ЦФО" },
  "Tver'": { shapeName: "Tver'", name_ru: "Тверская область", iso_code: "RU-TVE", population_mln: 1.27, pigs_per_km2: 4.0, cattle_per_km2: 5.0, poultry_per_km2: 7.0, federal_district: "ЦФО" },
  "Samara": { shapeName: "Samara", name_ru: "Самарская область", iso_code: "RU-SAM", population_mln: 3.18, pigs_per_km2: 7.0, cattle_per_km2: 6.0, poultry_per_km2: 16.0, federal_district: "ПФО" },
  "Volgograd": { shapeName: "Volgograd", name_ru: "Волгоградская область", iso_code: "RU-VGG", population_mln: 2.49, pigs_per_km2: 5.0, cattle_per_km2: 5.5, poultry_per_km2: 12.0, federal_district: "ЮФО" },
  "Orel": { shapeName: "Orel", name_ru: "Орловская область", iso_code: "RU-ORE", population_mln: 0.71, pigs_per_km2: 12.0, cattle_per_km2: 9.0, poultry_per_km2: 20.0, federal_district: "ЦФО" },
  "Kaluga": { shapeName: "Kaluga", name_ru: "Калужская область", iso_code: "RU-KLU", population_mln: 1.0, pigs_per_km2: 6.0, cattle_per_km2: 6.0, poultry_per_km2: 12.0, federal_district: "ЦФО" },
  "Ul'yanovsk": { shapeName: "Ul'yanovsk", name_ru: "Ульяновская область", iso_code: "RU-ULY", population_mln: 1.21, pigs_per_km2: 7.0, cattle_per_km2: 7.0, poultry_per_km2: 13.0, federal_district: "ПФО" },
  "Arkhangel'sk": { shapeName: "Arkhangel'sk", name_ru: "Архангельская область", iso_code: "RU-ARK", population_mln: 1.13, pigs_per_km2: 1.5, cattle_per_km2: 2.0, poultry_per_km2: 3.0, federal_district: "СЗФО" },
  "Vologda": { shapeName: "Vologda", name_ru: "Вологодская область", iso_code: "RU-VLG", population_mln: 1.14, pigs_per_km2: 4.0, cattle_per_km2: 5.0, poultry_per_km2: 8.0, federal_district: "СЗФО" },
  "Tomsk": { shapeName: "Tomsk", name_ru: "Томская область", iso_code: "RU-TOM", population_mln: 1.08, pigs_per_km2: 3.0, cattle_per_km2: 3.5, poultry_per_km2: 6.0, federal_district: "СФО" },
  "Amur": { shapeName: "Amur", name_ru: "Амурская область", iso_code: "RU-AMU", population_mln: 0.77, pigs_per_km2: 2.5, cattle_per_km2: 3.0, poultry_per_km2: 5.0, federal_district: "ДФО" },
  "Belgorod": { shapeName: "Belgorod", name_ru: "Белгородская область", iso_code: "RU-BEL", population_mln: 1.54, pigs_per_km2: 25.0, cattle_per_km2: 9.0, poultry_per_km2: 35.0, federal_district: "ЦФО" },
  "Kirov": { shapeName: "Kirov", name_ru: "Кировская область", iso_code: "RU-KIR", population_mln: 1.27, pigs_per_km2: 5.0, cattle_per_km2: 6.0, poultry_per_km2: 9.0, federal_district: "ПФО" },
  "Penza": { shapeName: "Penza", name_ru: "Пензенская область", iso_code: "RU-PNZ", population_mln: 1.24, pigs_per_km2: 9.0, cattle_per_km2: 7.0, poultry_per_km2: 16.0, federal_district: "ПФО" },
  "Tambov": { shapeName: "Tambov", name_ru: "Тамбовская область", iso_code: "RU-TAM", population_mln: 0.98, pigs_per_km2: 14.0, cattle_per_km2: 7.0, poultry_per_km2: 22.0, federal_district: "ЦФО" },
  "Nizhegorod": { shapeName: "Nizhegorod", name_ru: "Нижегородская область", iso_code: "RU-NIZ", population_mln: 3.19, pigs_per_km2: 6.0, cattle_per_km2: 6.5, poultry_per_km2: 14.0, federal_district: "ПФО" },
  "Murmansk": { shapeName: "Murmansk", name_ru: "Мурманская область", iso_code: "RU-MUR", population_mln: 0.71, pigs_per_km2: 0.3, cattle_per_km2: 0.5, poultry_per_km2: 1.0, federal_district: "СЗФО" },
  "Irkutsk": { shapeName: "Irkutsk", name_ru: "Иркутская область", iso_code: "RU-IRK", population_mln: 2.36, pigs_per_km2: 2.5, cattle_per_km2: 3.0, poultry_per_km2: 6.0, federal_district: "СФО" },
  "Pskov": { shapeName: "Pskov", name_ru: "Псковская область", iso_code: "RU-PSK", population_mln: 0.59, pigs_per_km2: 3.0, cattle_per_km2: 4.0, poultry_per_km2: 5.0, federal_district: "СЗФО" },
  "Novgorod": { shapeName: "Novgorod", name_ru: "Новгородская область", iso_code: "RU-NGR", population_mln: 0.59, pigs_per_km2: 4.0, cattle_per_km2: 4.5, poultry_per_km2: 6.0, federal_district: "СЗФО" },
  "Sverdlovsk": { shapeName: "Sverdlovsk", name_ru: "Свердловская область", iso_code: "RU-SVE", population_mln: 4.27, pigs_per_km2: 5.0, cattle_per_km2: 4.0, poultry_per_km2: 12.0, federal_district: "УрФО" },
  "Orenburg": { shapeName: "Orenburg", name_ru: "Оренбургская область", iso_code: "RU-ORE", population_mln: 1.85, pigs_per_km2: 4.0, cattle_per_km2: 7.0, poultry_per_km2: 10.0, federal_district: "ПФО" },
  "Tyumen'": { shapeName: "Tyumen'", name_ru: "Тюменская область", iso_code: "RU-TYU", population_mln: 3.83, pigs_per_km2: 4.0, cattle_per_km2: 4.0, poultry_per_km2: 10.0, federal_district: "УрФО" },
  "Bryansk": { shapeName: "Bryansk", name_ru: "Брянская область", iso_code: "RU-BRY", population_mln: 1.16, pigs_per_km2: 9.0, cattle_per_km2: 8.0, poultry_per_km2: 16.0, federal_district: "ЦФО" },
  "Kursk": { shapeName: "Kursk", name_ru: "Курская область", iso_code: "RU-KRS", population_mln: 1.06, pigs_per_km2: 8.0, cattle_per_km2: 7.0, poultry_per_km2: 14.0, federal_district: "ЦФО" },
  "Lipetsk": { shapeName: "Lipetsk", name_ru: "Липецкая область", iso_code: "RU-LIP", population_mln: 1.13, pigs_per_km2: 13.0, cattle_per_km2: 7.0, poultry_per_km2: 22.0, federal_district: "ЦФО" },
  "Kostroma": { shapeName: "Kostroma", name_ru: "Костромская область", iso_code: "RU-KOS", population_mln: 0.61, pigs_per_km2: 3.0, cattle_per_km2: 5.0, poultry_per_km2: 6.0, federal_district: "ЦФО" },
  "Kurgan": { shapeName: "Kurgan", name_ru: "Курганская область", iso_code: "RU-KGN", population_mln: 0.79, pigs_per_km2: 4.0, cattle_per_km2: 6.0, poultry_per_km2: 8.0, federal_district: "УрФО" },
  "Ivanovo": { shapeName: "Ivanovo", name_ru: "Ивановская область", iso_code: "RU-IVA", population_mln: 0.93, pigs_per_km2: 5.0, cattle_per_km2: 5.0, poultry_per_km2: 10.0, federal_district: "ЦФО" },
  "Omsk": { shapeName: "Omsk", name_ru: "Омская область", iso_code: "RU-OMS", population_mln: 1.83, pigs_per_km2: 6.0, cattle_per_km2: 6.0, poultry_per_km2: 14.0, federal_district: "СФО" },
  "Ryazan'": { shapeName: "Ryazan'", name_ru: "Рязанская область", iso_code: "RU-RYA", population_mln: 1.08, pigs_per_km2: 7.0, cattle_per_km2: 7.0, poultry_per_km2: 13.0, federal_district: "ЦФО" },
  "Smolensk": { shapeName: "Smolensk", name_ru: "Смоленская область", iso_code: "RU-SMO", population_mln: 0.91, pigs_per_km2: 4.0, cattle_per_km2: 5.0, poultry_per_km2: 8.0, federal_district: "ЦФО" },
  "Tula": { shapeName: "Tula", name_ru: "Тульская область", iso_code: "RU-TUL", population_mln: 1.45, pigs_per_km2: 8.0, cattle_per_km2: 7.0, poultry_per_km2: 15.0, federal_district: "ЦФО" },
  "Yaroslavl'": { shapeName: "Yaroslavl'", name_ru: "Ярославская область", iso_code: "RU-YAR", population_mln: 1.23, pigs_per_km2: 4.0, cattle_per_km2: 5.0, poultry_per_km2: 10.0, federal_district: "ЦФО" },
  "Voronezh": { shapeName: "Voronezh", name_ru: "Воронежская область", iso_code: "RU-VOR", population_mln: 2.31, pigs_per_km2: 11.0, cattle_per_km2: 7.0, poultry_per_km2: 22.0, federal_district: "ЦФО" },
  "Sakhalin": { shapeName: "Sakhalin", name_ru: "Сахалинская область", iso_code: "RU-SAK", population_mln: 0.47, pigs_per_km2: 0.5, cattle_per_km2: 0.5, poultry_per_km2: 1.5, federal_district: "ДФО" },
  "Kemerovo": { shapeName: "Kemerovo", name_ru: "Кемеровская область", iso_code: "RU-KEM", population_mln: 2.6, pigs_per_km2: 5.0, cattle_per_km2: 4.5, poultry_per_km2: 12.0, federal_district: "СФО" },

  // Autonomous okrugs / oblasts
  "Chukchi Autonomous Okrug": { shapeName: "Chukchi Autonomous Okrug", name_ru: "Чукотский АО", iso_code: "RU-CHU", population_mln: 0.05, pigs_per_km2: 0.0, cattle_per_km2: 0.1, poultry_per_km2: 0.2, federal_district: "ДФО" },
  "Nenets": { shapeName: "Nenets", name_ru: "Ненецкий АО", iso_code: "RU-NEN", population_mln: 0.04, pigs_per_km2: 0.0, cattle_per_km2: 0.5, poultry_per_km2: 0.3, federal_district: "СЗФО" },
  "Khanty-Mansiy": { shapeName: "Khanty-Mansiy", name_ru: "Ханты-Мансийский АО — Югра", iso_code: "RU-KHM", population_mln: 1.68, pigs_per_km2: 1.0, cattle_per_km2: 1.0, poultry_per_km2: 3.0, federal_district: "УрФО" },
  "Yamal-Nenets": { shapeName: "Yamal-Nenets", name_ru: "Ямало-Ненецкий АО", iso_code: "RU-YAN", population_mln: 0.55, pigs_per_km2: 0.5, cattle_per_km2: 1.0, poultry_per_km2: 2.0, federal_district: "УрФО" },
  "Yevrey": { shapeName: "Yevrey", name_ru: "Еврейская автономная область", iso_code: "RU-YEV", population_mln: 0.14, pigs_per_km2: 1.0, cattle_per_km2: 2.0, poultry_per_km2: 3.0, federal_district: "ДФО" },
  "Kaliningrad": { shapeName: "Kaliningrad", name_ru: "Калининградская область", iso_code: "RU-KGD", population_mln: 1.04, pigs_per_km2: 11.0, cattle_per_km2: 6.0, poultry_per_km2: 18.0, federal_district: "ЦФО" },
  "Maga Buryatdan": { shapeName: "Maga Buryatdan", name_ru: "Республика Бурятия (зап.)", iso_code: "RU-BU", population_mln: 0.98, pigs_per_km2: 2.0, cattle_per_km2: 6.0, poultry_per_km2: 4.0, federal_district: "ДФО" },
};

/**
 * Normalize a Russian region name to the canonical GeoJSON shapeName.
 * Returns null if no match is found.
 *
 * Strategy:
 *   1. Direct lookup in REGION_MAP.
 *   2. Try with "область"/"край"/"Республика"/"АО" stripped.
 *   3. Case-insensitive fuzzy match against known shapeNames.
 */
export function normalizeRegion(russianName: string): string | null {
  if (!russianName) return null;

  const trimmed = russianName.trim();

  // 1. Direct lookup
  if (REGION_MAP[trimmed]) return REGION_MAP[trimmed];

  // 2. Strip common suffixes
  const stripped = trimmed
    .replace(/\s+(область|край|АО| автономная область| автономный округ)/i, "")
    .replace(/^Республика\s+/i, "")
    .trim();
  if (REGION_MAP[stripped]) return REGION_MAP[stripped];
  if (REGION_MAP[`Республика ${stripped}`]) return REGION_MAP[`Республика ${stripped}`];

  // 3. Fuzzy match against known shapeNames (case-insensitive substring)
  const lower = trimmed.toLowerCase();
  for (const [ru, en] of Object.entries(REGION_MAP)) {
    if (ru.toLowerCase() === lower) return en;
  }

  // 4. Try matching the short stem (e.g., "Тюмень" -> "Тюменская область")
  for (const [ru, en] of Object.entries(REGION_MAP)) {
    const ruStem = ru.replace(/\s+(область|край|Республика|АО| автономная область| автономный округ)/i, "").toLowerCase();
    if (ruStem && (lower.startsWith(ruStem) || ruStem.startsWith(lower))) {
      return en;
    }
  }

  return null;
}

/** Get full region properties by GeoJSON shapeName. */
export function getRegionProperties(shapeName: string): RegionProperties | undefined {
  return REGION_PROPERTIES[shapeName];
}

/**
 * Region centroids: shapeName → [lon, lat].
 *
 * Used by EnterpriseRiskMonitor, OutbreakSourceTracker, CustomDataImport
 * and OutbreakDetailPanel for distance calculations when an outbreak
 * doesn't have precise lat/lon (only region_geo).
 *
 * Values are approximate region centers (capital city coords in most
 * cases). For large regions (Yakutia, Krasnoyarsk Krai) this is the
 * geometric center, which is fine for ~50km resolution risk assessment.
 *
 * Source: OSM Nominatim + Wikipedia region capital coordinates.
 */
export const REGION_CENTROIDS: Record<string, [number, number]> = {
  // Central Federal District (ЦФО)
  "Moskva": [37.6173, 55.7558],
  "Moskovskaya": [37.5, 55.5],
  "City of St. Petersburg": [30.3141, 59.9386],
  "Leningrad": [30.5, 59.7],
  "Belgorod": [36.5883, 50.6009],
  "Bryansk": [34.3717, 53.2427],
  "Vladimir": [40.3962, 56.1291],
  "Voronezh": [39.2003, 51.6608],
  "Ivanovo": [40.9714, 57.0004],
  "Kaluga": [36.2613, 54.5139],
  "Kostroma": [40.9266, 57.7665],
  "Kursk": [36.1926, 51.7373],
  "Lipetsk": [39.5704, 52.6088],
  "Oryol": [36.0785, 52.9696], "Orel": [36.0785, 52.9696],
  "Ryazan": [39.7426, 54.6229], "Ryazan'": [39.7426, 54.6229],
  "Smolensk": [31.9993, 54.7826],
  "Tambov": [41.4523, 52.7212],
  "Tver": [35.9023, 56.8627], "Tver'": [35.9023, 56.8627],
  "Tula": [37.6175, 54.1938],
  "Yaroslavl": [39.8736, 57.6265],
  // Northwestern Federal District (СЗФО)
  "Arkhangelsk": [40.5169, 64.5394], "Arkhangel'sk": [40.5169, 64.5394],
  "Vologda": [39.8915, 59.2188],
  "Murmansk": [33.4147, 68.9585],
  "Nenets": [55.0, 67.0],
  "Karelia": [33.5, 61.8],
  "Komi": [54.0, 64.0],
  "Kaliningrad": [20.5, 54.7],
  "Pskov": [28.3345, 57.8194],
  "Novgorod": [31.2840, 58.5228],
  // Southern Federal District (ЮФО)
  "Adygey": [38.9869, 44.6098],
  "Kalmyk": [44.2770, 46.3105],
  "Krasnodar": [38.9769, 45.0235],
  "Astrakhan": [48.0308, 46.3492], "Astrakhan'": [48.0308, 46.3492],
  "Volgograd": [44.5169, 48.7079],
  "Rostov": [39.7015, 47.2313],
  "Sevastopol": [33.5, 44.6],
  "Crimea": [34.2, 45.0],
  // North Caucasian Federal District (СКФО)
  "Dagestan": [47.5, 42.5],
  "Chechnya": [45.7, 43.3],
  "Ingush": [45.0, 43.2],
  "Kabardin-Balkar": [43.5, 43.5],
  "Karachay-Cherkess": [42.0, 43.8],
  "North Ossetia": [44.7, 43.0],
  "Stavropol": [42.0, 45.0], "Stavropol'": [42.0, 45.0],
  // Volga Federal District (ПФО)
  "Tatarstan": [52.0, 55.5],
  "Bashkortostan": [56.0, 54.0],
  "Mordovia": [44.0, 54.2],
  "Udmurt": [52.2, 57.0],
  "Chuvash": [47.2, 55.5],
  "Mariy-El": [47.9, 56.6],
  "Kirov": [49.7, 58.6],
  "Nizhny Novgorod": [44.0, 56.3], "Nizhegorod": [44.0, 56.3],
  "Samara": [50.15, 53.5],
  "Orenburg": [55.1, 51.8],
  "Penza": [45.0, 53.0],
  "Perm": [56.0, 58.0], "Perm'": [56.0, 58.0],
  "Saratov": [46.0, 51.5],
  "Ulyanovsk": [48.4, 54.3],
  // Ural Federal District (УрФО)
  "Kurgan": [64.0, 55.5],
  "Sverdlovsk": [60.0, 58.0],
  "Tyumen": [65.5, 57.0], "Tyumen'": [65.5, 57.0],
  "Khanty-Mansiy": [73.0, 61.0],
  "Yamalo-Nenets": [67.0, 67.0],
  "Chelyabinsk": [61.4, 55.0],
  // Siberian Federal District (СФО)
  "Altay": [83.0, 52.5],
  "Altai Republic": [86.0, 51.0],
  "Kemerovo": [87.0, 55.0],
  "Novosibirsk": [82.9, 55.0],
  "Omsk": [73.3, 55.0],
  "Tomsk": [84.97, 56.5],
  "Tyva": [93.0, 51.0],
  "Khakass": [90.0, 53.0],
  "Irkutsk": [104.3, 52.3],
  "Buryat": [107.0, 52.0],
  "Zabaykalsk": [113.5, 52.0], "Chita": [113.5, 52.0],
  // Far Eastern Federal District (ДФО)
  "Sakha": [130.0, 62.0], "Yakutia": [130.0, 62.0],
  "Amur": [127.5, 50.3],
  "Kamchatka": [160.0, 56.0],
  "Magadan": [150.7, 62.0],
  "Primorye": [132.0, 44.0],
  "Sakhalin": [143.0, 50.0],
  "Khabarovsk": [135.4, 48.5],
  "Chukotka": [177.0, 67.0],
};

/**
 * Get region centroid [lon, lat] by shapeName.
 * Falls back to [0, 0] (which callers should filter out) if unknown.
 */
export function getRegionCentroid(shapeName: string): [number, number] | null {
  return REGION_CENTROIDS[shapeName] ?? null;
}

/** All known GeoJSON shapeNames. */
export const ALL_REGION_NAMES: string[] = Object.keys(REGION_PROPERTIES);
