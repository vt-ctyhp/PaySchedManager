import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Internal Companies
export const internalCompanies = pgTable("internal_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  abbreviation: text("abbreviation").notNull().unique(),
});

export const insertInternalCompanySchema = createInsertSchema(internalCompanies).omit({
  id: true,
});

export type InsertInternalCompany = z.infer<typeof insertInternalCompanySchema>;
export type InternalCompany = typeof internalCompanies.$inferSelect;

// Payment Accounts
export const paymentAccounts = pgTable("payment_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  accountType: text("account_type").notNull(),
  lastFourDigits: text("last_four_digits"),
});

export const insertPaymentAccountSchema = createInsertSchema(paymentAccounts).omit({
  id: true,
});

export type InsertPaymentAccount = z.infer<typeof insertPaymentAccountSchema>;
export type PaymentAccount = typeof paymentAccounts.$inferSelect;

// Payment Types
export const paymentTypes = pgTable("payment_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
});

export const insertPaymentTypeSchema = createInsertSchema(paymentTypes).omit({
  id: true,
});

export type InsertPaymentType = z.infer<typeof insertPaymentTypeSchema>;
export type PaymentType = typeof paymentTypes.$inferSelect;

// Expense Types
export const expenseTypes = pgTable("expense_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
});

export const insertExpenseTypeSchema = createInsertSchema(expenseTypes).omit({
  id: true,
});

export type InsertExpenseType = z.infer<typeof insertExpenseTypeSchema>;
export type ExpenseType = typeof expenseTypes.$inferSelect;

// Payment Schedules
export const paymentSchedules = pgTable("payment_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  expenseId: text("expense_id").notNull().unique(),
  internalCompanyId: varchar("internal_company_id").notNull(),
  vendorName: text("vendor_name").notNull(),
  vendorAbbreviation: text("vendor_abbreviation").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  frequency: text("frequency").notNull(),
  nextDueDate: timestamp("next_due_date").notNull(),
  paymentTypeId: varchar("payment_type_id").notNull(),
  paymentAccountId: varchar("payment_account_id").notNull(),
  expenseTypeId: varchar("expense_type_id").notNull(),
  status: text("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPaymentScheduleSchema = createInsertSchema(paymentSchedules)
  .omit({
    id: true,
    expenseId: true,
    createdAt: true,
  })
  .extend({
    nextDueDate: z.coerce.date(),
  });

export type InsertPaymentSchedule = z.infer<typeof insertPaymentScheduleSchema>;
export type PaymentSchedule = typeof paymentSchedules.$inferSelect;

// Payment Records
export const paymentRecords = pgTable("payment_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  paymentScheduleId: varchar("payment_schedule_id"),
  expenseId: text("expense_id").notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paidBy: varchar("paid_by").notNull(), // User ID who made the payment (auto-filled from session)
  approvedBy: varchar("approved_by"), // User ID who approved the payment
  paymentMethod: text("payment_method").notNull(),
  paymentAccountId: varchar("payment_account_id"), // Foreign key to payment accounts
  confirmationFile: text("confirmation_file"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPaymentRecordSchema = createInsertSchema(paymentRecords)
  .omit({
    id: true,
    paidBy: true, // Will be auto-filled from logged-in user
    createdAt: true,
  })
  .extend({
    paymentDate: z.coerce.date(),
  });

export type InsertPaymentRecord = z.infer<typeof insertPaymentRecordSchema>;
export type PaymentRecord = typeof paymentRecords.$inferSelect;

// Users
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("User"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
