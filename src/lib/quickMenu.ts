// Быстрое меню (раздел 05): раскладка групп блюд по страницам кассы.
// Каждая группа имеет страницу по умолчанию (page); офис может переназначить её (override).
// Касса показывает на странице N группы, у которых эффективная страница == N.

export interface PagedGroup { id: string; page: number }

// Эффективная страница группы: оверрайд из офиса ?? страница по умолчанию.
export const effectivePage = (g: PagedGroup, override: Record<string, number>): number => override[g.id] ?? g.page

// Группы для страницы кассы с учётом оверрайда.
export function groupsForPage<T extends PagedGroup>(groups: T[], override: Record<string, number>, page: number): T[] {
  return groups.filter((g) => effectivePage(g, override) === page)
}
