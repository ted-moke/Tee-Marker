import 'dotenv/config'
import { ezLinksAdapter } from '../src/adapters/EzLinksAdapter'

async function run() {
  console.log('[debug] Initializing EzLinks adapter...')
  await ezLinksAdapter.initialize()

  console.log('[debug] Calling fetchReservations(forceRefresh=true)...')
  const reservations = await ezLinksAdapter.fetchReservations(true)

  console.log('[debug] Mapped reservations:')
  console.log(JSON.stringify(reservations, null, 2))
  console.log(`[debug] Total: ${reservations.length}`)
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[debug] Unexpected error:', err)
    process.exit(1)
  })
