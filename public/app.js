'use strict';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
let config = null;
let adminToken = sessionStorage.getItem('kac_admin_token') || '';
let bookingStep = 0;
let gps = { latitude: null, longitude: null };
let photoData = '';
let toastTimer;
const STATUS_LABELS = { PENDING: 'Pending review', ACCEPTED: 'Accepted', REJECTED: 'Declined', MECHANIC_ASSIGNED: 'Mechanic assigned', ON_THE_WAY: 'On the way', ARRIVED: 'Arrived', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };
const PROBLEMS = [
  ['01', 'Bike not starting', 'No-start checks and diagnosis'], ['02', 'Engine / starting issue', 'Ask about symptoms and repair'], ['03', 'Brake repair', 'Brake feel, noise or adjustment'], ['04', 'Battery / electrical', 'Battery and electrical checks'], ['05', 'Clutch / chain', 'Clutch, chain and sprocket'], ['06', 'Puncture / tyre', 'Tyre and puncture assistance'], ['07', 'General servicing', 'Routine motorcycle maintenance'], ['08', 'Other issue', 'Describe what your bike is doing']
];
const HI = {
  '/services': { 'Services': 'सेवाएँ', 'Workshop': 'वर्कशॉप', 'Track request': 'बुकिंग स्थिति', 'Owner login': 'मालिक लॉगिन', 'BOOK HOME SERVICE': 'घर पर सेवा बुक करें', 'CALL THE SHOP': 'दुकान पर कॉल करें' },
  '/': { 'Your bike': 'आपकी बाइक', 'deserves expert care.': 'बेहतर देखभाल की हकदार है।', 'Trusted motorcycle repair and maintenance in Bhurkunda, Jharkhand. Visit the workshop or request a mechanic at your doorstep.': 'भुरकुंडा, झारखंड में भरोसेमंद बाइक मरम्मत और सर्विस। वर्कशॉप आएँ या घर पर मैकेनिक बुलाएँ।', 'BOOK HOME SERVICE': 'घर पर सेवा बुक करें', 'CALL THE SHOP': 'दुकान पर कॉल करें', "Bike problem?": 'बाइक में समस्या?', "We've got you covered.": 'हम मदद के लिए हैं।' },
  '/book': { 'BOOK HOME SERVICE': 'घर पर सेवा बुक करें', 'CONTINUE': 'आगे बढ़ें', 'BACK': 'वापस', 'SEND REQUEST': 'अनुरोध भेजें', 'Your motorcycle': 'आपकी बाइक', 'What needs attention?': 'क्या समस्या है?', 'Where should we meet you?': 'आप कहाँ हैं?', 'When works for you?': 'कौन सा समय ठीक है?' },
  '/track': { 'Track request': 'बुकिंग स्थिति', 'CHECK STATUS': 'स्थिति देखें' },
  '/location': { 'Workshop': 'वर्कशॉप', 'GET DIRECTIONS': 'रास्ता देखें' }
};
let currentLanguage = localStorage.getItem('kac_language') || 'en';
const TEXT_HI = {
  'Services': 'सेवाएँ', 'Workshop': 'वर्कशॉप', 'Track request': 'बुकिंग स्थिति', 'Owner login': 'मालिक लॉगिन',
  'CALL THE WORKSHOP': 'वर्कशॉप पर कॉल करें', 'CALL THE SHOP': 'दुकान पर कॉल करें', 'BOOK HOME SERVICE': 'घर पर सेवा बुक करें', 'CALL NOW': 'अभी कॉल करें', 'WHATSAPP': 'व्हाट्सऐप',
  'Manufacturer *': 'कंपनी *', 'Model *': 'मॉडल *', 'Registration number': 'रजिस्ट्रेशन नंबर', 'Fuel type': 'ईंधन का प्रकार', 'Service needed *': 'ज़रूरी सेवा *', 'Urgency': 'प्राथमिकता', 'Describe the problem *': 'समस्या बताएँ *', 'Add a photo': 'फोटो जोड़ें',
  'Your name *': 'आपका नाम *', 'Phone number *': 'फ़ोन नंबर *', 'Full address *': 'पूरा पता *', 'Area / town': 'इलाका / शहर', 'Nearby landmark': 'पास की पहचान', 'Preferred date *': 'पसंदीदा तारीख *', 'Preferred time *': 'पसंदीदा समय *', 'Anything else to know?': 'और कोई जानकारी?',
  'Choose if known': 'यदि पता हो तो चुनें', 'Choose a service': 'सेवा चुनें', 'Choose a time window': 'समय चुनें', 'Petrol': 'पेट्रोल', 'Electric': 'इलेक्ट्रिक', 'Other': 'अन्य', 'Normal': 'सामान्य', 'Urgent': 'तत्काल', 'Morning (9 AM – 12 PM)': 'सुबह (9 से 12 बजे)', 'Afternoon (12 PM – 3 PM)': 'दोपहर (12 से 3 बजे)', 'Evening (3 PM – 6 PM)': 'शाम (3 से 6 बजे)', 'Flexible / call me': 'लचीला समय / कॉल करें',
  'USE MY LOCATION': 'मेरी लोकेशन लें', 'GPS is optional. Your browser will ask permission.': 'GPS वैकल्पिक है। ब्राउज़र अनुमति माँगेगा।', 'Enter if known': 'पता हो तो लिखें',
  'Service categories will be added by the owner.': 'मालिक सेवा श्रेणियाँ जोड़ेंगे।', 'ASK ABOUT SERVICE ↗': 'सेवा के बारे में पूछें ↗', 'GET DIRECTIONS': 'रास्ता देखें', 'CHECK STATUS': 'स्थिति देखें'
};
function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function money(value) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0); }
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3400); }
function phoneHref(value) { const digits = String(value || '').replace(/[^\d+]/g, ''); return digits ? `tel:${digits}` : ''; }
function whatsappHref(number, message) { const digits = String(number || '').replace(/\D/g, ''); return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : ''; }
function setLink(id, href, text) { const el = $(id); if (!el) return; el.href = href || '#'; if (text) el.textContent = text; el.setAttribute('aria-disabled', href ? 'false' : 'true'); }
function updateContact() {
  if (!config) return;
  const call = phoneHref(config.phone);
  for (const id of ['#headerCall', '#heroCall', '#bandCall', '#serviceCall', '#bookingCall', '#footerPhone', '#mobileCall']) setLink(id, call);
  const label = config.phone ? config.phone : 'Phone not set';
  $('#headerPhone').textContent = label;
  $('#locationPhone').textContent = config.phone || 'Phone number to be added';
  $('#locationBusiness').textContent = config.businessName || 'Krishna Auto Center';
  $('#locationAddress').textContent = config.address || 'Exact workshop address to be added.';
  $('#locationHours').textContent = [config.hours, config.weeklyHoliday ? `Weekly holiday: ${config.weeklyHoliday}` : ''].filter(Boolean).join(' · ');
  const mapLink = config.mapsUrl || (config.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.address)}` : '');
  setLink('#directionsLink', mapLink);
  const reviewLink = $('#reviewsLink');
  if (reviewLink) { reviewLink.hidden = !config.googleReviewUrl; if (config.googleReviewUrl) reviewLink.href = config.googleReviewUrl; }
  const canonical = $('link[rel="canonical"]');
  if (canonical && config.siteUrl) canonical.href = String(config.siteUrl).replace(/\/$/, '') + location.pathname;
  const message = `Hello ${config.businessName || 'Krishna Auto Center'}, I need assistance with my motorcycle. Vehicle: Problem: Location: Preferred service: Please contact me.`;
  const wa = whatsappHref(config.whatsapp, message);
  for (const id of ['#bandWhatsApp', '#footerWhatsApp']) setLink(id, wa);
  $('#availabilityText').textContent = config.homeServiceAvailable ? 'Taking home-service requests · owner confirmation required' : 'Workshop enquiries · call to check home-service availability';
  $('#year').textContent = new Date().getFullYear();
  if (config.googleReviewUrl) {
    // Reviews are linked only after the owner supplies the real business review URL.
  }
}
function navigate(route, replace = false) {
  const path = route || '/';
  const page = $(`[data-page="${CSS.escape(path)}"]`);
  if (!page) return;
  if (replace) history.replaceState({}, '', path); else if (location.pathname !== path) history.pushState({}, '', path);
  $$('.page').forEach(el => { el.hidden = el !== page; el.classList.toggle('active', el === page); });
  $$('.main-nav a').forEach(a => a.classList.toggle('active', a.dataset.route === path));
  $('#mainNav').classList.remove('open'); $('#menuToggle').setAttribute('aria-expanded', 'false');
  const names = { '/': 'Bike Repair in Bhurkunda', '/services': 'Motorcycle Services', '/book': 'Request Home Service', '/track': 'Track Booking', '/location': 'Workshop Location', '/privacy': 'Privacy', '/terms': 'Service Terms', '/admin': 'Owner Desk' };
  document.title = `${names[path] || 'Krishna Auto Center'} | Krishna Auto Center`;
  const description = $('meta[name="description"]');
  if (description) description.content = ({ '/': 'Krishna Auto Center provides motorcycle repair and servicing in Bhurkunda, Jharkhand.', '/services': 'Explore motorcycle service categories configured by Krishna Auto Center in Bhurkunda, Jharkhand.', '/book': 'Request a home-service motorcycle mechanic from Krishna Auto Center in Bhurkunda. Your request is reviewed by the owner.', '/location': 'Find Krishna Auto Center in Bhurkunda, Jharkhand. Call ahead to confirm the address and opening hours.', '/track': 'Check your Krishna Auto Center service request status with your booking reference and phone number.' })[path] || 'Krishna Auto Center in Bhurkunda, Jharkhand.';
  if (config?.siteUrl) { const canonical = $('link[rel="canonical"]'); if (canonical) canonical.href = String(config.siteUrl).replace(/\/$/, '') + path; }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (path === '/admin' && adminToken) loadAdmin();
  if (path === '/book') renderEstimate();
  applyLanguage();
}
function renderServices() {
  const services = config?.services || [];
  const serviceLabels = [...services];
  $('#problemGrid').innerHTML = PROBLEMS.filter(p => serviceLabels.some(s => s.toLowerCase() === p[1].toLowerCase())).map(p => `<article class="problem-item"><span class="problem-icon">${p[0]}</span><div><strong>${esc(p[1])}</strong><p>${esc(p[2])}</p></div></article>`).join('');
  $('#serviceList').innerHTML = services.map((s, i) => `<article class="service-row"><span class="service-number">${String(i + 1).padStart(2, '0')}</span><h2>${esc(s)}</h2><p class="service-detail">Describe the symptoms when you contact the workshop. Service availability and charges depend on the motorcycle and inspection.</p><a class="service-action" href="/book" data-route="/book">ASK ABOUT SERVICE ↗</a></article>`).join('') || '<p class="field-hint">Service categories will be added by the owner.</p>';
  $('#serviceSelect').innerHTML = '<option value="">Choose a service</option>' + services.map(s => `<option>${esc(s)}</option>`).join('');
}
function setBookingStep(index) {
  bookingStep = Math.max(0, Math.min(3, index));
  $$('.form-step').forEach((el, i) => { el.hidden = i !== bookingStep; el.classList.toggle('current', i === bookingStep); });
  $('#stepLabel').textContent = `STEP ${bookingStep + 1} OF 4`;
  $('#stepTitle').textContent = ['Your motorcycle', 'Problem details', 'Your location', 'Schedule & review'][bookingStep];
  $('#progressFill').style.width = `${(bookingStep + 1) * 25}%`;
  $('#bookingError').hidden = true;
  if (bookingStep === 3) renderEstimate();
}
function validateStep(index) {
  const panel = $(`.form-step[data-step="${index}"]`);
  const fields = $$('input[required],select[required],textarea[required]', panel).filter(f => f.name !== 'consent');
  for (const field of fields) {
    if (!field.reportValidity()) return false;
  }
  return true;
}
function getDistance() {
  if (gps.latitude != null && config?.latitude != null && config?.longitude != null) {
    const rad = n => n * Math.PI / 180;
    const dLat = rad(gps.latitude - Number(config.latitude)), dLon = rad(gps.longitude - Number(config.longitude));
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(Number(config.latitude))) * Math.cos(rad(gps.latitude)) * Math.sin(dLon / 2) ** 2;
    return Number((6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
  }
  const manual = Number($('#distanceInput')?.value);
  return $('#distanceInput')?.value !== '' && Number.isFinite(manual) && manual >= 0 ? manual : null;
}
function clientEstimate() {
  if (!config || !config.pricing) return null;
  const p = config.pricing;
  const service = $('#bookingForm')?.elements.service?.value;
  const labour = p.labourByService?.[service];
  if (p.visitFee == null || p.petrolPricePerLitre == null || p.bikeMileageKmPerLitre == null || Number(p.bikeMileageKmPerLitre) <= 0 || labour == null || labour === undefined || getDistance() == null) return null;
  const km = getDistance();
  const travel = km * 2 / Number(p.bikeMileageKmPerLitre) * Number(p.petrolPricePerLitre) * (1 + Number(p.travelMarginPercent || 0) / 100);
  let profit = 0;
  const subtotal = Number(p.visitFee) + travel + Number(labour);
  if (!p.labourIncludedProfit && p.profitMode === 'fixed') profit = Number(p.profitValue || 0);
  if (!p.labourIncludedProfit && p.profitMode === 'percent') profit = subtotal * Number(p.profitValue || 0) / 100;
  return { homeVisit: Number(p.visitFee), travel, labour: Number(labour), businessProfit: profit, total: Number(p.visitFee) + travel + Number(labour) + profit };
}
function renderEstimate() {
  const target = $('#estimateContent'); if (!target) return;
  const estimate = clientEstimate();
  if (!estimate) {
    target.textContent = getDistance() == null ? 'Enter an approximate one-way distance or share your location for a travel estimate. If distance cannot be estimated, the workshop will discuss the charges before confirming.' : 'Rates have not been configured for this service yet. Send your request and the workshop will discuss an estimate before confirming.';
    $('#estimateBadge').textContent = 'OWNER CONFIRMATION REQUIRED'; return;
  }
  $('#estimateBadge').textContent = 'PRELIMINARY · NOT A FINAL QUOTE';
  target.innerHTML = `<div class="estimate-line"><span>Home visit</span><strong>${money(estimate.homeVisit)}</strong></div><div class="estimate-line"><span>Estimated travel</span><strong>${money(estimate.travel)}</strong></div><div class="estimate-line"><span>Labour (${esc($('#bookingForm').elements.service.value)})</span><strong>${money(estimate.labour)}</strong></div>${estimate.businessProfit ? `<div class="estimate-line"><span>Business profit</span><strong>${money(estimate.businessProfit)}</strong></div>` : ''}<div class="estimate-line estimate-total"><span>Estimated total · parts excluded</span><strong>${money(estimate.total)}</strong></div>`;
}
function getBookingPayload() {
  const f = $('#bookingForm'); const v = Object.fromEntries(new FormData(f).entries());
  return { ...v, latitude: gps.latitude, longitude: gps.longitude, distanceKm: getDistance(), photo: photoData };
}
async function api(url, options = {}, token = '') {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  if (token) headers['X-Admin-Token'] = token;
  const response = await fetch(url, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) throw new Error(data?.error || 'Request failed. Please try again.');
  return data;
}
function showBookingResult(data) {
  const result = $('#bookingResult');
  $('#bookingForm').hidden = true; $('.form-progress').hidden = true;
  const message = `Hello ${config.businessName || 'Krishna Auto Center'}, my service request ${data.id} has been received. Please contact me to confirm.`;
  const wa = whatsappHref(config.whatsapp, message);
  result.hidden = false;
  result.innerHTML = `<p class="eyebrow">REQUEST RECEIVED · PENDING OWNER REVIEW</p><h3>Your service request has been received.</h3><p class="field-hint">${esc(config.businessName || 'Krishna Auto Center')} will contact you to confirm your booking. This is not a confirmed appointment yet.</p><div class="result-reference">${esc(data.id)}</div><p class="field-hint">Keep this reference to check your status. You will also need the phone number from your request.</p><div class="hero-actions"><a class="button button-outline" href="/track" data-route="/track">TRACK REQUEST <span>↗</span></a>${phoneHref(config.phone) ? `<a class="button button-primary" href="${esc(phoneHref(config.phone))}">CALL THE SHOP</a>` : ''}${wa ? `<a class="button button-outline" target="_blank" rel="noreferrer" href="${esc(wa)}">WHATSAPP</a>` : ''}</div>`;
  result.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
async function submitBooking(event) {
  event.preventDefault();
  if (!$('#consent').checked) { $('#consent').reportValidity(); return; }
  $('#bookingError').hidden = true;
  const button = $('#submitBooking'); button.disabled = true; button.textContent = 'SENDING REQUEST…';
  try { const data = await api('/api/bookings', { method: 'POST', body: JSON.stringify(getBookingPayload()) }); showBookingResult(data); }
  catch (error) { $('#bookingError').textContent = error.message; $('#bookingError').hidden = false; }
  finally { button.disabled = false; button.innerHTML = 'SEND REQUEST <span>↗</span>'; }
}
async function trackBooking(event) {
  event.preventDefault(); const form = new FormData(event.currentTarget); const result = $('#trackResult'); result.hidden = true;
  try {
    const data = await api(`/api/bookings/${encodeURIComponent(form.get('id').trim())}?phone=${encodeURIComponent(form.get('phone'))}`);
    result.hidden = false;
    result.innerHTML = `<p class="eyebrow">PRIVATE BOOKING STATUS</p><h2>${esc(data.id)}</h2><span class="status-pill ${esc(data.status.toLowerCase())}">${esc(STATUS_LABELS[data.status] || data.status)}</span><p class="field-hint">Service: ${esc(data.service)} · Preferred date: ${esc(data.date)} · ${esc(data.timeSlot)}</p>${data.ownerQuote != null ? `<p>Owner's current quotation: <strong>${money(data.ownerQuote)}</strong>. Please confirm directly with the workshop.</p>` : ''}<p class="field-hint">For questions, contact the workshop. Booking statuses update after owner action.</p>`;
  } catch (error) { result.hidden = false; result.textContent = error.message; }
}
function setAdminToken(token) { adminToken = token; if (token) sessionStorage.setItem('kac_admin_token', token); else sessionStorage.removeItem('kac_admin_token'); }
function adminMessage(message, error = false) { const el = $('#adminMessage'); el.textContent = message; el.classList.toggle('error', error); el.hidden = false; setTimeout(() => el.hidden = true, 4500); }
function statusOptions(selected) { return Object.keys(STATUS_LABELS).map(s => `<option value="${s}" ${s === selected ? 'selected' : ''}>${esc(STATUS_LABELS[s])}</option>`).join(''); }
function renderAdminBookings(bookings) {
  const pending = bookings.filter(b => b.status === 'PENDING').length;
  const accepted = bookings.filter(b => ['ACCEPTED', 'MECHANIC_ASSIGNED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'].includes(b.status)).length;
  const complete = bookings.filter(b => b.status === 'COMPLETED').length;
  const revenue = bookings.filter(b => b.status === 'COMPLETED').reduce((sum, b) => sum + (Number(b.ownerQuote) || 0), 0);
  const stats = `<div class="admin-stats"><div class="stat-card"><span>ALL REQUESTS</span><strong>${bookings.length}</strong></div><div class="stat-card"><span>PENDING</span><strong>${pending}</strong></div><div class="stat-card"><span>ACTIVE</span><strong>${accepted}</strong></div><div class="stat-card"><span>COMPLETED · QUOTED</span><strong>${money(revenue)}</strong></div></div>`;
  const cards = bookings.map(b => `<article class="booking-card" data-booking="${esc(b.id)}"><div class="booking-card-head"><div><h3>${esc(b.customerName)} · ${esc(b.vehicleBrand)} ${esc(b.vehicleModel)}</h3><small>${esc(b.id)} · ${new Date(b.createdAt).toLocaleString()}</small></div><span class="status-pill ${esc(b.status.toLowerCase())}">${esc(STATUS_LABELS[b.status] || b.status)}</span></div><div class="booking-card-body"><p><strong>Contact:</strong> <a href="tel:${esc(phoneHref(b.phone))}">${esc(b.phone)}</a><br><strong>Service:</strong> ${esc(b.service)} · ${esc(b.urgency)}<br><strong>Registration:</strong> ${esc(b.registration || 'Not provided')} · ${esc(b.fuelType || 'Fuel type not provided')}</p><p><strong>Problem:</strong> ${esc(b.problem)}<br><strong>Preferred:</strong> ${esc(b.date)} · ${esc(b.timeSlot)}<br><strong>Address:</strong> ${esc([b.address,b.landmark,b.area].filter(Boolean).join(', '))}</p>${b.estimate?.total != null ? `<p><strong>Initial estimate:</strong> ${money(b.estimate.total)} · parts excluded</p>` : '<p><strong>Initial estimate:</strong> Not configured / contact customer</p>'}${b.photo ? `<p><strong>Customer photo</strong><img src="${esc(b.photo)}" alt="Customer-provided issue photo"></p>` : ''}</div><div class="booking-card-actions"><label>Status<select class="edit-status">${statusOptions(b.status)}</select></label><label>Owner quotation (₹)<input class="edit-quote" type="number" min="0" step="1" value="${b.ownerQuote == null ? '' : esc(b.ownerQuote)}" placeholder="Not set"></label><label>Mechanic<input class="edit-mechanic" value="${esc(b.assignedMechanic || '')}" maxlength="100" placeholder="Optional"></label><button class="button button-outline save-booking">SAVE UPDATE</button><label class="field-full">Internal notes<textarea class="edit-notes" rows="2" maxlength="1500" placeholder="Private owner notes">${esc(b.ownerNotes || '')}</textarea></label></div></article>`).join('');
  $('#adminRequests').innerHTML = stats + (cards || '<div class="notice-box"><strong>No requests yet.</strong><p>New customer requests will appear here. The site does not automatically confirm appointments.</p></div>');
}
async function loadAdmin() {
  if (!adminToken) { $('#adminLogin').hidden = false; $('#adminPanel').hidden = true; $('#logoutButton').hidden = true; return; }
  try { const bookings = await api('/api/admin/bookings', {}, adminToken); $('#adminLogin').hidden = true; $('#adminPanel').hidden = false; $('#logoutButton').hidden = false; renderAdminBookings(bookings); }
  catch { setAdminToken(''); $('#adminLogin').hidden = false; $('#adminPanel').hidden = true; $('#logoutButton').hidden = true; }
}
async function saveBooking(card) {
  const id = card.dataset.booking;
  try {
    const data = await api(`/api/admin/bookings/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status: $('.edit-status', card).value, ownerQuote: $('.edit-quote', card).value || null, assignedMechanic: $('.edit-mechanic', card).value, ownerNotes: $('.edit-notes', card).value }) }, adminToken);
    adminMessage('Booking updated. The customer status lookup reflects the current status.'); renderAdminBookings(await api('/api/admin/bookings', {}, adminToken));
  } catch (error) { adminMessage(error.message, true); }
}
function renderSettings(settings) {
  const p = settings.pricing || {};
  const input = (label, key, value, type = 'text', attrs = '') => `<label>${label}<input name="${key}" type="${type}" value="${value == null ? '' : esc(value)}" ${attrs}></label>`;
  const services = (settings.services || []).map((s, i) => `<label>Labour · ${esc(s)}<input name="labour_${i}" data-service="${esc(s)}" type="number" min="0" step="1" value="${p.labourByService?.[s] == null ? '' : esc(p.labourByService[s])}" placeholder="Not set"></label>`).join('');
  $('#adminSettings').innerHTML = `<form id="settingsForm">
    <section class="setting-section"><h3>Business contact & service area</h3><div class="setting-grid">
      ${input('Business name','businessName',settings.businessName)}${input('Phone number (with country code)','phone',settings.phone,'tel')}${input('WhatsApp number (with country code)','whatsapp',settings.whatsapp,'tel')}
      ${input('Full address','address',settings.address,'text','class="wide"')}${input('Google Maps directions URL','mapsUrl',settings.mapsUrl,'url','class="wide"')}
      ${input('Opening hours','hours',settings.hours)}${input('Weekly holiday','weeklyHoliday',settings.weeklyHoliday)}${input('Service radius (km)','serviceRadiusKm',settings.serviceRadiusKm,'number','min="0" step="1"')}
      ${input('Workshop latitude (optional)','latitude',settings.latitude,'number','step="any"')}${input('Workshop longitude (optional)','longitude',settings.longitude,'number','step="any"')}
      ${input('Owner PIN · minimum 8 characters','adminPin','','password','minlength="8" placeholder="Leave blank to keep current PIN"')}
      <label>Home-service requests<select name="homeServiceAvailable"><option value="true" ${settings.homeServiceAvailable ? 'selected' : ''}>Available</option><option value="false" ${!settings.homeServiceAvailable ? 'selected' : ''}>Unavailable</option></select></label>
      ${input('Public website URL for sitemap','siteUrl',settings.siteUrl,'url','class="wide"')}${input('Google review URL','googleReviewUrl',settings.googleReviewUrl,'url','class="wide"')}
      <label class="wide">Services actually offered · one category per line<textarea name="serviceCategories" rows="5" maxlength="1600">${esc((settings.services || []).join('\n'))}</textarea></label>
    </div></section>
    <section class="setting-section"><h3>Estimated home-service pricing · INR</h3><p class="field-hint">Leave a price blank until the owner has verified it. Travel is estimated as round-trip distance divided by mileage, times petrol price, plus configured travel margin. Unknown parts are excluded.</p><div class="setting-grid">
      ${input('Home visit fee','visitFee',p.visitFee,'number','min="0" step="1"')}${input('Petrol price per litre','petrolPricePerLitre',p.petrolPricePerLitre,'number','min="0" step="0.01"')}${input('Workshop bike mileage (km/litre)','bikeMileageKmPerLitre',p.bikeMileageKmPerLitre,'number','min="0" step="0.1"')}
      ${input('Travel margin (%)','travelMarginPercent',p.travelMarginPercent,'number','min="0" step="0.1"')}${input('Parts markup (%)','partsMarkupPercent',p.partsMarkupPercent,'number','min="0" step="0.1"')}${input('Profit amount / percent','profitValue',p.profitValue,'number','min="0" step="0.1"')}
      <label>Profit handling<select name="profitMode"><option value="none" ${p.profitMode === 'none' ? 'selected' : ''}>No separate profit line</option><option value="fixed" ${p.profitMode === 'fixed' ? 'selected' : ''}>Add fixed profit amount</option><option value="percent" ${p.profitMode === 'percent' ? 'selected' : ''}>Add percent of subtotal</option></select></label>
      <label>Labour already includes profit?<select name="labourIncludedProfit"><option value="true" ${p.labourIncludedProfit ? 'selected' : ''}>Yes · do not add separate profit</option><option value="false" ${!p.labourIncludedProfit ? 'selected' : ''}>No · use profit setting above</option></select></label>${services}
    </div></section><div class="setting-actions"><button class="button button-primary" type="submit">SAVE SETTINGS <span>↗</span></button></div></form>`;
}
function collectSettings(form, old) {
  const fd = new FormData(form); const obj = Object.fromEntries(fd.entries());
  const labourByService = {};
  $$('[data-service]', form).forEach(el => { labourByService[el.dataset.service] = el.value === '' ? null : Number(el.value); });
  const pricing = { visitFee: obj.visitFee === '' ? null : Number(obj.visitFee), petrolPricePerLitre: obj.petrolPricePerLitre === '' ? null : Number(obj.petrolPricePerLitre), bikeMileageKmPerLitre: obj.bikeMileageKmPerLitre === '' ? null : Number(obj.bikeMileageKmPerLitre), travelMarginPercent: Number(obj.travelMarginPercent || 0), partsMarkupPercent: Number(obj.partsMarkupPercent || 0), profitValue: Number(obj.profitValue || 0), profitMode: obj.profitMode, labourIncludedProfit: obj.labourIncludedProfit === 'true', labourByService };
  const result = { businessName: obj.businessName, phone: obj.phone, whatsapp: obj.whatsapp, address: obj.address, mapsUrl: obj.mapsUrl, googleReviewUrl: obj.googleReviewUrl, siteUrl: obj.siteUrl, hours: obj.hours, weeklyHoliday: obj.weeklyHoliday, services: (obj.serviceCategories || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean), serviceRadiusKm: Number(obj.serviceRadiusKm || 0), latitude: obj.latitude === '' ? null : Number(obj.latitude), longitude: obj.longitude === '' ? null : Number(obj.longitude), homeServiceAvailable: obj.homeServiceAvailable === 'true', pricing };
  if (obj.adminPin) result.adminPin = obj.adminPin;
  return result;
}
function applyLanguage() {
  const toggle = $('#languageToggle'); if (toggle) toggle.textContent = currentLanguage === 'en' ? 'हिन्दी' : 'English';
  document.documentElement.lang = currentLanguage === 'en' ? 'en' : 'hi';
  const routeLinks = { 'Services': 'सेवाएँ', 'Workshop': 'वर्कशॉप', 'Track request': 'बुकिंग स्थिति', 'Owner login': 'मालिक लॉगिन' };
  $$('.main-nav a').forEach(el => { if (!el.dataset.original) el.dataset.original = el.textContent; el.textContent = currentLanguage === 'hi' ? (routeLinks[el.dataset.original] || el.dataset.original) : el.dataset.original; });
  const isHindi = currentLanguage === 'hi';
  const path = location.pathname;
  if ($('#heroTitle')) $('#heroTitle').innerHTML = isHindi ? 'आपकी बाइक<br><em>बेहतर देखभाल की हकदार है।</em>' : 'Your bike<br>deserves <em>expert care.</em>';
  if ($('#heroIntro')) $('#heroIntro').textContent = isHindi ? 'भुरकुंडा, झारखंड में भरोसेमंद बाइक मरम्मत और सर्विस। वर्कशॉप आएँ या घर पर मैकेनिक बुलाएँ।' : 'Trusted motorcycle repair and maintenance in Bhurkunda, Jharkhand. Visit the workshop or request a mechanic at your doorstep.';
  const labels = {
    '#pageHome .hero-actions a[data-route]': isHindi ? 'घर पर सेवा बुक करें ↗' : 'BOOK HOME SERVICE ↗',
    '#heroCall': isHindi ? 'दुकान पर कॉल करें' : '● CALL THE SHOP',
    '#pageHome .section-heading h2': isHindi ? 'बाइक में समस्या? हमें बताइए।' : "Bike problem? We've got you covered.",
    '#pageBook .inner-hero h1': isHindi ? 'बाइक की मरम्मत<br><em>घर पर बुक करें।</em>' : "Let's get your<br>bike <em>sorted.</em>",
    '#pageBook .form-step[data-step="0"] h2': isHindi ? 'अपनी बाइक के बारे में बताइए।' : 'Tell us about your bike.',
    '#pageBook .form-step[data-step="1"] h2': isHindi ? 'बाइक में क्या समस्या है?' : 'What needs attention?',
    '#pageBook .form-step[data-step="2"] h2': isHindi ? 'मैकेनिक कहाँ आए?' : 'Where should we meet you?',
    '#pageBook .form-step[data-step="3"] h2': isHindi ? 'आपके लिए कौन सा समय ठीक है?' : 'When works for you?'
  };
  for (const [selector, value] of Object.entries(labels)) { const el = $(selector); if (el) el.innerHTML = value; }
  $$('.next-step').forEach(el => { el.innerHTML = isHindi ? 'आगे बढ़ें <span>↗</span>' : 'CONTINUE <span>↗</span>'; });
  $$('.previous-step').forEach(el => { el.textContent = isHindi ? 'वापस' : 'BACK'; });
  if ($('#submitBooking')) $('#submitBooking').innerHTML = isHindi ? 'अनुरोध भेजें <span>↗</span>' : 'SEND REQUEST <span>↗</span>';
  if ($('#stepTitle')) $('#stepTitle').textContent = isHindi ? ['आपकी बाइक', 'समस्या का विवरण', 'आपका स्थान', 'समय और अनुरोध'][bookingStep] : ['Your motorcycle', 'Problem details', 'Your location', 'Schedule & review'][bookingStep];
  if ($('#stepLabel')) $('#stepLabel').textContent = isHindi ? `चरण ${bookingStep + 1} / 4` : `STEP ${bookingStep + 1} OF 4`;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest('script,style,textarea,.main-nav')) continue;
    if (node.__kacOriginal === undefined) node.__kacOriginal = node.nodeValue;
    const original = node.__kacOriginal;
    const trimmed = original.trim();
    const translated = isHindi ? (TEXT_HI[trimmed] || trimmed) : trimmed;
    if (trimmed) node.nodeValue = original.replace(trimmed, translated);
  }
  $$('input[placeholder],textarea[placeholder]').forEach(el => {
    if (!el.dataset.englishPlaceholder) el.dataset.englishPlaceholder = el.placeholder;
    el.placeholder = isHindi ? (TEXT_HI[el.dataset.englishPlaceholder] || el.dataset.englishPlaceholder) : el.dataset.englishPlaceholder;
  });
}
async function loadConfig() {
  config = await api('/api/config');
  updateContact(); renderServices(); applyLanguage();
}

$('#menuToggle').addEventListener('click', () => { const nav = $('#mainNav'); const open = nav.classList.toggle('open'); $('#menuToggle').setAttribute('aria-expanded', String(open)); });
document.addEventListener('click', event => { const link = event.target.closest('[data-route]'); if (!link) return; event.preventDefault(); navigate(link.dataset.route); });
document.addEventListener('click', event => { const link = event.target.closest('a[aria-disabled="true"]'); if (!link) return; event.preventDefault(); toast('The owner has not added this contact detail yet.'); });
window.addEventListener('popstate', () => navigate(location.pathname, true));
$$('.next-step').forEach(button => button.addEventListener('click', () => { if (validateStep(bookingStep)) setBookingStep(bookingStep + 1); }));
$$('.previous-step').forEach(button => button.addEventListener('click', () => setBookingStep(bookingStep - 1)));
$('#bookingForm').addEventListener('submit', submitBooking);
  $('#bookingForm').addEventListener('change', event => { if (['service', 'date', 'distanceKm'].includes(event.target.name)) renderEstimate(); });
$('#trackForm').addEventListener('submit', trackBooking);
$('#gpsButton').addEventListener('click', () => {
  const status = $('#gpsStatus');
  if (!navigator.geolocation) { status.textContent = 'GPS is not available in this browser. Enter your address instead.'; return; }
  status.textContent = 'Waiting for location permission…';
  navigator.geolocation.getCurrentPosition(pos => { gps = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }; status.textContent = 'Location added. Your coordinates are attached to this request.'; renderEstimate(); }, err => { status.textContent = err.code === 1 ? 'Permission was not granted. You can continue by entering your address.' : 'Could not get your location. You can continue by entering your address.'; }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
});
$('#photoInput').addEventListener('change', event => {
  const file = event.target.files?.[0]; photoData = '';
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { event.target.value = ''; $('#photoStatus').textContent = 'Choose a JPG, PNG or WEBP image under 2 MB.'; return; }
  const reader = new FileReader(); reader.onload = () => { photoData = reader.result; $('#photoStatus').textContent = 'Photo ready to include with your request.'; }; reader.readAsDataURL(file);
});
$('#loginForm').addEventListener('submit', async event => {
  event.preventDefault(); const pin = new FormData(event.currentTarget).get('pin');
  try { const data = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ pin }) }); setAdminToken(data.token); event.currentTarget.reset(); await loadAdmin(); adminMessage('Signed in.'); }
  catch (error) { adminMessage(error.message, true); }
});
$('#logoutButton').addEventListener('click', async () => { try { await api('/api/admin/logout', { method: 'POST' }, adminToken); } catch {} setAdminToken(''); $('#adminLogin').hidden = false; $('#adminPanel').hidden = true; $('#logoutButton').hidden = true; });
$('#adminRequests').addEventListener('click', event => { const button = event.target.closest('.save-booking'); if (button) saveBooking(button.closest('[data-booking]')); });
$('#csvLink').addEventListener('click', async event => {
  event.preventDefault();
  try {
    const response = await fetch('/api/admin/export.csv', { headers: { 'X-Admin-Token': adminToken } });
    if (!response.ok) throw new Error('Could not export bookings. Please sign in again.');
    const blob = await response.blob(); const objectUrl = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = objectUrl; link.download = 'krishna-auto-bookings.csv'; link.click(); URL.revokeObjectURL(objectUrl);
  } catch (error) { adminMessage(error.message, true); }
});
$$('.admin-tab').forEach(tab => tab.addEventListener('click', async () => {
  $$('.admin-tab').forEach(x => x.classList.toggle('active', x === tab));
  const isSettings = tab.dataset.adminTab === 'settings'; $('#adminRequests').hidden = isSettings; $('#adminSettings').hidden = !isSettings;
  if (isSettings) { try { renderSettings(await api('/api/admin/settings', {}, adminToken)); } catch (error) { adminMessage(error.message, true); } }
}));
$('#adminSettings').addEventListener('submit', async event => {
  if (event.target.id !== 'settingsForm') return; event.preventDefault();
  try { const old = await api('/api/admin/settings', {}, adminToken); const result = await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(collectSettings(event.target, old)) }, adminToken); config = result.config; updateContact(); renderServices(); adminMessage('Business details and pricing saved.'); if ($('[name="adminPin"]', event.target).value) { setAdminToken(''); await loadAdmin(); toast('PIN changed. Sign in with the new PIN.'); } }
  catch (error) { adminMessage(error.message, true); }
});
$('#languageToggle')?.addEventListener('click', () => { currentLanguage = currentLanguage === 'en' ? 'hi' : 'en'; localStorage.setItem('kac_language', currentLanguage); applyLanguage(); });
$('#dateInput').min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const route = ['/', '/services', '/book', '/location', '/track', '/admin', '/privacy', '/terms'].includes(location.pathname) ? location.pathname : '/';
if (route !== location.pathname) history.replaceState({}, '', route);
navigate(route, true);
loadConfig().catch(() => toast('Could not load business settings. Please restart the local app.'));
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('/service-worker.js').catch(() => {});
