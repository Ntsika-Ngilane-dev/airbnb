import { app, connectDatabase } from '../server/index.js'

let databasePromise

export default async function handler(req, res) {
  databasePromise ||= connectDatabase().catch((error) => {
    console.error(`MongoDB unavailable: ${error.message}`)
    app.locals.databaseError = error.message
    return null
  })
  await databasePromise
  return app(req, res)
}
