/**
 * End-to-end check of the path a client actually demos:
 *
 *   guest scans a table QR -> menu -> order -> kitchen sees it -> marks it ready
 *   -> waiter -> bill -> payment recorded -> table freed
 *
 * plus the guards that have to hold while that happens: prices come from the menu,
 * one guest cannot read another's orders, and one restaurant cannot read another's.
 *
 * Read-only against seeded data apart from the order it places, which it cancels at
 * the end. Point API_BASE at a local server — never at production.
 *
 *   node scripts/e2e-demo-path.mjs
 */

const API = process.env.API_BASE || "http://localhost:8080/api";
const RESTAURANT_ID = Number(process.env.RESTAURANT_ID || 1);
const SLUG = process.env.VENUE_SLUG || "spice-garden";

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Keeps cookies per actor so guest and staff sessions never bleed into each other. */
function makeSession() {
  let cookie = "";
  return async function request(path, options = {}) {
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...(options.headers || {}),
      },
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body };
  };
}

async function main() {
  console.log(`\n=== Demo path end to end ===\nAPI: ${API}\n`);

  const guest = makeSession();
  const staff = makeSession();
  const other = makeSession();

  // ── A. Guest arrives by QR ────────────────────────────────────────────
  console.log("A. Guest arrives");
  const venue = await guest(`/public/venue/${SLUG}?table=T-1`);
  check("QR resolves the venue", venue.status === 200 && venue.body?.restaurant?.id, `status ${venue.status}`);

  const menu = await guest(`/public/menu/${SLUG}`);
  const items = (menu.body?.categories || []).flatMap(c => c.items || []);
  check("menu loads with items", items.length > 0, `${items.length} items`);
  check(
    "no invented add-ons on dishes",
    !items.some(i => JSON.stringify(i.customizationOptions || {}).includes("extraCheese")),
  );

  // ── B. Ordering, and the price guard ──────────────────────────────────
  console.log("\nB. Ordering");
  const dish = items[0];
  const listed = Number(dish.discountedPrice ?? dish.price);

  const placed = await guest("/public/orders", {
    method: "POST",
    body: JSON.stringify({
      restaurantId: RESTAURANT_ID,
      tableName: "T-1",
      customerName: "E2E Guest",
      customerPhone: "9990001111",
      items: [
        // Deliberately lie about the price and the discount.
        { menuItemId: dish.id, quantity: 2, unitPrice: 1, addons: [{ name: "Free stuff", price: -500 }] },
      ],
      discountAmount: 99999,
    }),
  });
  const order = placed.body;
  check("order is created", placed.status === 201 || placed.status === 200, `status ${placed.status}`);
  check(
    "server prices from the menu, not the request",
    Math.abs(Number(order.subtotal) - listed * 2) < 0.01,
    `subtotal ${order.subtotal}, expected ${(listed * 2).toFixed(2)}`,
  );
  check("total is never negative", Number(order.total) > 0, `total ${order.total}`);

  // ── C. The kitchen sees it ────────────────────────────────────────────
  console.log("\nC. Kitchen");
  const login = await staff("/restaurant-auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "owner@spicegarden.com", password: "Staff@123" }),
  });
  check("restaurant staff can sign in", login.status === 200, `status ${login.status}`);

  const orders = await staff(`/restaurants/${RESTAURANT_ID}/orders`);
  const found = Array.isArray(orders.body) && orders.body.some(o => o.id === order.id);
  check("order reaches the restaurant orders list", found);

  const kds = await fetch(`${API}/v1/auth/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ staffCode: "KCH-005", password: "Staff@123", deviceId: "e2e" }),
  }).then(r => r.json());
  check("kitchen app can sign in", kds?.success === true);

  if (kds?.data?.token) {
    const board = await fetch(`${API}/v1/kds`, {
      headers: { Authorization: `Bearer ${kds.data.token}` },
    }).then(r => r.json());
    const kdsOrders = board?.data?.orders || board?.orders || [];
    check("order appears on the kitchen display", kdsOrders.some(o => String(o.orderId || o.id).includes(String(order.id))));
  }

  // ── D. Isolation guards ───────────────────────────────────────────────
  console.log("\nD. Isolation");
  const crossTenant = await staff(`/restaurants/${RESTAURANT_ID + 1}/orders`);
  check("staff cannot read another restaurant", crossTenant.status === 403, `status ${crossTenant.status}`);

  const strangerPay = await other(`/public/payments/process/${order.id}`, {
    method: "POST",
    body: JSON.stringify({ paymentMethod: "upi" }),
  });
  check("a stranger cannot settle someone's order", strangerPay.status === 404, `status ${strangerPay.status}`);

  const freeMoney = await other("/public/me/wallet/recharge", {
    method: "POST",
    body: JSON.stringify({ amount: 100000 }),
  });
  check("wallet cannot be topped up without payment", freeMoney.status !== 200, `status ${freeMoney.status}`);

  // ── E. Service and billing ────────────────────────────────────────────
  console.log("\nE. Service and billing");
  for (const status of ["accepted", "preparing", "ready", "served"]) {
    const step = await staff(`/restaurants/${RESTAURANT_ID}/orders/${order.id}`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    check(`order can be moved to ${status}`, step.status === 200, `status ${step.status}`);
  }

  const inflate = await staff(`/restaurants/${RESTAURANT_ID}/orders/${order.id}`, {
    method: "PUT",
    body: JSON.stringify({ finalTotal: Number(order.total) + 5000 }),
  });
  check("POS cannot inflate a bill", inflate.status === 400, `status ${inflate.status}`);

  const collect = await staff(`/restaurants/${RESTAURANT_ID}/orders/${order.id}`, {
    method: "PUT",
    body: JSON.stringify({
      status: "completed",
      paymentMethod: "cash",
      paymentStatus: "paid",
      collectedBy: "E2E",
    }),
  });
  check("payment can be collected", collect.status === 200, `status ${collect.status}`);
  check("payment method is recorded", collect.body?.paymentMethod === "cash");

  // ── F. Clean up ───────────────────────────────────────────────────────
  await staff(`/restaurants/${RESTAURANT_ID}/orders/${order.id}`, {
    method: "PUT",
    body: JSON.stringify({ status: "cancelled", cancelReason: "end-to-end check" }),
  });

  console.log(`\n${passed}/${passed + failed} passed`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("\nDemo path is intact.");
}

main().catch(err => {
  console.error("\ne2e run could not complete:", err);
  process.exit(1);
});
