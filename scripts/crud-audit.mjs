/**
 * Exercises every create / edit / delete the panels offer, the way the panels call them.
 *
 * Reading the code only proves a button exists. This proves the button does something:
 * for each entity it creates a row, checks the row comes back in the list, edits it,
 * checks the edit stuck, deletes it, and checks it is gone. Anything that silently
 * fails, 404s, or "succeeds" without persisting shows up here.
 *
 *   node scripts/crud-audit.mjs              local
 *   API_BASE=https://…/api node scripts/…    a deployed environment (read the warning)
 *
 * It writes and deletes real rows, so point it at a database you are willing to dirty.
 * Everything it creates is prefixed CRUDTEST so leftovers are easy to find.
 */

const API = process.env.API_BASE || "http://localhost:8080/api";
const RID = Number(process.env.RESTAURANT_ID || 1);
const TAG = "CRUDTEST";

const results = [];

function session() {
  let cookie = "";
  return async function call(method, path, body) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: res.status, body: parsed };
  };
}

/** Pull an id out of whatever shape the endpoint chose to return. */
function idOf(body) {
  if (!body || typeof body !== "object") return null;
  for (const key of ["id", "itemId", "taskId", "documentId"]) {
    if (body[key] != null) return body[key];
  }
  for (const value of Object.values(body)) {
    if (value && typeof value === "object" && value.id != null) return value.id;
  }
  return null;
}

/** Find our row in a list response, whatever the list is wrapped in. */
function findIn(listBody, id) {
  const rows = Array.isArray(listBody)
    ? listBody
    : Object.values(listBody ?? {}).find(v => Array.isArray(v)) ?? [];
  return rows.find(r => String(r?.id) === String(id)) ?? null;
}

/**
 * One entity's full lifecycle. `editField` is the field we change and then read back —
 * an edit that returns 200 but does not persist is a very common failure here.
 */
async function checkEntity(call, name, spec) {
  const row = { entity: name, create: "—", list: "—", update: "—", persisted: "—", delete: "—", note: "" };
  try {
    const created = await call("POST", spec.createPath, spec.createBody);
    if (created.status >= 400) {
      row.create = `FAIL ${created.status}`;
      row.note = typeof created.body === "object"
        ? (created.body.error ?? created.body.message ?? "").slice(0, 70)
        : String(created.body).slice(0, 70);
      results.push(row);
      return;
    }
    row.create = `ok ${created.status}`;

    const id = idOf(created.body);
    if (id == null) {
      row.note = "created but returned no id";
      results.push(row);
      return;
    }

    const listed = await call("GET", spec.listPath);
    const found = findIn(listed.body, id);
    row.list = found ? "ok" : "NOT IN LIST";

    if (spec.editField) {
      const newValue = `${TAG} edited`;
      const updated = await call("PUT", spec.itemPath(id), { ...spec.createBody, [spec.editField]: newValue });
      row.update = updated.status >= 400 ? `FAIL ${updated.status}` : `ok ${updated.status}`;

      if (updated.status < 400) {
        const after = findIn((await call("GET", spec.listPath)).body, id);
        // Some fields are normalised on write (a coupon code is uppercased), so compare
        // case-insensitively rather than reporting a false failure.
        const saved = after ? String(after[spec.editField]).toLowerCase() : "";
        row.persisted = saved === newValue.toLowerCase() ? "ok" : "NOT SAVED";
      }
    }

    const removed = await call("DELETE", spec.itemPath(id));
    if (removed.status >= 400) {
      row.delete = `FAIL ${removed.status}`;
    } else {
      const gone = findIn((await call("GET", spec.listPath)).body, id) === null;
      row.delete = gone ? "ok" : "STILL THERE";
    }
  } catch (err) {
    row.note = String(err).slice(0, 70);
  }
  results.push(row);
}

async function main() {
  console.log(`\n=== CRUD audit ===\nAPI: ${API}\n`);

  const staff = session();
  const login = await staff("POST", "/restaurant-auth/login", {
    email: "owner@spicegarden.com",
    password: "Staff@123",
  });
  if (login.status !== 200) {
    console.error("restaurant login failed:", login.status, login.body);
    process.exit(1);
  }

  const base = `/restaurants/${RID}`;

  const entities = {
    "Menu category": {
      createPath: `${base}/categories`, listPath: `${base}/categories`,
      itemPath: id => `${base}/categories/${id}`,
      createBody: { name: `${TAG} Category` }, editField: "name",
    },
    "Menu item": {
      createPath: `${base}/items`, listPath: `${base}/items`,
      itemPath: id => `${base}/items/${id}`,
      createBody: { name: `${TAG} Dish`, price: "199", categoryId: 1, dietaryTags: ["veg"], isAvailable: true },
      editField: "name",
    },
    "Table": {
      createPath: `${base}/tables`, listPath: `${base}/tables`,
      itemPath: id => `${base}/tables/${id}`,
      createBody: { name: `${TAG}-T1`, capacity: 4, section: "Main" }, editField: "name",
    },
    "Staff": {
      createPath: `${base}/staff`, listPath: `${base}/staff`,
      itemPath: id => `${base}/staff/${id}`,
      createBody: { name: `${TAG} Person`, email: `crudtest@example.com`, role: "waiter", phone: "9000000001", password: "Test@1234" },
      editField: "name",
    },
    "Inventory item": {
      createPath: `${base}/inventory`, listPath: `${base}/inventory`,
      itemPath: id => `${base}/inventory/${id}`,
      createBody: { name: `${TAG} Stock`, unit: "kg", currentStock: "10", minStock: "2", costPerUnit: "50" },
      editField: "name",
    },
    "Customer": {
      createPath: `${base}/customers`, listPath: `${base}/customers`,
      itemPath: id => `${base}/customers/${id}`,
      createBody: { name: `${TAG} Guest`, phone: "9000000002", email: "crudguest@example.com" },
      editField: "name",
    },
    "Reservation": {
      createPath: `${base}/reservations`, listPath: `${base}/reservations`,
      itemPath: id => `${base}/reservations/${id}`,
      createBody: { customerName: `${TAG} Booking`, customerPhone: "9000000003", date: "2026-12-01", time: "19:00", guestCount: 2 },
      editField: "customerName",
    },
    "Task": {
      createPath: `${base}/tasks`, listPath: `${base}/tasks`,
      itemPath: id => `${base}/tasks/${id}`,
      createBody: { title: `${TAG} Task`, description: "check", priority: "normal" },
      editField: "title",
    },
    "SOP document": {
      createPath: `${base}/sop`, listPath: `${base}/sop`,
      itemPath: id => `${base}/sop/${id}`,
      createBody: { title: `${TAG} SOP`, content: "steps", category: "kitchen" },
      editField: "title",
    },
    "Promo code": {
      createPath: `${base}/promo-codes`, listPath: `${base}/promo-codes`,
      itemPath: id => `${base}/promo-codes/${id}`,
      createBody: { code: `${TAG}10`, discountType: "percent", discountValue: "10", isActive: true },
      editField: "code",
    },
    "Supplier": {
      createPath: `${base}/suppliers`, listPath: `${base}/suppliers`,
      itemPath: id => `${base}/suppliers/${id}`,
      createBody: { name: `${TAG} Supplier`, phone: "9000000004" }, editField: "name",
    },
    "Purchase order": {
      createPath: `${base}/purchase-orders`, listPath: `${base}/purchase-orders`,
      itemPath: id => `${base}/purchase-orders/${id}`,
      createBody: { supplierName: `${TAG} Supplier`, items: [], total: "1000" },
    },
    "Recipe": {
      createPath: `${base}/recipes`, listPath: `${base}/recipes`,
      itemPath: id => `${base}/recipes/${id}`,
      createBody: { name: `${TAG} Recipe`, servings: 1, sellingPrice: "200" }, editField: "name",
    },
    "Hardware device": {
      createPath: `${base}/hardware`, listPath: `${base}/hardware`,
      itemPath: id => `${base}/hardware/${id}`,
      createBody: { name: `${TAG} Printer`, type: "printer", location: "Kitchen" }, editField: "name",
    },
    "Branch": {
      createPath: `${base}/branches`, listPath: `${base}/branches`,
      itemPath: id => `${base}/branches/${id}`,
      createBody: { name: `${TAG} Branch`, address: "Test" }, editField: "name",
    },
    "Housekeeping task": {
      createPath: `${base}/housekeeping`, listPath: `${base}/housekeeping`,
      itemPath: id => `${base}/housekeeping/${id}`,
      createBody: { title: `${TAG} Clean`, location: "Room 101", type: "cleaning" }, editField: "title",
    },
    "Spa service": {
      createPath: `${base}/spa/services`, listPath: `${base}/spa/services`,
      itemPath: id => `${base}/spa/services/${id}`,
      createBody: { name: `${TAG} Massage`, duration: 60, price: "1500" }, editField: "name",
    },
    "Banquet event": {
      createPath: `${base}/events`, listPath: `${base}/events`,
      itemPath: id => `${base}/events/${id}`,
      createBody: { name: `${TAG} Event`, date: "2026-12-05", guests: 50, total: "50000" }, editField: "name",
    },
    "Campaign": {
      createPath: `${base}/campaigns`, listPath: `${base}/campaigns`,
      itemPath: id => `${base}/campaigns/${id}`,
      createBody: { name: `${TAG} Campaign`, type: "sms", message: "hello" }, editField: "name",
    },
    "Signage slide": {
      createPath: `${base}/signage/slides`, listPath: `${base}/signage`,
      itemPath: id => `${base}/signage/slides/${id}`,
      createBody: { title: `${TAG} Screen`, mediaType: "video", url: "https://example.com/v.mp4" },
      editField: "title",
    },
    "Training video": {
      createPath: `${base}/training-videos`, listPath: `${base}/training-videos`,
      itemPath: id => `${base}/training-videos/${id}`,
      createBody: { title: `${TAG} Video`, url: "https://youtube.com/watch?v=abc", category: "kitchen" },
      editField: "title",
    },
    "Document": {
      createPath: `${base}/documents`, listPath: `${base}/documents`,
      itemPath: id => `${base}/documents/${id}`,
      createBody: { name: `${TAG} Doc`, type: "licence", url: "https://example.com/d.pdf" },
      editField: "name",
    },
  };

  for (const [name, spec] of Object.entries(entities)) {
    await checkEntity(staff, name, spec);
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad("ENTITY", 20) + pad("CREATE", 11) + pad("IN LIST", 12) + pad("EDIT", 10) + pad("SAVED", 11) + pad("DELETE", 12) + "NOTE");
  console.log("-".repeat(110));
  for (const r of results) {
    console.log(
      pad(r.entity, 20) + pad(r.create, 11) + pad(r.list, 12) +
      pad(r.update, 10) + pad(r.persisted, 11) + pad(r.delete, 12) + r.note,
    );
  }

  const broken = results.filter(r =>
    r.create.startsWith("FAIL") || r.list === "NOT IN LIST" ||
    r.update.startsWith("FAIL") || r.persisted === "NOT SAVED" ||
    r.delete.startsWith("FAIL") || r.delete === "STILL THERE" || r.note,
  );
  console.log(`\n${results.length - broken.length}/${results.length} entities fully working.`);
  if (broken.length) {
    console.log(`\n${broken.length} with problems:`);
    for (const r of broken) console.log(`  - ${r.entity}: ${[r.create, r.list, r.update, r.persisted, r.delete].join(" / ")} ${r.note}`);
  }
}

main().catch(err => {
  console.error("audit could not complete:", err);
  process.exit(1);
});
