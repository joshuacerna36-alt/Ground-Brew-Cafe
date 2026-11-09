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

The server-backed customer dashboard lets a signed-in customer upload or remove a profile photo. Images are cropped and resized in the browser and saved with the account. The admin Overview and Analytics pages summarize order revenue, unpaid balance, paid orders, active customers, and pickup/delivery mix from the latest order and account records; they do not represent a bank balance or external venue data.

## GitHub Pages

The `Deploy café site to GitHub Pages` workflow builds the Vite app and deploys the generated `dist` folder whenever changes are pushed to `main`. In the repository's **Settings → Pages**, select **GitHub Actions** as the build and deployment source. The Vite base path is configured for this project repository.

GitHub Pages hosts only static files, so it cannot run `server.js`. To keep the site fully usable there, the app includes a built-in **browser account service** (`src/localApi.js`). When no Node.js server is reachable, login, registration, checkout, My Orders, and the staff/admin dashboards all run inside the visitor's browser and store their data in that browser's `localStorage`. The Pages workflow sets `VITE_API_MODE=local` to enable this.

Built-in logins on the GitHub Pages site:

| Account | Email | Password |
| --- | --- | --- |
| Administrator | `admin@groundedbrew.local` | `GroundedBrew123!` |
| Demo customer | `test@grounded.com` | `123456` |

Anyone can also use **Register** to create their own customer account and log in with it later on the same browser. In the admin dashboard, **Users → Accounts** lets the administrator promote accounts to staff, deactivate/reactivate them, or delete them.

Things to know about this browser-only mode:

- Accounts and orders are saved per browser/device. They are **not shared** between devices, so an order placed on a customer's phone will not appear in an admin's browser on another computer.
- Everything in a static site's JavaScript is visible to visitors, including the built-in admin password above. Treat it as a public demo login only; never use it for a real shared server or sensitive data. To change the browser demo login, set `VITE_ADMIN_EMAIL` and `VITE_ADMIN_PASSWORD` in the workflow's build `env`.
- Delivery quotes and GCash are unavailable (pickup + cash only), exactly as when the Node server has no Google Maps key.

For real, shared accounts and orders, deploy `server.js` to a Node.js host with persistent storage, set `CORS_ALLOWED_ORIGIN` to your GitHub Pages URL on that server, then in the workflow replace `VITE_API_MODE: local` with `VITE_API_BASE_URL: https://your-server.example.com`. The site then uses the real server automatically.

## Orders, delivery, and payments

- Pickup scheduling is available in 30-minute slots from 9:00 AM to 8:30 PM, Asia/Manila time. Orders must be scheduled at least 30 minutes ahead and within 14 days.
- Delivery quotes use Google Routes road distance. Configure `CAFE_ADDRESS` and a server-side `GOOGLE_MAPS_API_KEY` to enable delivery checkout. Restrict the key to the Routes API and server IP. Until both are configured, checkout accepts pickup orders and explains that delivery quotes are unavailable.
- Delivery defaults to ₱100 for the first 5 km, then ₱100 per additional kilometer. Override with `DELIVERY_BASE_PHP`, `DELIVERY_INCLUDED_KM`, and `DELIVERY_PER_KM_PHP`.
- Cash is available by default for pickup/delivery. GCash is intentionally unavailable in checkout until a GCash-capable merchant gateway is configured to create a unique order payment and verify the exact amount. A static QR cannot automatically confirm the amount, so the supplied QR is not presented as verified online checkout. Do not mark an online payment paid without checking the actual gateway transaction.
- PayPal/card checkout is not enabled. No card details are collected by this site.

Orders are priced from the server-side product catalog, stored in SQLite, and visible only to the ordering customer and authenticated staff/admin accounts. The admin/staff dashboard lets staff update order progress and payment status.

## Production

Build and start the Node server with `npm start`. Keep the account database on persistent storage, use HTTPS at the deployment edge, and provide the environment variables required for the admin account and any enabled payment or delivery services.
