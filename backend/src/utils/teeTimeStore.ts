import { db } from '../index'
import { SCHEDULE_SOURCE } from '../constants'
import type { StoredTeeTime, TeeTime, TeeTimeActiveIndex } from '../types'

/**
 * Reads the currently-active tee times persisted in Firestore for the given
 * (scheduleIds × dates) cross product. Performs zero upstream provider calls.
 *
 * Returns wire-shape TeeTime[] with doc ID as `id`.
 */
export async function readActiveTeeTimes(
  scheduleIds: string[],
  dates: string[]
): Promise<TeeTime[]> {
  if (scheduleIds.length === 0 || dates.length === 0) return []

  const indexIds: string[] = []
  for (const scheduleId of scheduleIds) {
    const source = SCHEDULE_SOURCE[scheduleId] ?? 'foreup'
    for (const date of dates) {
      indexIds.push(`${source}_${scheduleId}_${date}`)
    }
  }

  const indexRefs = indexIds.map(id => db.collection('teeTimeActive').doc(id))
  const indexSnaps = await db.getAll(...indexRefs)

  const teeTimeDocIds: string[] = []
  indexSnaps.forEach((snap, i) => {
    if (!snap.exists) return
    const data = snap.data() as TeeTimeActiveIndex | undefined
    const activeTimes = data?.activeTimes ?? []
    const indexId = indexIds[i]!
    for (const time of activeTimes) {
      teeTimeDocIds.push(`${indexId}_${time}`)
    }
  })

  if (teeTimeDocIds.length === 0) return []

  const teeTimeRefs = teeTimeDocIds.map(id => db.collection('teeTimes').doc(id))
  const teeTimeSnaps = await db.getAll(...teeTimeRefs)

  const out: TeeTime[] = []
  teeTimeSnaps.forEach((snap, i) => {
    if (!snap.exists) return
    const stored = snap.data() as StoredTeeTime
    if (stored.status !== 'active') return
    out.push({
      id: teeTimeDocIds[i]!,
      source: stored.source,
      scheduleId: stored.scheduleId,
      ...(stored.scheduleName !== undefined && { scheduleName: stored.scheduleName }),
      date: stored.date,
      time: stored.time,
      availableSpots: stored.availableSpots,
      ...(stored.price !== undefined && { price: stored.price }),
      ...(stored.weather && { weather: stored.weather }),
    })
  })

  return out
}
