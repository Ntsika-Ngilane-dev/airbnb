import mongoose from 'mongoose'

const listingSchema = new mongoose.Schema({
  hostEmail: { type: String, trim: true, index: true },
  hostName: { type: String, trim: true },
  hostPhone: { type: String, trim: true },
  title: { type: String, required: true, minlength: 3, trim: true },
  location: { type: String, required: true, trim: true },
  country: { type: String, required: true, trim: true },
  addressLine1: { type: String, trim: true },
  addressLine2: { type: String, trim: true },
  postalCode: { type: String, trim: true },
  description: { type: String, required: true },
  bedrooms: { type: Number, min: 0, required: true },
  bathrooms: { type: Number, min: 0, required: true },
  guests: { type: Number, min: 1, max: 16, required: true },
  type: { type: String, required: true },
  pricePerNight: { type: Number, min: 1, required: true },
  amenities: { type: [String], default: [] },
  image: { type: String, required: true },
  images: { type: [String], default: [] },
  weeklyDiscount: { type: Number, min: 0, default: 0 },
  cleaningFee: { type: Number, min: 0, default: 0 },
  serviceFee: { type: Number, min: 0, default: 0 },
  occupancyTaxes: { type: Number, min: 0, default: 0 },
  rating: { type: Number, min: 0, max: 5, default: 4.8 },
  reviewCount: { type: Number, min: 0, default: 0 },
  category: { type: String, required: true },
  propertySize: { type: Number, min: 1 },
  furnished: { type: Boolean, default: true },
  parking: { type: String, trim: true },
  checkInFrom: { type: String, trim: true },
  checkOutBy: { type: String, trim: true },
  minimumStay: { type: Number, min: 1, default: 1 },
  availability: { type: String, trim: true },
  houseRules: { type: String, trim: true },
  cancellationPolicy: { type: String, trim: true },
  guestFavorite: { type: Boolean, default: false },
}, { timestamps: true })

const reservationSchema = new mongoose.Schema({
  userEmail: { type: String, required: true, index: true },
  userName: { type: String, required: true },
  stayId: { type: String, required: true },
  stayTitle: { type: String, required: true },
  location: { type: String, required: true },
  checkIn: { type: String, required: true },
  checkOut: { type: String, required: true },
  guests: { type: Number, min: 1, max: 16, required: true },
  nights: { type: Number, min: 1, required: true },
  subtotal: { type: Number, min: 0, required: true },
  status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
}, { timestamps: true })

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  passwordHash: String,
  salt: String,
  provider: String,
}, { timestamps: true })

export const Stay = mongoose.models.Stay || mongoose.model('Stay', listingSchema, 'stays')
export const Reservation = mongoose.models.Reservation || mongoose.model('Reservation', reservationSchema, 'reservations')
export const User = mongoose.models.User || mongoose.model('User', userSchema, 'users')
