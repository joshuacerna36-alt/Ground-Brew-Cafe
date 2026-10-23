# Grounded Brew Café

## Run locally

Use Node.js 22.13 or newer:

```powershell
npm install
npm run dev
```

The site opens at `http://127.0.0.1:5173`. To open it from a phone on the same Wi-Fi, start the server with `npm run dev -- --host 0.0.0.0`, then use the computer's local network IP and port.

Website pictures are stored together in `public/images/`.

## Create the first administrator

Administrator accounts are provisioned securely at server startup. Set these environment variables on the server before starting it:

```powershell
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_PASSWORD = "use-a-unique-password-of-at-least-12-characters"
$env:ADMIN_NAME = "Café Administrator"
npm run dev
```

The password is hashed before it is stored. Do not put real credentials in source control. Registration does not send or confirm email; customers can use any valid email-shaped address as their login name. Administrators can promote accounts to staff, deactivate/reactivate accounts, or delete accounts from the dashboard. Deactivation immediately revokes active sessions. Deletion removes the account's login and contact details while retaining anonymized order records.

The SQLite database is stored in `data/accounts.sqlite` by default. Set `DATABASE_PATH` to a persistent volume path in production. Back up this database securely.

## GitHub Pages

The `Deploy café site to GitHub Pages` workflow builds the Vite app and deploys the generated `dist` folder whenever changes are pushed to `main`. In the repository's **Settings → Pages**, select **GitHub Actions** as the build and deployment source. The Vite base path is configured for this project repository.

GitHub Pages hosts only static files. It can display the café site and menu, but cannot run the Node.js server, database-backed registration/login, checkout, orders, delivery quotes, or staff dashboard. Those features require deploying `server.js` to a Node.js host with persistent storage and configuring the frontend to use that server.

## Orders, delivery, and payments

- Pickup scheduling is available in 30-minute slots from 9:00 AM to 8:30 PM, Asia/Manila time. Orders must be scheduled at least 30 minutes ahead and within 14 days.
- Delivery quotes use Google Routes road distance. Configure `CAFE_ADDRESS` and a server-side `GOOGLE_MAPS_API_KEY` to enable delivery checkout. Restrict the key to the Routes API and server IP. Until both are configured, checkout accepts pickup orders and explains that delivery quotes are unavailable.
- Delivery defaults to ₱100 for the first 5 km, then ₱100 per additional kilometer. Override with `DELIVERY_BASE_PHP`, `DELIVERY_INCLUDED_KM`, and `DELIVERY_PER_KM_PHP`.
- Cash is available by default for pickup/delivery. GCash is intentionally unavailable in checkout until a GCash-capable merchant gateway is configured to create a unique order payment and verify the exact amount. A static QR cannot automatically confirm the amount, so the supplied QR is not presented as verified online checkout. Do not mark an online payment paid without checking the actual gateway transaction.
- PayPal/card checkout is not enabled. No card details are collected by this site.

Orders are priced from the server-side product catalog, stored in SQLite, and visible only to the ordering customer and authenticated staff/admin accounts. The admin/staff dashboard lets staff update order progress and payment status.

## Production

Build and start the Node server with `npm start`. Keep the account database on persistent storage, use HTTPS at the deployment edge, and provide the environment variables required for the admin account and any enabled payment or delivery services.
