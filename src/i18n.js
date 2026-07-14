import en from './copy/en.json'
import it from './copy/it.json'

// Language: ?lang=it|en wins, otherwise the browser decides.
// Chosen once at load — switching reloads with the param set.
const param = new URLSearchParams(window.location.search).get('lang')
const browser = (navigator.language || 'en').slice(0, 2)
export const LANG = (param || browser) === 'it' ? 'it' : 'en'
export const STR = LANG === 'it' ? it : en

// tiny template helper: fill('{icon} {label}', {icon: '🍋', label: 'bergamot'})
export function fill(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
}

export function switchLang() {
  const url = new URL(window.location.href)
  url.searchParams.set('lang', LANG === 'it' ? 'en' : 'it')
  window.location.href = url.toString()
}
