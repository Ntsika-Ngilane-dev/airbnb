# Airbnb stay search

React/Vite frontend with an Express API, MongoDB-ready stay catalog, Google Places autocomplete, booking quotes, currency conversion, and listing detail pages.

## Run locally

1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI` to your MongoDB connection string. The API seeds 12 stays into the `stays` collection on first connection.
3. Set `GOOGLE_MAPS_API_KEY` to enable Google Places city autocomplete. Without it, the API uses the built-in city list.
4. Run `npm run dev` and open the Vite URL it prints, such as `http://localhost:5173` or `http://localhost:5174`.

## Authentication

Set these values in your local `.env` file to enable the Workngilane admin account:

```env
SESSION_SECRET=long-random-secret
ADMIN_EMAIL=admin@workngilane.com
ADMIN_PASSWORD=strong-private-password
```

For local development only, the login works without `.env` using email `admin@workngilane.com` and password `workngilane`. Set `ADMIN_PASSWORD` before deploying; production does not use the development fallback.

The account menu opens the login page. Successful admin login opens the protected dashboard at `/api/admin/overview`, which reports catalog counts and ownership metadata. Sessions use signed, HTTP-only cookies and expire after 24 hours.

Google login uses the supported Google Identity Services library rather than deprecated `gapi.auth2`. Set `GOOGLE_CLIENT_ID` to your Google OAuth web client ID and add `http://localhost:5173` to its authorized JavaScript origins. The server verifies the Google ID token before creating a session. The verified email must equal `ADMIN_EMAIL` to receive admin access. Apple uses `APPLE_AUTH_URL` until its provider callback is configured.

The app also runs without MongoDB using the same seed records in memory, which keeps the UI usable for local design work.

## API

- `GET /api/stays?location=&category=` searches stays.
- `GET /api/stays/:id` returns one listing.
- `GET /api/locations?q=` returns Google Places or local location suggestions.
- `POST /api/quote` accepts `checkIn`, `checkOut`, and `pricePerNight` and returns nights, fees, and total.

Each listing includes a nightly price, a 0-5 rating, review count, category, image URL, and `© 2024 Airbnb, Inc.` metadata. The footer credits Ntsika Ngilane.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
