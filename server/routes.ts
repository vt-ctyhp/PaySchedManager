import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import {
  insertInternalCompanySchema,
  insertPaymentAccountSchema,
  insertAccountBankSchema,
  insertPaymentTypeSchema,
  insertExpenseTypeSchema,
  insertPaymentScheduleSchema,
  insertPaymentRecordSchema,
  insertUserSchema,
  insertAccountMappingSchema,
  type InsertPaymentRecord,
} from "@shared/schema";
import { hashPassword, authenticateUser, requireAuth, requireAdmin, getCurrentUser } from "./auth";
import { upload, persistUploadedFile, getFileStream } from "./upload";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await authenticateUser(username, password);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      req.session.userId = user.id;
      req.session.userRole = user.role;
      
      // Explicitly save session before sending response
      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ message: "Session save failed" });
        }
        
        res.json({
          id: user.id,
          username: user.username,
          role: user.role,
        });
      });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }
      
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        role: "User", // Always create as regular user, admins must be created by other admins
      });
      
      req.session.userId = user.id;
      req.session.userRole = user.role;
      
      // Explicitly save session before sending response
      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ message: "Session save failed" });
        }
        
        res.status(201).json({
          id: user.id,
          username: user.username,
          role: user.role,
        });
      });
    } catch (error) {
      res.status(400).json({ message: "Registration failed" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const user = await getCurrentUser(req.session.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
    });
  });

  // User list for approvers (accessible to all authenticated users)
  app.get("/api/users/approvers", requireAuth, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const approvers = users.map(u => ({
        id: u.id,
        username: u.username,
      }));
      res.json(approvers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // User Management (Admin only)
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const sanitizedUsers = users.map(u => ({
        id: u.id,
        username: u.username,
        role: u.role,
        createdAt: u.createdAt,
      }));
      res.json(sanitizedUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const hashedPassword = await hashPassword(data.password);
      const user = await storage.createUser({
        ...data,
        password: hashedPassword,
      });
      
      res.status(201).json({
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
      });
    } catch (error) {
      res.status(400).json({ message: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const { password, ...updates } = req.body;
      const data: any = { ...updates };
      
      if (password) {
        data.password = await hashPassword(password);
      }
      
      const user = await storage.updateUser(req.params.id, data);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
      });
    } catch (error) {
      res.status(400).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const success = await storage.deleteUser(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });
  // Internal Companies
  app.get("/api/internal-companies", requireAuth, async (req, res) => {
    try {
      const companies = await storage.getAllInternalCompanies();
      res.json(companies);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch internal companies" });
    }
  });

  app.post("/api/internal-companies", requireAuth, async (req, res) => {
    try {
      const data = insertInternalCompanySchema.parse(req.body);
      const company = await storage.createInternalCompany(data);
      res.status(201).json(company);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.put("/api/internal-companies/:id", requireAuth, async (req, res) => {
    try {
      const data = insertInternalCompanySchema.partial().parse(req.body);
      const company = await storage.updateInternalCompany(req.params.id, data);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.delete("/api/internal-companies/:id", requireAdmin, async (req, res) => {
    try {
      const success = await storage.deleteInternalCompany(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete company" });
    }
  });

  // Account Banks
  app.get("/api/account-banks", requireAuth, async (_req, res) => {
    try {
      const banks = await storage.getAllAccountBanks();
      res.json(banks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch banks" });
    }
  });

  app.post("/api/account-banks", requireAuth, async (req, res) => {
    try {
      const data = insertAccountBankSchema.parse(req.body);
      const bank = await storage.createAccountBank(data);
      res.status(201).json(bank);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid data" });
    }
  });

  // Payment Accounts
  app.get("/api/payment-accounts", requireAuth, async (req, res) => {
    try {
      const accounts = await storage.getAllPaymentAccounts();
      res.json(accounts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payment accounts" });
    }
  });

  app.post("/api/payment-accounts", requireAuth, async (req, res) => {
    try {
      const data = insertPaymentAccountSchema.parse(req.body);
      const account = await storage.createPaymentAccount(data);
      res.status(201).json(account);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.put("/api/payment-accounts/:id", requireAuth, async (req, res) => {
    try {
      const data = insertPaymentAccountSchema.partial().parse(req.body);
      const account = await storage.updatePaymentAccount(req.params.id, data);
      if (!account) {
        return res.status(404).json({ message: "Account not found" });
      }
      res.json(account);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.delete("/api/payment-accounts/:id", requireAdmin, async (req, res) => {
    try {
      const success = await storage.deletePaymentAccount(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Account not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  // Payment Types
  app.get("/api/payment-types", requireAuth, async (req, res) => {
    try {
      const types = await storage.getAllPaymentTypes();
      res.json(types);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payment types" });
    }
  });

  app.post("/api/payment-types", requireAuth, async (req, res) => {
    try {
      const data = insertPaymentTypeSchema.parse(req.body);
      const type = await storage.createPaymentType(data);
      res.status(201).json(type);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.put("/api/payment-types/:id", requireAuth, async (req, res) => {
    try {
      const data = insertPaymentTypeSchema.partial().parse(req.body);
      const type = await storage.updatePaymentType(req.params.id, data);
      if (!type) {
        return res.status(404).json({ message: "Payment type not found" });
      }
      res.json(type);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.delete("/api/payment-types/:id", requireAdmin, async (req, res) => {
    try {
      const success = await storage.deletePaymentType(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Payment type not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete payment type" });
    }
  });

  // Expense Types
  app.get("/api/expense-types", requireAuth, async (req, res) => {
    try {
      const types = await storage.getAllExpenseTypes();
      res.json(types);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch expense types" });
    }
  });

  app.post("/api/expense-types", requireAuth, async (req, res) => {
    try {
      const data = insertExpenseTypeSchema.parse(req.body);
      const type = await storage.createExpenseType(data);
      res.status(201).json(type);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.put("/api/expense-types/:id", requireAuth, async (req, res) => {
    try {
      const data = insertExpenseTypeSchema.partial().parse(req.body);
      const type = await storage.updateExpenseType(req.params.id, data);
      if (!type) {
        return res.status(404).json({ message: "Expense type not found" });
      }
      res.json(type);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.delete("/api/expense-types/:id", requireAdmin, async (req, res) => {
    try {
      const success = await storage.deleteExpenseType(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Expense type not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete expense type" });
    }
  });

  // Payment Schedules
  app.get("/api/payment-schedules", requireAuth, async (req, res) => {
    try {
      const schedules = await storage.getAllPaymentSchedules();
      res.json(schedules);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payment schedules" });
    }
  });

  app.get("/api/payment-schedules/:id", requireAuth, async (req, res) => {
    try {
      const schedule = await storage.getPaymentSchedule(req.params.id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      res.json(schedule);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schedule" });
    }
  });

  app.post("/api/payment-schedules", requireAuth, async (req, res) => {
    try {
      const data = insertPaymentScheduleSchema.parse(req.body);
      const schedule = await storage.createPaymentSchedule(data);
      res.status(201).json(schedule);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid data" });
    }
  });

  app.put("/api/payment-schedules/:id", requireAuth, async (req, res) => {
    try {
      const data = insertPaymentScheduleSchema.partial().parse(req.body);
      const schedule = await storage.updatePaymentSchedule(req.params.id, data);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      res.json(schedule);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.delete("/api/payment-schedules/:id", requireAdmin, async (req, res) => {
    try {
      const success = await storage.deletePaymentSchedule(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete schedule" });
    }
  });

  // Payment Records
  app.get("/api/payment-records", requireAuth, async (req, res) => {
    try {
      const records = await storage.getAllPaymentRecords();
      res.json(records);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payment records" });
    }
  });

  app.get("/api/payment-records/schedule/:scheduleId", requireAuth, async (req, res) => {
    try {
      const records = await storage.getPaymentRecordsByScheduleId(req.params.scheduleId);
      res.json(records);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payment records" });
    }
  });

  app.post(
    "/api/payment-records",
    requireAuth,
    upload.fields([
      { name: "confirmationFile", maxCount: 1 },
      { name: "approvalScreenshot", maxCount: 1 },
    ]),
    async (req, res) => {
      try {
        const files = req.files as Record<string, Express.Multer.File[]> | undefined;
        const confirmationKey = await persistUploadedFile(files?.confirmationFile?.[0]);
        const approvalKey = await persistUploadedFile(files?.approvalScreenshot?.[0]);
        const scheduleId = req.body.paymentScheduleId || null;
        const schedule = scheduleId ? await storage.getPaymentSchedule(scheduleId) : null;
        const internalCompanyId = req.body.internalCompanyId || schedule?.internalCompanyId;
        const expenseId = schedule?.expenseId ?? req.body.expenseId;

        if (!internalCompanyId) {
          throw new Error("Internal company is required");
        }

        if (!expenseId) {
          throw new Error("Expense ID is required");
        }

        const data = insertPaymentRecordSchema.parse({
          paymentScheduleId: scheduleId,
          expenseId,
          internalCompanyId,
          paymentDate: req.body.paymentDate,
          amount: req.body.amount,
          approvedBy: req.body.approvedBy || null,
          paymentMethod: req.body.paymentMethod,
          paymentAccountId: req.body.paymentAccountId || null,
          confirmationFile: confirmationKey ?? null,
          approvalScreenshot: approvalKey ?? null,
        });

        const record = await storage.createPaymentRecord({
          ...data,
          paidBy: req.session.userId!,
          confirmationFile: confirmationKey ?? null,
          approvalScreenshot: approvalKey ?? null,
        });
        res.status(201).json(record);
      } catch (error: any) {
        res.status(400).json({ message: error.message || "Invalid data" });
      }
    }
  );

  app.post("/api/payment-records/bulk", requireAuth, async (req, res) => {
    try {
      if (!Array.isArray(req.body) || req.body.length === 0) {
        return res.status(400).json({ message: "Request body must be a non-empty array" });
      }

      const parsedRecords = await Promise.all(
        req.body.map(async (rawRecord: any) => {
          const scheduleId = rawRecord.paymentScheduleId || null;
          const schedule = scheduleId ? await storage.getPaymentSchedule(scheduleId) : null;
          const internalCompanyId = rawRecord.internalCompanyId || schedule?.internalCompanyId;
          const expenseId = schedule?.expenseId ?? rawRecord.expenseId;

          if (!internalCompanyId) {
            throw new Error("Internal company is required for imported payments");
          }

          if (!expenseId) {
            throw new Error("Expense ID is required for imported payments");
          }

          return insertPaymentRecordSchema.parse({
            ...rawRecord,
            paymentScheduleId: scheduleId,
            expenseId,
            internalCompanyId,
            approvedBy: rawRecord.approvedBy || null,
            paymentAccountId: rawRecord.paymentAccountId || null,
            confirmationFile: rawRecord.confirmationFile ?? null,
            approvalScreenshot: rawRecord.approvalScreenshot ?? null,
          });
        })
      );

      const createdRecords = await Promise.all(
        parsedRecords.map((record) =>
          storage.createPaymentRecord({
            ...record,
            paidBy: req.session.userId!,
          })
        )
      );

      res.status(201).json(createdRecords);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid data" });
    }
  });

  app.put("/api/payment-records/:id", requireAuth, async (req, res) => {
    try {
      const { reason, ...payload } = req.body ?? {};

      if (typeof reason !== "string" || reason.trim().length === 0) {
        return res.status(400).json({ message: "Reason is required" });
      }

      const data = insertPaymentRecordSchema.partial().parse(payload);
      const record = await storage.updatePaymentRecord(req.params.id, data, {
        reason: reason.trim(),
        performedBy: req.session.userId!,
      });
      if (!record) {
        return res.status(404).json({ message: "Record not found" });
      }
      res.json(record);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.put(
    "/api/payment-records/:id/files",
    requireAuth,
    upload.fields([
      { name: "confirmationFile", maxCount: 1 },
      { name: "approvalScreenshot", maxCount: 1 },
    ]),
    async (req, res) => {
      try {
        const files = req.files as Record<string, Express.Multer.File[]> | undefined;
        const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
        const confirmation = files?.confirmationFile?.[0];
        const approval = files?.approvalScreenshot?.[0];

        if (!confirmation && !approval) {
          return res.status(400).json({ message: "No files provided" });
        }

        if (!reason) {
          return res.status(400).json({ message: "Reason is required" });
        }

        const updates: Partial<InsertPaymentRecord> & {
          confirmationFile?: string | null;
          approvalScreenshot?: string | null;
        } = {};

        if (confirmation) {
          updates.confirmationFile = await persistUploadedFile(confirmation);
        }

        if (approval) {
          updates.approvalScreenshot = await persistUploadedFile(approval);
        }

        const record = await storage.updatePaymentRecord(req.params.id, updates, {
          reason,
          performedBy: req.session.userId!,
        });
        if (!record) {
          return res.status(404).json({ message: "Record not found" });
        }

        res.json(record);
      } catch (error: any) {
        res.status(500).json({ message: error?.message || "Failed to update files" });
      }
    },
  );

  app.delete("/api/payment-records/:id", requireAdmin, async (req, res) => {
    try {
      const reason =
        typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

      if (!reason) {
        return res.status(400).json({ message: "Reason is required" });
      }

      const success = await storage.deletePaymentRecord(req.params.id, {
        reason,
        performedBy: req.session.userId!,
      });
      if (!success) {
        return res.status(404).json({ message: "Record not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete record" });
    }
  });

  app.get("/api/payment-record-audits", requireAdmin, async (_req, res) => {
    try {
      const audits = await storage.getAllPaymentRecordAudits();
      res.json(audits);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/payment-records/:id/audits", requireAuth, async (req, res) => {
    try {
      const audits = await storage.getPaymentRecordAuditsByRecord(req.params.id);
      res.json(audits);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // File download endpoint
  app.get("/api/files/:key", requireAuth, async (req, res) => {
    try {
      const file = await getFileStream(req.params.key);

      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      const fileName = file.originalName || req.params.key;
      if (file.contentType) {
        res.setHeader("Content-Type", file.contentType);
      }
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
      );
      if (file.contentLength) {
        res.setHeader("Content-Length", file.contentLength.toString());
      }

      file.stream.on("error", () => {
        res.status(500).end();
      });

      file.stream.pipe(res);
    } catch (error) {
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  // Account Mappings
  app.get("/api/account-mappings", requireAuth, async (req, res) => {
    try {
      const mappings = await storage.getAllAccountMappings();
      res.json(mappings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch account mappings" });
    }
  });

  app.post("/api/account-mappings", requireAuth, async (req, res) => {
    try {
      const data = insertAccountMappingSchema.parse(req.body);
      const mapping = await storage.createAccountMapping(data);
      res.status(201).json(mapping);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.put("/api/account-mappings/:id", requireAuth, async (req, res) => {
    try {
      const data = insertAccountMappingSchema.partial().parse(req.body);
      const mapping = await storage.updateAccountMapping(req.params.id, data);
      if (!mapping) {
        return res.status(404).json({ message: "Mapping not found" });
      }
      res.json(mapping);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.delete("/api/account-mappings/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteAccountMapping(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Mapping not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete mapping" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
