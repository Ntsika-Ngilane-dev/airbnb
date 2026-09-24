import 'dotenv/config'
import crypto from 'node:crypto'
import cors from 'cors'
import express from 'express'
import { OAuth2Client } from 'google-auth-library'
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import mongoose from 'mongoose'
import { SignJWT, decodeJwt, importPKCS8, jwtVerify } from 'jose'
import { Reservation, Stay, User } from './models.js'

const app = express()
const port = Number(process.env.PORT || 4000)
let databaseError = null
let client = null
try {
  if (process.env.MONGODB_URI) {
    client = new MongoClient(process.env.MONGODB_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      serverSelectionTimeoutMS: 15000,
    })
  }
} catch (error) {
  databaseError = error.message
}
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null
const sessionSecret = process.env.SESSION_SECRET || 'local-development-session-secret'
const jwtSecret = new TextEncoder().encode(sessionSecret)
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@workngilane.com').toLowerCase()
const adminPassword = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV !== 'production' ? 'workngilane' : null)
const localUsers = new Map()
const localReservations = new Map()
let localStayCatalog = []
const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5174'
const _fallbackStays = [
  ['Over the clouds in the Dolomites', 'Cortina d’Ampezzo, Italy', 382, 'https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=85', 'Amazing views'],
  ['Sunlit villa with a private pool', 'Paros, Greece', 247, 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=900&q=85', 'Amazing pools'],
  ['A quiet cabin in the woods', 'Lofoten, Norway', 194, 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=900&q=85', 'Cabins'],
  ['A villa made for slow mornings', 'Uluwatu, Indonesia', 311, 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=900&q=85', 'Tropical'],
  ['Sea glass house above the coast', 'Knysna, South Africa', 168, 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=85', 'Beach'],
  ['The little red house', 'Vermont, United States', 215, 'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=900&q=85', 'Countryside'],
  ['A design stay in the city', 'Barcelona, Spain', 289, 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=85', 'Design'],
  ['Private island hideaway', 'Palawan, Philippines', 421, 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=900&q=85', 'Beach'],
  ['Glass cabin under the stars', 'Tromsø, Norway', 255, 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=900&q=85', 'OMG!'],
  ['Pool house in the olive grove', 'Mallorca, Spain', 226, 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=85', 'Amazing pools'],
  ['Warm wood and mountain air', 'Banff, Canada', 178, 'https://images.unsplash.com/photo-1542718610-a1d656d1884c?auto=format&fit=crop&w=900&q=85', 'Skiing'],
  ['The blue door in the village', 'Puglia, Italy', 137, 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=85', 'Countryside'],
  ['Eiffel Tower pied-à-terre', 'Eiffel Tower, Paris, France', 318, 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&q=85', 'Icons'],
  ['Colosseum courtyard apartment', 'Colosseum, Rome, Italy', 276, 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=900&q=85', 'Icons'],
  ['Petra stone city retreat', 'Petra, Jordan', 142, 'https://images.unsplash.com/photo-1548786811-dd6e453ccca7?auto=format&fit=crop&w=900&q=85', 'Icons'],
  ['Taj Mahal sunrise suite', 'Taj Mahal, Agra, India', 121, 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=900&q=85', 'Icons'],
  ['Machu Picchu mountain home', 'Machu Picchu, Peru', 189, 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=900&q=85', 'Icons'],
  ['Sydney Opera House harbour stay', 'Sydney Opera House, Australia', 247, 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d1?auto=format&fit=crop&w=900&q=85', 'Icons'],
]
const locations = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cambodia', 'Cameroon', 'Canada', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Democratic Republic of the Congo', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Türkiye', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
]
const destinationImages = [
  'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=240&q=80',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=240&q=80',
  'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=240&q=80',
  'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=240&q=80',
  'https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=240&q=80',
  'https://images.unsplash.com/photo-1533929736458-ca588d08c8be?auto=format&fit=crop&w=240&q=80',
  'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=240&q=80',
  'https://images.unsplash.com/photo-1526772662000-3f88f10405ff?auto=format&fit=crop&w=240&q=80',
]
const stayCategories = ['Amazing views', 'Icons', 'Amazing pools', 'Beach', 'Countryside', 'Skiing', 'OMG!', 'Cabins', 'Design', 'Tropical']

function createStays() {
  const catalog = []
  const hostNames = ['Amara', 'Theo', 'Maya', 'Nia', 'Luca', 'Sofia', 'Ethan', 'Leila', 'Noah', 'Zuri', 'Milo', 'Anika']
  const hostSurnames = ['Chen', 'Okafor', 'Meyer', 'Patel', 'Rossi', 'Williams', 'Silva', 'Khan', 'Bennett', 'Dlamini', 'Sato', 'Martin']
  const reviewerNames = ['Olivia', 'James', 'Ava', 'Mateo', 'Sophie', 'Daniel', 'Mia', 'Lucas', 'Grace', 'Eli', 'Isla', 'Henry']
  const reviewComments = ['Beautiful space and an easy check-in. We felt at home right away.', 'The location was perfect and the home was even better than the photos.', 'Everything was clean, comfortable, and thoughtfully prepared for our stay.', 'A memorable visit with a wonderful host. I would happily book this place again.', 'The neighborhood was lovely and the stay had everything we needed.', 'Such a peaceful and well-designed home. It made our trip feel effortless.']
  const imagePool = [
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1502672023488-70e25813eb80?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1448630360428-65456885c650?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=85'
  ]

  for (let countryIndex = 0; countryIndex < locations.length; countryIndex += 1) {
    const country = locations[countryIndex]
    for (let categoryIndex = 0; categoryIndex < stayCategories.length; categoryIndex += 1) {
      const category = stayCategories[categoryIndex]
      const city = `${country.split(' ')[0].replace(/[^a-zA-Z]/g, '') || 'City'} ${countryIndex + 1}`
      const location = `${city}, ${country}`
      const image = imagePool[(countryIndex + categoryIndex) % imagePool.length]
      const listingIndex = countryIndex * stayCategories.length + categoryIndex
      const hostName = `${hostNames[listingIndex % hostNames.length]} ${hostSurnames[Math.floor(listingIndex / hostNames.length) % hostSurnames.length]} · ${city} ${categoryIndex + 1}`
      const reviews = [0, 1, 2].map((reviewIndex) => ({
        author: `${reviewerNames[(listingIndex + reviewIndex * 3) % reviewerNames.length]} ${String.fromCharCode(65 + ((listingIndex + reviewIndex) % 26))}.`,
        rating: Number((4 + ((listingIndex + reviewIndex * 11) % 10) / 10).toFixed(1)),
        text: reviewComments[(listingIndex + reviewIndex * 2) % reviewComments.length],
      }))

      catalog.push({
        title: `${category} home in ${city}`,
        location,
        country,
        hostName,
        hostEmail: `host-${listingIndex + 1}@airbnb.local`,
        pricePerNight: 90 + ((countryIndex * 47) + categoryIndex * 29) % 460,
        image,
        category,
        rating: Number((4.1 + ((listingIndex * 37) % 90) / 100).toFixed(2)),
        reviewCount: 25 + ((listingIndex * 97) % 1200),
        reviews,
        guestFavorite: (countryIndex + categoryIndex) % 3 === 0,
        copyright: '© 2024 Airbnb, Inc.',
      })

    }
  }

  return catalog
}
function nightsBetween(checkIn, checkOut) { const start = new Date(checkIn); const end = new Date(checkOut); return Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) ? 0 : Math.max(0, Math.ceil((end - start) / 86400000)) }

export { app, connectDatabase }

app.use(cors())
app.use(express.json({ limit: '12mb' }))

async function signSession(payload) {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setIssuedAt().setExpirationTime('24h').sign(jwtSecret)
}
async function readSession(req) {
  const value = req.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith('airbnb_session='))?.split('=')[1]
  if (!value) return null
  try {
    const { payload } = await jwtVerify(value, jwtSecret)
    if (!payload || typeof payload.email !== 'string') return null
    const session = { ...payload }
    if (typeof session.expiresAt === 'number' && session.expiresAt < Date.now()) return null
    return session
  } catch {
    return null
  }
}
async function requireAdmin(req, res, next) { const session = await readSession(req); if (!session?.isAdmin) return res.status(401).json({ error: 'Admin authentication required' }); req.session = session; next() }
async function setSession(res, session) { const token = await signSession(session); res.setHeader('Set-Cookie', `airbnb_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`) }
function setOAuthState(res, state) { res.setHeader('Set-Cookie', `oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`) }
function getCookie(req, name) { return req.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.split('=')[1] }

app.get('/api/auth/providers', (_req, res) => res.json({ google: Boolean(process.env.GOOGLE_CLIENT_ID), apple: Boolean(process.env.APPLE_CLIENT_ID) }))
app.get('/api/auth/config', (_req, res) => res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null, appleConfigured: Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY) }))
app.get('/api/auth/me', async (req, res) => { const session = await readSession(req); res.json({ authenticated: Boolean(session), user: session ? { email: session.email, name: session.name, isAdmin: session.isAdmin } : null }) })
app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  try {
    const user = await findUser(email)
    if (!user || !passwordMatches(password, user)) return res.status(401).json({ error: 'Incorrect email or password' })
    await setSession(res, { ...publicUser(user), expiresAt: Date.now() + 86400000 })
    res.json({ user: publicUser(user) })
  } catch {
    res.status(500).json({ error: 'Unable to log in' })
  }
})
app.post('/api/auth/signup', async (req, res) => {
  const name = String(req.body.name || '').trim()
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  if (name.length < 2) return res.status(400).json({ error: 'Enter your full name' })
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' })
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })
  if (await findUser(email)) return res.status(409).json({ error: 'An account already exists for this email' })
  const passwordData = hashPassword(password)
  const user = { email, name, isAdmin: false, passwordHash: passwordData.hash, salt: passwordData.salt, createdAt: new Date() }
  await saveUser(user)
  await setSession(res, { ...publicUser(user), expiresAt: Date.now() + 86400000 })
  res.status(201).json({ user: publicUser(user) })
})
app.post('/api/auth/google/token', async (req, res) => {
  if (!googleClient) return res.status(503).json({ error: 'Google login is not configured. Set GOOGLE_CLIENT_ID in .env.' })
  const credential = String(req.body.credential || '')
  if (!credential) return res.status(400).json({ error: 'Google credential is required' })
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID })
    const payload = ticket.getPayload()
    if (!payload?.sub || !payload.email || payload.email_verified !== true) return res.status(401).json({ error: 'Invalid Google credential' })
    const email = payload.email.toLowerCase()
    const isAdmin = email === adminEmail
    await setSession(res, { email, name: payload.name || email, isAdmin, expiresAt: Date.now() + 86400000 })
    res.json({ user: { email, name: payload.name || email, isAdmin } })
  } catch { res.status(401).json({ error: 'Invalid Google credential' }) }
})
app.post('/api/auth/logout', (_req, res) => { res.setHeader('Set-Cookie', 'airbnb_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); res.json({ ok: true }) })
app.get('/api/auth/google', (req, res) => process.env.GOOGLE_AUTH_URL ? res.redirect(process.env.GOOGLE_AUTH_URL) : res.status(501).json({ error: 'Google OAuth is not configured. Set GOOGLE_AUTH_URL in .env.' }))
app.get('/api/auth/apple', (req, res) => {
  if (!process.env.APPLE_CLIENT_ID) return res.status(501).json({ error: 'Apple login is not configured. Set Apple OAuth variables in .env.' })
  const state = crypto.randomBytes(24).toString('hex'); setOAuthState(res, state)
  const params = new URLSearchParams({ response_type: 'code', response_mode: 'form_post', client_id: process.env.APPLE_CLIENT_ID, redirect_uri: `${appBaseUrl}/api/auth/apple/callback`, scope: 'name email', state })
  res.redirect(`https://appleid.apple.com/auth/authorize?${params}`)
})
app.post('/api/auth/apple/callback', async (req, res) => {
  const state = String(req.body.state || ''); const storedState = getCookie(req, 'oauth_state')
  if (!state || state !== storedState) return res.status(401).send('Apple login state validation failed')
  if (!process.env.APPLE_CLIENT_ID || !process.env.APPLE_TEAM_ID || !process.env.APPLE_KEY_ID || !process.env.APPLE_PRIVATE_KEY) return res.status(503).send('Apple login is not configured')
  try {
    const privateKey = await importPKCS8(process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'), 'ES256')
    const clientSecret = await new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: process.env.APPLE_KEY_ID, typ: 'JWT' }).setIssuer(process.env.APPLE_TEAM_ID).setAudience('https://appleid.apple.com').setSubject(process.env.APPLE_CLIENT_ID).setIssuedAt().setExpirationTime('180d').sign(privateKey)
    const tokenResponse = await fetch('https://appleid.apple.com/auth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: process.env.APPLE_CLIENT_ID, client_secret: clientSecret, code: String(req.body.code || ''), grant_type: 'authorization_code', redirect_uri: `${appBaseUrl}/api/auth/apple/callback` }) })
    const token = await tokenResponse.json(); if (!tokenResponse.ok || !token.id_token) return res.status(401).send('Apple token exchange failed')
    const claims = decodeJwt(token.id_token); const email = String(claims.email || '').toLowerCase(); if (!email) return res.status(401).send('Apple account email unavailable')
    let user = await findUser(email); if (!user) user = await saveUser({ email, name: email.split('@')[0], isAdmin: email === adminEmail, provider: 'apple', createdAt: new Date() })
    await setSession(res, { ...publicUser(user), expiresAt: Date.now() + 86400000 }); res.redirect(appBaseUrl)
  } catch { res.status(502).send('Apple login verification failed') }
})
app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
  const catalog = await getStayCatalog()
  const categoryCounts = new Map(); const locationCounts = new Map(); const ratingCounts = new Map()
  catalog.forEach((stay) => { categoryCounts.set(stay.category, (categoryCounts.get(stay.category) || 0) + 1); locationCounts.set(stay.location, (locationCounts.get(stay.location) || 0) + 1); const rating = Math.floor(Number(stay.rating || 0)); ratingCounts.set(rating, (ratingCounts.get(rating) || 0) + 1) })
  const monthly = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, index) => { const bookings = 42 + ((index * 17) % 74); return { month, bookings, revenue: bookings * (185 + ((index * 31) % 120)) } })
  const totalRevenue = monthly.reduce((sum, item) => sum + item.revenue, 0)
  const averageRating = catalog.length ? Number((catalog.reduce((sum, stay) => sum + Number(stay.rating || 0), 0) / catalog.length).toFixed(2)) : 0
  res.json({ stays: catalog.length, locations: locations.length, categories: stayCategories.length, users: usersCollection ? await usersCollection.countDocuments() : localUsers.size, averageRating, totalRevenue, categoryMix: [...categoryCounts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value), topLocations: [...locationCounts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8), ratingMix: [...ratingCounts].map(([label, value]) => ({ label, value })).sort((a, b) => b.label - a.label), monthly, copyright: '© 2024 Airbnb, Inc.', owner: 'Ntsika Ngilane' })
})
app.get('/api/admin/listings', requireAdmin, async (_req, res) => {
  const catalog = await getStayCatalog()
  res.json(catalog.map((stay) => ({
    id: stay._id ? String(stay._id) : stay.id ?? `${stay.title}-${stay.location}`,
    hostEmail: stay.hostEmail || '',
    hostName: stay.hostName || '',
    hostPhone: stay.hostPhone || '',
    title: stay.title,
    location: stay.location,
    country: stay.country || '',
    addressLine1: stay.addressLine1 || '',
    addressLine2: stay.addressLine2 || '',
    postalCode: stay.postalCode || '',
    description: stay.description || 'Comfortable Airbnb stay with thoughtful details and a welcoming atmosphere.',
    bedrooms: stay.bedrooms || 2,
    bathrooms: stay.bathrooms || 2,
    guests: stay.guests || 4,
    type: stay.type || 'Entire place',
    price: stay.pricePerNight || 0,
    amenities: stay.amenities || ['Wi‑Fi', 'Kitchen', 'Free parking'],
    image: stay.image || '',
    images: stay.images || (stay.image ? [stay.image] : []),
    weeklyDiscount: stay.weeklyDiscount || 7,
    cleaningFee: stay.cleaningFee || 45,
    serviceFee: stay.serviceFee || 55,
    occupancyTaxes: stay.occupancyTaxes || 20,
    rating: stay.rating || 4.8,
    reviewCount: stay.reviewCount || 38,
    category: stay.category || 'Cabins',
    propertySize: stay.propertySize || 0,
    furnished: stay.furnished !== false,
    parking: stay.parking || '',
    checkInFrom: stay.checkInFrom || '',
    checkOutBy: stay.checkOutBy || '',
    minimumStay: stay.minimumStay || 1,
    availability: stay.availability || '',
    houseRules: stay.houseRules || '',
    cancellationPolicy: stay.cancellationPolicy || '',
  })))
})
app.post('/api/admin/listings', requireAdmin, async (req, res) => {
  try {
    const listing = normalizeListing(req.body)
    const record = await saveStayRecord(listing)
    res.status(201).json(record)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})
app.post('/api/host/listings', async (req, res) => {
  const session = await readSession(req)
  if (!session?.email) return res.status(401).json({ error: 'Log in to start hosting' })
  try {
    const title = String(req.body.title || '').trim()
    const location = String(req.body.location || '').trim()
    const country = String(req.body.country || '').trim()
    const addressLine1 = String(req.body.addressLine1 || '').trim()
    const postalCode = String(req.body.postalCode || '').trim()
    const hostPhone = String(req.body.hostPhone || '').trim()
    const description = String(req.body.description || '').trim()
    const image = String(req.body.image || '').trim()
    const price = Number(req.body.price)
    const guests = Number(req.body.guests)
    const bedrooms = Number(req.body.bedrooms)
    const bathrooms = Number(req.body.bathrooms)
    if (title.length < 3 || location.length < 2 || country.length < 2 || addressLine1.length < 5 || postalCode.length < 2 || description.length < 20) throw new Error('Add a title, complete address, country, and a description of at least 20 characters')
    if (!/^\+?[0-9 ()-]{7,20}$/.test(hostPhone)) throw new Error('Enter a valid host phone number')
    if (!image) throw new Error('A listing image is required')
    if (!Number.isFinite(price) || price <= 0 || !Number.isInteger(guests) || guests < 1 || guests > 16 || !Number.isFinite(bedrooms) || bedrooms < 0 || !Number.isFinite(bathrooms) || bathrooms < 0) throw new Error('Enter valid home capacity and pricing details')
    if (!Array.isArray(req.body.amenities) || !req.body.amenities.length) throw new Error('Add at least one amenity')
    const listing = normalizeListing({ ...req.body, hostEmail: session.email, hostName: session.name || session.email, hostPhone })
    const record = await saveStayRecord(listing)
    const user = await findUser(session.email)
    if (user) {
      user.isAdmin = true
      await saveUser(user)
    }
    await setSession(res, { ...session, isAdmin: true, expiresAt: Date.now() + 86400000 })
    res.status(201).json({ listing: record, user: { ...publicUser(user || session), isAdmin: true } })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})
app.get('/api/admin/listings/:id', requireAdmin, async (req, res) => {
  const record = await findStayRecord(req.params.id)
  if (!record) return res.status(404).json({ error: 'Listing not found' })
  res.json(normalizeListing(record))
})
app.put('/api/admin/listings/:id', requireAdmin, async (req, res) => {
  const existing = await findStayRecord(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Listing not found' })
  try {
    const payload = normalizeListing({ ...existing, ...req.body, _id: existing._id })
    const updated = await replaceStayRecord(req.params.id, payload)
    res.json(updated)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})
app.delete('/api/admin/listings/:id', requireAdmin, async (req, res) => {
  const removed = await deleteStayRecord(req.params.id)
  if (!removed) return res.status(404).json({ error: 'Listing not found' })
  res.json({ ok: true, deleted: removed })
})

app.get('/api/reservations', async (req, res) => {
  const session = await readSession(req)
  if (!session) return res.status(401).json({ error: 'Authentication required' })
  const reservations = reservationsCollection ? await reservationsCollection.find({ userEmail: session.email }).sort({ createdAt: -1 }).toArray() : [...localReservations.values()].filter((reservation) => reservation.userEmail === session.email)
  res.json(reservations)
})
app.post('/api/reservations', async (req, res) => {
  const session = await readSession(req)
  if (!session) return res.status(401).json({ error: 'Authentication required' })
  const stayId = String(req.body.stayId || '').trim()
  const checkIn = String(req.body.checkIn || '').trim()
  const checkOut = String(req.body.checkOut || '').trim()
  const guests = Number(req.body.guests)
  const nights = nightsBetween(checkIn, checkOut)
  if (!stayId || !checkIn || !checkOut || nights < 1 || !Number.isInteger(guests) || guests < 1 || guests > 16) return res.status(400).json({ error: 'Choose valid dates and between 1 and 16 guests' })
  const stay = await findStayRecord(stayId)
  if (!stay) return res.status(404).json({ error: 'Stay not found' })
  if (guests > Number(stay.guests || 16)) return res.status(400).json({ error: 'This stay cannot accommodate that many guests' })
  const pricePerNight = Number(stay.pricePerNight || 0)
  const reservation = { userEmail: session.email, userName: session.name || session.email, stayId, stayTitle: stay.title, location: stay.location, checkIn, checkOut, guests, nights, subtotal: nights * pricePerNight, status: 'confirmed', createdAt: new Date() }
  if (reservationsCollection) { const result = await reservationsCollection.insertOne(reservation); return res.status(201).json({ ...reservation, _id: result.insertedId }) }
  const id = crypto.randomUUID(); const saved = { ...reservation, id }; localReservations.set(id, saved); res.status(201).json(saved)
})
app.put('/api/reservations/:id', async (req, res) => {
  const session = await readSession(req)
  if (!session) return res.status(401).json({ error: 'Authentication required' })
  const existing = reservationsCollection && ObjectId.isValid(req.params.id) ? await reservationsCollection.findOne({ _id: new ObjectId(req.params.id), userEmail: session.email }) : localReservations.get(req.params.id)
  if (!existing || existing.userEmail !== session.email) return res.status(404).json({ error: 'Reservation not found' })
  const checkIn = String(req.body.checkIn || existing.checkIn).trim(); const checkOut = String(req.body.checkOut || existing.checkOut).trim(); const guests = Number(req.body.guests || existing.guests); const nights = nightsBetween(checkIn, checkOut)
  if (nights < 1 || !Number.isInteger(guests) || guests < 1 || guests > 16) return res.status(400).json({ error: 'Choose valid dates and between 1 and 16 guests' })
  const updated = { ...existing, checkIn, checkOut, guests, nights, subtotal: nights * Number(existing.subtotal || 0) / Math.max(existing.nights || 1, 1), updatedAt: new Date() }
  if (reservationsCollection) { const result = await reservationsCollection.findOneAndUpdate({ _id: new ObjectId(req.params.id), userEmail: session.email }, { $set: updated }, { returnDocument: 'after' }); return res.json(result.value || updated) }
  localReservations.set(req.params.id, updated); res.json(updated)
})
app.delete('/api/reservations/:id', async (req, res) => {
  const session = await readSession(req)
  if (!session) return res.status(401).json({ error: 'Authentication required' })
  if (reservationsCollection) { if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Reservation not found' }); const result = await reservationsCollection.deleteOne({ _id: new ObjectId(req.params.id), userEmail: session.email }); if (!result.deletedCount) return res.status(404).json({ error: 'Reservation not found' }); return res.json({ ok: true }) }
  const reservation = localReservations.get(req.params.id); if (!reservation || reservation.userEmail !== session.email) return res.status(404).json({ error: 'Reservation not found' }); localReservations.delete(req.params.id); res.json({ ok: true })
})

let staysCollection
let usersCollection
let reservationsCollection
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) { return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') } }
function passwordMatches(password, record) { const candidate = crypto.scryptSync(password, record.salt, 64); return crypto.timingSafeEqual(candidate, Buffer.from(record.passwordHash, 'hex')) }
function publicUser(user) { return { email: user.email, name: user.name, isAdmin: user.isAdmin } }
function normalizeListing(payload = {}) {
  const pricePerNight = Number(payload.price || payload.pricePerNight)
  if (payload.title !== undefined && String(payload.title).trim().length < 3) throw new Error('Listing title must be at least 3 characters')
  if (payload.location !== undefined && String(payload.location).trim().length < 2) throw new Error('Listing location is required')
  if (payload.price !== undefined && (!Number.isFinite(pricePerNight) || pricePerNight <= 0)) throw new Error('Listing price must be greater than zero')
  const id = payload._id ? String(payload._id) : payload.id || undefined
  return {
    ...payload,
    _id: id ? new ObjectId(id) : undefined,
    hostEmail: String(payload.hostEmail || '').trim() || undefined,
    hostName: String(payload.hostName || '').trim() || undefined,
    hostPhone: String(payload.hostPhone || '').trim() || undefined,
    title: String(payload.title || '').trim() || 'New listing',
    location: String(payload.location || '').trim() || 'Unknown location',
    country: String(payload.country || '').trim() || 'United States',
    addressLine1: String(payload.addressLine1 || '').trim(),
    addressLine2: String(payload.addressLine2 || '').trim(),
    postalCode: String(payload.postalCode || '').trim(),
    description: String(payload.description || '').trim() || 'Comfortable Airbnb stay.',
    bedrooms: Number(payload.bedrooms || 2),
    bathrooms: Number(payload.bathrooms || 2),
    guests: Number(payload.guests || 4),
    type: String(payload.type || 'Entire place').trim(),
    pricePerNight: Number.isFinite(pricePerNight) && pricePerNight > 0 ? pricePerNight : 150,
    amenities: Array.isArray(payload.amenities) && payload.amenities.length ? payload.amenities : ['Wi‑Fi', 'Kitchen', 'Free parking'],
    image: String(payload.image || 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=85'),
    images: Array.isArray(payload.images) && payload.images.length ? payload.images : [String(payload.image || 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=85')],
    weeklyDiscount: Number(payload.weeklyDiscount || 7),
    cleaningFee: Number(payload.cleaningFee || 45),
    serviceFee: Number(payload.serviceFee || 55),
    occupancyTaxes: Number(payload.occupancyTaxes || 20),
    rating: Number(payload.rating || 4.8),
    reviewCount: Number(payload.reviewCount || 38),
    category: String(payload.category || 'Cabins').trim(),
    propertySize: Number(payload.propertySize || 0) || undefined,
    furnished: payload.furnished !== false,
    parking: String(payload.parking || '').trim(),
    checkInFrom: String(payload.checkInFrom || '').trim(),
    checkOutBy: String(payload.checkOutBy || '').trim(),
    minimumStay: Math.max(1, Number(payload.minimumStay || 1)),
    availability: String(payload.availability || '').trim(),
    houseRules: String(payload.houseRules || '').trim(),
    cancellationPolicy: String(payload.cancellationPolicy || '').trim(),
    guestFavorite: Boolean(payload.guestFavorite),
    copyright: payload.copyright || '© 2024 Airbnb, Inc.'
  }
}
async function getStayCatalog() {
  if (staysCollection) return staysCollection.find({}).toArray()
  if (!localStayCatalog.length) localStayCatalog = createStays()
  return [...localStayCatalog]
}
async function findStayRecord(id) {
  if (staysCollection) {
    if (!ObjectId.isValid(id)) return null
    return staysCollection.findOne({ _id: new ObjectId(id) })
  }
  if (!localStayCatalog.length) localStayCatalog = createStays()
  return localStayCatalog.find((stay) => String(stay._id || stay.id || `${stay.title}-${stay.location}`) === String(id)) || null
}
async function saveStayRecord(payload) {
  const record = normalizeListing(payload)
  if (staysCollection) {
    const result = await staysCollection.insertOne(record)
    return { ...record, _id: result.insertedId }
  }
  const id = crypto.randomUUID()
  const item = { ...record, _id: id, id }
  localStayCatalog = [...localStayCatalog, item]
  return item
}
async function replaceStayRecord(id, payload) {
  const record = normalizeListing({ ...payload, _id: id })
  if (staysCollection) {
    const result = await staysCollection.findOneAndUpdate({ _id: new ObjectId(id) }, { $set: record }, { returnDocument: 'after' })
    return result.value || record
  }
  localStayCatalog = localStayCatalog.map((stay) => String(stay._id || stay.id || `${stay.title}-${stay.location}`) === String(id) ? { ...record, _id: id, id } : stay)
  return { ...record, _id: id, id }
}
async function deleteStayRecord(id) {
  if (staysCollection) {
    if (!ObjectId.isValid(id)) return null
    const filter = { _id: new ObjectId(id) }
    const existing = await staysCollection.findOne(filter)
    if (!existing) return null
    await staysCollection.deleteOne(filter)
    return existing
  }
  const existing = localStayCatalog.find((stay) => String(stay._id || stay.id || `${stay.title}-${stay.location}`) === String(id))
  if (!existing) return null
  localStayCatalog = localStayCatalog.filter((stay) => String(stay._id || stay.id || `${stay.title}-${stay.location}`) !== String(id))
  return existing
}
async function findUser(email) { return usersCollection ? usersCollection.findOne({ email }) : localUsers.get(email) }
async function saveUser(user) { if (usersCollection) { const { _id, ...userData } = user; await usersCollection.updateOne({ email: user.email }, { $set: userData }, { upsert: true }) } else localUsers.set(user.email, user); return user }
async function connectDatabase() {
  if (!client) throw new Error('MONGODB_URI is missing from .env')
  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || 'airbnb_clone', serverSelectionTimeoutMS: 15000 })
  await client.connect()
  await client.db('admin').command({ ping: 1 })
  staysCollection = Stay.collection
  usersCollection = User.collection
  reservationsCollection = Reservation.collection
  await usersCollection.createIndex({ email: 1 }, { unique: true })
  if (adminPassword) { const adminHash = hashPassword(adminPassword); await usersCollection.updateOne({ email: adminEmail }, { $set: { email: adminEmail, name: 'Workngilane Admin', isAdmin: true, passwordHash: adminHash.hash, salt: adminHash.salt }, $setOnInsert: { createdAt: new Date() } }, { upsert: true }) }
  const stayCount = await staysCollection.countDocuments()
  const expectedStayCount = locations.length * stayCategories.length
  if (stayCount < expectedStayCount) {
    await staysCollection.deleteMany({})
    await staysCollection.insertMany(createStays())
  }
  databaseError = null
  console.log('MongoDB connected and stays seeded')
}
function useCollection() { return staysCollection }
if (adminPassword) { const adminHash = hashPassword(adminPassword); localUsers.set(adminEmail, { email: adminEmail, name: 'Workngilane Admin', isAdmin: true, passwordHash: adminHash.hash, salt: adminHash.salt, createdAt: new Date() }) }

app.get('/api/health', (_req, res) => { const error = databaseError || app.locals.databaseError || null; return res.status(error ? 503 : 200).json({ ok: !error, database: Boolean(useCollection()), error, copyright: 'Ntsika Ngilane' }) })
app.get('/api/stays', async (req, res) => {
  const locationQuery = String(req.query.location || '').trim()
  const categoryQuery = String(req.query.category || '').trim()
  const collection = useCollection()
  const limit = Math.min(Number(req.query.limit) || 60, 1000)

  const filters = {}
  if (categoryQuery) filters.category = categoryQuery
  if (locationQuery) {
    filters.$or = [
      { location: { $regex: locationQuery, $options: 'i' } },
      { country: { $regex: locationQuery, $options: 'i' } }
    ]
  }

  const source = collection
    ? await collection.find(filters).limit(limit).toArray()
    : (localStayCatalog.length ? localStayCatalog : createStays()).filter((stay) => (!categoryQuery || stay.category === categoryQuery) && (!locationQuery || stay.location.toLowerCase().includes(locationQuery.toLowerCase()) || stay.country.toLowerCase().includes(locationQuery.toLowerCase()))).slice(0, limit)

  res.json(source)
})
app.get('/api/stays/:id', async (req, res) => {
  const collection = useCollection()
  const listingId = decodeURIComponent(req.params.id)
  const stay = collection
    ? await collection.findOne(ObjectId.isValid(listingId) ? { _id: new ObjectId(listingId) } : { title: listingId })
    : (localStayCatalog.length ? localStayCatalog : createStays()).find((item) => item.title === listingId || String(item._id || item.id) === listingId)
  if (!stay) return res.status(404).json({ error: 'Stay not found' })
  res.json(stay)
})
app.get('/api/locations', async (req, res) => {
  const query = String(req.query.q || '').trim()
  if (!query && !process.env.GOOGLE_MAPS_API_KEY) return res.json(locations.slice(0, 12).map((label, index) => ({ label, image: destinationImages[index % destinationImages.length] })))
  if (process.env.GOOGLE_MAPS_API_KEY) {
    const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=(cities)&key=${process.env.GOOGLE_MAPS_API_KEY}`)
    const data = await response.json()
    return res.json((data.predictions || []).map((item, index) => ({ label: item.description, placeId: item.place_id, image: destinationImages[index % destinationImages.length] })))
  }
  const filtered = query ? locations.filter((item) => item.toLowerCase().includes(query.toLowerCase())).slice(0, 12) : locations.slice(0, 12)
  res.json(filtered.map((label, index) => ({ label, image: destinationImages[index % destinationImages.length] })))
})
app.get('/api/locations/all', (_req, res) => res.json(locations.map((label, index) => ({ label, image: destinationImages[index % destinationImages.length] }))))
app.post('/api/quote', (req, res) => {
  const nights = nightsBetween(req.body.checkIn, req.body.checkOut)
  const nightly = Number(req.body.pricePerNight || 0)
  const subtotal = nights * nightly
  res.json({ nights, nightly, subtotal, cleaningFee: Math.round(subtotal * 0.08), serviceFee: Math.round(subtotal * 0.12), total: Math.round(subtotal * 1.2 + subtotal * 0.08) })
})
if (!process.env.VERCEL) {
  app.listen(port, async () => {
    try {
      await connectDatabase()
    } catch (error) {
      databaseError = error.message
      console.error(`MongoDB unavailable; using local seed data: ${error.message}`)
    }
    console.log(`API running at http://localhost:${port}`)
  })
}