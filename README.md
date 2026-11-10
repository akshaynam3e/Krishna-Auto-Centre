# Krishna Auto Center — Termux starter

A local-first motorcycle-service website and booking manager. It uses only Node.js built-in modules, so there are no npm packages to install and no database service to configure. Bookings are stored on the device in `data/bookings.json`.

## Run it in Termux

First install Termux from a trusted source such as F-Droid or the official GitHub release, then open Termux and allow storage access:

```sh
termux-setup-storage
pkg update -y
pkg install nodejs-lts unzip nano -y
cd ~/storage/downloads
unzip -o krishna-auto-center-termux.zip -d "$HOME"
cd "$HOME/krishna-auto-center-termux"
```

Before the first run, edit the configuration:

```sh
cp config.example.json config.json
nano config.json
```

Replace the starter owner PIN `CHANGE-THIS-4821` with a unique PIN of at least 8 characters. Add the verified shop phone, WhatsApp number, exact address, actual services, current opening hours, and real pricing only when the owner confirms those details. The initial service categories are suggestions from the supplied specification; remove any service Krishna Auto Center does not actually provide. Leave unknown prices blank.

Save in nano with **Ctrl+O**, Enter, then **Ctrl+X**. Start the app:

```sh
npm start
```

On the same Android phone, open this in Chrome or another browser:

```text
http://127.0.0.1:3000
```

The owner dashboard is at `http://127.0.0.1:3000/admin`. Sign in with the PIN in `config.json`. You can edit the contact details, actual service categories, pricing, and PIN in the dashboard. The first PIN change is best done by editing `config.json` before opening the dashboard.

Stop the app with **Ctrl+C** in Termux. Start it again later with `cd "$HOME/krishna-auto-center-termux" && npm start`.

## Optional: view from another device on the same Wi-Fi

This is for a trusted private network only. Do not expose this starter directly to the public internet. Stop the server, then run:

```sh
cd "$HOME/krishna-auto-center-termux"
HOST=0.0.0.0 npm start
```

Find the phone's Wi-Fi IP in Android network settings and visit `http://PHONE-IP:3000` from the other device. Anyone who can reach that port can access the public pages, so keep the network trusted and use a strong admin PIN. This local server does not provide HTTPS.

## What is included

- Responsive customer website with call and WhatsApp links, service list, location page, and contact details.
- Four-step home-service request form with bike details, problem description, address, optional GPS/manual distance, scheduling and a JPG/PNG/WEBP photo attachment (maximum 2 MB).
- Requests remain **PENDING** until the owner changes the status. Submitting a request never confirms an appointment.
- Private status lookup requires both booking reference and the submitting phone number.
- Owner dashboard with requests, status changes, owner quotation, mechanic assignment, internal notes, settings, pricing inputs and CSV export.
- Server-side travel estimate: round-trip distance ÷ configured motorcycle mileage × petrol price, plus configured margin. A total is shown only after required rates and distance exist. Unknown parts are excluded and the owner must confirm the final amount.
- Local JSON persistence, basic input checks, a honeypot, request rate limits, image validation, admin session tokens, and a 12-hour owner session.
- Installable PWA shell, basic static asset caching, robots rules, and a dynamic sitemap. Dynamic booking/status APIs still need a connection.

## Important before public launch

This ZIP runs a useful local prototype, not a hardened public production service. The JSON store is not a managed database, HTTPS is not included, owner login is PIN-based, and there is no automated SMS/WhatsApp notification or video upload. Do not put real customer information on a publicly exposed Termux server. For public operation, deploy behind HTTPS with a production database, backups, stronger authentication, monitoring, and a reviewed privacy notice. Confirm all services, location, business hours, rates, and policies with the owner first.

The workshop photo is illustrative stock photography and is not a photo of Krishna Auto Center. It is attributed in the website footer to [Bernd Dittrich on Unsplash](https://unsplash.com/photos/mechanic-working-in-a-cluttered-motorcycle-repair-shop-aZAFO1S1izU). Replace it with real shop photos before publication.

## Back up the local data

Stop the app, then copy the project folder somewhere safe. Bookings are in `data/bookings.json`; business settings and the owner PIN are in `config.json`. Keep both private. Never share the data file because it contains customer contact and address information.
