import { pgTable, text, serial, timestamp, integer, numeric, index } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";
import { staffTable } from "./staff";

/**
 * One row per shift a staff member works.
 *
 * The staff screen showed an attendance tab that was a permanent placeholder, and the
 * `staff.shift` column held a single word like "morning" — so there was no record of who
 * actually turned up, when, or for how long. Payroll, commission and the day-end report
 * all need that, and none of them could have it.
 *
 * Clock-out, hours and the shift's takings are filled in when the shift ends, so an open
 * row is a staff member currently on the floor.
 */
export const staffAttendanceTable = pgTable("staff_attendance", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  staffId: integer("staff_id").notNull().references(() => staffTable.id, { onDelete: "cascade" }),

  /** Kept alongside the id so a report still reads correctly after someone leaves. */
  staffName: text("staff_name").notNull(),
  staffRole: text("staff_role").notNull(),

  clockedInAt: timestamp("clocked_in_at", { withTimezone: true }).notNull().defaultNow(),
  clockedOutAt: timestamp("clocked_out_at", { withTimezone: true }),

  /** Computed on clock-out rather than at read time, so a corrected row stays corrected. */
  minutesWorked: integer("minutes_worked"),

  /** Unpaid break time, subtracted from minutesWorked when payroll reads this. */
  breakMinutes: integer("break_minutes").notNull().default(0),

  /** What this person took during the shift — the basis for any commission. */
  salesDuringShift: numeric("sales_during_shift", { precision: 10, scale: 2 }).notNull().default("0"),

  /** Where they clocked in from, when a venue cares. */
  clockInMethod: text("clock_in_method").notNull().default("panel"),
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  // The two questions asked of this table: who is on the floor now, and what did one
  // person work over a period.
  index("staff_attendance_open_idx").on(table.restaurantId, table.clockedOutAt),
  index("staff_attendance_staff_idx").on(table.staffId, table.clockedInAt),
]);

export type StaffAttendance = typeof staffAttendanceTable.$inferSelect;
