import { describe, it, expect } from 'vitest'
import { effectivePage, groupsForPage } from './quickMenu'

const GROUPS = [
  { id: 'g-hot', page: 1 },
  { id: 'g-bar', page: 2 },
  { id: 'g-service', page: 3 },
]

describe('effectivePage', () => {
  it('без оверрайда — страница по умолчанию', () => {
    expect(effectivePage({ id: 'g-hot', page: 1 }, {})).toBe(1)
  })
  it('оверрайд перекрывает страницу', () => {
    expect(effectivePage({ id: 'g-hot', page: 1 }, { 'g-hot': 3 })).toBe(3)
  })
})

describe('groupsForPage', () => {
  it('по умолчанию группы на своих страницах', () => {
    expect(groupsForPage(GROUPS, {}, 1).map((g) => g.id)).toEqual(['g-hot'])
    expect(groupsForPage(GROUPS, {}, 2).map((g) => g.id)).toEqual(['g-bar'])
  })
  it('оверрайд перемещает группу на другую страницу', () => {
    const over = { 'g-bar': 1 } // бар → страница 1
    expect(groupsForPage(GROUPS, over, 1).map((g) => g.id)).toEqual(['g-hot', 'g-bar'])
    expect(groupsForPage(GROUPS, over, 2)).toEqual([])
  })
})
