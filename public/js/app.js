// ==========================================================================
// Food Share - Frontend SPA Logic & API Client
// Handles routing, auth sessions, REST API queries, and interactive UI states
// ==========================================================================

const API_BASE = '/api';

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
  document.getElementById('landing-hero').classList.add('hidden');
  document.getElementById('auth-section').classList.add('hidden');
  document.getElementById('browse-section').classList.add('hidden');
  document.getElementById('donor-section').classList.add('hidden');
  document.getElementById('receiver-dashboard').classList.add('hidden');

  // Deactivate all navbar links
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

  // Show target section & highlight active link
  if (sectionId === 'landing') {
    document.getElementById('landing-hero').classList.remove('hidden');
    document.getElementById('nav-home').classList.add('active');
  } else if (sectionId === 'auth') {
    document.getElementById('auth-section').classList.remove('hidden');
  } else if (sectionId === 'browse') {
    document.getElementById('browse-section').classList.remove('hidden');
    document.getElementById('nav-browse').classList.add('active');
    loadListings();
  } else if (sectionId === 'donor') {
    if (!state.currentUser || state.currentUser.role !== 'donor') {
      showSection('auth');
      return;
    }
    document.getElementById('donor-section').classList.remove('hidden');
    document.getElementById('nav-donate').classList.add('active');
    loadDonorDashboard();
  } else if (sectionId === 'receiver') {
    if (!state.currentUser || state.currentUser.role !== 'receiver') {
      showSection('auth');
      return;
    }
    document.getElementById('receiver-dashboard').classList.remove('hidden');
    document.getElementById('nav-reservations').classList.add('active');
    loadReceiverReservations();
  }

  // Close mobile navigation drawer if open
  document.getElementById('navbar').classList.remove('active');
}

function updateNavUI() {
  const guestElems = document.querySelectorAll('.guest-only');
  const authElems = document.querySelectorAll('.auth-only');
  const donorElems = document.querySelectorAll('.donor-only');
  const receiverElems = document.querySelectorAll('.receiver-only');

  if (state.currentUser) {
    // Authenticated
    guestElems.forEach(el => el.classList.add('hidden'));
    authElems.forEach(el => el.classList.remove('hidden'));
    document.getElementById('user-display-name').textContent = state.currentUser.username;

    if (state.currentUser.role === 'donor') {
      donorElems.forEach(el => el.classList.remove('hidden'));
      receiverElems.forEach(el => el.classList.add('hidden'));
    } else {
      donorElems.forEach(el => el.classList.add('hidden'));
      receiverElems.forEach(el => el.classList.remove('hidden'));
    }
  } else {
    // Guest
    guestElems.forEach(el => el.classList.remove('hidden'));
    authElems.forEach(el => el.classList.add('hidden'));
    donorElems.forEach(el => el.classList.add('hidden'));
    receiverElems.forEach(el => el.classList.add('hidden'));
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

  // Search Input Debouncing
  let searchTimeout;
  document.getElementById('filter-search').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    state.filters.search = e.target.value.trim();
    searchTimeout = setTimeout(loadListings, 300);
  });

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
        title, description, quantity, pickup_location, pickup_start, pickup_end, expiry_time, dietary_tags, image_url, food_category
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

// Retrieve food listings for Browse Feed
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
    if (state.filters.tags.size > 0) {
      const tagString = Array.from(state.filters.tags).join(',');
      url += `&tags=${encodeURIComponent(tagString)}`;
    }

    const data = await fetchWithAuth(url);
    state.listings = data;
    renderListings(data);
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
        cardActionBtn = `<button class="btn btn-primary btn-sm" onclick="reserveFood(${l.id})"><i class="fa-solid fa-bookmark"></i> Book Now</button>`;
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
            <button class="btn btn-secondary btn-sm" onclick="openListingDetail(${l.id})">Details</button>
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
        actionBtnHtml = `<button class="btn btn-primary btn-full" onclick="reserveFood(${listing.id})"><i class="fa-solid fa-cart-shopping"></i> Reserve This Food</button>`;
      } else if (listing.status === 'reserved') {
        actionBtnHtml = `
          <div class="notification-bar warning" style="border-radius: var(--radius-sm); margin-bottom:12px;">This listing is currently reserved by a receiver.</div>
          <button class="btn btn-danger btn-full" onclick="releaseReservation(${listing.id})">Cancel/Release Reservation</button>
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
            <button class="btn btn-primary btn-full" onclick="openClaimVerification(${listing.id})"><i class="fa-solid fa-check-double"></i> Validate Claim Code</button>
            <button class="btn btn-danger btn-full margin-top" onclick="releaseReservation(${listing.id})">Release Reservation (Make Available)</button>
          `;
        } else {
          actionBtnHtml = `<button class="btn btn-danger btn-full" onclick="deleteListing(${listing.id})"><i class="fa-solid fa-trash-can"></i> Delete Listing</button>`;
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
    // Querying all listings where status is anything, filter by owner can be done on backend or server filter:
    // In our backend, we get listings. Filter client side or fetch a specific endpoint. 
    // In routes.js: GET /listings with status=all shows all. Let's filter client-side for donor listings:
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
            <button class="btn btn-secondary btn-sm" onclick="openListingDetail(${l.id})">View</button>
            <button class="btn btn-danger btn-sm" onclick="deleteListing(${l.id})"><i class="fa-solid fa-trash-can"></i></button>
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
            <p>Reserved by: <strong>${escapeHTML(r.receiver_name)}</strong></p>
            <p>Contact: ${escapeHTML(r.receiver_phone || r.receiver_email)}</p>
          </div>
          <div class="dashboard-item-actions">
            <button class="btn btn-primary btn-sm" onclick="openClaimVerification(${r.listing_id})">Claim</button>
          </div>
        </div>
      `).join('');
    }
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
    const reservations = await fetchWithAuth('/reservations/my');
    
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
          <button class="btn btn-danger btn-full margin-top" onclick="releaseReservation(${r.listing_id})">Cancel Reservation</button>
        `;
      } else {
        cardStyle = 'border-top: 4px solid var(--border); opacity: 0.8;';
        footerHtml = `
          <div style="text-align:center; padding: 20px 0; font-weight:700; color: ${isCompleted ? 'var(--success)' : 'var(--error)'}">
            <i class="fa-solid ${isCompleted ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> 
            Reservation ${r.status}
          </div>
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
  const bar = document.getElementById('notification-bar');
  const text = document.getElementById('notification-text');

  bar.className = 'notification-bar'; // reset classes
  if (type === 'success') bar.classList.add('success');
  if (type === 'error') bar.classList.add('error');
  if (type === 'warning') bar.classList.add('warning');

  text.textContent = message;
  bar.style.display = 'flex';

  // Automatically hide standard notifications after 6 seconds
  if (type !== 'error') {
    clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
      bar.style.display = 'none';
    }, 6000);
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

// Simple fallback router based on hash links
function routeByUrl() {
  const hash = window.location.hash;
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
    themeToggleBtn.addEventListener('click', () => {
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
      
      // 1 meal saved = ~300 gallons of water saved (average agricultural estimate)
      // 1 meal saved = ~2.5 lbs of greenhouse gases / CO2 avoided (EPA estimate)
      const waterSaved = meals * 300;
      const co2Saved = meals * 2.5;

      calcWater.textContent = waterSaved.toLocaleString();
      calcCo2.textContent = co2Saved.toFixed(0);
    };

    calcSlider.addEventListener('input', updateCalculator);
    // Initialize calculator results
    updateCalculator();
  }
}
