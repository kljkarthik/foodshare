// ==========================================================================
// Food Share - Frontend SPA Logic & API Client
// Handles routing, auth sessions, REST API queries, and interactive UI states
// ==========================================================================

const API_BASE = '/api';

// Globals for advanced features
let mapInstance = null;
let markerLayerGroup = null;
let csrChartInstance = null;
let pickerMapInstance = null;
let pickerMarkerInstance = null;
let pickerLayerGroup = null;
let routingControlInstance = null;
let chatPollInterval = null;

// --- APPLICATION STATE ---
let state = {
  currentUser: null,     // { id, username, email, role, phone }
  token: null,           // JWT token string
  listings: [],          // active food listings shown in the browse feed
  myReservations: [],    // reservations associated with current user
  filters: {
    search: '',
    tags: new Set(),
    status: 'available',
    category: 'all'      // Added category filter
  }
};

// --- INIT APP ---
document.addEventListener('DOMContentLoaded', () => {
  initSession();
  setupEventListeners();
  setupExtraFeatures();
  routeByUrl();
});

// --- SESSION MANAGEMENT ---
function initSession() {
  const token = localStorage.getItem('token');
  const userJson = localStorage.getItem('user');

  if (token && userJson) {
    state.token = token;
    state.currentUser = JSON.parse(userJson);
    updateNavUI();

    // Proactively verify session validity with backend
    fetchWithAuth('/auth/me')
      .then(user => {
        state.currentUser = user;
        localStorage.setItem('user', JSON.stringify(user));
        updateNavUI();
      })
      .catch(err => {
        console.warn('Session expired or invalid:', err);
        logout();
      });
  }
}

function saveSession(token, user) {
  state.token = token;
  state.currentUser = user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  updateNavUI();
  showToast(`Welcome back, ${user.username}!`, 'success');
}

function logout() {
  state.token = null;
  state.currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  updateNavUI();
  showSection('landing');
  showToast('You have been logged out.', 'info');
}

// --- API HELPER FUNCTION (Includes JWT token automatically) ---
async function fetchWithAuth(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }

  return data;
}

// --- UI ROUTING SYSTEM ---
function showSection(sectionId) {
  // Hide all sections first
  const heroEl = document.getElementById('landing-hero');
  const howWorksEl = document.getElementById('how-it-works-section');
  const impactEl = document.getElementById('impact-section');
  const authEl = document.getElementById('auth-section');
  const browseEl = document.getElementById('browse-section');
  const donorEl = document.getElementById('donor-section');
  const receiverEl = document.getElementById('receiver-dashboard');
  const adminEl = document.getElementById('admin-section');

  if (heroEl) heroEl.classList.add('hidden');
  if (howWorksEl) howWorksEl.classList.add('hidden');
  if (impactEl) impactEl.classList.add('hidden');
  if (authEl) authEl.classList.add('hidden');
  if (browseEl) browseEl.classList.add('hidden');
  if (donorEl) donorEl.classList.add('hidden');
  if (receiverEl) receiverEl.classList.add('hidden');
  if (adminEl) adminEl.classList.add('hidden');

  // Deactivate all navbar links
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

  // Show target section & highlight active link
  if (sectionId === 'landing') {
    if (heroEl) heroEl.classList.remove('hidden');
    if (howWorksEl) howWorksEl.classList.remove('hidden');
    if (impactEl) impactEl.classList.remove('hidden');
    document.getElementById('nav-home')?.classList.add('active');
    if (typeof setupScrollAnimations === 'function') setupScrollAnimations();
    if (typeof animateCounters === 'function') animateCounters();
  } else if (sectionId === 'auth') {
    if (authEl) authEl.classList.remove('hidden');
  } else if (sectionId === 'browse') {
    if (browseEl) browseEl.classList.remove('hidden');
    document.getElementById('nav-browse')?.classList.add('active');
    loadListings();
  } else if (sectionId === 'donor') {
    if (!state.currentUser || state.currentUser.role !== 'donor') {
      showSection('auth');
      return;
    }
    if (donorEl) donorEl.classList.remove('hidden');
    document.getElementById('nav-donate')?.classList.add('active');
    loadDonorDashboard();
  } else if (sectionId === 'receiver') {
    if (!state.currentUser || state.currentUser.role !== 'receiver') {
      showSection('auth');
      return;
    }
    if (receiverEl) receiverEl.classList.remove('hidden');
    document.getElementById('nav-reservations')?.classList.add('active');
    loadReceiverReservations();
  } else if (sectionId === 'admin') {
    if (!state.currentUser || state.currentUser.role !== 'admin') {
      showSection('auth');
      return;
    }
    if (adminEl) adminEl.classList.remove('hidden');
    document.getElementById('nav-admin')?.classList.add('active');
    loadAdminDashboard();
  }

  // Close mobile navigation drawer if open
  document.getElementById('navbar')?.classList.remove('active');
}

function updateNavUI() {
  const guestElems = document.querySelectorAll('.guest-only');
  const authElems = document.querySelectorAll('.auth-only');
  const donorElems = document.querySelectorAll('.donor-only');
  const receiverElems = document.querySelectorAll('.receiver-only');
  const adminElems = document.querySelectorAll('.admin-only');

  if (state.currentUser) {
    // Authenticated
    guestElems.forEach(el => el.classList.add('hidden'));
    authElems.forEach(el => el.classList.remove('hidden'));

    const displaySpan = document.getElementById('user-display-name');
    if (state.currentUser.role === 'receiver' && state.currentUser.verification_doc === 'verified') {
      displaySpan.innerHTML = `${escapeHTML(state.currentUser.username)} <i class="fa-solid fa-circle-check" style="color: #4caf50; margin-left: 4px;" title="Verified NGO"></i>`;
    } else {
      displaySpan.textContent = state.currentUser.username;
    }

    if (state.currentUser.role === 'donor') {
      donorElems.forEach(el => el.classList.remove('hidden'));
      receiverElems.forEach(el => el.classList.add('hidden'));
      adminElems.forEach(el => el.classList.add('hidden'));
    } else if (state.currentUser.role === 'admin') {
      donorElems.forEach(el => el.classList.add('hidden'));
      receiverElems.forEach(el => el.classList.add('hidden'));
      adminElems.forEach(el => el.classList.remove('hidden'));
    } else {
      donorElems.forEach(el => el.classList.add('hidden'));
      receiverElems.forEach(el => el.classList.remove('hidden'));
      adminElems.forEach(el => el.classList.add('hidden'));
    }
  } else {
    // Guest
    guestElems.forEach(el => el.classList.remove('hidden'));
    authElems.forEach(el => el.classList.add('hidden'));
    donorElems.forEach(el => el.classList.add('hidden'));
    receiverElems.forEach(el => el.classList.add('hidden'));
    adminElems.forEach(el => el.classList.add('hidden'));
  }
}

// --- EVENT LISTENERS INITIALIZATION ---
function setupEventListeners() {
  // Navigation Routing
  document.getElementById('nav-logo').addEventListener('click', (e) => { e.preventDefault(); showSection('landing'); });
  document.getElementById('nav-home').addEventListener('click', (e) => { e.preventDefault(); showSection('landing'); });
  document.getElementById('nav-browse').addEventListener('click', (e) => { e.preventDefault(); showSection('browse'); });
  document.getElementById('nav-donate').addEventListener('click', (e) => { e.preventDefault(); showSection('donor'); });
  document.getElementById('nav-reservations').addEventListener('click', (e) => { e.preventDefault(); showSection('receiver'); });
  document.getElementById('nav-admin').addEventListener('click', (e) => { e.preventDefault(); showSection('admin'); });

  // Hero CTA Buttons
  document.getElementById('hero-btn-browse').addEventListener('click', () => showSection('browse'));
  document.getElementById('hero-btn-donate').addEventListener('click', () => {
    if (state.currentUser) {
      if (state.currentUser.role === 'donor') showSection('donor');
      else showToast('Please register or sign in with a Donor account to post food.', 'warning');
    } else {
      showSection('auth');
      switchToSignupTab('donor');
    }
  });

  // Auth Toggles & Links
  document.getElementById('nav-login').addEventListener('click', (e) => { e.preventDefault(); showSection('auth'); switchToLoginTab(); });
  document.getElementById('nav-register').addEventListener('click', (e) => { e.preventDefault(); showSection('auth'); switchToSignupTab(); });
  document.getElementById('nav-logout').addEventListener('click', (e) => { e.preventDefault(); logout(); });

  // Tab switching
  document.getElementById('tab-login-btn').addEventListener('click', switchToLoginTab);
  document.getElementById('tab-signup-btn').addEventListener('click', () => switchToSignupTab());

  // Role buttons styling selector based on radio change events
  const donorRadio = document.getElementById('role-donor');
  const receiverRadio = document.getElementById('role-receiver');
  const donorLabel = document.getElementById('role-donor-label');
  const receiverLabel = document.getElementById('role-receiver-label');

  if (donorRadio && receiverRadio) {
    donorRadio.addEventListener('change', () => {
      if (donorRadio.checked) {
        donorLabel.classList.add('active');
        receiverLabel.classList.remove('active');
      }
    });
    receiverRadio.addEventListener('change', () => {
      if (receiverRadio.checked) {
        receiverLabel.classList.add('active');
        donorLabel.classList.remove('active');
      }
    });
  }

  // Mobile navigation drawer toggle
  document.getElementById('mobile-toggle').addEventListener('click', () => {
    document.getElementById('navbar').classList.toggle('active');
  });

  // Forms Submits
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('signup-form').addEventListener('submit', handleSignup);
  document.getElementById('create-listing-form').addEventListener('submit', handleCreateListing);
  document.getElementById('claim-verification-form').addEventListener('submit', handleConfirmClaimCode);
  document.getElementById('admin-user-form').addEventListener('submit', handleAdminUserSubmit);

  const ratingForm = document.getElementById('rating-form');
  if (ratingForm) {
    ratingForm.addEventListener('submit', handleRatingSubmit);
  }
  document.getElementById('modal-close-rating-btn').addEventListener('click', () => {
    document.getElementById('rating-modal').close();
  });

  const ngoVerifyForm = document.getElementById('ngo-verify-form');
  if (ngoVerifyForm) {
    ngoVerifyForm.addEventListener('submit', handleNgoVerifySubmit);
  }

  const certModal = document.getElementById('certificate-modal');
  const closeCertBtn = document.getElementById('modal-close-cert-btn');
  if (closeCertBtn && certModal) {
    closeCertBtn.addEventListener('click', () => certModal.close());
  }

  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'btn-export-certificate') {
      openCertificateModal();
    }
  });

  // Attach Live Worldwide Location Autocomplete to Browse Feed Search Bar
  attachLocationAutocomplete('filter-search', 'filter-search-dropdown', ({ address, lat, lon }) => {
    state.filters.search = address;
    loadListings();
    if (mapInstance) {
      mapInstance.setView([lat, lon], 14);
    }
  });

  // Attach Live Worldwide Location Autocomplete to Donor Pickup Address Form Input
  attachLocationAutocomplete('listing-location', 'listing-location-dropdown', ({ address, lat, lon }) => {
    document.getElementById('listing-latitude').value = lat.toFixed(6);
    document.getElementById('listing-longitude').value = lon.toFixed(6);

    if (pickerMapInstance) {
      pickerMapInstance.setView([lat, lon], 15);
      if (pickerMarkerInstance) {
        pickerMarkerInstance.setLatLng([lat, lon]);
      }
      if (pickerLayerGroup) {
        pickerLayerGroup.clearLayers();
        const marker = L.marker([lat, lon]);
        marker.bindPopup(`<div style="font-family: var(--font-sans); width: 180px; padding: 4px;"><strong style="font-size: 0.8rem; color: var(--primary);">Selected Location</strong><p style="font-size: 0.7rem; margin-top: 4px;">${escapeHTML(address)}</p></div>`).openPopup();
        marker.addTo(pickerLayerGroup);
      }
    }
  });

  // Search Input Debouncing & Map Navigation
  let searchTimeout;
  document.getElementById('filter-search').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    state.filters.search = query;
    searchTimeout = setTimeout(() => {
      loadListings();
    }, 400);
  });

  const locateMeBtn = document.getElementById('btn-locate-me');
  if (locateMeBtn) {
    locateMeBtn.addEventListener('click', handleLocateUser);
  }

  // Status Filter Select
  document.getElementById('filter-status').addEventListener('change', (e) => {
    state.filters.status = e.target.value;
    loadListings();
  });

  // Category Filter Select
  document.getElementById('filter-category').addEventListener('change', (e) => {
    state.filters.category = e.target.value;
    loadListings();
  });

  // Reset Filters Button
  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    state.filters.search = '';
    state.filters.status = 'available';
    state.filters.category = 'all';
    state.filters.tags.clear();

    document.getElementById('filter-search').value = '';
    document.getElementById('filter-status').value = 'available';
    document.getElementById('filter-category').value = 'all';
    document.querySelectorAll('.tag-filter-btn').forEach(btn => btn.classList.remove('active'));

    loadListings();
  });

  // Tag filter chips selection
  document.querySelectorAll('.tag-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.getAttribute('data-tag');
      btn.classList.toggle('active');
      if (state.filters.tags.has(tag)) {
        state.filters.tags.delete(tag);
      } else {
        state.filters.tags.add(tag);
      }
      loadListings();
    });
  });

  // Toast banner close
  document.getElementById('notification-close').addEventListener('click', () => {
    document.getElementById('notification-bar').style.display = 'none';
  });

  // Dialog Modals Close
  document.getElementById('modal-close-btn').addEventListener('click', () => {
    document.getElementById('listing-detail-modal').close();
  });
  document.getElementById('modal-close-claim-btn').addEventListener('click', () => {
    document.getElementById('claim-verification-modal').close();
  });
  document.getElementById('modal-close-chat-btn').addEventListener('click', () => {
    document.getElementById('chat-modal').close();
    if (chatPollInterval) {
      clearInterval(chatPollInterval);
      chatPollInterval = null;
    }
  });

  document.getElementById('chat-send-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const listingId = document.getElementById('chat-listing-id').value;
    const input = document.getElementById('chat-message-input');
    const text = input.value.trim();
    if (text) {
      sendChatMessage(listingId, text);
      input.value = '';
    }
  });
}

// --- AUTH UI TABS ---
function switchToLoginTab() {
  document.getElementById('tab-login-btn').classList.add('active');
  document.getElementById('tab-signup-btn').classList.remove('active');
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('signup-form').classList.add('hidden');
}

function switchToSignupTab(defaultRole = 'donor') {
  document.getElementById('tab-signup-btn').classList.add('active');
  document.getElementById('tab-login-btn').classList.remove('active');
  document.getElementById('signup-form').classList.remove('hidden');
  document.getElementById('login-form').classList.add('hidden');

  if (defaultRole === 'donor') {
    const radio = document.getElementById('role-donor');
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change'));
    }
  } else {
    const radio = document.getElementById('role-receiver');
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change'));
    }
  }
}

// --- SUBMIT HANDLERS ---

// User Login
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetchWithAuth('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    saveSession(res.token, res.user);
    e.target.reset();

    // Redirect depending on user role
    if (res.user.role === 'donor') {
      showSection('donor');
    } else {
      showSection('browse');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// User Registration
async function handleSignup(e) {
  e.preventDefault();
  const role = document.querySelector('input[name="signup-role"]:checked').value;
  const username = document.getElementById('signup-username').value;
  const email = document.getElementById('signup-email').value;
  const phone = document.getElementById('signup-phone').value;
  const password = document.getElementById('signup-password').value;

  if (password.length < 6) {
    showToast('Password must be at least 6 characters.', 'error');
    return;
  }

  try {
    await fetchWithAuth('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, role, phone })
    });

    showToast('Registration successful! Please login.', 'success');
    switchToLoginTab();

    // Auto-fill login email for convenience
    document.getElementById('login-email').value = email;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Helper to read file as base64 data URL
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

// Create Food Listing (Donor)
async function handleCreateListing(e) {
  e.preventDefault();
  const title = document.getElementById('listing-title').value;
  const food_category = document.getElementById('listing-category').value;
  const quantity = document.getElementById('listing-quantity').value;
  const expiry_time = new Date(document.getElementById('listing-expiry').value).toISOString();
  const pickup_location = document.getElementById('listing-location').value;
  const latitude = document.getElementById('listing-latitude').value;
  const longitude = document.getElementById('listing-longitude').value;
  const pickup_start = new Date(document.getElementById('listing-pickup-start').value).toISOString();
  const pickup_end = new Date(document.getElementById('listing-pickup-end').value).toISOString();
  const description = document.getElementById('listing-description').value;

  // Read uploaded file as base64 URL
  const fileInput = document.getElementById('listing-image-file');
  let image_url = '';
  if (fileInput && fileInput.files.length > 0) {
    try {
      image_url = await readFileAsDataURL(fileInput.files[0]);
    } catch (err) {
      console.error('Error reading image file:', err);
      showToast('Failed to read image file. Listing will be posted without it.', 'warning');
    }
  }

  // Compile selected dietary checkboxes
  const selectedTags = [];
  document.querySelectorAll('input[name="listing-tags"]:checked').forEach(cb => {
    selectedTags.push(cb.value);
  });
  const dietary_tags = selectedTags.join(',');

  try {
    await fetchWithAuth('/listings', {
      method: 'POST',
      body: JSON.stringify({
        title, description, quantity, pickup_location, pickup_start, pickup_end, expiry_time, dietary_tags, image_url, food_category, latitude, longitude
      })
    });

    showToast('Food listing posted successfully!', 'success');
    e.target.reset();

    // Hide image preview on form reset
    const previewContainer = document.getElementById('image-preview-container');
    const previewImage = document.getElementById('image-preview');
    if (previewContainer && previewImage) {
      previewContainer.classList.add('hidden');
      previewImage.src = '';
    }

    loadDonorDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// --- DATA RETRIEVAL & RENDERING ---

// // Retrieve food listings for Browse Feed
async function loadListings() {
  const grid = document.getElementById('listings-grid');
  grid.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Filtering fresh meals...</div>';

  try {
    // Build query params
    let url = `/listings?status=${state.filters.status === 'all' ? '' : state.filters.status}`;
    if (state.filters.category && state.filters.category !== 'all') {
      url += `&category=${encodeURIComponent(state.filters.category)}`;
    }
    if (state.filters.search) {
      url += `&search=${encodeURIComponent(state.filters.search)}`;
    }

    const data = await fetchWithAuth(url);
    state.listings = data;
    renderListings(data);

    // Initialize Leaflet map and draw markers
    initializeMap();
    updateMapMarkers(data);
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Error fetching listings: ${err.message}</div>`;
  }
}

// Render Listings feed
function renderListings(listings) {
  const grid = document.getElementById('listings-grid');

  if (listings.length === 0) {
    grid.innerHTML = `
      <div class="empty-state-container">
        <i class="fa-solid fa-cookie-bite empty-state-icon"></i>
        <p>No listings match your search criteria. Check back soon!</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = listings.map(l => {
    const defaultImg = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop';
    const bgImg = l.image_url ? l.image_url : defaultImg;

    // Format Tags
    const tagsHtml = l.dietary_tags
      ? l.dietary_tags.split(',').map(t => {
          let cssClass = 'tag-nuts';
          if (t.toLowerCase() === 'vegan') cssClass = 'tag-vegan';
          if (t.toLowerCase() === 'vegetarian') cssClass = 'tag-vegetarian';
          if (t.toLowerCase() === 'gluten-free') cssClass = 'tag-gf';
          return `<span class="tag ${cssClass}">${t}</span>`;
        }).join('')
      : '';

    // Calculate expiry string
    const expiryDate = new Date(l.expiry_time);
    const isExpired = expiryDate < new Date();
    const expiryStr = isExpired ? 'Expired' : `Expires at: ${expiryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    let cardActionBtn = '';
    const isOwner = state.currentUser && state.currentUser.id === l.donor_id;

    if (l.status === 'available' && !isExpired) {
      if (!state.currentUser) {
        cardActionBtn = `<button class="btn btn-primary btn-sm" onclick="showSection('auth'); switchToSignupTab('receiver');"><i class="fa-solid fa-bookmark"></i> Book Now</button>`;
      } else if (state.currentUser.role === 'receiver') {
        cardActionBtn = `<button class="btn btn-primary btn-sm" onclick="reserveFood('${l.id}')"><i class="fa-solid fa-bookmark"></i> Book Now</button>`;
      } else if (state.currentUser.role === 'donor' && isOwner) {
        cardActionBtn = `<span style="font-size: 0.8rem; color: var(--primary); font-weight: 700;"><i class="fa-solid fa-circle-user"></i> Mine</span>`;
      }
    }

    return `
      <article class="listing-card">
        <div class="listing-card-image" style="background-image: url('${bgImg}')">
          <span class="listing-status-tag status-${l.status}">${l.status}</span>
          <span class="listing-status-tag" style="background-color: var(--secondary); left: auto; right: 12px; font-size: 8px;">${escapeHTML(l.food_category || 'Other')}</span>
        </div>
        <div class="listing-body">
          <div class="listing-tags">${tagsHtml}</div>
          <h3 class="listing-title">${escapeHTML(l.title)}</h3>
          <p style="font-size: 0.75rem; color: #f0a500; margin-bottom: 8px; font-weight: 700; display: flex; align-items: center; gap: 4px;">
            <i class="fa-solid fa-star"></i> <span>${l.donor_rating || 'New'}</span> <span style="color: var(--text-muted); font-weight: 400;">(${l.donor_rating_count || 0} reviews)</span>
          </p>
          <p class="listing-description">${escapeHTML(l.description || 'No description provided.')}</p>

          <div class="listing-meta" style="display: flex; flex-direction: column; gap: 8px;">
            <div class="meta-item" style="display: flex; align-items: flex-start; gap: 6px;">
              <i class="fa-solid fa-location-dot" style="margin-top: 3px;"></i>
              <span>${escapeHTML(l.pickup_location)}</span>
            </div>
            <div class="meta-item">
              <i class="fa-solid fa-clock"></i>
              <span>${expiryStr}</span>
            </div>
          </div>
        </div>
        <div class="listing-footer">
          <span class="listing-qty"><i class="fa-solid fa-cubes"></i> ${escapeHTML(l.quantity)}</span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="btn btn-secondary btn-sm" onclick="openListingDetail('${l.id}')">Details</button>
            ${cardActionBtn}
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// Open Dialog Details modal for single food listing
async function openListingDetail(listingId) {
  const modal = document.getElementById('listing-detail-modal');
  const body = document.getElementById('modal-body-content');
  body.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Retrieving detail view...</div>';
  modal.showModal();

  try {
    const listing = await fetchWithAuth(`/listings/${listingId}`);

    // Check if the current user owns it or reserved it
    const isOwner = state.currentUser && state.currentUser.id === listing.donor_id;

    const expiryDate = new Date(listing.expiry_time);
    const isExpired = expiryDate < new Date();

    const startWindow = new Date(listing.pickup_start).toLocaleString();
    const endWindow = new Date(listing.pickup_end).toLocaleString();

    let actionBtnHtml = '';

    if (!state.currentUser) {
      actionBtnHtml = `<button class="btn btn-primary btn-full" onclick="showSection('auth'); document.getElementById('listing-detail-modal').close();">Log In to Reserve Food</button>`;
    } else if (state.currentUser.role === 'receiver') {
      if (listing.status === 'available' && !isExpired) {
        actionBtnHtml = `<button class="btn btn-primary btn-full" onclick="reserveFood('${listing.id}')"><i class="fa-solid fa-cart-shopping"></i> Reserve This Food</button>`;
      } else if (listing.status === 'reserved') {
        actionBtnHtml = `
          <div class="notification-bar warning" style="border-radius: var(--radius-sm); margin-bottom:12px;">This listing is currently reserved.</div>
          <button class="btn btn-primary btn-full" onclick="showDirectionsToPickup(${listing.latitude || 19.0760}, ${listing.longitude || 72.8777})"><i class="fa-solid fa-diamond-turn-right"></i> Get Directions</button>
          <button class="btn btn-secondary btn-full margin-top" onclick="openListingChat('${listing.id}')"><i class="fa-solid fa-comments"></i> Open Coordination Chat</button>
          <button class="btn btn-danger btn-full margin-top" onclick="releaseReservation('${listing.id}')">Cancel/Release Reservation</button>
        `;
      } else if (listing.status === 'claimed') {
        actionBtnHtml = `<button class="btn btn-secondary btn-full" disabled>Food Already Claimed</button>`;
      } else if (isExpired || listing.status === 'expired') {
        actionBtnHtml = `<button class="btn btn-secondary btn-full" disabled>Food Expired</button>`;
      }
    } else if (state.currentUser.role === 'donor') {
      if (isOwner) {
        if (listing.status === 'reserved') {
          actionBtnHtml = `
            <button class="btn btn-primary btn-full" onclick="openClaimVerification('${listing.id}')"><i class="fa-solid fa-check-double"></i> Validate Claim Code</button>
            <button class="btn btn-secondary btn-full margin-top" onclick="openListingChat('${listing.id}')"><i class="fa-solid fa-comments"></i> Open Coordination Chat</button>
            <button class="btn btn-danger btn-full margin-top" onclick="releaseReservation('${listing.id}')">Release Reservation (Make Available)</button>
          `;
        } else {
          actionBtnHtml = `<button class="btn btn-danger btn-full" onclick="deleteListing('${listing.id}')"><i class="fa-solid fa-trash-can"></i> Delete Listing</button>`;
        }
      } else {
        actionBtnHtml = `<p class="empty-state">Logged in as a Donor. You cannot reserve food listings.</p>`;
      }
    }

    const defaultImg = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop';
    const bgImg = listing.image_url ? listing.image_url : defaultImg;

    // Contact info display condition: Show donor phone only if authorized
    const contactInfoHtml = state.currentUser
      ? `<div class="donor-contact-card">
          <h5><i class="fa-solid fa-address-book"></i> Donor Contact Details</h5>
          <p><strong>Name:</strong> ${escapeHTML(listing.donor_name)}</p>
          <p><strong>Phone:</strong> ${escapeHTML(listing.donor_phone || 'Not provided')}</p>
          <p><strong>Email:</strong> ${escapeHTML(listing.donor_email)}</p>
         </div>`
      : `<div class="donor-contact-card" style="text-align:center;">
          <p><i class="fa-solid fa-lock"></i> Login to view pickup contact numbers.</p>
         </div>`;

    body.innerHTML = `
      <div class="modal-detail-img" style="background-image: url('${bgImg}')"></div>
      <h4 class="modal-detail-title">${escapeHTML(listing.title)}</h4>
      <p class="modal-detail-desc" style="margin-bottom: 8px;"><strong>Category:</strong> <span style="font-weight: 700; color: var(--primary);">${escapeHTML(listing.food_category || 'Other')}</span></p>
      <p class="modal-detail-desc">${escapeHTML(listing.description || 'No detailed instructions provided.')}</p>

      <div class="modal-detail-grid">
        <div class="modal-detail-item">
          <h5>Quantity</h5>
          <p>${escapeHTML(listing.quantity)}</p>
        </div>
        <div class="modal-detail-item">
          <h5>Current Status</h5>
          <p><span class="status-${listing.status}">${listing.status}</span></p>
        </div>
        <div class="modal-detail-item">
          <h5>Pickup Window Start</h5>
          <p>${startWindow}</p>
        </div>
        <div class="modal-detail-item">
          <h5>Pickup Window End</h5>
          <p>${endWindow}</p>
        </div>
        <div class="modal-detail-item" style="grid-column: span 2;">
          <h5>Location Address</h5>
          <p><i class="fa-solid fa-location-dot"></i> ${escapeHTML(listing.pickup_location)}</p>
        </div>
      </div>

      ${contactInfoHtml}
      <div class="margin-top">
        ${actionBtnHtml}
      </div>
    `;
  } catch (err) {
    body.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
  }
}

// --- DONOR ACTIONS & DASHBOARD ---
async function loadDonorDashboard() {
  const listingsList = document.getElementById('donor-listings-list');
  const reservationsList = document.getElementById('donor-reservations-list');

  listingsList.innerHTML = '<p class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading lists...</p>';
  reservationsList.innerHTML = '<p class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading pending orders...</p>';

  try {
    // 1. Fetch donor's own listings
    const allListings = await fetchWithAuth('/listings?status=all');
    const donorListings = allListings.filter(l => l.donor_id === state.currentUser.id);

    if (donorListings.length === 0) {
      listingsList.innerHTML = '<p class="empty-state">You have not posted any food listings yet.</p>';
    } else {
      listingsList.innerHTML = donorListings.map(l => `
        <div class="dashboard-item-row">
          <div class="dashboard-item-info">
            <h4>${escapeHTML(l.title)}</h4>
            <p>Qty: ${escapeHTML(l.quantity)} | Status: <span class="status-${l.status}">${l.status}</span></p>
          </div>
          <div class="dashboard-item-actions">
            <button class="btn btn-secondary btn-sm" onclick="openListingDetail('${l.id}')">View</button>
            <button class="btn btn-danger btn-sm" onclick="deleteListing('${l.id}')"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </div>
      `).join('');
    }

    // 2. Fetch reservations on donor's listings
    const reservations = await fetchWithAuth('/reservations/my');
    const activeReservations = reservations.filter(r => r.status === 'active');

    if (activeReservations.length === 0) {
      reservationsList.innerHTML = '<p class="empty-state">No pending reservations for your listings.</p>';
    } else {
      reservationsList.innerHTML = activeReservations.map(r => `
        <div class="dashboard-item-row" style="border-left: 4px solid var(--accent)">
          <div class="dashboard-item-info">
            <h4>${escapeHTML(r.title)}</h4>
            <p>Reserved by: <strong>${escapeHTML(r.receiver_name)}</strong>${r.receiver_verified ? ' <i class="fa-solid fa-circle-check" style="color: #4caf50;" title="Verified NGO"></i>' : ''}</p>
            <p>Contact: ${escapeHTML(r.receiver_phone || r.receiver_email)}</p>
          </div>
          <div class="dashboard-item-actions">
            <button class="btn btn-primary btn-sm" onclick="openClaimVerification('${r.listing_id}')">Claim</button>
          </div>
        </div>
      `).join('');
    }

    // 3. Fetch CSR statistics and draw chart
    try {
      const stats = await fetchWithAuth('/listings/stats');
      document.getElementById('donor-stats-meals').innerText = stats.meals;
      document.getElementById('donor-stats-water').innerText = stats.water.toLocaleString();
      document.getElementById('donor-stats-co2').innerText = stats.co2;
      renderCsrChart(stats.monthlyData);
    } catch (statsErr) {
      console.warn('Failed to load CSR stats:', statsErr);
    }

    // 4. Initialize location picker map
    initializePickerMap();
  } catch (err) {
    listingsList.innerHTML = `<p class="empty-state">Error: ${err.message}</p>`;
    reservationsList.innerHTML = `<p class="empty-state">Error: ${err.message}</p>`;
  }
}

// Delete Listing (Donor)
async function deleteListing(listingId) {
  if (!confirm('Are you sure you want to delete this listing? Any reservations will be cancelled.')) return;

  try {
    await fetchWithAuth(`/listings/${listingId}`, {
      method: 'DELETE'
    });
    showToast('Listing deleted successfully.', 'success');
    document.getElementById('listing-detail-modal').close();

    if (state.currentUser.role === 'donor') loadDonorDashboard();
    else loadListings();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// --- RECEIVER ACTIONS & RESERVATION ---

// Reserve Food Listing
async function reserveFood(listingId) {
  try {
    const res = await fetchWithAuth(`/listings/${listingId}/reserve`, {
      method: 'POST'
    });

    document.getElementById('listing-detail-modal').close();
    showToast(`Food reserved! Your code is: ${res.reservationCode}`, 'success');
    showSection('receiver'); // Redirect to reservations dashboard
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Release Reservation
async function releaseReservation(listingId) {
  if (!confirm('Are you sure you want to cancel this reservation? The food will be made available back on the feed.')) return;

  try {
    await fetchWithAuth(`/listings/${listingId}/release`, {
      method: 'POST'
    });
    showToast('Reservation successfully cancelled.', 'success');
    document.getElementById('listing-detail-modal').close();

    if (state.currentUser.role === 'receiver') loadReceiverReservations();
    else loadDonorDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Load Receiver Reservations
async function loadReceiverReservations() {
  const grid = document.getElementById('receiver-reservations-grid');
  grid.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Retrieving your claims...</div>';

  try {
    // Load XP and verification document status
    try {
      const profile = await fetchWithAuth('/auth/me');
      if (profile && profile.xp_points !== undefined) {
        document.getElementById('user-xp-display').innerText = profile.xp_points;
        updateBadgesAndLevel(profile.xp_points);
      }

      const statusDiv = document.getElementById('ngo-verification-status');
      if (profile && statusDiv) {
        const verifyForm = document.getElementById('ngo-verify-form');
        if (profile.verification_doc === 'verified') {
          statusDiv.innerHTML = 'Status: <span style="color: #4caf50;"><i class="fa-solid fa-circle-check"></i> Verified & Approved</span>';
          if (verifyForm) verifyForm.style.display = 'none';
        } else if (profile.verification_doc) {
          statusDiv.innerHTML = 'Status: <span style="color: #ff9800;"><i class="fa-solid fa-hourglass-half"></i> Under Review (Document Uploaded)</span>';
          if (verifyForm) verifyForm.style.display = 'none';
        } else {
          statusDiv.innerHTML = 'Status: <span style="color: #f44336;"><i class="fa-solid fa-circle-xmark"></i> Not Verified (Submit credentials to get verified)</span>';
          if (verifyForm) verifyForm.style.display = 'flex';
        }
      }
    } catch (xpErr) {
      console.warn('XP and verification status fetch skipped:', xpErr);
    }

    const reservations = await fetchWithAuth('/reservations/my');

    // Load leaderboard list
    try {
      const leaderboard = await fetchWithAuth('/users/leaderboard');
      const leaderboardList = document.getElementById('leaderboard-list');
      if (leaderboardList) {
        if (leaderboard.length === 0) {
          leaderboardList.innerHTML = '<p class="empty-state">No rescuers ranked yet.</p>';
        } else {
          leaderboardList.innerHTML = leaderboard.map((u, index) => {
            let medal = '';
            if (index === 0) medal = '🥇';
            else if (index === 1) medal = '🥈';
            else if (index === 2) medal = '🥉';
            else medal = `<strong>#${index + 1}</strong>`;

            return `
              <div class="dashboard-item-row" style="padding: 10px; margin-bottom: 0;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 1.1rem;">${medal}</span>
                  <strong style="font-size: 0.85rem;">${escapeHTML(u.username)}</strong>
                </div>
                <span style="font-size: 0.85rem; font-weight: 700; color: var(--primary);">${u.xp_points} XP</span>
              </div>
            `;
          }).join('');
        }
      }
    } catch (leaderboardErr) {
      console.warn('Failed to load leaderboard:', leaderboardErr);
    }

    if (reservations.length === 0) {
      grid.innerHTML = `
        <div class="empty-state-container">
          <i class="fa-solid fa-utensils empty-state-icon"></i>
          <p>You have no active food reservations.</p>
          <button class="btn btn-primary" onclick="showSection('browse')">Browse Available Food</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = reservations.map(r => {
      const isCompleted = r.status === 'completed';
      const isCancelled = r.status === 'cancelled';

      let cardStyle = '';
      let footerHtml = '';

      if (r.status === 'active') {
        cardStyle = 'border-top: 4px solid var(--accent);';
        footerHtml = `
          <div class="reservation-code-badge">
            <span class="reservation-code-title">Pickup Code</span>
            <div class="reservation-code-val">${escapeHTML(r.reservation_code)}</div>
          </div>
          <div class="donor-contact-card">
            <h5><i class="fa-solid fa-address-card"></i> Donor Information</h5>
            <p><strong>Store:</strong> ${escapeHTML(r.donor_name)}</p>
            <p><strong>Phone:</strong> ${escapeHTML(r.donor_phone || 'No phone')}</p>
            <p><strong>Location:</strong> ${escapeHTML(r.pickup_location)}</p>
          </div>
          <button class="btn btn-danger btn-full margin-top" onclick="releaseReservation('${r.listing_id}')">Cancel Reservation</button>
        `;
      } else {
        cardStyle = 'border-top: 4px solid var(--border); opacity: 0.8;';

        let ratingBtnHtml = '';
        if (isCompleted) {
          if (r.rating) {
            ratingBtnHtml = `<div style="margin-top: 10px; font-weight: bold; color: var(--accent); text-align: center;">Feedback: ${'⭐'.repeat(r.rating)}</div>`;
          } else {
            ratingBtnHtml = `<button class="btn btn-secondary btn-sm margin-top btn-full" onclick="openRatingModal('${r.id}')"><i class="fa-solid fa-star"></i> Rate Pickup</button>`;
          }
        }

        footerHtml = `
          <div style="text-align:center; padding: 20px 0 10px; font-weight:700; color: ${isCompleted ? 'var(--success)' : 'var(--error)'}">
            <i class="fa-solid ${isCompleted ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
            Reservation ${r.status}
          </div>
          ${ratingBtnHtml}
        `;
      }

      return `
        <div class="reservation-card" style="${cardStyle}">
          <h3>${escapeHTML(r.title)}</h3>
          <p class="margin-top" style="font-size:0.9rem; color:var(--text-muted);">
            <i class="fa-solid fa-cubes"></i> Qty: ${escapeHTML(r.quantity)}
          </p>
          ${footerHtml}
        </div>
      `;
    }).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
  }
}

// --- CLAIM CODE MODAL HANDLERS ---
function openClaimVerification(listingId) {
  document.getElementById('claim-listing-id').value = listingId;
  document.getElementById('claim-code-input').value = '';
  document.getElementById('listing-detail-modal').close();
  document.getElementById('claim-verification-modal').showModal();
}

async function handleConfirmClaimCode(e) {
  e.preventDefault();
  const listingId = document.getElementById('claim-listing-id').value;
  const reservationCode = document.getElementById('claim-code-input').value.trim();

  try {
    await fetchWithAuth(`/listings/${listingId}/claim`, {
      method: 'POST',
      body: JSON.stringify({ reservationCode })
    });

    showToast('Pickup confirmed! Food claimed successfully.', 'success');
    document.getElementById('claim-verification-modal').close();

    if (state.currentUser.role === 'donor') loadDonorDashboard();
    else showSection('browse');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// --- NOTIFICATION / TOAST SYSTEM ---
function showToast(message, type = 'info') {
  // 1. Maintain top notification bar if present
  const bar = document.getElementById('notification-bar');
  const text = document.getElementById('notification-text');
  if (bar && text) {
    bar.className = 'notification-bar';
    if (type === 'success') bar.classList.add('success');
    if (type === 'error') bar.classList.add('error');
    if (type === 'warning') bar.classList.add('warning');
    text.textContent = message;
    bar.style.display = 'flex';
  }

  // 2. Modern floating toast pill
  const container = document.getElementById('toast-container');
  if (container) {
    const toast = document.createElement('div');
    toast.className = `toast-pill toast-${type}`;

    let iconClass = 'fa-circle-info';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-xmark';
    if (type === 'warning') iconClass = 'fa-triangle-exclamation';

    toast.innerHTML = `
      <i class="fa-solid ${iconClass} toast-icon"></i>
      <span class="toast-message">${escapeHTML(message)}</span>
      <div class="toast-progress"></div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4800);
  }
}

// --- SECURITY UTILITY ---
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Generic reusable Live Location Autocomplete component with Typo Tolerance (Photon + Nominatim)
function attachLocationAutocomplete(inputId, dropdownId, onSelectCallback) {
  const inputEl = document.getElementById(inputId);
  const dropdownEl = document.getElementById(dropdownId);
  if (!inputEl || !dropdownEl) return;

  let debounceTimer = null;

  inputEl.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(debounceTimer);

    if (query.length < 2) {
      dropdownEl.classList.add('hidden');
      dropdownEl.innerHTML = '';
      return;
    }

    // Show loading state
    dropdownEl.innerHTML = '<div class="autocomplete-loading"><i class="fa-solid fa-spinner fa-spin"></i> Searching locations worldwide...</div>';
    dropdownEl.classList.remove('hidden');

    debounceTimer = setTimeout(async () => {
      try {
        // Concurrently query Photon (fuzzy & typo tolerant) and Nominatim (structured OSM)
        const [photonRes, nominatimRes] = await Promise.allSettled([
          fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6`),
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&addressdetails=1`)
        ]);

        const formattedResults = [];
        const seenCoords = new Set();

        // 1. Process Photon fuzzy geocoding results (handles typos like "hydrabad", "mubai")
        if (photonRes.status === 'fulfilled' && photonRes.value.ok) {
          const photonData = await photonRes.value.json();
          if (photonData && photonData.features) {
            photonData.features.forEach(f => {
              const coords = f.geometry ? f.geometry.coordinates : null;
              if (!coords) return;
              const lon = coords[0];
              const lat = coords[1];
              const coordKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;

              if (seenCoords.has(coordKey)) return;
              seenCoords.add(coordKey);

              const props = f.properties || {};
              const titleParts = [props.name || props.street || props.district || props.city].filter(Boolean);
              const subParts = [props.street, props.district, props.city, props.state, props.country].filter(p => p && p !== titleParts[0]);

              const title = titleParts[0] || 'Location';
              const subtitle = subParts.join(', ') || props.country || '';
              const fullAddress = [title, subtitle].filter(Boolean).join(', ');

              formattedResults.push({
                lat,
                lon,
                title,
                subtitle,
                fullAddress
              });
            });
          }
        }

        // 2. Process Nominatim results to complement Photon
        if (nominatimRes.status === 'fulfilled' && nominatimRes.value.ok) {
          const nomData = await nominatimRes.value.json();
          if (Array.isArray(nomData)) {
            nomData.forEach(item => {
              const lat = parseFloat(item.lat);
              const lon = parseFloat(item.lon);
              const coordKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;

              if (seenCoords.has(coordKey)) return;
              seenCoords.add(coordKey);

              const parts = item.display_name.split(', ');
              const title = parts[0] || item.display_name;
              const subtitle = parts.slice(1).join(', ') || '';

              formattedResults.push({
                lat,
                lon,
                title,
                subtitle,
                fullAddress: item.display_name
              });
            });
          }
        }

        if (formattedResults.length === 0) {
          dropdownEl.innerHTML = '<div class="autocomplete-empty"><i class="fa-solid fa-location-dot"></i> No matching locations found. Check spelling.</div>';
          return;
        }

        // Limit to 7 distinct results
        const finalResults = formattedResults.slice(0, 7);

        dropdownEl.innerHTML = finalResults.map(item => {
          const safeTitle = escapeHTML(item.title);
          const safeSubtitle = escapeHTML(item.subtitle);
          const safeFull = escapeHTML(item.fullAddress);

          return `
            <div class="autocomplete-item" data-lat="${item.lat}" data-lon="${item.lon}" data-address="${safeFull}">
              <i class="fa-solid fa-location-dot autocomplete-icon"></i>
              <div class="autocomplete-text-container">
                <div class="autocomplete-title">${safeTitle}</div>
                <div class="autocomplete-subtitle">${safeSubtitle}</div>
              </div>
            </div>
          `;
        }).join('');

        // Attach click listener to generated items
        dropdownEl.querySelectorAll('.autocomplete-item').forEach(itemNode => {
          itemNode.addEventListener('click', (evt) => {
            evt.stopPropagation();
            const address = itemNode.getAttribute('data-address');
            const lat = parseFloat(itemNode.getAttribute('data-lat'));
            const lon = parseFloat(itemNode.getAttribute('data-lon'));

            inputEl.value = address;
            dropdownEl.classList.add('hidden');
            dropdownEl.innerHTML = '';

            if (onSelectCallback) {
              onSelectCallback({ address, lat, lon });
            }
          });
        });

      } catch (err) {
        console.warn('Location autocomplete fetch error:', err);
        dropdownEl.innerHTML = '<div class="autocomplete-empty">Unable to fetch suggestions</div>';
      }
    }, 280);
  });

  // Hide dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!inputEl.contains(e.target) && !dropdownEl.contains(e.target)) {
      dropdownEl.classList.add('hidden');
    }
  });

  // Hide dropdown on Escape key
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dropdownEl.classList.add('hidden');
    }
  });
}

// Simple fallback router based on hash links
function routeByUrl() {
  const hash = window.location.hash;
  const path = window.location.pathname;
  if (path === '/ui-demo' || hash === '#ui-demo') {
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', '/');
    }
    showSection('landing');
    return;
  }
  if (hash === '#browse') showSection('browse');
  else if (hash === '#donate') showSection('donor');
  else if (hash === '#reservations') showSection('receiver');
  else if (hash === '#auth') showSection('auth');
  else showSection('landing');
}
window.addEventListener('hashchange', routeByUrl);

// --- EXTRA PREMIUM FEATURES (Dark Mode, Live Preview, and Impact Calculator) ---
function setupExtraFeatures() {
  // 1. Dark Mode Setup
  const themeToggleBtn = document.getElementById('theme-toggle');
  const storedTheme = localStorage.getItem('theme') || 'light';

  // Apply saved theme on startup
  if (storedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    document.body.classList.remove('light-theme');
    if (themeToggleBtn) {
      themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }
  } else {
    document.body.classList.add('light-theme');
    document.body.classList.remove('dark-theme');
    if (themeToggleBtn) {
      themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', (e) => {
      const toggle = () => {
        if (document.body.classList.contains('dark-theme')) {
          document.body.classList.remove('dark-theme');
          document.body.classList.add('light-theme');
          localStorage.setItem('theme', 'light');
          themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
          showToast('Switched to Light Mode', 'info');
        } else {
          document.body.classList.remove('light-theme');
          document.body.classList.add('dark-theme');
          localStorage.setItem('theme', 'dark');
          themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
          showToast('Switched to Dark Mode', 'info');
        }
      };

      // Modern View Transition API for radial clip wipe
      if (!document.startViewTransition) {
        toggle();
        return;
      }

      const x = e.clientX;
      const y = e.clientY;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const transition = document.startViewTransition(toggle);
      transition.ready.then(() => {
        const clipPath = [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`
        ];
        document.documentElement.animate(
          {
            clipPath: document.body.classList.contains('dark-theme')
              ? clipPath
              : [...clipPath].reverse()
          },
          {
            duration: 450,
            easing: 'ease-in-out',
            pseudoElement: document.body.classList.contains('dark-theme')
              ? '::view-transition-new(root)'
              : '::view-transition-old(root)'
          }
        );
      });
    });
  }



  // 2. Live Image Preview
  const fileInput = document.getElementById('listing-image-file');
  const previewContainer = document.getElementById('image-preview-container');
  const previewImage = document.getElementById('image-preview');
  const removeImageBtn = document.getElementById('btn-remove-image');

  if (fileInput && previewContainer && previewImage && removeImageBtn) {
    fileInput.addEventListener('change', async (e) => {
      if (fileInput.files.length > 0) {
        try {
          const dataUrl = await readFileAsDataURL(fileInput.files[0]);
          previewImage.src = dataUrl;
          previewContainer.classList.remove('hidden');
        } catch (err) {
          console.error(err);
        }
      } else {
        previewContainer.classList.add('hidden');
        previewImage.src = '';
      }
    });

    removeImageBtn.addEventListener('click', () => {
      fileInput.value = '';
      previewContainer.classList.add('hidden');
      previewImage.src = '';
    });
  }

  // 3. Impact Calculator Logic
  const calcSlider = document.getElementById('calc-slider');
  const calcMealsVal = document.getElementById('calc-meals-val');
  const calcWater = document.getElementById('calc-water');
  const calcCo2 = document.getElementById('calc-co2');

  if (calcSlider && calcMealsVal && calcWater && calcCo2) {
    const updateCalculator = () => {
      const meals = parseInt(calcSlider.value);
      calcMealsVal.textContent = meals;

      const waterSaved = meals * 300;
      const co2Saved = meals * 2.5;

      calcWater.textContent = waterSaved.toLocaleString();
      calcCo2.textContent = co2Saved.toFixed(0);
    };

    calcSlider.addEventListener('input', updateCalculator);
    updateCalculator();
  }
}

// --- ADVANCED FEATURES CONTROLLER FUNCTIONS ---

// Leaflet Map Initialization
function initializeMap() {
  const mapContainer = document.getElementById('map-view');
  if (!mapContainer) return;

  if (!mapInstance) {
    // Default to Mumbai Center, India
    mapInstance = L.map('map-view').setView([19.0760, 72.8777], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(mapInstance);
    markerLayerGroup = L.layerGroup().addTo(mapInstance);
  } else {
    // Invalidate size in case display toggled
    setTimeout(() => { mapInstance.invalidateSize(); }, 150);
  }
}

// Plot listing coordinates on map view
function updateMapMarkers(listings) {
  if (!mapInstance || !markerLayerGroup) return;
  markerLayerGroup.clearLayers();

  const coordinates = [];

  listings.forEach(l => {
    let lat = parseFloat(l.latitude);
    let lng = parseFloat(l.longitude);
    if (isNaN(lat)) lat = 19.0760;
    if (isNaN(lng)) lng = 72.8777;

    const marker = L.marker([lat, lng]);
    const popupContent = `
      <div style="font-family: var(--font-sans); width: 140px; padding: 4px;">
        <h4 style="font-weight:800; font-size:0.85rem; margin-bottom: 2px; color: var(--dark);">${escapeHTML(l.title)}</h4>
        <p style="font-size:0.7rem; color:var(--text-muted); margin-bottom: 6px;">Qty: ${escapeHTML(l.quantity)}</p>
        <button class="btn btn-primary btn-sm" onclick="openListingDetail('${l.id}')" style="padding: 4px; font-size:0.65rem; width:100%; border-radius: var(--radius-sm);">View Details</button>
      </div>
    `;

    marker.bindPopup(popupContent);
    marker.addTo(markerLayerGroup);
    coordinates.push([lat, lng]);
  });

  if (coordinates.length > 0) {
    const bounds = L.latLngBounds(coordinates);
    mapInstance.fitBounds(bounds, { padding: [40, 40] });
  }
}

// Render CSR Environmental statistics bar chart
function renderCsrChart(monthlyData) {
  const ctx = document.getElementById('donor-csr-chart');
  if (!ctx) return;

  const monthsName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const labels = [];
  const dataValues = [];

  // Populate chart with trailing 6 months dataset
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const mCode = String(d.getMonth() + 1).padStart(2, '0');
    labels.push(monthsName[d.getMonth()]);

    const record = monthlyData.find(r => r.month === mCode);
    dataValues.push(record ? record.count : 0);
  }

  if (csrChartInstance) {
    csrChartInstance.destroy();
  }

  csrChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Meals Shared',
        data: dataValues,
        backgroundColor: '#2a6f43',
        borderRadius: 4,
        barThickness: 16
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.04)' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

// Open Star Rating modal dialog
function openRatingModal(reservationId) {
  document.getElementById('rating-reservation-id').value = reservationId;
  document.getElementById('rating-select').value = "5";
  document.getElementById('rating-review').value = "";
  document.getElementById('rating-modal').showModal();
}

// Submit star rating feedback
async function handleRatingSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('rating-reservation-id').value;
  const rating = document.getElementById('rating-select').value;
  const review = document.getElementById('rating-review').value;

  try {
    await fetchWithAuth(`/reservations/${id}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating, review })
    });
    showToast('Star feedback submitted successfully. Thank you!', 'success');
    document.getElementById('rating-modal').close();
    loadReceiverReservations();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Submit NGO verification document upload
async function handleNgoVerifySubmit(e) {
  e.preventDefault();
  const fileInput = document.getElementById('ngo-doc-file');
  const statusDiv = document.getElementById('ngo-verification-status');

  if (!fileInput || fileInput.files.length === 0) return;

  statusDiv.innerText = "Submitting documentation...";
  statusDiv.style.color = "var(--accent)";

  try {
    const file = fileInput.files[0];
    const dataUrl = await readFileAsDataURL(file);
    await fetchWithAuth('/users/verify-doc', {
      method: 'POST',
      body: JSON.stringify({ verificationDoc: dataUrl })
    });

    statusDiv.innerText = "Status: Pending Review (Document Uploaded)";
    statusDiv.style.color = "var(--primary)";
    const verifyForm = document.getElementById('ngo-verify-form');
    if (verifyForm) verifyForm.style.display = 'none';

    showToast('NGO Verification document submitted successfully!', 'success');
  } catch (err) {
    statusDiv.innerText = "Error: " + err.message;
    statusDiv.style.color = "var(--error)";
    showToast(err.message, 'error');
  }
}

// Open Certificate Print Modal
async function openCertificateModal() {
  const certModal = document.getElementById('certificate-modal');
  if (!certModal) return;

  try {
    const stats = await fetchWithAuth('/listings/stats');
    const profile = await fetchWithAuth('/auth/me');

    document.getElementById('cert-donor-name').innerText = profile.username;
    document.getElementById('cert-meals').innerText = stats.meals;
    document.getElementById('cert-water').innerText = stats.water.toLocaleString();
    document.getElementById('cert-co2').innerText = stats.co2;

    certModal.showModal();
  } catch (err) {
    showToast('Failed to load certificate stats: ' + err.message, 'error');
  }
}

// Initialize donor create listing picker map
function initializePickerMap() {
  const mapContainer = document.getElementById('listing-picker-map');
  if (!mapContainer) return;

  const defaultLat = 19.0760;
  const defaultLng = 72.8777;

  if (!pickerMapInstance) {
    pickerMapInstance = L.map('listing-picker-map').setView([defaultLat, defaultLng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(pickerMapInstance);

    // Create search result layer group
    pickerLayerGroup = L.layerGroup().addTo(pickerMapInstance);

    // Initial default marker
    pickerMarkerInstance = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(pickerMapInstance);

    // Update coordinates when marker is dragged
    pickerMarkerInstance.on('dragend', function (e) {
      const position = pickerMarkerInstance.getLatLng();
      document.getElementById('listing-latitude').value = position.lat.toFixed(6);
      document.getElementById('listing-longitude').value = position.lng.toFixed(6);
    });

    // Update coordinates when map is clicked
    pickerMapInstance.on('click', function (e) {
      pickerMarkerInstance.setLatLng(e.latlng);
      document.getElementById('listing-latitude').value = e.latlng.lat.toFixed(6);
      document.getElementById('listing-longitude').value = e.latlng.lng.toFixed(6);
    });

    // Bind Address geocoding search
    const addressInput = document.getElementById('listing-location');
    if (addressInput) {
      addressInput.addEventListener('change', async () => {
        const query = addressInput.value.trim();
        if (!query) return;

        // Clear previous search result markers
        pickerLayerGroup.clearLayers();

        try {
          // Fetch up to 10 matching locations from Nominatim
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10`);
          const data = await res.json();
          if (data && data.length > 0) {
            const bounds = [];
            data.forEach((place, index) => {
              const lat = parseFloat(place.lat);
              const lon = parseFloat(place.lon);
              const displayName = place.display_name;

              // Place search pin
              const marker = L.marker([lat, lon]);
              const popupContent = `
                <div style="font-family: var(--font-sans); width: 180px; padding: 4px;">
                  <strong style="font-size: 0.8rem; color: var(--primary);">Search Result #${index + 1}</strong>
                  <p style="font-size: 0.7rem; margin-top: 4px; margin-bottom: 8px; max-height: 50px; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(displayName)}</p>
                  <button class="btn btn-primary btn-sm" onclick="selectPickerLocation('${escapeHTML(displayName).replace(/'/g, "\\'")}', ${lat}, ${lon})" style="padding: 4px; font-size: 0.7rem; width: 100%; border-radius: var(--radius-sm);">Select This</button>
                </div>
              `;
              marker.bindPopup(popupContent);
              marker.addTo(pickerLayerGroup);
              bounds.push([lat, lon]);
            });

            // Adjust map view bounds to encompass all results
            if (bounds.length > 1) {
              pickerMapInstance.fitBounds(bounds, { padding: [30, 30] });
            } else {
              pickerMapInstance.setView(bounds[0], 14);
            }

            // Default to first choice coordinates
            const first = data[0];
            const firstLat = parseFloat(first.lat);
            const firstLon = parseFloat(first.lon);
            pickerMarkerInstance.setLatLng([firstLat, firstLon]);
            document.getElementById('listing-latitude').value = firstLat.toFixed(6);
            document.getElementById('listing-longitude').value = firstLon.toFixed(6);
          } else {
            showToast('No locations matched your address search.', 'warning');
          }
        } catch (err) {
          console.warn('Geocoding search failed:', err);
        }
      });
    }
  } else {
    // Invalidate size and reset view
    setTimeout(() => {
      pickerMapInstance.invalidateSize();
      pickerMapInstance.setView([defaultLat, defaultLng], 12);
      pickerMarkerInstance.setLatLng([defaultLat, defaultLng]);
      pickerLayerGroup.clearLayers();
      document.getElementById('listing-latitude').value = defaultLat.toFixed(6);
      document.getElementById('listing-longitude').value = defaultLng.toFixed(6);
    }, 150);
  }
}

// Global selection handler for map pickers
window.selectPickerLocation = function(address, lat, lon) {
  document.getElementById('listing-location').value = address;
  document.getElementById('listing-latitude').value = lat.toFixed(6);
  document.getElementById('listing-longitude').value = lon.toFixed(6);

  if (pickerMarkerInstance) {
    pickerMarkerInstance.setLatLng([lat, lon]);
  }

  if (pickerLayerGroup) {
    pickerLayerGroup.clearLayers();
  }

  showToast('Location selected: ' + address.split(',')[0], 'success');
};

// Geocode search terms and pan/zoom map view
async function geocodeAndNavigateMap(query) {
  if (!mapInstance) return;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      mapInstance.setView([lat, lon], 13);
    }
  } catch (err) {
    console.warn('Map geocode search navigation failed:', err);
  }
}

// Center map view on user's current GPS location
function handleLocateUser(e) {
  e.preventDefault();
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      if (mapInstance) {
        mapInstance.setView([latitude, longitude], 14);
        L.popup()
          .setLatLng([latitude, longitude])
          .setContent("<strong>You are here</strong>")
          .openOn(mapInstance);
      }
    }, (err) => {
      showToast("Error getting location: " + err.message, "warning");
    });
  } else {
    showToast("Geolocation services are not supported by this browser.", "warning");
  }
}

// Calculate and update gamified badges & levels based on XP
function updateBadgesAndLevel(xp) {
  const progressBar = document.getElementById('xp-progress-bar');
  const levelText = document.getElementById('xp-next-level');
  if (!progressBar || !levelText) return;

  const nextLevelXp = Math.ceil((xp + 1) / 250) * 250;
  const currentLevelBase = Math.floor(xp / 250) * 250;
  const progressPercent = Math.min(((xp - currentLevelBase) / 250) * 100, 100);

  progressBar.style.width = `${progressPercent}%`;
  levelText.innerText = `${xp} / ${nextLevelXp} XP (Level ${Math.floor(xp / 250) + 1})`;

  const badgeBronze = document.getElementById('badge-bronze');
  const badgeSilver = document.getElementById('badge-silver');
  const badgeGold = document.getElementById('badge-gold');
  const badgeHero = document.getElementById('badge-hero');

  if (xp >= 50) badgeBronze.classList.remove('locked');
  else badgeBronze.classList.add('locked');

  if (xp >= 150) badgeSilver.classList.remove('locked');
  else badgeSilver.classList.add('locked');

  if (xp >= 250) badgeGold.classList.remove('locked');
  else badgeGold.classList.add('locked');

  if (xp >= 500) badgeHero.classList.remove('locked');
  else badgeHero.classList.add('locked');
}

// Generate Leaflet turn-by-turn routing directions
function showDirectionsToPickup(destLat, destLng) {
  const modal = document.getElementById('listing-detail-modal');
  if (modal) modal.close();

  showSection('browse');

  if (!mapInstance) return;

  // Clear previous routing lines
  if (routingControlInstance) {
    mapInstance.removeControl(routingControlInstance);
    routingControlInstance = null;
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;

      routingControlInstance = L.Routing.control({
        waypoints: [
          L.latLng(latitude, longitude),
          L.latLng(destLat, destLng)
        ],
        routeWhileDragging: true,
        createMarker: function() { return null; } // Only show the line path
      }).addTo(mapInstance);

      showToast("Directions route successfully plotted on map!", "success");
    }, (err) => {
      showToast("GPS error: " + err.message, "warning");
    });
  } else {
    showToast("Geolocation services are not supported by this browser.", "warning");
  }
}

// Open Coordination Chat Room dialog
async function openListingChat(listingId) {
  // Close details modal
  const detailModal = document.getElementById('listing-detail-modal');
  if (detailModal) detailModal.close();

  const chatModal = document.getElementById('chat-modal');
  if (!chatModal) return;

  document.getElementById('chat-listing-id').value = listingId;
  document.getElementById('chat-message-input').value = '';

  const chatMessagesBox = document.getElementById('chat-messages-container');
  chatMessagesBox.innerHTML = '<p class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Retrieving conversation logs...</p>';

  chatModal.showModal();

  // Fetch messages initially
  await fetchChatMessages(listingId);

  // Clear previous polling intervals
  if (chatPollInterval) {
    clearInterval(chatPollInterval);
  }

  // Poll for new messages every 4 seconds
  chatPollInterval = setInterval(() => {
    fetchChatMessages(listingId);
  }, 4000);
}

// Retrieve message history from database
async function fetchChatMessages(listingId) {
  const chatMessagesBox = document.getElementById('chat-messages-container');
  if (!chatMessagesBox) return;

  try {
    const messages = await fetchWithAuth(`/messages/${listingId}`);
    if (messages.length === 0) {
      chatMessagesBox.innerHTML = '<p class="empty-state">No messages yet. Send a note to coordinate pickup details!</p>';
    } else {
      const currentUserId = state.currentUser ? state.currentUser.id : null;
      chatMessagesBox.innerHTML = messages.map(m => {
        const isMe = m.sender_id === currentUserId;
        const alignStyle = isMe ? 'align-self: flex-end; background-color: var(--primary-light);' : 'align-self: flex-start; background-color: var(--border);';
        const nameColor = isMe ? 'var(--primary)' : 'var(--dark)';

        return `
          <div style="max-width: 80%; padding: 8px 12px; border-radius: var(--radius-sm); margin: 2px 0; ${alignStyle}">
            <strong style="font-size: 0.65rem; display: block; color: ${nameColor};">${escapeHTML(m.sender_name)}</strong>
            <span style="font-size: 0.8rem; display: block; margin-top: 2px; color: var(--dark);">${escapeHTML(m.text)}</span>
            <span style="font-size: 0.55rem; color: var(--text-muted); display: block; text-align: right; margin-top: 4px;">${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        `;
      }).join('');

      // Scroll to bottom
      chatMessagesBox.scrollTop = chatMessagesBox.scrollHeight;
    }
  } catch (err) {
    console.error('Failed to poll chat:', err);
  }
}

// Send chat message
async function sendChatMessage(listingId, text) {
  try {
    await fetchWithAuth('/messages', {
      method: 'POST',
      body: JSON.stringify({ listingId, text })
    });
    // Immediately refresh list
    fetchChatMessages(listingId);
  } catch (err) {
    showToast('Failed to send message: ' + err.message, 'error');
  }
}

// Window scope registrations for inline HTML event click/submit attributes
window.showDirectionsToPickup = showDirectionsToPickup;
window.openListingChat = openListingChat;
window.openClaimVerification = openClaimVerification;

// --- ADMINISTRATIVE CONTROL DASHBOARD ACTIONS ---

let adminRolesChartInstance = null;
let adminListingsChartInstance = null;

async function loadAdminDashboard() {
  const usersTableBody = document.getElementById('admin-users-table-body');
  const ngoVerifyList = document.getElementById('admin-pending-verification-list');

  if (usersTableBody) usersTableBody.innerHTML = '<tr><td colspan="5" class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Retrieving users...</td></tr>';
  if (ngoVerifyList) ngoVerifyList.innerHTML = '<p class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Checking documents...</p>';

  try {
    // 1. Fetch statistics
    const stats = await fetchWithAuth('/admin/stats');
    document.getElementById('admin-stat-users').innerText = stats.totalUsers || 0;
    document.getElementById('admin-stat-listings').innerText = stats.totalListings || 0;
    document.getElementById('admin-stat-claims').innerText = stats.completedClaims || 0;

    // Render interactive analytics charts
    renderAdminCharts(stats);

    // 2. Fetch users list
    const users = await fetchWithAuth('/admin/users');

    if (users.length === 0) {
      usersTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No registered accounts in system.</td></tr>';
    } else {
      usersTableBody.innerHTML = users.map(u => {
        let roleBadge = '';
        if (u.role === 'donor') roleBadge = '<span class="status-tag status-available" style="font-size:9px; background-color: var(--secondary-light); color: var(--secondary);">donor</span>';
        else if (u.role === 'admin') roleBadge = '<span class="status-tag status-reserved" style="font-size:9px; background-color: var(--error-light); color: var(--error);">admin</span>';
        else roleBadge = '<span class="status-tag status-claimed" style="font-size:9px; background-color: var(--primary-light); color: var(--primary);">receiver</span>';

        return `
          <tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 10px;"><strong>${escapeHTML(u.username)}</strong></td>
            <td style="padding: 10px; color: var(--text-muted);">${escapeHTML(u.email)}</td>
            <td style="padding: 10px;">${escapeHTML(u.phone || 'N/A')}</td>
            <td style="padding: 10px;">${roleBadge}</td>
            <td style="padding: 10px; text-align: right;">
              <button class="btn btn-secondary btn-sm" onclick="editUser('${u._id}')" style="padding: 4px 8px; font-size: 0.75rem;"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-danger btn-sm" onclick="deleteUser('${u._id}')" style="padding: 4px 8px; font-size: 0.75rem;"><i class="fa-solid fa-trash-can"></i></button>
            </td>
          </tr>
        `;
      }).join('');
    }

    // 3. Render NGO document verifications list
    const pendingNgos = users.filter(u => u.role === 'receiver' && u.verification_doc && u.verification_doc !== 'verified');
    if (pendingNgos.length === 0) {
      ngoVerifyList.innerHTML = '<p class="empty-state">No pending documents to verify.</p>';
    } else {
      ngoVerifyList.innerHTML = pendingNgos.map(ngo => {
        const isImg = ngo.verification_doc && ngo.verification_doc.startsWith('data:image/');
        const viewBtn = `<button class="btn btn-secondary btn-sm" onclick="viewVerificationDoc('${ngo.verification_doc.replace(/'/g, "\\'")}')" style="padding: 4px 8px; font-size: 0.7rem;"><i class="fa-solid fa-eye"></i> View Doc</button>`;
        const thumb = isImg ? `<img src="${ngo.verification_doc}" onclick="viewVerificationDoc('${ngo.verification_doc.replace(/'/g, "\\'")}')" style="width: 50px; height: 50px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--border); cursor: pointer; margin-top: 6px; box-shadow: var(--shadow-sm); display: block;" alt="Doc Thumbnail">` : '';

        return `
          <div class="dashboard-item-row" style="padding: 12px; flex-direction: column; align-items: stretch; gap: 8px;">
            <div>
              <strong style="font-size: 0.85rem; display: block; color: var(--dark);">${escapeHTML(ngo.username)}</strong>
              <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Pending tax-exempt document:</span>
              ${thumb}
            </div>
            <div style="display: flex; gap: 6px; justify-content: flex-end; align-items: center; margin-top: 4px;">
              ${viewBtn}
              <button class="btn btn-danger btn-sm" onclick="verifyNgoUser('${ngo._id}', false)" style="padding: 4px 8px; font-size: 0.7rem;">Reject</button>
              <button class="btn btn-primary btn-sm" onclick="verifyNgoUser('${ngo._id}', true)" style="padding: 4px 8px; font-size: 0.7rem;">Approve</button>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    showToast('Failed to load admin lists: ' + err.message, 'error');
  }
}

function renderAdminCharts(stats) {
  const rolesCtx = document.getElementById('admin-roles-chart');
  const listingsCtx = document.getElementById('admin-listings-chart');

  if (!rolesCtx || !listingsCtx) return;

  const rData = stats.roles || { donor: 0, receiver: 0, admin: 0 };
  const lData = stats.listings || { available: 0, reserved: 0, claimed: 0, expired: 0 };

  // 1. User Roles Pie Chart
  if (adminRolesChartInstance) {
    adminRolesChartInstance.destroy();
  }
  adminRolesChartInstance = new Chart(rolesCtx, {
    type: 'pie',
    data: {
      labels: ['Donors', 'Receivers', 'Admins'],
      datasets: [{
        data: [rData.donor, rData.receiver, rData.admin],
        backgroundColor: ['#1565c0', '#2e7d32', '#f9a825'],
        borderWidth: 1,
        borderColor: 'var(--surface)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 8,
            font: { size: 9, family: 'var(--font-sans)' },
            color: 'var(--dark)'
          }
        }
      }
    }
  });

  // 2. Listing Status Bar Chart
  if (adminListingsChartInstance) {
    adminListingsChartInstance.destroy();
  }
  adminListingsChartInstance = new Chart(listingsCtx, {
    type: 'bar',
    data: {
      labels: ['Avail', 'Resv', 'Claimed', 'Expr'],
      datasets: [{
        label: 'Count',
        data: [lData.available, lData.reserved, lData.claimed, lData.expired],
        backgroundColor: ['#2e7d32', '#f9a825', '#1565c0', '#c62828'],
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 8 }, color: 'var(--dark)' }
        },
        y: {
          grid: { color: 'var(--border)' },
          ticks: { font: { size: 8 }, color: 'var(--dark)', precision: 0 }
        }
      }
    }
  });
}

function viewVerificationDoc(docData) {
  const modal = document.getElementById('admin-doc-modal');
  const img = document.getElementById('admin-doc-preview-image');
  const fallback = document.getElementById('admin-doc-preview-fallback');

  if (!modal) return;

  if (docData && (docData.startsWith('data:image/') || docData.startsWith('data:application/pdf') || docData.startsWith('data:'))) {
    img.src = docData;
    img.style.display = 'inline-block';
    fallback.style.display = 'none';
  } else if (docData && (docData.startsWith('http://') || docData.startsWith('https://'))) {
    img.src = docData;
    img.style.display = 'inline-block';
    fallback.style.display = 'none';
  } else if (docData && (docData.endsWith('.jpg') || docData.endsWith('.jpeg') || docData.endsWith('.png') || docData.endsWith('.webp') || docData.endsWith('.gif'))) {
    img.src = '/uploads/' + docData;
    img.style.display = 'inline-block';
    fallback.style.display = 'none';
  } else {
    img.src = '';
    img.style.display = 'none';
    fallback.style.display = 'block';
    fallback.innerText = `Document details: ${escapeHTML(docData)}`;
  }

  modal.showModal();
}

async function handleAdminUserSubmit(e) {
  e.preventDefault();

  const userId = document.getElementById('admin-user-id').value;
  const username = document.getElementById('admin-user-username').value;
  const email = document.getElementById('admin-user-email').value;
  const phone = document.getElementById('admin-user-phone').value;
  const role = document.getElementById('admin-user-role').value;
  const password = document.getElementById('admin-user-password').value;

  try {
    if (userId) {
      // Edit User mode
      await fetchWithAuth(`/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ username, email, phone, role })
      });
      showToast('User profile updated successfully.', 'success');
    } else {
      // Create User mode
      if (!password) {
        showToast('Password is required for new user profiles.', 'warning');
        return;
      }
      await fetchWithAuth('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ username, email, phone, role, password })
      });
      showToast('New user account created successfully.', 'success');
    }

    cancelAdminUserEdit();
    loadAdminDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function editUser(userId) {
  try {
    const users = await fetchWithAuth('/admin/users');
    const u = users.find(user => user._id === userId);
    if (!u) return;

    document.getElementById('admin-user-id').value = u._id;
    document.getElementById('admin-user-username').value = u.username;
    document.getElementById('admin-user-email').value = u.email;
    document.getElementById('admin-user-phone').value = u.phone || '';
    document.getElementById('admin-user-role').value = u.role;

    // Hide password field for edits to prevent accidental rewrites
    document.getElementById('admin-password-group').style.display = 'none';
    document.getElementById('admin-user-password').required = false;

    document.getElementById('admin-form-title').innerHTML = '<i class="fa-solid fa-user-pen icon-accent"></i> Edit Profile';
    document.getElementById('admin-form-subtitle').innerText = 'Modify details of the selected profile.';
    document.getElementById('btn-admin-cancel-edit').style.display = 'inline-block';

    // Scroll form into view
    document.getElementById('admin-user-form').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteUser(userId) {
  if (!confirm('Are you sure you want to delete this user profile? All associated records will be lost.')) return;

  try {
    await fetchWithAuth(`/admin/users/${userId}`, {
      method: 'DELETE'
    });
    showToast('User deleted successfully.', 'success');
    loadAdminDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function verifyNgoUser(userId, approve) {
  try {
    await fetchWithAuth(`/admin/users/${userId}/verify`, {
      method: 'POST',
      body: JSON.stringify({ approve })
    });
    showToast(approve ? 'NGO Verified!' : 'NGO Verification Rejected.', 'success');
    loadAdminDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function cancelAdminUserEdit() {
  document.getElementById('admin-user-id').value = '';
  document.getElementById('admin-user-form').reset();

  // Restore password field
  document.getElementById('admin-password-group').style.display = 'block';

  document.getElementById('admin-form-title').innerHTML = '<i class="fa-solid fa-user-plus icon-accent"></i> Add New Profile';
  document.getElementById('admin-form-subtitle').innerText = 'Create a new donor or receiver profile manually.';
  document.getElementById('btn-admin-cancel-edit').style.display = 'none';
}

window.cancelAdminUserEdit = cancelAdminUserEdit;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.verifyNgoUser = verifyNgoUser;
window.viewVerificationDoc = viewVerificationDoc;

// --- MODERN SCROLL ANIMATIONS & COUNTERS ---
function setupScrollAnimations() {
  const elements = document.querySelectorAll('.reveal-up, .reveal-left, .reveal-right, .scale-in');
  if (!('IntersectionObserver' in window)) {
    elements.forEach(el => el.classList.add('active-revealed'));
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active-revealed');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  elements.forEach(el => observer.observe(el));
}

function animateCounters() {
  const counters = document.querySelectorAll('.count-up');
  counters.forEach(counter => {
    const target = +counter.getAttribute('data-target') || 0;
    const duration = 1600;
    const start = 0;
    const startTime = performance.now();

    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (target - start) * ease);
      counter.textContent = current.toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        counter.textContent = target.toLocaleString();
      }
    }
    requestAnimationFrame(update);
  });
}

// Global hookups
window.setupScrollAnimations = setupScrollAnimations;
window.animateCounters = animateCounters;

document.addEventListener('DOMContentLoaded', () => {
  const navHowItWorks = document.getElementById('nav-how-it-works');
  if (navHowItWorks) {
    navHowItWorks.addEventListener('click', (e) => {
      e.preventDefault();
      showSection('landing');
      document.getElementById('how-it-works-section')?.scrollIntoView({ behavior: 'smooth' });
    });
  }
  const navImpact = document.getElementById('nav-impact');
  if (navImpact) {
    navImpact.addEventListener('click', (e) => {
      e.preventDefault();
      showSection('landing');
      document.getElementById('impact-section')?.scrollIntoView({ behavior: 'smooth' });
    });
  }
  setupScrollAnimations();
});
