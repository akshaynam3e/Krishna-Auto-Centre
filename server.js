'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const CONFIG_FILE = path.join(ROOT, 'config.json');
const STORE_FILE = path.join(DATA_DIR, 'bookings.json');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY = 5 * 1024 * 1024;
const STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'MECHANIC_ASSIGNED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const sessions = new Map();
const rateLimits = new Map();

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(STORE_FILE)) fs.writeFileSync(STORE_FILE, '[]\n');

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch (error) { console.error('Cannot read config.json:', error.message); process.exit(1); }
}
function saveConfig(config) {
  const temp = CONFIG_FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temp, CONFIG_FILE);
}
function loadBookings() {
  try { return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')); }
  catch { return []; }
}
function saveBookings(bookings) {
  const temp = STORE_FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(bookings, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temp, STORE_FILE);
}
function clean(value, max = 300) {
  return String(value == null ? '' : value).replace(/[<>\u0000-\u001f]/g, ' ').trim().slice(0, max);
}
function json(res, status, body, extraHeaders = {}) {
  const bytes = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': bytes.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders
  });
  res.end(bytes);
}
function text(res, status, body, contentType = 'text/plain; charset=utf-8', extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': contentType, 'X-Content-Type-Options': 'nosniff', ...extraHeaders });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Request is too large. Please use an image under 2 MB.'), { status: 413 }));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(Object.assign(new Error('Invalid request data.'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}
function limit(req, key, max, windowMs) {
  const now = Date.now();
  const id = `${key}:${req.socket.remoteAddress || 'local'}`;
  const entry = rateLimits.get(id);
  if (!entry || entry.until <= now) {
    rateLimits.set(id, { count: 1, until: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}
function publicConfig() {
  const config = loadConfig();
  const { adminPin, ...safe } = config;
  return safe;
}
function requireAdmin(req, res) {
  const token = req.headers['x-admin-token'];
  const expiry = token && sessions.get(token);
  if (!expiry || expiry < Date.now()) {
    if (token) sessions.delete(token);
    json(res, 401, { error: 'Admin session expired. Please sign in again.' });
    return false;
  }
  return true;
}
function validPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}
function haversineKm(lat1, lon1, lat2, lon2) {
  const rad = n => n * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function estimateFor(config, booking) {
  const p = config.pricing || {};
  const labour = p.labourByService && p.labourByService[booking.service];
  const configured = booking.distanceKm !== null && Number.isFinite(Number(p.visitFee)) && p.visitFee !== null && Number(p.visitFee) >= 0 && Number.isFinite(Number(p.petrolPricePerLitre)) && p.petrolPricePerLitre !== null && Number(p.petrolPricePerLitre) >= 0 && Number.isFinite(Number(p.bikeMileageKmPerLitre)) && Number(p.bikeMileageKmPerLitre) > 0 && Number.isFinite(Number(labour)) && labour !== null && Number(labour) >= 0;
  if (!configured) return { configured: false, items: null, total: null, partsNote: 'Parts are not included. Their cost depends on the actual parts needed and will be confirmed before work begins.' };
  const visit = Number(p.visitFee);
  const oneWayKm = Number.isFinite(Number(booking.distanceKm)) ? Number(booking.distanceKm) : 0;
  const roundTripKm = oneWayKm * 2;
  const travelBase = roundTripKm / Number(p.bikeMileageKmPerLitre) * Number(p.petrolPricePerLitre);
  const travel = travelBase * (1 + Number(p.travelMarginPercent || 0) / 100);
  const labourCharge = Number(labour);
  let subtotal = visit + travel + labourCharge;
  let profit = 0;
  if (!p.labourIncludedProfit && p.profitMode === 'fixed') profit = Number(p.profitValue || 0);
  if (!p.labourIncludedProfit && p.profitMode === 'percent') profit = subtotal * Number(p.profitValue || 0) / 100;
  const items = {
    homeVisit: Math.round(visit),
    travel: Math.round(travel),
    labour: Math.round(labourCharge),
    businessProfit: Math.round(profit),
    parts: null
  };
  const total = Object.values(items).filter(Number.isFinite).reduce((a, b) => a + b, 0);
  return { configured: true, items, total, partsNote: 'Parts are not included. Their cost depends on the actual parts needed and will be confirmed before work begins.' };
}
function bookingId(existing = []) {
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  let id;
  do { id = `KAC-${day}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`; }
  while (existing.some(item => item.id === id));
  return id;
}
function csvCell(value) {
  const s = String(value == null ? '' : value).replace(/[\r\n]+/g, ' ');
  return `"${s.replaceAll('"', '""')}"`;
}
function updateAllowedConfig(input, old) {
  const next = { ...old };
  const stringFields = ['businessName', 'city', 'phone', 'whatsapp', 'address', 'mapsUrl', 'googleReviewUrl', 'siteUrl', 'hours', 'weeklyHoliday'];
  for (const key of stringFields) if (key in input) next[key] = clean(input[key], key === 'address' ? 300 : 160);
  for (const key of ['serviceRadiusKm', 'latitude', 'longitude']) {
    if (key in input) {
      if (input[key] === '' || input[key] === null) next[key] = key === 'serviceRadiusKm' ? 0 : null;
      else if (Number.isFinite(Number(input[key]))) next[key] = Number(input[key]);
    }
  }
  if ('homeServiceAvailable' in input) next.homeServiceAvailable = Boolean(input.homeServiceAvailable);
  if (Array.isArray(input.services)) next.services = input.services.map(x => clean(x, 70)).filter(Boolean).slice(0, 20);
  if ('adminPin' in input && String(input.adminPin).length >= 8) next.adminPin = String(input.adminPin).slice(0, 64);
  if (input.pricing && typeof input.pricing === 'object') {
    const src = input.pricing;
    const pricing = { ...old.pricing, labourByService: { ...(old.pricing?.labourByService || {}) } };
    for (const key of ['visitFee', 'petrolPricePerLitre', 'bikeMileageKmPerLitre', 'travelMarginPercent', 'profitValue', 'partsMarkupPercent']) {
      if (key in src) {
        const value = src[key] === '' || src[key] === null ? null : Number(src[key]);
        if (value === null || (Number.isFinite(value) && value >= 0)) pricing[key] = value;
      }
    }
    if ('labourIncludedProfit' in src) pricing.labourIncludedProfit = Boolean(src.labourIncludedProfit);
    if (['none', 'fixed', 'percent'].includes(src.profitMode)) pricing.profitMode = src.profitMode;
    if (src.labourByService && typeof src.labourByService === 'object') {
      for (const service of next.services || old.services || []) {
        if (service in src.labourByService) {
          const value = src.labourByService[service];
          pricing.labourByService[service] = value === '' || value === null ? null : Number(value);
        }
      }
    }
    next.pricing = pricing;
  }
  return next;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);
  const method = req.method || 'GET';
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'geolocation=(self)');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");

  try {
    if (pathname === '/api/health' && method === 'GET') return json(res, 200, { ok: true });
    if (pathname === '/api/config' && method === 'GET') return json(res, 200, publicConfig());
    if (pathname === '/sitemap.xml' && method === 'GET') {
      const config = loadConfig();
      let origin = String(config.siteUrl || '').trim().replace(/\/$/, '');
      if (!/^https?:\/\//i.test(origin)) origin = `${req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${req.headers.host || 'localhost'}`;
      const routes = ['/', '/services', '/book', '/location', '/track', '/privacy', '/terms'];
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(route => `<url><loc>${origin}${route}</loc></url>`).join('')}</urlset>`;
      return text(res, 200, xml, 'application/xml; charset=utf-8');
    }
    if (pathname === '/robots.txt' && method === 'GET') {
      const config = loadConfig();
      let origin = String(config.siteUrl || '').trim().replace(/\/$/, '');
      if (!/^https?:\/\//i.test(origin)) origin = `${req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${req.headers.host || 'localhost'}`;
      return text(res, 200, `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`);
    }

    if (pathname === '/api/bookings' && method === 'POST') {
      if (!limit(req, 'booking', 6, 60 * 60 * 1000)) return json(res, 429, { error: 'Too many requests from this connection. Please try again later or call the shop.' });
      const body = await readBody(req);
      if (body.website) return json(res, 400, { error: 'Request rejected.' });
      const booking = {
        customerName: clean(body.customerName, 80),
        phone: clean(body.phone, 25),
        vehicleBrand: clean(body.vehicleBrand, 60),
        vehicleModel: clean(body.vehicleModel, 80),
        registration: clean(body.registration, 25),
        fuelType: clean(body.fuelType, 30),
        service: clean(body.service, 80),
        problem: clean(body.problem, 1000),
        urgency: ['Normal', 'Urgent'].includes(body.urgency) ? body.urgency : 'Normal',
        address: clean(body.address, 300),
        landmark: clean(body.landmark, 120),
        area: clean(body.area, 100),
        date: clean(body.date, 10),
        timeSlot: clean(body.timeSlot, 50),
        notes: clean(body.notes, 500),
        distanceKm: body.distanceKm !== null && body.distanceKm !== '' && body.distanceKm !== undefined && Number.isFinite(Number(body.distanceKm)) && Number(body.distanceKm) >= 0 ? Number(body.distanceKm) : null,
        latitude: body.latitude !== null && body.latitude !== '' && body.latitude !== undefined && Number.isFinite(Number(body.latitude)) ? Number(body.latitude) : null,
        longitude: body.longitude !== null && body.longitude !== '' && body.longitude !== undefined && Number.isFinite(Number(body.longitude)) ? Number(body.longitude) : null
      };
      const required = ['customerName', 'phone', 'vehicleBrand', 'vehicleModel', 'service', 'problem', 'address', 'date', 'timeSlot'];
      const missing = required.filter(key => !booking[key]);
      if (missing.length) return json(res, 400, { error: 'Please complete all required fields.' });
      if (booking.customerName.length < 2 || !validPhone(booking.phone)) return json(res, 400, { error: 'Enter a name and a valid phone number.' });
      const chosenDate = new Date(`${booking.date}T00:00:00`);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (Number.isNaN(chosenDate.getTime()) || chosenDate < today || chosenDate > new Date(today.getTime() + 90 * 86400000)) return json(res, 400, { error: 'Choose a date within the next 90 days.' });
      const config = loadConfig();
      if (!config.homeServiceAvailable) return json(res, 409, { error: 'Home service is currently unavailable. Please call the shop.' });
      if (!config.services.includes(booking.service)) return json(res, 400, { error: 'Please select an available service.' });
      if (booking.latitude !== null && booking.longitude !== null && config.latitude !== null && config.latitude !== '' && config.longitude !== null && config.longitude !== '' && Number.isFinite(Number(config.latitude)) && Number.isFinite(Number(config.longitude))) {
        booking.distanceKm = Number(haversineKm(Number(config.latitude), Number(config.longitude), booking.latitude, booking.longitude).toFixed(1));
        if (Number(config.serviceRadiusKm) > 0 && booking.distanceKm > Number(config.serviceRadiusKm)) return json(res, 400, { error: `This location appears to be outside the current ${config.serviceRadiusKm} km service area. Please call the shop to check.` });
      }
      if (body.photo) {
        const match = String(body.photo).match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
        if (!match || Buffer.from(match[2], 'base64').length > 2 * 1024 * 1024) return json(res, 400, { error: 'Photo must be a JPG, PNG, or WEBP image under 2 MB.' });
        booking.photo = body.photo;
      }
      const bookings = loadBookings();
      const recentDuplicate = bookings.find(b => b.phone === booking.phone && b.createdAt > Date.now() - 2 * 60 * 1000 && b.status !== 'CANCELLED');
      if (recentDuplicate) return json(res, 409, { error: 'A recent request already exists for this phone number. Please wait for the shop to contact you.' });
      const record = {
        id: bookingId(bookings), status: 'PENDING', createdAt: Date.now(), updatedAt: Date.now(),
        ...booking,
        estimate: estimateFor(config, booking),
        ownerNotes: '', assignedMechanic: '', ownerQuote: null, history: [{ status: 'PENDING', at: Date.now() }]
      };
      bookings.unshift(record);
      saveBookings(bookings);
      return json(res, 201, { id: record.id, status: record.status, estimate: record.estimate });
    }

    const trackMatch = pathname.match(/^\/api\/bookings\/([A-Za-z0-9-]+)$/);
    if (trackMatch && method === 'GET') {
      const phone = String(url.searchParams.get('phone') || '').replace(/\D/g, '');
      if (!validPhone(phone)) return json(res, 400, { error: 'Enter the phone number used for this booking.' });
      const item = loadBookings().find(b => b.id === trackMatch[1] && b.phone.replace(/\D/g, '') === phone);
      if (!item) return json(res, 404, { error: 'Booking not found. Check the reference and phone number.' });
      return json(res, 200, { id: item.id, status: item.status, createdAt: item.createdAt, service: item.service, date: item.date, timeSlot: item.timeSlot, ownerQuote: item.ownerQuote });
    }

    if (pathname === '/api/admin/login' && method === 'POST') {
      if (!limit(req, 'admin-login', 8, 15 * 60 * 1000)) return json(res, 429, { error: 'Too many sign-in attempts. Wait 15 minutes before trying again.' });
      const body = await readBody(req);
      const config = loadConfig();
      const supplied = Buffer.from(String(body.pin || ''));
      const expected = Buffer.from(String(config.adminPin || ''));
      if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return json(res, 401, { error: 'PIN is not correct.' });
      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, Date.now() + 12 * 60 * 60 * 1000);
      return json(res, 200, { token });
    }

    if (pathname.startsWith('/api/admin/')) {
      if (!requireAdmin(req, res)) return;
      if (pathname === '/api/admin/logout' && method === 'POST') {
        sessions.delete(req.headers['x-admin-token']);
        return json(res, 200, { ok: true });
      }
      if (pathname === '/api/admin/bookings' && method === 'GET') return json(res, 200, loadBookings());
      if (pathname === '/api/admin/settings' && method === 'GET') return json(res, 200, loadConfig());
      if (pathname === '/api/admin/settings' && method === 'PUT') {
        const body = await readBody(req);
        const previous = loadConfig();
        const updated = updateAllowedConfig(body, previous);
        if (updated.adminPin !== previous.adminPin) sessions.clear();
        saveConfig(updated);
        return json(res, 200, { ok: true, config: publicConfig() });
      }
      if (pathname === '/api/admin/export.csv' && method === 'GET') {
        const bookings = loadBookings();
        const columns = ['id', 'status', 'createdAt', 'customerName', 'phone', 'vehicleBrand', 'vehicleModel', 'registration', 'fuelType', 'service', 'problem', 'address', 'date', 'timeSlot', 'ownerQuote'];
        const lines = [columns.join(','), ...bookings.map(b => columns.map(c => csvCell(b[c] instanceof Object ? JSON.stringify(b[c]) : b[c])).join(','))];
        return text(res, 200, '\uFEFF' + lines.join('\r\n'), 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="krishna-auto-bookings.csv"', 'Cache-Control': 'no-store' });
      }
      const bookingMatch = pathname.match(/^\/api\/admin\/bookings\/([A-Za-z0-9-]+)$/);
      if (bookingMatch && method === 'PATCH') {
        const body = await readBody(req);
        const bookings = loadBookings();
        const item = bookings.find(b => b.id === bookingMatch[1]);
        if (!item) return json(res, 404, { error: 'Booking not found.' });
        if (body.status && !STATUSES.includes(body.status)) return json(res, 400, { error: 'Invalid booking status.' });
        if (body.status && body.status !== item.status) {
          item.status = body.status;
          item.history.push({ status: body.status, at: Date.now() });
        }
        if ('ownerNotes' in body) item.ownerNotes = clean(body.ownerNotes, 1500);
        if ('assignedMechanic' in body) item.assignedMechanic = clean(body.assignedMechanic, 100);
        if ('ownerQuote' in body) {
          const quote = body.ownerQuote === '' || body.ownerQuote === null ? null : Number(body.ownerQuote);
          if (quote !== null && (!Number.isFinite(quote) || quote < 0 || quote > 10000000)) return json(res, 400, { error: 'Enter a valid quotation.' });
          item.ownerQuote = quote;
        }
        item.updatedAt = Date.now();
        saveBookings(bookings);
        return json(res, 200, { ok: true, booking: item });
      }
      return json(res, 404, { error: 'Admin route not found.' });
    }

    if (method !== 'GET' && method !== 'HEAD') return json(res, 405, { error: 'Method not allowed.' });
    const appRoutes = new Set(['/', '/services', '/book', '/location', '/track', '/admin', '/privacy', '/terms']);
    let filePath = appRoutes.has(pathname) ? path.join(PUBLIC, 'index.html') : path.join(PUBLIC, pathname.replace(/^\/+/, ''));
    if (!filePath.startsWith(PUBLIC + path.sep) && filePath !== path.join(PUBLIC, 'index.html')) return text(res, 403, 'Forbidden');
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return text(res, 404, 'Not found');
    const ext = path.extname(filePath).toLowerCase();
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400' });
    if (method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    if (res.headersSent || res.destroyed) return;
    const status = error.status || 500;
    if (status >= 500) console.error(error);
    json(res, status, { error: status === 500 ? 'Something went wrong. Please try again or call the shop.' : error.message });
  }
});

server.listen(PORT, HOST, () => console.log(`Krishna Auto Center is running at http://127.0.0.1:${PORT} (LAN: ${HOST}:${PORT})`));
