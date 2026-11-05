import type { EquipmentItem } from "@/lib/site-content";

export const equipmentSortOptions = [
  { value: "recommended", label: "Recommended" },
  { value: "price-asc", label: "Price: low-high" },
  { value: "price-desc", label: "Price: high-low" },
  { value: "name", label: "Name: A-Z" },
] as const;

export type EquipmentFilters = {
  query: string;
  category: string;
  sort: (typeof equipmentSortOptions)[number]["value"];
};

export const defaultEquipmentFilters: EquipmentFilters = {
  query: "",
  category: "all",
  sort: "recommended",
};

function normaliseSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function equipmentCategoryKey(category: string) {
  return normaliseSearch(category).replace(/\s+/g, "-");
}

export function getEquipmentCategories(items: EquipmentItem[]) {
  return Array.from(new Set(items.map((item) => item.category))).map((label) => ({
    key: equipmentCategoryKey(label),
    label,
    count: items.filter((item) => item.category === label).length,
  }));
}

export function readEquipmentFilters(
  params: Pick<URLSearchParams, "get">,
  items: EquipmentItem[],
): EquipmentFilters {
  const category = getEquipmentCategories(items).find((entry) => entry.key === params.get("category"));

  return {
    query: params.get("q") ?? "",
    category: category?.key ?? "all",
    sort: equipmentSortOptions.find((option) => option.value === params.get("sort"))?.value
      ?? "recommended",
  };
}

export function filterEquipment(items: EquipmentItem[], filters: EquipmentFilters) {
  const aliases: Record<string, string> = {
    mics: "microphone",
    mic: "microphone",
    subs: "subwoofer",
    sub: "subwoofer",
    fog: "smoke",
    lights: "light",
  };
  const terms = normaliseSearch(filters.query)
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => aliases[term] ?? term);
  const matches = items.filter((item) => {
    if (filters.category !== "all" && equipmentCategoryKey(item.category) !== filters.category) {
      return false;
    }

    const searchable = normaliseSearch([
      item.name,
      item.category,
      item.description,
      ...item.details,
      ...item.options.map((option) => option.label),
    ].join(" "));

    const words = searchable.split(" ");
    return terms.every((term) => words.some((word) =>
      word === term
      || ((term.length > 2 || /\d/.test(word)) && word.startsWith(term))
      || (/\d/.test(term) && word.includes(term)),
    ));
  });

  if (filters.sort === "name") {
    return matches.sort((a, b) => a.name.localeCompare(b.name, "en-AU"));
  }
  if (filters.sort === "price-asc" || filters.sort === "price-desc") {
    const direction = filters.sort === "price-asc" ? 1 : -1;
    return matches.sort((a, b) =>
      (Math.min(...a.options.map((option) => option.price))
        - Math.min(...b.options.map((option) => option.price))) * direction,
    );
  }

  return matches;
}
