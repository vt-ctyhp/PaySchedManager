import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  eq,
  like,
  desc,
  asc,
} from "drizzle-orm";
import {
  users,
  internalCompanies,
  paymentAccounts,
  accountBanks,
  paymentTypes,
  expenseTypes,
  paymentSchedules,
  paymentRecords,
  accountMappings,
  paymentRecordAudits,
  insertUserSchema,
  insertInternalCompanySchema,
  insertPaymentAccountSchema,
  insertAccountBankSchema,
  insertPaymentTypeSchema,
  insertExpenseTypeSchema,
  insertPaymentScheduleSchema,
  insertPaymentRecordSchema,
  insertAccountMappingSchema,
  insertPaymentRecordAuditSchema,
  type User,
  type InsertUser,
  type InternalCompany,
  type InsertInternalCompany,
  type PaymentAccount,
  type AccountBank,
  type InsertAccountBank,
  type InsertPaymentAccount,
  type PaymentType,
  type InsertPaymentType,
  type ExpenseType,
  type InsertExpenseType,
  type PaymentSchedule,
  type InsertPaymentSchedule,
  type PaymentRecord,
  type InsertPaymentRecord,
  type AccountMapping,
  type InsertAccountMapping,
  type PaymentRecordAudit,
  type InsertPaymentRecordAudit,
  ACCOUNT_TYPE_OPTIONS,
  type AccountTypeCode,
} from "@shared/schema";
import * as schema from "@shared/schema";

type ScheduleFrequency = PaymentSchedule["frequency"];

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const ACCOUNT_TYPE_LOOKUP: Record<AccountTypeCode, string> = ACCOUNT_TYPE_OPTIONS.reduce(
  (acc, option) => ({ ...acc, [option.code]: option.label }),
  {} as Record<AccountTypeCode, string>
);

function getAccountTypeLabel(code: AccountTypeCode): string {
  return ACCOUNT_TYPE_LOOKUP[code] ?? code;
}

function generateAccountName(params: {
  companyAbbreviation: string;
  bankNickname: string;
  accountTypeCode: AccountTypeCode;
  lastFourDigits?: string | null;
}): string {
  const parts = [
    params.companyAbbreviation.trim(),
    params.bankNickname.trim(),
    params.accountTypeCode.trim(),
  ].filter(Boolean);

  if (params.lastFourDigits) {
    parts.push(params.lastFourDigits.trim());
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function addFrequencyInterval(date: Date, frequency: ScheduleFrequency): Date | null {
  const next = new Date(date.getTime());

  switch (frequency) {
    case "one-time":
      return null;
    case "bi-weekly":
      next.setDate(next.getDate() + 14);
      return next;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      return next;
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      return next;
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      return next;
    default:
      return null;
  }
}

function deriveScheduleUpdate(
  schedule: PaymentSchedule,
  paymentDate: Date,
): Pick<PaymentSchedule, "nextDueDate" | "status"> | { status: "completed" } | null {
  if (!schedule.frequency) {
    return null;
  }

  if (schedule.frequency === "one-time") {
    return { status: "completed" };
  }

  const currentDue = new Date(schedule.nextDueDate);
  if (Number.isNaN(currentDue.getTime())) {
    return null;
  }

  let nextDue = new Date(currentDue.getTime());
  let iterations = 0;
  while (nextDue <= paymentDate) {
    const candidate = addFrequencyInterval(nextDue, schedule.frequency);
    if (!candidate) {
      return { status: "completed" };
    }
    nextDue = candidate;
    iterations += 1;
    if (iterations > 24) {
      break;
    }
  }

  return {
    nextDueDate: nextDue,
    status: "scheduled",
  };
}

function computeDaysLate(dueDate: Date | null | undefined, paymentDate: Date): number {
  if (!dueDate) {
    return 0;
  }

  const diff = paymentDate.getTime() - dueDate.getTime();
  if (diff <= 0) {
    return 0;
  }

  return Math.ceil(diff / MS_PER_DAY);
}

export interface IStorage {
  initialize(): Promise<void>;

  // Users
  getAllUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // Internal Companies
  getAllInternalCompanies(): Promise<InternalCompany[]>;
  getInternalCompany(id: string): Promise<InternalCompany | undefined>;
  createInternalCompany(company: InsertInternalCompany): Promise<InternalCompany>;
  updateInternalCompany(id: string, company: Partial<InsertInternalCompany>): Promise<InternalCompany | undefined>;
  deleteInternalCompany(id: string): Promise<boolean>;

  // Payment Accounts
  getAllPaymentAccounts(): Promise<PaymentAccount[]>;
  getPaymentAccount(id: string): Promise<PaymentAccount | undefined>;
  getAllAccountBanks(): Promise<AccountBank[]>;
  getAccountBank(id: string): Promise<AccountBank | undefined>;
  createAccountBank(bank: InsertAccountBank): Promise<AccountBank>;
  createPaymentAccount(account: InsertPaymentAccount): Promise<PaymentAccount>;
  updatePaymentAccount(id: string, account: Partial<InsertPaymentAccount>): Promise<PaymentAccount | undefined>;
  deletePaymentAccount(id: string): Promise<boolean>;

  // Payment Types
  getAllPaymentTypes(): Promise<PaymentType[]>;
  getPaymentType(id: string): Promise<PaymentType | undefined>;
  createPaymentType(type: InsertPaymentType): Promise<PaymentType>;
  updatePaymentType(id: string, type: Partial<InsertPaymentType>): Promise<PaymentType | undefined>;
  deletePaymentType(id: string): Promise<boolean>;

  // Expense Types
  getAllExpenseTypes(): Promise<ExpenseType[]>;
  getExpenseType(id: string): Promise<ExpenseType | undefined>;
  createExpenseType(type: InsertExpenseType): Promise<ExpenseType>;
  updateExpenseType(id: string, type: Partial<InsertExpenseType>): Promise<ExpenseType | undefined>;
  deleteExpenseType(id: string): Promise<boolean>;

  // Payment Schedules
  getAllPaymentSchedules(): Promise<PaymentSchedule[]>;
  getPaymentSchedule(id: string): Promise<PaymentSchedule | undefined>;
  getPaymentScheduleByExpenseId(expenseId: string): Promise<PaymentSchedule | undefined>;
  createPaymentSchedule(schedule: InsertPaymentSchedule): Promise<PaymentSchedule>;
  updatePaymentSchedule(id: string, schedule: Partial<InsertPaymentSchedule>): Promise<PaymentSchedule | undefined>;
  deletePaymentSchedule(id: string): Promise<boolean>;
  getNextSequenceNumber(internalCompanyAbbr: string, vendorAbbr: string): Promise<number>;

  // Payment Records
  getAllPaymentRecords(): Promise<PaymentRecord[]>;
  getPaymentRecord(id: string): Promise<PaymentRecord | undefined>;
  getPaymentRecordsByScheduleId(scheduleId: string): Promise<PaymentRecord[]>;
  createPaymentRecord(
    record: InsertPaymentRecord & {
      paidBy: string;
      confirmationFile?: string | null;
      approvalScreenshot?: string | null;
    }
  ): Promise<PaymentRecord>;
  updatePaymentRecord(
    id: string,
    record: Partial<InsertPaymentRecord> & {
      confirmationFile?: string | null;
      approvalScreenshot?: string | null;
    },
    audit?: { reason: string; performedBy: string }
  ): Promise<PaymentRecord | undefined>;
  deletePaymentRecord(
    id: string,
    audit?: { reason: string; performedBy: string }
  ): Promise<boolean>;
  getAllPaymentRecordAudits(): Promise<PaymentRecordAudit[]>;
  getPaymentRecordAuditsByRecord(paymentRecordId: string): Promise<PaymentRecordAudit[]>;

  // Account Mappings
  getAllAccountMappings(): Promise<AccountMapping[]>;
  getAccountMapping(id: string): Promise<AccountMapping | undefined>;
  getAccountMappingByCsvName(csvAccountName: string): Promise<AccountMapping | undefined>;
  createAccountMapping(mapping: InsertAccountMapping): Promise<AccountMapping>;
  updateAccountMapping(id: string, mapping: Partial<InsertAccountMapping>): Promise<AccountMapping | undefined>;
  deleteAccountMapping(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private internalCompanies: Map<string, InternalCompany>;
  private paymentAccounts: Map<string, PaymentAccount>;
  private accountBanks: Map<string, AccountBank>;
  private paymentTypes: Map<string, PaymentType>;
  private expenseTypes: Map<string, ExpenseType>;
  private paymentSchedules: Map<string, PaymentSchedule>;
  private paymentRecords: Map<string, PaymentRecord>;
  private accountMappings: Map<string, AccountMapping>;
  private paymentRecordAudits: PaymentRecordAudit[];

  constructor() {
    this.users = new Map();
    this.internalCompanies = new Map();
    this.paymentAccounts = new Map();
    this.accountBanks = new Map();
    this.paymentTypes = new Map();
    this.expenseTypes = new Map();
    this.paymentSchedules = new Map();
    this.paymentRecords = new Map();
    this.accountMappings = new Map();
    this.paymentRecordAudits = [];
  }

  async initialize() {
    await this.initializeDefaults();
  }

  private async initializeDefaults() {
    const bcrypt = await import("bcryptjs");
    const SALT_ROUNDS = 10;

    if (!Array.from(this.users.values()).some((user) => user.username === "admin")) {
      const adminId = randomUUID();
      const hashedPassword = await bcrypt.hash("admin123", SALT_ROUNDS);
      this.users.set(adminId, {
        id: adminId,
        username: "admin",
        password: hashedPassword,
        role: "Admin",
        createdAt: new Date(),
      });
    }

    if (this.internalCompanies.size === 0) {
      const companies = [
        { name: "Trans Fine Jewelry", abbreviation: "TFJ" },
        { name: "Alexander DM", abbreviation: "ADM" },
        { name: "Hung Phat LLC", abbreviation: "HP LLC" },
      ];
      companies.forEach((c) => {
        const id = randomUUID();
        this.internalCompanies.set(id, { id, ...c });
      });
    }

    if (this.paymentTypes.size === 0) {
      const paymentTypesData = ["ACH", "Wire", "Credit Card", "Debit Card"];
      paymentTypesData.forEach((name) => {
        const id = randomUUID();
        this.paymentTypes.set(id, { id, name });
      });
    }

    if (this.accountBanks.size === 0) {
      const banks = [
        { name: "Bank of America", nickname: "BoA" },
        { name: "Chase Bank", nickname: "Chase" },
        { name: "Wells Fargo", nickname: "Wells" },
      ];
      banks.forEach((bank) => {
        const id = randomUUID();
        this.accountBanks.set(id, {
          id,
          name: bank.name,
          nickname: bank.nickname,
          createdAt: new Date(),
        });
      });
    }

    if (this.expenseTypes.size === 0) {
      const expenseTypesData = ["Insurance", "Rent", "Professional Services", "Shipping", "Subscriptions"];
      expenseTypesData.forEach((name) => {
        const id = randomUUID();
        this.expenseTypes.set(id, { id, name });
      });
    }
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((user) => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      role: insertUser.role || "User",
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const existing = this.users.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...user };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async getAllInternalCompanies(): Promise<InternalCompany[]> {
    return Array.from(this.internalCompanies.values());
  }

  async getInternalCompany(id: string): Promise<InternalCompany | undefined> {
    return this.internalCompanies.get(id);
  }

  async createInternalCompany(company: InsertInternalCompany): Promise<InternalCompany> {
    const id = randomUUID();
    const newCompany: InternalCompany = { id, ...company };
    this.internalCompanies.set(id, newCompany);
    return newCompany;
  }

  async updateInternalCompany(id: string, company: Partial<InsertInternalCompany>): Promise<InternalCompany | undefined> {
    const existing = this.internalCompanies.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...company };
    this.internalCompanies.set(id, updated);
    return updated;
  }

  async deleteInternalCompany(id: string): Promise<boolean> {
    return this.internalCompanies.delete(id);
  }

  async getAllPaymentAccounts(): Promise<PaymentAccount[]> {
    return Array.from(this.paymentAccounts.values());
  }

  async getAllAccountBanks(): Promise<AccountBank[]> {
    return Array.from(this.accountBanks.values());
  }

  async getAccountBank(id: string): Promise<AccountBank | undefined> {
    return this.accountBanks.get(id);
  }

  async createAccountBank(bank: InsertAccountBank): Promise<AccountBank> {
    const id = randomUUID();
    const record: AccountBank = {
      id,
      ...bank,
      createdAt: new Date(),
    };
    this.accountBanks.set(id, record);
    return record;
  }

  async getPaymentAccount(id: string): Promise<PaymentAccount | undefined> {
    return this.paymentAccounts.get(id);
  }

  async createPaymentAccount(account: InsertPaymentAccount): Promise<PaymentAccount> {
    const company = this.internalCompanies.get(account.internalCompanyId);
    if (!company) {
      throw new Error("Internal company not found");
    }

    const bank = this.accountBanks.get(account.bankId);
    if (!bank) {
      throw new Error("Bank not found");
    }

    const accountTypeLabel = getAccountTypeLabel(account.accountTypeCode as AccountTypeCode);
    const lastFour = account.lastFourDigits?.trim() || null;
    const name = generateAccountName({
      companyAbbreviation: company.abbreviation,
      bankNickname: bank.nickname,
      accountTypeCode: account.accountTypeCode as AccountTypeCode,
      lastFourDigits: lastFour ?? undefined,
    });

    const id = randomUUID();
    const newAccount: PaymentAccount = {
      id,
      name,
      accountType: accountTypeLabel,
      accountTypeCode: account.accountTypeCode,
      internalCompanyId: account.internalCompanyId,
      bankId: account.bankId,
      lastFourDigits: lastFour,
    };
    this.paymentAccounts.set(id, newAccount);
    return newAccount;
  }

  async updatePaymentAccount(id: string, account: Partial<InsertPaymentAccount>): Promise<PaymentAccount | undefined> {
    const existing = this.paymentAccounts.get(id);
    if (!existing) return undefined;

    const merged: PaymentAccount = {
      ...existing,
      ...account,
      lastFourDigits: account.lastFourDigits !== undefined ? account.lastFourDigits?.trim() || null : existing.lastFourDigits,
    } as PaymentAccount;

    const company = this.internalCompanies.get(merged.internalCompanyId);
    if (!company) {
      throw new Error("Internal company not found");
    }

    const bank = this.accountBanks.get(merged.bankId);
    if (!bank) {
      throw new Error("Bank not found");
    }

    const typeCode = merged.accountTypeCode as AccountTypeCode;
    merged.accountType = getAccountTypeLabel(typeCode);
    merged.name = generateAccountName({
      companyAbbreviation: company.abbreviation,
      bankNickname: bank.nickname,
      accountTypeCode: typeCode,
      lastFourDigits: merged.lastFourDigits ?? undefined,
    });

    this.paymentAccounts.set(id, merged);
    return merged;
  }

  async deletePaymentAccount(id: string): Promise<boolean> {
    return this.paymentAccounts.delete(id);
  }

  async getAllPaymentTypes(): Promise<PaymentType[]> {
    return Array.from(this.paymentTypes.values());
  }

  async getPaymentType(id: string): Promise<PaymentType | undefined> {
    return this.paymentTypes.get(id);
  }

  async createPaymentType(type: InsertPaymentType): Promise<PaymentType> {
    const id = randomUUID();
    const newType: PaymentType = { id, ...type };
    this.paymentTypes.set(id, newType);
    return newType;
  }

  async updatePaymentType(id: string, type: Partial<InsertPaymentType>): Promise<PaymentType | undefined> {
    const existing = this.paymentTypes.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...type };
    this.paymentTypes.set(id, updated);
    return updated;
  }

  async deletePaymentType(id: string): Promise<boolean> {
    return this.paymentTypes.delete(id);
  }

  async getAllExpenseTypes(): Promise<ExpenseType[]> {
    return Array.from(this.expenseTypes.values());
  }

  async getExpenseType(id: string): Promise<ExpenseType | undefined> {
    return this.expenseTypes.get(id);
  }

  async createExpenseType(type: InsertExpenseType): Promise<ExpenseType> {
    const id = randomUUID();
    const newType: ExpenseType = { id, ...type };
    this.expenseTypes.set(id, newType);
    return newType;
  }

  async updateExpenseType(id: string, type: Partial<InsertExpenseType>): Promise<ExpenseType | undefined> {
    const existing = this.expenseTypes.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...type };
    this.expenseTypes.set(id, updated);
    return updated;
  }

  async deleteExpenseType(id: string): Promise<boolean> {
    return this.expenseTypes.delete(id);
  }

  async getAllPaymentSchedules(): Promise<PaymentSchedule[]> {
    return Array.from(this.paymentSchedules.values());
  }

  async getPaymentSchedule(id: string): Promise<PaymentSchedule | undefined> {
    return this.paymentSchedules.get(id);
  }

  async getPaymentScheduleByExpenseId(expenseId: string): Promise<PaymentSchedule | undefined> {
    return Array.from(this.paymentSchedules.values()).find(
      (schedule) => schedule.expenseId === expenseId
    );
  }

  async getNextSequenceNumber(internalCompanyAbbr: string, vendorAbbr: string): Promise<number> {
    const prefix = `${internalCompanyAbbr}-${vendorAbbr}`;
    const existing = Array.from(this.paymentSchedules.values()).filter(
      (schedule) => schedule.expenseId.startsWith(prefix)
    );
    return existing.length + 1;
  }

  async createPaymentSchedule(schedule: InsertPaymentSchedule): Promise<PaymentSchedule> {
    const id = randomUUID();

    const internalCompany = await this.getInternalCompany(schedule.internalCompanyId);
    if (!internalCompany) {
      throw new Error("Internal company not found");
    }

    const sequenceNumber = await this.getNextSequenceNumber(
      internalCompany.abbreviation,
      schedule.vendorAbbreviation
    );
    const expenseId = `${internalCompany.abbreviation}-${schedule.vendorAbbreviation}-${String(sequenceNumber).padStart(3, "0")}`;

    const newSchedule: PaymentSchedule = {
      id,
      expenseId,
      createdAt: new Date(),
      status: schedule.status ?? "scheduled",
      ...schedule,
      isActive: schedule.isActive ?? true,
    };
    this.paymentSchedules.set(id, newSchedule);
    return newSchedule;
  }

  async updatePaymentSchedule(id: string, schedule: Partial<InsertPaymentSchedule>): Promise<PaymentSchedule | undefined> {
    const existing = this.paymentSchedules.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...schedule };
    this.paymentSchedules.set(id, updated);
    return updated;
  }

  async deletePaymentSchedule(id: string): Promise<boolean> {
    return this.paymentSchedules.delete(id);
  }

  async getAllPaymentRecords(): Promise<PaymentRecord[]> {
    return Array.from(this.paymentRecords.values());
  }

  async getPaymentRecord(id: string): Promise<PaymentRecord | undefined> {
    return this.paymentRecords.get(id);
  }

  async getPaymentRecordsByScheduleId(scheduleId: string): Promise<PaymentRecord[]> {
    return Array.from(this.paymentRecords.values()).filter(
      (record) => record.paymentScheduleId === scheduleId
    );
  }

  async createPaymentRecord(record: InsertPaymentRecord & { paidBy: string }): Promise<PaymentRecord> {
    const id = randomUUID();
    const schedule = record.paymentScheduleId ? this.paymentSchedules.get(record.paymentScheduleId) : undefined;
    const resolvedInternalCompanyId = record.internalCompanyId ?? schedule?.internalCompanyId;

    if (!resolvedInternalCompanyId) {
      throw new Error("Internal company is required for payment records");
    }

    const rawDueDate = schedule ? new Date(schedule.nextDueDate) : null;
    const paymentDateInstance = new Date(record.paymentDate);
    const daysLate = computeDaysLate(rawDueDate, paymentDateInstance);

    const newRecord: PaymentRecord = {
      id,
      createdAt: new Date(),
      ...record,
      paymentScheduleId: record.paymentScheduleId ?? null,
      internalCompanyId: resolvedInternalCompanyId,
      approvedBy: record.approvedBy ?? null,
      paymentAccountId: record.paymentAccountId ?? null,
      confirmationFile: record.confirmationFile ?? null,
      approvalScreenshot: record.approvalScreenshot ?? null,
      scheduledDueDate: rawDueDate,
      daysLate,
    };
    this.paymentRecords.set(id, newRecord);

    if (schedule) {
      const update = deriveScheduleUpdate(schedule, paymentDateInstance);
      if (update) {
        const updatedSchedule: PaymentSchedule = {
          ...schedule,
          ...update,
        };
        this.paymentSchedules.set(schedule.id, updatedSchedule);
      }
    }

    return newRecord;
  }

  async updatePaymentRecord(
    id: string,
    record: Partial<InsertPaymentRecord>,
    audit?: { reason: string; performedBy: string },
  ): Promise<PaymentRecord | undefined> {
    const existing = this.paymentRecords.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...record };
    this.paymentRecords.set(id, updated);
    if (audit) {
      this.paymentRecordAudits.push({
        id: randomUUID(),
        paymentRecordId: id,
        action: "edit",
        reason: audit.reason,
        beforeSnapshot: JSON.parse(JSON.stringify(existing)),
        afterSnapshot: JSON.parse(JSON.stringify(updated)),
        performedBy: audit.performedBy,
        createdAt: new Date(),
      });
    }
    return updated;
  }

  async deletePaymentRecord(
    id: string,
    audit?: { reason: string; performedBy: string },
  ): Promise<boolean> {
    const existing = this.paymentRecords.get(id);
    if (!existing) return false;
    const deleted = this.paymentRecords.delete(id);
    if (deleted && audit) {
      this.paymentRecordAudits.push({
        id: randomUUID(),
        paymentRecordId: id,
        action: "delete",
        reason: audit.reason,
        beforeSnapshot: JSON.parse(JSON.stringify(existing)),
        afterSnapshot: null,
        performedBy: audit.performedBy,
        createdAt: new Date(),
      });
    }
    return deleted;
  }

  async getAllPaymentRecordAudits(): Promise<PaymentRecordAudit[]> {
    return [...this.paymentRecordAudits].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async getPaymentRecordAuditsByRecord(paymentRecordId: string): Promise<PaymentRecordAudit[]> {
    return this.paymentRecordAudits
      .filter((log) => log.paymentRecordId === paymentRecordId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAllAccountMappings(): Promise<AccountMapping[]> {
    return Array.from(this.accountMappings.values());
  }

  async getAccountMapping(id: string): Promise<AccountMapping | undefined> {
    return this.accountMappings.get(id);
  }

  async getAccountMappingByCsvName(csvAccountName: string): Promise<AccountMapping | undefined> {
    return Array.from(this.accountMappings.values()).find(
      (mapping) => mapping.csvAccountName.toLowerCase() === csvAccountName.toLowerCase()
    );
  }

  async createAccountMapping(mapping: InsertAccountMapping): Promise<AccountMapping> {
    const existing = await this.getAccountMappingByCsvName(mapping.csvAccountName);
    if (existing) {
      throw new Error("Mapping for this CSV account already exists");
    }
    const id = randomUUID();
    const newMapping: AccountMapping = {
      id,
      createdAt: new Date(),
      ...mapping,
    };
    this.accountMappings.set(id, newMapping);
    return newMapping;
  }

  async updateAccountMapping(id: string, mapping: Partial<InsertAccountMapping>): Promise<AccountMapping | undefined> {
    const existing = this.accountMappings.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...mapping };
    this.accountMappings.set(id, updated);
    return updated;
  }

  async deleteAccountMapping(id: string): Promise<boolean> {
    return this.accountMappings.delete(id);
  }
}

export class PgStorage implements IStorage {
  private pool: Pool;
  private db;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
      // In serverless (Vercel) many instances share the DB pooler, so keep each
      // instance's pool small via PG_POOL_MAX. Unset locally -> pg default (10).
      max: process.env.PG_POOL_MAX ? parseInt(process.env.PG_POOL_MAX, 10) : undefined,
    });
    this.db = drizzle(this.pool, { schema });
  }

  async initialize() {
    await this.pool.query("select 1");
    await this.ensureInitialAdmin();
  }

  private async ensureInitialAdmin() {
    const username = process.env.INITIAL_ADMIN_USERNAME;
    const password = process.env.INITIAL_ADMIN_PASSWORD;

    if (!username || !password) {
      return;
    }

    const existing = await this.getUserByUsername(username);
    if (existing) {
      return;
    }

    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.hash(password, 10);

    await this.createUser({
      username,
      password: hashedPassword,
      role: "Admin",
    });
  }

  async getAllUsers(): Promise<User[]> {
    return await this.db.select().from(users);
  }

  async getUser(id: string): Promise<User | undefined> {
    return await this.db.query.users.findFirst({ where: eq(users.id, id) }) || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return await this.db.query.users.findFirst({ where: eq(users.username, username) }) || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await this.db
      .insert(users)
      .values({ ...insertUser, role: insertUser.role || "User" })
      .returning();
    return user;
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    if (Object.keys(user).length === 0) {
      return await this.getUser(id);
    }
    const [updated] = await this.db
      .update(users)
      .set(user)
      .where(eq(users.id, id))
      .returning();
    return updated ?? undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return deleted.length > 0;
  }

  async getAllInternalCompanies(): Promise<InternalCompany[]> {
    return await this.db.select().from(internalCompanies);
  }

  async getInternalCompany(id: string): Promise<InternalCompany | undefined> {
    return await this.db.query.internalCompanies.findFirst({ where: eq(internalCompanies.id, id) }) || undefined;
  }

  async createInternalCompany(company: InsertInternalCompany): Promise<InternalCompany> {
    const [created] = await this.db.insert(internalCompanies).values(company).returning();
    return created;
  }

  async updateInternalCompany(id: string, company: Partial<InsertInternalCompany>): Promise<InternalCompany | undefined> {
    const [updated] = await this.db
      .update(internalCompanies)
      .set(company)
      .where(eq(internalCompanies.id, id))
      .returning();
    return updated ?? undefined;
  }

  async deleteInternalCompany(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(internalCompanies)
      .where(eq(internalCompanies.id, id))
      .returning({ id: internalCompanies.id });
    return deleted.length > 0;
  }

  async getAllPaymentAccounts(): Promise<PaymentAccount[]> {
    return await this.db.select().from(paymentAccounts);
  }

  async getAllAccountBanks(): Promise<AccountBank[]> {
    return await this.db.select().from(accountBanks).orderBy(asc(accountBanks.name));
  }

  async getAccountBank(id: string): Promise<AccountBank | undefined> {
    return (
      (await this.db.query.accountBanks.findFirst({ where: eq(accountBanks.id, id) })) || undefined
    );
  }

  async createAccountBank(bank: InsertAccountBank): Promise<AccountBank> {
    const [created] = await this.db.insert(accountBanks).values(bank).returning();
    return created;
  }

  async getPaymentAccount(id: string): Promise<PaymentAccount | undefined> {
    return await this.db.query.paymentAccounts.findFirst({ where: eq(paymentAccounts.id, id) }) || undefined;
  }

  async createPaymentAccount(account: InsertPaymentAccount): Promise<PaymentAccount> {
    const company = await this.getInternalCompany(account.internalCompanyId);
    if (!company) {
      throw new Error("Internal company not found");
    }
    const bank = await this.getAccountBank(account.bankId);
    if (!bank) {
      throw new Error("Bank not found");
    }

    const accountTypeLabel = getAccountTypeLabel(account.accountTypeCode as AccountTypeCode);
    const lastFour = account.lastFourDigits?.trim() || null;
    const name = generateAccountName({
      companyAbbreviation: company.abbreviation,
      bankNickname: bank.nickname,
      accountTypeCode: account.accountTypeCode as AccountTypeCode,
      lastFourDigits: lastFour ?? undefined,
    });

    const [created] = await this.db
      .insert(paymentAccounts)
      .values({
        name,
        accountType: accountTypeLabel,
        accountTypeCode: account.accountTypeCode,
        internalCompanyId: account.internalCompanyId,
        bankId: account.bankId,
        lastFourDigits: lastFour,
      })
      .returning();
    return created;
  }

  async updatePaymentAccount(id: string, account: Partial<InsertPaymentAccount>): Promise<PaymentAccount | undefined> {
    const existing = await this.getPaymentAccount(id);
    if (!existing) {
      return undefined;
    }

    const merged: InsertPaymentAccount = {
      accountTypeCode: (account.accountTypeCode ?? existing.accountTypeCode) as AccountTypeCode,
      internalCompanyId: account.internalCompanyId ?? existing.internalCompanyId,
      bankId: account.bankId ?? existing.bankId,
      lastFourDigits:
        account.lastFourDigits !== undefined
          ? account.lastFourDigits?.trim() || null
          : existing.lastFourDigits,
    } as InsertPaymentAccount;

    const company = await this.getInternalCompany(merged.internalCompanyId);
    if (!company) {
      throw new Error("Internal company not found");
    }

    const bank = await this.getAccountBank(merged.bankId);
    if (!bank) {
      throw new Error("Bank not found");
    }

    const accountTypeLabel = getAccountTypeLabel(merged.accountTypeCode as AccountTypeCode);
    const name = generateAccountName({
      companyAbbreviation: company.abbreviation,
      bankNickname: bank.nickname,
      accountTypeCode: merged.accountTypeCode as AccountTypeCode,
      lastFourDigits: merged.lastFourDigits ?? undefined,
    });

    const [updated] = await this.db
      .update(paymentAccounts)
      .set({
        name,
        accountType: accountTypeLabel,
        accountTypeCode: merged.accountTypeCode,
        internalCompanyId: merged.internalCompanyId,
        bankId: merged.bankId,
        lastFourDigits: merged.lastFourDigits ?? null,
      })
      .where(eq(paymentAccounts.id, id))
      .returning();
    return updated ?? undefined;
  }

  async deletePaymentAccount(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(paymentAccounts)
      .where(eq(paymentAccounts.id, id))
      .returning({ id: paymentAccounts.id });
    return deleted.length > 0;
  }

  async getAllPaymentTypes(): Promise<PaymentType[]> {
    return await this.db.select().from(paymentTypes);
  }

  async getPaymentType(id: string): Promise<PaymentType | undefined> {
    return await this.db.query.paymentTypes.findFirst({ where: eq(paymentTypes.id, id) }) || undefined;
  }

  async createPaymentType(type: InsertPaymentType): Promise<PaymentType> {
    const [created] = await this.db.insert(paymentTypes).values(type).returning();
    return created;
  }

  async updatePaymentType(id: string, type: Partial<InsertPaymentType>): Promise<PaymentType | undefined> {
    const [updated] = await this.db
      .update(paymentTypes)
      .set(type)
      .where(eq(paymentTypes.id, id))
      .returning();
    return updated ?? undefined;
  }

  async deletePaymentType(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(paymentTypes)
      .where(eq(paymentTypes.id, id))
      .returning({ id: paymentTypes.id });
    return deleted.length > 0;
  }

  async getAllExpenseTypes(): Promise<ExpenseType[]> {
    return await this.db.select().from(expenseTypes);
  }

  async getExpenseType(id: string): Promise<ExpenseType | undefined> {
    return await this.db.query.expenseTypes.findFirst({ where: eq(expenseTypes.id, id) }) || undefined;
  }

  async createExpenseType(type: InsertExpenseType): Promise<ExpenseType> {
    const [created] = await this.db.insert(expenseTypes).values(type).returning();
    return created;
  }

  async updateExpenseType(id: string, type: Partial<InsertExpenseType>): Promise<ExpenseType | undefined> {
    const [updated] = await this.db
      .update(expenseTypes)
      .set(type)
      .where(eq(expenseTypes.id, id))
      .returning();
    return updated ?? undefined;
  }

  async deleteExpenseType(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(expenseTypes)
      .where(eq(expenseTypes.id, id))
      .returning({ id: expenseTypes.id });
    return deleted.length > 0;
  }

  async getAllPaymentSchedules(): Promise<PaymentSchedule[]> {
    return await this.db.select().from(paymentSchedules);
  }

  async getPaymentSchedule(id: string): Promise<PaymentSchedule | undefined> {
    return await this.db.query.paymentSchedules.findFirst({ where: eq(paymentSchedules.id, id) }) || undefined;
  }

  async getPaymentScheduleByExpenseId(expenseId: string): Promise<PaymentSchedule | undefined> {
    return await this.db.query.paymentSchedules.findFirst({ where: eq(paymentSchedules.expenseId, expenseId) }) || undefined;
  }

  async getNextSequenceNumber(internalCompanyAbbr: string, vendorAbbr: string): Promise<number> {
    const prefix = `${internalCompanyAbbr}-${vendorAbbr}`;
    const rows = await this.db
      .select({ expenseId: paymentSchedules.expenseId })
      .from(paymentSchedules)
      .where(like(paymentSchedules.expenseId, `${prefix}-%`));
    const suffixes = rows
      .map((row) => parseInt(row.expenseId.split("-").pop() || "0", 10))
      .filter((num) => !Number.isNaN(num));
    const currentMax = suffixes.length > 0 ? Math.max(...suffixes) : 0;
    return currentMax + 1;
  }

  async createPaymentSchedule(schedule: InsertPaymentSchedule): Promise<PaymentSchedule> {
    const internalCompany = await this.getInternalCompany(schedule.internalCompanyId);
    if (!internalCompany) {
      throw new Error("Internal company not found");
    }

    const sequenceNumber = await this.getNextSequenceNumber(
      internalCompany.abbreviation,
      schedule.vendorAbbreviation
    );
    const expenseId = `${internalCompany.abbreviation}-${schedule.vendorAbbreviation}-${String(sequenceNumber).padStart(3, "0")}`;

    const [created] = await this.db
      .insert(paymentSchedules)
      .values({
        ...schedule,
        expenseId,
        status: schedule.status ?? "scheduled",
      })
      .returning();

    return created;
  }

  async updatePaymentSchedule(id: string, schedule: Partial<InsertPaymentSchedule>): Promise<PaymentSchedule | undefined> {
    const [updated] = await this.db
      .update(paymentSchedules)
      .set(schedule)
      .where(eq(paymentSchedules.id, id))
      .returning();
    return updated ?? undefined;
  }

  async deletePaymentSchedule(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(paymentSchedules)
      .where(eq(paymentSchedules.id, id))
      .returning({ id: paymentSchedules.id });
    return deleted.length > 0;
  }

  async getAllPaymentRecords(): Promise<PaymentRecord[]> {
    return await this.db.select().from(paymentRecords);
  }

  async getPaymentRecord(id: string): Promise<PaymentRecord | undefined> {
    return await this.db.query.paymentRecords.findFirst({ where: eq(paymentRecords.id, id) }) || undefined;
  }

  async getPaymentRecordsByScheduleId(scheduleId: string): Promise<PaymentRecord[]> {
    return await this.db
      .select()
      .from(paymentRecords)
      .where(eq(paymentRecords.paymentScheduleId, scheduleId));
  }

  async createPaymentRecord(record: InsertPaymentRecord & { paidBy: string }): Promise<PaymentRecord> {
    const schedule = record.paymentScheduleId ? await this.getPaymentSchedule(record.paymentScheduleId) : undefined;
    const resolvedInternalCompanyId = record.internalCompanyId ?? schedule?.internalCompanyId;

    if (!resolvedInternalCompanyId) {
      throw new Error("Internal company is required for payment records");
    }

    const rawDueDate = schedule ? new Date(schedule.nextDueDate) : null;
    const paymentDateInstance = new Date(record.paymentDate);
    const daysLate = computeDaysLate(rawDueDate, paymentDateInstance);

    const [created] = await this.db
      .insert(paymentRecords)
      .values({
        ...record,
        paymentScheduleId: record.paymentScheduleId ?? null,
        internalCompanyId: resolvedInternalCompanyId,
        paymentAccountId: record.paymentAccountId ?? null,
        approvedBy: record.approvedBy ?? null,
        confirmationFile: record.confirmationFile ?? null,
        approvalScreenshot: record.approvalScreenshot ?? null,
        scheduledDueDate: rawDueDate ?? null,
        daysLate,
      })
      .returning();

    if (schedule) {
      const update = deriveScheduleUpdate(schedule, paymentDateInstance);
      if (update) {
        await this.updatePaymentSchedule(schedule.id, update);
      }
    }

    return created;
  }

  async updatePaymentRecord(
    id: string,
    record: Partial<InsertPaymentRecord>,
    audit?: { reason: string; performedBy: string },
  ): Promise<PaymentRecord | undefined> {
    const existing = await this.getPaymentRecord(id);
    if (!existing) {
      return undefined;
    }

    const [updated] = await this.db
      .update(paymentRecords)
      .set(record)
      .where(eq(paymentRecords.id, id))
      .returning();
    if (!updated) {
      return undefined;
    }

    if (audit) {
      await this.db
        .insert(paymentRecordAudits)
        .values(
          insertPaymentRecordAuditSchema.parse({
            paymentRecordId: id,
            action: "edit",
            reason: audit.reason,
            beforeSnapshot: existing,
            afterSnapshot: updated,
            performedBy: audit.performedBy,
          }),
        );
    }

    return updated;
  }

  async deletePaymentRecord(
    id: string,
    audit?: { reason: string; performedBy: string },
  ): Promise<boolean> {
    const existing = await this.getPaymentRecord(id);
    if (!existing) {
      return false;
    }

    const deleted = await this.db
      .delete(paymentRecords)
      .where(eq(paymentRecords.id, id))
      .returning({ id: paymentRecords.id });
    const success = deleted.length > 0;

    if (success && audit) {
      await this.db
        .insert(paymentRecordAudits)
        .values(
          insertPaymentRecordAuditSchema.parse({
            paymentRecordId: id,
            action: "delete",
            reason: audit.reason,
            beforeSnapshot: existing,
            afterSnapshot: null,
            performedBy: audit.performedBy,
          }),
        );
    }

    return success;
  }

  async getAllPaymentRecordAudits(): Promise<PaymentRecordAudit[]> {
    return await this.db
      .select()
      .from(paymentRecordAudits)
      .orderBy(desc(paymentRecordAudits.createdAt));
  }

  async getPaymentRecordAuditsByRecord(paymentRecordId: string): Promise<PaymentRecordAudit[]> {
    return await this.db
      .select()
      .from(paymentRecordAudits)
      .where(eq(paymentRecordAudits.paymentRecordId, paymentRecordId))
      .orderBy(desc(paymentRecordAudits.createdAt));
  }

  async getAllAccountMappings(): Promise<AccountMapping[]> {
    return await this.db.select().from(accountMappings);
  }

  async getAccountMapping(id: string): Promise<AccountMapping | undefined> {
    return await this.db.query.accountMappings.findFirst({ where: eq(accountMappings.id, id) }) || undefined;
  }

  async getAccountMappingByCsvName(csvAccountName: string): Promise<AccountMapping | undefined> {
    return await this.db.query.accountMappings.findFirst({ where: eq(accountMappings.csvAccountName, csvAccountName) }) || undefined;
  }

  async createAccountMapping(mapping: InsertAccountMapping): Promise<AccountMapping> {
    const [created] = await this.db
      .insert(accountMappings)
      .values(insertAccountMappingSchema.parse(mapping))
      .returning();
    return created;
  }

  async updateAccountMapping(id: string, mapping: Partial<InsertAccountMapping>): Promise<AccountMapping | undefined> {
    const [updated] = await this.db
      .update(accountMappings)
      .set(mapping)
      .where(eq(accountMappings.id, id))
      .returning();
    return updated ?? undefined;
  }

  async deleteAccountMapping(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(accountMappings)
      .where(eq(accountMappings.id, id))
      .returning({ id: accountMappings.id });
    return deleted.length > 0;
  }
}

export const storage: IStorage = process.env.DATABASE_URL
  ? new PgStorage(process.env.DATABASE_URL)
  : new MemStorage();
