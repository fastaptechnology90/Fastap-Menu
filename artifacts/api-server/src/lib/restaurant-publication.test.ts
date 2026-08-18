import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getPublicationStatus,
  isRestaurantPublished,
  canAccessGuestVenue,
  emptyDashboardStats,
  emptyAnalyticsSummary,
  emptyOrderStats,
  emptyBranchAnalytics,
} from "./restaurant-publication.js";
import type { RestaurantRow } from "./restaurant-publication.js";

function mockRestaurant(overrides: Partial<RestaurantRow> = {}): RestaurantRow {
  return {
    id: 1,
    userId: 1,
    name: "Test Restaurant",
    slug: "test",
    description: null,
    address: null,
    phone: null,
    email: null,
    website: null,
    logoUrl: null,
    customDomain: null,
    currency: "INR",
    businessType: "restaurant",
    timezone: "Asia/Kolkata",
    gstNumber: null,
    fssaiNumber: null,
    isActive: true,
    plan: "free",
    settings: { kyc: { status: "approved" } },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as RestaurantRow;
}

describe("restaurant publication", () => {
  it("treats active + approved KYC as Published", () => {
    const r = mockRestaurant();
    assert.equal(getPublicationStatus(r), "Published");
    assert.equal(isRestaurantPublished(r), true);
  });

  it("treats pending KYC as Pending", () => {
    const r = mockRestaurant({ isActive: false, settings: { kyc: { status: "pending" } } });
    assert.equal(getPublicationStatus(r), "Pending");
    assert.equal(isRestaurantPublished(r), false);
  });

  it("treats rejected KYC as Rejected", () => {
    const r = mockRestaurant({ settings: { kyc: { status: "rejected" } } });
    assert.equal(getPublicationStatus(r), "Rejected");
    assert.equal(isRestaurantPublished(r), false);
  });

  it("treats inactive approved restaurant as Disabled", () => {
    const r = mockRestaurant({ isActive: false, settings: { kyc: { status: "approved" } } });
    assert.equal(getPublicationStatus(r), "Disabled");
    assert.equal(isRestaurantPublished(r), false);
  });

  it("treats soft-deleted restaurant as Archived", () => {
    const r = mockRestaurant({
      settings: {
        kyc: { status: "approved" },
        platformControls: { deletedAt: new Date().toISOString() },
      },
    });
    assert.equal(getPublicationStatus(r), "Archived");
    assert.equal(isRestaurantPublished(r), false);
  });

  it("returns zero dashboard stats for unpublished restaurants", () => {
    const stats = emptyDashboardStats("Pending");
    assert.equal(stats.todayOrders, 0);
    assert.equal(stats.todayRevenue, 0);
    assert.equal(stats.totalCustomers, 0);
    assert.equal(stats.avgRating, 0);
    assert.equal(stats.recentOrders.length, 0);
    assert.equal(stats.isPublished, false);
  });

  it("returns zero analytics summary for unpublished restaurants", () => {
    const summary = emptyAnalyticsSummary("week", "Last 7 days");
    assert.equal(summary.totalOrders, 0);
    assert.equal(summary.totalRevenue, 0);
    assert.equal(summary.qrScans, 0);
    assert.equal(summary.feedbackAvgRating, 0);
    assert.equal(summary.growth, 0);
    assert.equal(summary.isPublished, false);
  });

  it("returns zero order stats for unpublished restaurants", () => {
    const stats = emptyOrderStats();
    assert.equal(stats.isPublished, false);
    assert.equal(stats.growth, 0);
    assert.equal(stats.paymentMix.length, 0);
    assert.equal(stats.customerSegments.length, 0);
    assert.equal(stats.hourlyOrders.length, 0);
    assert.equal(stats.byStatus.pending, 0);
    assert.equal(stats.byType.dine_in, 0);
  });

  it("returns zero branch analytics for unpublished restaurants", () => {
    const rows = emptyBranchAnalytics();
    assert.equal(rows.length, 4);
    for (const row of rows) {
      assert.match(row.value, /^₹0$|^0$|^—$/);
      assert.equal(row.trend, row.metric === "Active Branches" || row.metric === "Avg Rating" ? "—" : "0%");
    }
  });

  it("treats inactive non-approved restaurant as Draft", () => {
    const r = mockRestaurant({ isActive: false, settings: { kyc: { status: "draft" } } });
    assert.equal(getPublicationStatus(r), "Draft");
    assert.equal(isRestaurantPublished(r), false);
  });

  it("allows guest venue access for Draft and Pending restaurants", () => {
    const draft = mockRestaurant({ isActive: false, settings: { kyc: { status: "draft" } } });
    const pending = mockRestaurant({ isActive: false, settings: { kyc: { status: "pending" } } });
    assert.equal(canAccessGuestVenue(draft), true);
    assert.equal(canAccessGuestVenue(pending), true);
  });

  it("blocks guest venue access for disabled, rejected, and archived restaurants", () => {
    const disabled = mockRestaurant({ isActive: false, settings: { kyc: { status: "approved" } } });
    const rejected = mockRestaurant({ isActive: false, settings: { kyc: { status: "rejected" } } });
    const archived = mockRestaurant({
      isActive: false,
      settings: { kyc: { status: "approved" }, platformControls: { deletedAt: "2026-01-01T00:00:00.000Z" } },
    });
    assert.equal(canAccessGuestVenue(disabled), false);
    assert.equal(canAccessGuestVenue(rejected), false);
    assert.equal(canAccessGuestVenue(archived), false);
  });
});
