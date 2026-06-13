// «Печать» на чековый принтер/ФР (мок) — всплывающий тост вместо alert.
// На реальном железе сюда подключается драйвер ФР / Webkassa.
const PRINTER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>'

export function printToast(text: string) {
  const el = document.createElement('div')
  const span = document.createElement('span')
  span.textContent = text
  el.innerHTML = PRINTER_SVG
  el.appendChild(span)
  el.className =
    'fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/85 text-white px-5 py-3 rounded-lg z-50 text-sm shadow-lg whitespace-pre-line text-center flex items-center gap-2 justify-center'
  document.body.appendChild(el)
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s' }, 1500)
  setTimeout(() => el.remove(), 1900)
}

// Обычный информационный тост (без иконки принтера) — для «Обновить», «Параметры применены» и т.п.
export function toast(text: string) {
  const el = document.createElement('div')
  el.textContent = text
  el.className =
    'fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/85 text-white px-5 py-3 rounded-lg z-50 text-sm shadow-lg whitespace-pre-line text-center'
  document.body.appendChild(el)
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s' }, 1500)
  setTimeout(() => el.remove(), 1900)
}
