#!/usr/bin/env node
/** Quick registration API test */
const BASE = process.env.API_BASE || "http://localhost:8080/api";
const tiny = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function makePayload(email) {
  const docs = [
    "owner_id", "pan_card", "gst_certificate", "fssai_license", "business_registration", "bank_proof",
  ].map(type => ({ type, name: type, fileUrl: tiny }));
  return {
    staffRole: "owner",
    ownerName: "Test Owner",
    ownerEmail: email,
    ownerPassword: "Test@123456",
    ownerPhone: "9876543210",
    ownerIdType: "aadhaar",
    ownerIdNumber: "123456789012",
    restaurantName: `Test Venue ${Date.now()}`,
    businessType: "restaurant",
    address: "123 Test Street",
    city: "Mumbai",
    state: "MH",
    pincode: "400001",
    restaurantPhone: "9876543210",
    restaurantEmail: email,
    website: "",
    legalBusinessName: "Test Venue Pvt Ltd",
    gstNumber: "27AABCU9603R1ZM",
    fssaiNumber: "12345678901234",
    panNumber: "AABCU9603R",
    bankAccount: "1234567890",
    ifsc: "HDFC0001234",
    documents: docs,
  };
}

async function test(name, body) {
  const size = JSON.stringify(body).length;
  console.log(`\n--- ${name} (payload ${(size / 1024).toFixed(1)} KB) ---`);
  try {
    const res = await fetch(`${BASE}/restaurant-auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(text.slice(0, 500));
    return res.status;
  } catch (e) {
    console.log("Error:", e.message);
    return 0;
  }
}

const email = `owner.test.${Date.now()}@example.com`;
await test("minimal docs", makePayload(email));

// Simulate 6 × ~500KB base64 docs (~3MB total)
const big = "data:image/jpeg;base64," + "A".repeat(500_000);
const bigPayload = makePayload(`big.${Date.now()}@example.com`);
bigPayload.documents = bigPayload.documents.map(d => ({ ...d, fileUrl: big }));
await test("large docs (~3MB)", bigPayload);
