import { ZONE_CATALOG, type AccessMethodId, type SmartDetection, type GuestSessionInfo } from "./smartEntry";

export function getDemoVenue(slug: string, params: { table?: string; room?: string; section?: string; entry?: AccessMethodId; serviceMode?: string }) {
  const allZones = Object.entries(ZONE_CATALOG).flatMap(([category, meta]) =>
    meta.zones.map((name, i) => ({
      id: 1000 + i + Object.keys(ZONE_CATALOG).indexOf(category) * 20,
      name,
      areaType: category === "outdoor_dining" ? "outdoor" : category === "special_experience" ? "vip" : "indoor",
      zoneCategory: category,
    })),
  );

  const areaGroups = Object.entries(ZONE_CATALOG).map(([category, meta]) => ({
    category,
    label: meta.label,
    areas: allZones.filter(z => z.zoneCategory === category).map(z => ({ id: z.id, name: z.name, areaType: z.areaType })),
    zoneDefinitions: meta.zones.map(name => ({ name, areaType: category === "outdoor_dining" ? "outdoor" : "indoor" })),
  }));

  const table = params.table ? { id: 12, name: params.table, status: "free", zone: "Garden Seating", capacity: 4, isVip: false } : null;
  const room = params.room ? { number: params.room, type: "deluxe", floor: 5, guestName: "Guest" } : null;
  const sectionName = params.section || (table ? "Garden Seating" : room ? "In-Room Dining" : "AC Section");

  const detection: SmartDetection = {
    entryMethod: params.entry ?? (params.room ? "room_qr" : params.table ? "qr" : "direct_url"),
    serviceMode: params.serviceMode ?? (params.room ? "room_service" : params.table ? "dine_in" : "browse"),
    language: navigator.language?.slice(0, 5) || "en",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
    branchName: "The Grand Spice — Main Branch",
    autoDetection: {
      branch: true,
      table: !!params.table,
      room: !!params.room,
      section: true,
      language: true,
      timezone: true,
      serviceMode: true,
    },
  };

  const session: GuestSessionInfo = {
    token: `demo_${Date.now()}`,
    shareCode: "",
    sessionType: params.table ? "shared_table" : "personal",
    memberCount: 1,
    features: {
      autoReconnect: true,
      sessionRestore: true,
      multiDevice: false,
      familyShared: false,
      sharedTable: !!params.table,
    },
  };

  return {
    restaurant: { id: 1, name: slug === "spice-garden" ? "The Grand Spice" : slug.replace(/-/g, " "), slug },
    branch: { id: 1, name: "The Grand Spice — Main Branch" },
    areas: allZones,
    areaGroups,
    table,
    room,
    section: { id: 1, name: sectionName, areaType: "outdoor" },
    detection,
    session,
    accessMethods: ["qr", "nfc", "browser", "direct_url", "pwa", "room_qr", "poolside_qr", "spa_qr", "event_qr", "parking_qr"],
  };
}
