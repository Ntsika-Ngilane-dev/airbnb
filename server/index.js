import 'dotenv/config'
import crypto from 'node:crypto'
import cors from 'cors'
import express from 'express'
import { MongoClient, ObjectId } from 'mongodb'

const app = express()
const port = Number(process.env.PORT || 4000)
const client = process.env.MONGODB_URI ? new MongoClient(process.env.MONGODB_URI) : null
const sessionSecret = process.env.SESSION_SECRET || 'local-development-session-secret'
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@workngilane.com').toLowerCase()
const adminPassword = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV !== 'production' ? 'workngilane' : null)
const localUsers = new Map()
const fallbackStays = [
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
  'Cape Town, South Africa', 'Johannesburg, South Africa', 'Durban, South Africa', 'Marrakesh, Morocco', 'Cairo, Egypt', 'Nairobi, Kenya', 'Lagos, Nigeria', 'Accra, Ghana', 'Zanzibar, Tanzania', 'Victoria Falls, Zimbabwe',
  'Lisbon, Portugal', 'Porto, Portugal', 'Madrid, Spain', 'Barcelona, Spain', 'Seville, Spain', 'Paris, France', 'Nice, France', 'Rome, Italy', 'Milan, Italy', 'Venice, Italy', 'Florence, Italy', 'Athens, Greece', 'Santorini, Greece', 'Mykonos, Greece', 'Amsterdam, Netherlands', 'Brussels, Belgium', 'Berlin, Germany', 'Munich, Germany', 'Vienna, Austria', 'Prague, Czechia', 'Budapest, Hungary', 'Dublin, Ireland', 'Edinburgh, United Kingdom', 'London, United Kingdom', 'Reykjavik, Iceland', 'Copenhagen, Denmark', 'Stockholm, Sweden', 'Oslo, Norway', 'Helsinki, Finland', 'Zurich, Switzerland', 'Dubrovnik, Croatia', 'Istanbul, Türkiye', 'Tbilisi, Georgia', 'Moscow, Russia',
  'New York, United States', 'Los Angeles, United States', 'San Francisco, United States', 'Miami, United States', 'Chicago, United States', 'Las Vegas, United States', 'Seattle, United States', 'Boston, United States', 'New Orleans, United States', 'Austin, United States', 'Nashville, United States', 'Honolulu, United States', 'Toronto, Canada', 'Vancouver, Canada', 'Montreal, Canada', 'Calgary, Canada', 'Mexico City, Mexico', 'Cancún, Mexico', 'Tulum, Mexico', 'Havana, Cuba', 'San José, Costa Rica', 'Panama City, Panama', 'Santo Domingo, Dominican Republic', 'Kingston, Jamaica',
  'Rio de Janeiro, Brazil', 'São Paulo, Brazil', 'Buenos Aires, Argentina', 'Santiago, Chile', 'Lima, Peru', 'Cusco, Peru', 'Cartagena, Colombia', 'Bogotá, Colombia', 'Quito, Ecuador', 'La Paz, Bolivia', 'Montevideo, Uruguay',
  'Tokyo, Japan', 'Kyoto, Japan', 'Osaka, Japan', 'Sapporo, Japan', 'Seoul, South Korea', 'Beijing, China', 'Shanghai, China', 'Hong Kong', 'Taipei, Taiwan', 'Bangkok, Thailand', 'Chiang Mai, Thailand', 'Phuket, Thailand', 'Singapore', 'Kuala Lumpur, Malaysia', 'Bali, Indonesia', 'Uluwatu, Indonesia', 'Jakarta, Indonesia', 'Manila, Philippines', 'Palawan, Philippines', 'Hanoi, Vietnam', 'Ho Chi Minh City, Vietnam', 'Siem Reap, Cambodia', 'Kathmandu, Nepal', 'New Delhi, India', 'Mumbai, India', 'Goa, India', 'Malé, Maldives', 'Dubai, United Arab Emirates', 'Abu Dhabi, United Arab Emirates', 'Doha, Qatar', 'Muscat, Oman', 'Tel Aviv, Israel', 'Amman, Jordan', 'Riyadh, Saudi Arabia',
  'Sydney, Australia', 'Sydney Opera House, Australia', 'Melbourne, Australia', 'Brisbane, Australia', 'Perth, Australia', 'Gold Coast, Australia', 'Auckland, New Zealand', 'Queenstown, New Zealand', 'Wellington, New Zealand', 'Fiji', 'Seychelles', 'Mauritius',
  'Eiffel Tower, Paris, France', 'Colosseum, Rome, Italy', 'Petra, Jordan', 'Taj Mahal, Agra, India', 'Machu Picchu, Peru', 'Great Wall of China, Beijing, China', 'Christ the Redeemer, Rio de Janeiro, Brazil', 'Table Mountain, Cape Town, South Africa', 'Burj Khalifa, Dubai, United Arab Emirates', 'Acropolis, Athens, Greece', 'Sagrada Família, Barcelona, Spain',
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
  for (let index = 0; index < 1000; index += 1) {
    const base = fallbackStays[index % fallbackStays.length]
    const location = locations[index % locations.length]
    const category = index < fallbackStays.length ? base[4] : stayCategories[index % stayCategories.length]
    catalog.push({
      title: index < fallbackStays.length ? base[0] : `${category} home in ${location.split(',')[0]} ${Math.floor(index / locations.length) + 1}`,
      location,
      pricePerNight: 90 + ((index * 37) % 460),
      image: base[3],
      category,
      rating: Number((4.51 + ((index * 0.07) % 0.49)).toFixed(2)),
      reviewCount: 23 + ((index * 41) % 980),
      guestFavorite: index % 3 === 0,
      copyright: '© 2024 Airbnb, Inc.',
    })
  }
  return catalog
}
function nightsBetween(checkIn, checkOut) { const start = new Date(checkIn); const end = new Date(checkOut); return Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) ? 0 : Math.max(0, Math.ceil((end - start) / 86400000)) }

app.use(cors())
app.use(express.json())

function signSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', sessionSecret).update(body).digest('base64url')
  return `${body}.${signature}`
}
function readSession(req) {
  const value = req.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith('airbnb_session='))?.split('=')[1]
  if (!value) return null
  const [body, signature] = value.split('.')
  if (!body || !signature) return null
  const expected = crypto.createHmac('sha256', sessionSecret).update(body).digest('base64url')
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  try { const session = JSON.parse(Buffer.from(body, 'base64url').toString()); return session.expiresAt > Date.now() ? session : null } catch { return null }
}
function requireAdmin(req, res, next) { const session = readSession(req); if (!session?.isAdmin) return res.status(401).json({ error: 'Admin authentication required' }); req.session = session; next() }
function setSession(res, session) { res.setHeader('Set-Cookie', `airbnb_session=${signSession(session)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`) }

app.get('/api/auth/providers', (_req, res) => res.json({ google: Boolean(process.env.GOOGLE_AUTH_URL), apple: Boolean(process.env.APPLE_AUTH_URL) }))
app.get('/api/auth/config', (_req, res) => res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null }))
app.get('/api/auth/me', (req, res) => { const session = readSession(req); res.json({ authenticated: Boolean(session), user: session ? { email: session.email, name: session.name, isAdmin: session.isAdmin } : null }) })
app.post('/api/auth/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  return findUser(email).then((user) => {
    if (!user || !passwordMatches(password, user)) return res.status(401).json({ error: 'Incorrect email or password' })
    setSession(res, { ...publicUser(user), expiresAt: Date.now() + 86400000 })
    res.json({ user: publicUser(user) })
  }).catch(() => res.status(500).json({ error: 'Unable to log in' }))
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
  setSession(res, { ...publicUser(user), expiresAt: Date.now() + 86400000 })
  res.status(201).json({ user: publicUser(user) })
})
app.post('/api/auth/google/token', async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'Google login is not configured. Set GOOGLE_CLIENT_ID in .env.' })
  const credential = String(req.body.credential || '')
  if (!credential) return res.status(400).json({ error: 'Google credential is required' })
  try {
    const tokenResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`)
    const token = await tokenResponse.json()
    if (!tokenResponse.ok || token.aud !== process.env.GOOGLE_CLIENT_ID || !token.email_verified) return res.status(401).json({ error: 'Invalid Google credential' })
    const email = String(token.email).toLowerCase()
    const isAdmin = email === adminEmail
    setSession(res, { email, name: token.name || email, isAdmin, expiresAt: Date.now() + 86400000 })
    res.json({ user: { email, name: token.name || email, isAdmin } })
  } catch { res.status(502).json({ error: 'Google verification failed' }) }
})
app.post('/api/auth/logout', (_req, res) => { res.setHeader('Set-Cookie', 'airbnb_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); res.json({ ok: true }) })
app.get('/api/auth/google', (req, res) => process.env.GOOGLE_AUTH_URL ? res.redirect(process.env.GOOGLE_AUTH_URL) : res.status(501).json({ error: 'Google OAuth is not configured. Set GOOGLE_AUTH_URL in .env.' }))
app.get('/api/auth/apple', (req, res) => process.env.APPLE_AUTH_URL ? res.redirect(process.env.APPLE_AUTH_URL) : res.status(501).json({ error: 'Apple OAuth is not configured. Set APPLE_AUTH_URL in .env.' }))
app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
  const catalog = useCollection() ? await staysCollection.find({}, { projection: { location: 1, category: 1, rating: 1, pricePerNight: 1 } }).toArray() : createStays()
  const categoryCounts = new Map(); const locationCounts = new Map(); const ratingCounts = new Map()
  catalog.forEach((stay) => { categoryCounts.set(stay.category, (categoryCounts.get(stay.category) || 0) + 1); locationCounts.set(stay.location, (locationCounts.get(stay.location) || 0) + 1); const rating = Math.floor(Number(stay.rating || 0)); ratingCounts.set(rating, (ratingCounts.get(rating) || 0) + 1) })
  const monthly = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, index) => { const bookings = 42 + ((index * 17) % 74); return { month, bookings, revenue: bookings * (185 + ((index * 31) % 120)) } })
  const totalRevenue = monthly.reduce((sum, item) => sum + item.revenue, 0)
  const averageRating = catalog.length ? Number((catalog.reduce((sum, stay) => sum + Number(stay.rating || 0), 0) / catalog.length).toFixed(2)) : 0
  res.json({ stays: catalog.length, locations: locations.length, categories: stayCategories.length, users: usersCollection ? await usersCollection.countDocuments() : localUsers.size, averageRating, totalRevenue, categoryMix: [...categoryCounts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value), topLocations: [...locationCounts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8), ratingMix: [...ratingCounts].map(([label, value]) => ({ label, value })).sort((a, b) => b.label - a.label), monthly, copyright: '© 2024 Airbnb, Inc.', owner: 'Ntsika Ngilane' })
})

let staysCollection
let usersCollection
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) { return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') } }
function passwordMatches(password, record) { const candidate = crypto.scryptSync(password, record.salt, 64); return crypto.timingSafeEqual(candidate, Buffer.from(record.passwordHash, 'hex')) }
function publicUser(user) { return { email: user.email, name: user.name, isAdmin: user.isAdmin } }
async function findUser(email) { return usersCollection ? usersCollection.findOne({ email }) : localUsers.get(email) }
async function saveUser(user) { if (usersCollection) await usersCollection.updateOne({ email: user.email }, { $set: user }, { upsert: true }); else localUsers.set(user.email, user); return user }
async function connectDatabase() {
  if (!client) return
  await client.connect()
  staysCollection = client.db(process.env.MONGODB_DB || 'airbnb_clone').collection('stays')
  usersCollection = client.db(process.env.MONGODB_DB || 'airbnb_clone').collection('users')
  await usersCollection.createIndex({ email: 1 }, { unique: true })
  if (adminPassword) { const adminHash = hashPassword(adminPassword); await usersCollection.updateOne({ email: adminEmail }, { $setOnInsert: { email: adminEmail, name: 'Workngilane Admin', isAdmin: true, passwordHash: adminHash.hash, salt: adminHash.salt, createdAt: new Date() } }, { upsert: true }) }
  const stayCount = await staysCollection.countDocuments()
  if (stayCount < 1000) {
    await staysCollection.deleteMany({})
    await staysCollection.insertMany(createStays())
  }
  console.log('MongoDB connected and stays seeded')
}
function useCollection() { return staysCollection }
if (adminPassword) { const adminHash = hashPassword(adminPassword); localUsers.set(adminEmail, { email: adminEmail, name: 'Workngilane Admin', isAdmin: true, passwordHash: adminHash.hash, salt: adminHash.salt, createdAt: new Date() }) }

app.get('/api/health', (_req, res) => res.json({ ok: true, database: Boolean(useCollection()), copyright: 'Ntsika Ngilane' }))
app.get('/api/stays', async (req, res) => {
  const { location = '', category = '' } = req.query
  const collection = useCollection()
  const limit = Math.min(Number(req.query.limit) || 60, 1000)
  const source = collection ? await collection.find({ ...(category ? { category } : {}), ...(location ? { location: { $regex: location, $options: 'i' } } : {}) }).limit(limit).toArray() : createStays().filter((stay) => (!category || stay.category === category) && (!location || stay.location.toLowerCase().includes(location.toLowerCase()))).slice(0, limit)
  res.json(source)
})
app.get('/api/stays/:id', async (req, res) => {
  const collection = useCollection()
  const stay = collection && ObjectId.isValid(req.params.id) ? await collection.findOne({ _id: new ObjectId(req.params.id) }) : createStays().find((item) => item.title === decodeURIComponent(req.params.id))
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
  res.json(locations.filter((item) => item.toLowerCase().includes(query.toLowerCase())).slice(0, 12).map((label, index) => ({ label, image: destinationImages[index % destinationImages.length] })))
})
app.get('/api/locations/all', (_req, res) => res.json(locations.map((label, index) => ({ label, image: destinationImages[index % destinationImages.length] }))))
app.post('/api/quote', (req, res) => {
  const nights = nightsBetween(req.body.checkIn, req.body.checkOut)
  const nightly = Number(req.body.pricePerNight || 0)
  const subtotal = nights * nightly
  res.json({ nights, nightly, subtotal, cleaningFee: Math.round(subtotal * 0.08), serviceFee: Math.round(subtotal * 0.12), total: Math.round(subtotal * 1.2 + subtotal * 0.08) })
})
app.listen(port, async () => { try { await connectDatabase() } catch (error) { console.error(`MongoDB unavailable; using local seed data: ${error.message}`) } console.log(`API running at http://localhost:${port}`) })