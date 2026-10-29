// The name this build shows people: the launcher label, the page title, every sentence that names
// the app, the files it saves for you and the folder its backups go to. What nobody sees keeps
// "openGym": the code, the app id (changing it would make a new app and lose the data on the
// phone), the app's own data files, and the credit and licence lines that must name the original.
export const APP_NAME = 'Siyad Lift App'
/** The start of every file name this app saves for you: siyad-lift-app-backup-2026-10-29.json */
export const FILE_PREFIX = 'siyad-lift-app'
/** Documents/<this>: where the auto-backups go on Android. */
export const BACKUP_DIR = 'Siyad Lift App'
/** This build's source, which the AGPL asks to offer, and where its APK is published. */
export const SOURCE_URL = 'https://github.com/mohamedsiyad06/openGym'
export const APK_URL = SOURCE_URL + '/releases/tag/phone-latest'

// The in-app updater (lib/update.js) looks for upstream openGym's releases. An update from there is
// a different app without this build's changes, so this build never offers one: its new versions
// come from this fork's own "phone-latest" release (.github/workflows/phone-apk.yml).
export const UPSTREAM_UPDATES = false

// "openGym" as a word in a sentence, not inside a path, a file name or a domain.
const WORD = /(?<![/\w.-])openGym(?![\w/.-]\w)/g

// English "an openGym" reads "a Siyad Lift App": the article follows the new name's first sound.
const AN = /\b(a|A)n openGym(?![\w/.-]\w)/g
const article = /^[aeiou]/i.test(APP_NAME) ? 'n' : ''

/** The text with the app's name in place of "openGym" wherever it stands as a word, and the
 *  backup folder's new name where a sentence names it. */
export const branded = s => (typeof s === 'string' && s.includes('openGym')
  ? s.replaceAll('Documents/openGym', 'Documents/' + BACKUP_DIR).replace(AN, (_, a) => `${a}${article} openGym`).replace(WORD, APP_NAME) : s)
