const { spawn } = require('child_process');
const path = require('path');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}/api`;

let serverProcess;

function startServer() {
  return new Promise((resolve, reject) => {
    console.log('Starting backend server for verification tests...');
    serverProcess = spawn('node', [path.join(__dirname, 'server.js')], {
      env: { ...process.env, PORT: PORT }
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[Server]: ${output.trim()}`);
      if (output.includes(`running on http://localhost:${PORT}`)) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[Server Error]: ${data}`);
    });

    serverProcess.on('error', (err) => {
      reject(err);
    });
  });
}

function stopServer() {
  if (serverProcess) {
    console.log('Stopping backend server...');
    serverProcess.kill();
  }
}

async function runTests() {
  const timestamp = Date.now();
  const testDonor = {
    username: `TestDonor_${timestamp}`,
    email: `donor_${timestamp}@test.com`,
    password: 'password123',
    role: 'donor',
    phone: '555-TEST-D'
  };

  const testReceiver = {
    username: `TestReceiver_${timestamp}`,
    email: `receiver_${timestamp}@test.com`,
    password: 'password123',
    role: 'receiver',
    phone: '555-TEST-R'
  };

  let donorToken = '';
  let receiverToken = '';
  let listingId = null;
  let reservationCode = '';

  try {
    // 1. Test Donor Registration
    console.log('\n--- 1. Testing Donor Registration ---');
    let res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testDonor)
    });
    let data = await res.json();
    if (res.status !== 201) throw new Error(`Registration failed: ${data.error}`);
    console.log('Donor registered successfully. User ID:', data.userId);

    // 2. Test Donor Login
    console.log('\n--- 2. Testing Donor Login ---');
    res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testDonor.email, password: testDonor.password })
    });
    data = await res.json();
    if (res.status !== 200) throw new Error(`Login failed: ${data.error}`);
    donorToken = data.token;
    console.log('Donor logged in successfully. Token acquired.');

    // 3. Test Receiver Registration & Login
    console.log('\n--- 3. Testing Receiver Registration & Login ---');
    res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testReceiver)
    });
    data = await res.json();
    if (res.status !== 201) throw new Error(`Receiver registration failed: ${data.error}`);

    res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testReceiver.email, password: testReceiver.password })
    });
    data = await res.json();
    receiverToken = data.token;
    console.log('Receiver logged in successfully. Token acquired.');

    // 4. Test Listing Creation (Donor Role Required)
    console.log('\n--- 4. Testing Listing Creation ---');
    const newListing = {
      title: 'Fresh Test Strawberries',
      description: 'Grown locally in the test field, sweet and delicious.',
      quantity: '4 baskets',
      pickup_location: '999 Sandbox Ave, Test City',
      pickup_start: new Date(Date.now() + 60000).toISOString(),
      pickup_end: new Date(Date.now() + 1800000).toISOString(),
      expiry_time: new Date(Date.now() + 3600000).toISOString(),
      dietary_tags: 'Vegan,Gluten-Free',
      image_url: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6'
    };

    res = await fetch(`${BASE_URL}/listings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${donorToken}`
      },
      body: JSON.stringify(newListing)
    });
    data = await res.json();
    if (res.status !== 201) throw new Error(`Listing creation failed: ${data.error}`);
    listingId = data.listingId;
    console.log('Listing created successfully. Listing ID:', listingId);

    // 5. Test Fetch and Search Filters
    console.log('\n--- 5. Testing Listings Search & Filters ---');
    res = await fetch(`${BASE_URL}/listings?search=Strawberries&tags=Vegan`);
    data = await res.json();
    if (res.status !== 200) throw new Error('Failed to search listings');
    const matched = data.find(item => item.id === listingId);
    if (!matched) throw new Error('Created listing not found in search results.');
    console.log(`Successfully verified search: Matched listing '${matched.title}'`);

    // 6. Test Reservation (Receiver Role)
    console.log('\n--- 6. Testing Food Reservation ---');
    res = await fetch(`${BASE_URL}/listings/${listingId}/reserve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${receiverToken}`
      }
    });
    data = await res.json();
    if (res.status !== 200) throw new Error(`Reservation failed: ${data.error}`);
    reservationCode = data.reservationCode;
    console.log(`Food reserved. Reservation Code: ${reservationCode}`);

    // Verify listing status is now 'reserved'
    res = await fetch(`${BASE_URL}/listings/${listingId}`);
    data = await res.json();
    if (data.status !== 'reserved') throw new Error(`Listing status should be "reserved", but is "${data.status}"`);
    console.log('Verified listing status has transitioned to "reserved".');

    // 7. Test Claim/Pickup Completion (Donor validates receiver code)
    console.log('\n--- 7. Testing Claim Code Verification ---');
    res = await fetch(`${BASE_URL}/listings/${listingId}/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${donorToken}`
      },
      body: JSON.stringify({ reservationCode })
    });
    data = await res.json();
    if (res.status !== 200) throw new Error(`Claim confirmation failed: ${data.error}`);
    console.log('Claim successfully confirmed!');

    // Verify listing status is now 'claimed'
    res = await fetch(`${BASE_URL}/listings/${listingId}`);
    data = await res.json();
    if (data.status !== 'claimed') throw new Error(`Listing status should be "claimed", but is "${data.status}"`);
    console.log('Verified listing status has transitioned to "claimed".');

    console.log('\n==================================================');
    console.log('🎉 Verification PASSED! All API endpoints working.');
    console.log('==================================================\n');

  } catch (err) {
    console.error('\n❌ Verification FAILED!');
    console.error(err);
    process.exitCode = 1;
  }
}

async function main() {
  try {
    await startServer();
    await runTests();
  } catch (err) {
    console.error('Failed to run verification routine:', err);
    process.exitCode = 1;
  } finally {
    stopServer();
  }
}

main();
