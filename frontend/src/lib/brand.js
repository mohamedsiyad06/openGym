// The name this build shows people: the launcher label, the page title and every sentence that
// names the app. The code, the file names (Documents/openGym, opengym-*.json), the app id and the
// links to the upstream project keep "openGym": they are not what the app is called on screen.
export const APP_NAME = 'Siyad Lift App'

// The in-app updater (lib/update.js) looks for upstream openGym's releases. An update from there is
// a different app without this build's changes, so this build never offers one: its new versions
// come from this fork's own "phone-latest" release (.github/workflows/phone-apk.yml).
export const UPSTREAM_UPDATES = false

// "openGym" as a word in a sentence, not inside a path, a file name or a domain.
const WORD = /(?<![/\w.-])openGym(?![\w/.-]\w)/g

// English "an openGym" reads "a Siyad Lift App": the article follows the new name's first sound.
const AN = /\b(a|A)n openGym(?![\w/.-]\w)/g
const article = /^[aeiou]/i.test(APP_NAME) ? 'n' : ''

/** The text with the app's name in place of "openGym" wherever it stands as a word. */
export const branded = s => (typeof s === 'string' && s.includes('openGym')
  ? s.replace(AN, (_, a) => `${a}${article} openGym`).replace(WORD, APP_NAME) : s)
