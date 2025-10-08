import {
  type User,
  type InsertUser,
  type InternalCompany,
  type InsertInternalCompany,
  type PaymentAccount,
  type InsertPaymentAccount,
  type PaymentType,
  type InsertPaymentType,
  type ExpenseType,
  type InsertExpenseType,
  type PaymentSchedule,
  type InsertPaymentSchedule,
  type PaymentRecord,
  type InsertPaymentRecord,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
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
  createPaymentRecord(record: InsertPaymentRecord): Promise<PaymentRecord>;
  updatePaymentRecord(id: string, record: Partial<InsertPaymentRecord>): Promise<PaymentRecord | undefined>;
  deletePaymentRecord(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private internalCompanies: Map<string, InternalCompany>;
  private paymentAccounts: Map<string, PaymentAccount>;
  private paymentTypes: Map<string, PaymentType>;
  private expenseTypes: Map<string, ExpenseType>;
  private paymentSchedules: Map<string, PaymentSchedule>;
  private paymentRecords: Map<string, PaymentRecord>;

  constructor() {
    this.users = new Map();
    this.internalCompanies = new Map();
    this.paymentAccounts = new Map();
    this.paymentTypes = new Map();
    this.expenseTypes = new Map();
    this.paymentSchedules = new Map();
    this.paymentRecords = new Map();

    // Initialize with default data
    this.initializeDefaults();
  }

  private initializeDefaults() {
    // Default Internal Companies
    const companies = [
      { name: "Trans Fine Jewelry", abbreviation: "TFJ" },
      { name: "Alexander DM", abbreviation: "ADM" },
      { name: "Hung Phat LLC", abbreviation: "HP LLC" },
    ];
    companies.forEach((c) => {
      const id = randomUUID();
      this.internalCompanies.set(id, { id, ...c });
    });

    // Default Payment Types
    const paymentTypesData = ["ACH", "Wire", "Credit Card", "Debit Card"];
    paymentTypesData.forEach((name) => {
      const id = randomUUID();
      this.paymentTypes.set(id, { id, name });
    });

    // Default Expense Types
    const expenseTypesData = ["Insurance", "Rent", "Professional Services", "Shipping", "Subscriptions"];
    expenseTypesData.forEach((name) => {
      const id = randomUUID();
      this.expenseTypes.set(id, { id, name });
    });
  }

  // Users
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

  // Internal Companies
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

  // Payment Accounts
  async getAllPaymentAccounts(): Promise<PaymentAccount[]> {
    return Array.from(this.paymentAccounts.values());
  }

  async getPaymentAccount(id: string): Promise<PaymentAccount | undefined> {
    return this.paymentAccounts.get(id);
  }

  async createPaymentAccount(account: InsertPaymentAccount): Promise<PaymentAccount> {
    const id = randomUUID();
    const newAccount: PaymentAccount = { 
      id, 
      ...account,
      lastFourDigits: account.lastFourDigits ?? null,
    };
    this.paymentAccounts.set(id, newAccount);
    return newAccount;
  }

  async updatePaymentAccount(id: string, account: Partial<InsertPaymentAccount>): Promise<PaymentAccount | undefined> {
    const existing = this.paymentAccounts.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...account };
    this.paymentAccounts.set(id, updated);
    return updated;
  }

  async deletePaymentAccount(id: string): Promise<boolean> {
    return this.paymentAccounts.delete(id);
  }

  // Payment Types
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

  // Expense Types
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

  // Payment Schedules
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
    const suffixes = Array.from(this.paymentSchedules.values())
      .filter((schedule) => schedule.expenseId.startsWith(prefix))
      .map((schedule) => {
        const parts = schedule.expenseId.split("-");
        return Number.parseInt(parts.at(-1) || "0", 10) || 0;
      });

    const currentMax = suffixes.length > 0 ? Math.max(...suffixes) : 0;
    return currentMax + 1;
  }

  async createPaymentSchedule(schedule: InsertPaymentSchedule): Promise<PaymentSchedule> {
    const id = randomUUID();
    
    // Get internal company for abbreviation
    const internalCompany = await this.getInternalCompany(schedule.internalCompanyId);
    if (!internalCompany) {
      throw new Error("Internal company not found");
    }

    // Generate expense ID
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

  // Payment Records
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
    const newRecord: PaymentRecord = {
      id,
      createdAt: new Date(),
      ...record,
      paymentScheduleId: record.paymentScheduleId ?? null,
      approvedBy: record.approvedBy ?? null,
      paymentAccountId: record.paymentAccountId ?? null,
      confirmationFile: record.confirmationFile ?? null,
    };
    this.paymentRecords.set(id, newRecord);
    return newRecord;
  }

  async updatePaymentRecord(id: string, record: Partial<InsertPaymentRecord>): Promise<PaymentRecord | undefined> {
    const existing = this.paymentRecords.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...record };
    this.paymentRecords.set(id, updated);
    return updated;
  }

  async deletePaymentRecord(id: string): Promise<boolean> {
    return this.paymentRecords.delete(id);
  }
}

export const storage = new MemStorage();
