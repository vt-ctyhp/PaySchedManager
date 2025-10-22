import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { InternalCompany, PaymentAccount, PaymentType, ExpenseType, User, AccountMapping, AccountBank } from "@shared/schema";
import { ACCOUNT_TYPE_OPTIONS } from "@shared/schema";

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-settings-title">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your internal companies, payment accounts, and expense categories
          </p>
        </div>

        <Tabs defaultValue="companies" className="space-y-4">
          <TabsList>
            <TabsTrigger value="companies" data-testid="tab-companies">Internal Companies</TabsTrigger>
            <TabsTrigger value="accounts" data-testid="tab-accounts">Payment Accounts</TabsTrigger>
            <TabsTrigger value="account-mappings" data-testid="tab-account-mappings">Account Mappings</TabsTrigger>
            <TabsTrigger value="payment-types" data-testid="tab-payment-types">Payment Types</TabsTrigger>
            <TabsTrigger value="expense-types" data-testid="tab-expense-types">Expense Types</TabsTrigger>
            {isAdmin && <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>}
          </TabsList>

          <TabsContent value="companies">
            <InternalCompaniesManager />
          </TabsContent>

          <TabsContent value="accounts">
            <PaymentAccountsManager />
          </TabsContent>

          <TabsContent value="account-mappings">
            <AccountMappingsManager />
          </TabsContent>

          <TabsContent value="payment-types">
            <PaymentTypesManager />
          </TabsContent>

          <TabsContent value="expense-types">
            <ExpenseTypesManager />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="users">
              <UsersManager />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

function InternalCompaniesManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const canDelete = user?.role === "Admin";

  const { data: companies = [], isLoading } = useQuery<InternalCompany[]>({
    queryKey: ["/api/internal-companies"],
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; abbreviation: string }) =>
      apiRequest("POST", "/api/internal-companies", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/internal-companies"] });
      toast({ title: "Company added successfully" });
      setOpen(false);
      setName("");
      setAbbreviation("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/internal-companies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/internal-companies"] });
      toast({ title: "Company deleted successfully" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name, abbreviation });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>Internal Companies</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-company">
              <Plus className="h-4 w-4 mr-2" />
              Add Company
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Internal Company</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Trans Fine Jewelry"
                  data-testid="input-company-name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="abbreviation">Abbreviation</Label>
                <Input
                  id="abbreviation"
                  value={abbreviation}
                  onChange={(e) => setAbbreviation(e.target.value)}
                  placeholder="e.g., TFJ"
                  data-testid="input-abbreviation"
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" data-testid="button-save-company">
                  Add Company
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company Name</TableHead>
                <TableHead>Abbreviation</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell data-testid={`text-company-${company.id}`}>{company.name}</TableCell>
                  <TableCell data-testid={`text-abbr-${company.id}`}>{company.abbreviation}</TableCell>
                  <TableCell>
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(company.id)}
                        data-testid={`button-delete-company-${company.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentAccountsManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canDelete = user?.role === "Admin";

  const [open, setOpen] = useState(false);
  const [newBankOpen, setNewBankOpen] = useState(false);
  const [internalCompanyId, setInternalCompanyId] = useState("");
  const [bankId, setBankId] = useState("");
  const [accountTypeCode, setAccountTypeCode] = useState("");
  const [lastFourDigits, setLastFourDigits] = useState("");
  const [newBankName, setNewBankName] = useState("");
  const [newBankNickname, setNewBankNickname] = useState("");

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<PaymentAccount[]>({
    queryKey: ["/api/payment-accounts"],
  });

  const { data: companies = [] } = useQuery<InternalCompany[]>({
    queryKey: ["/api/internal-companies"],
  });

  const { data: banks = [] } = useQuery<AccountBank[]>({
    queryKey: ["/api/account-banks"],
  });

  const createBankMutation = useMutation({
    mutationFn: (data: { name: string; nickname: string }) =>
      apiRequest("POST", "/api/account-banks", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account-banks"] });
      toast({ title: "Bank added successfully" });
      setNewBankOpen(false);
      setNewBankName("");
      setNewBankNickname("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add bank",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      internalCompanyId: string;
      bankId: string;
      accountTypeCode: string;
      lastFourDigits: string | null;
    }) => apiRequest("POST", "/api/payment-accounts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-accounts"] });
      toast({ title: "Payment account added successfully" });
      resetForm();
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add payment account",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/payment-accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-accounts"] });
      toast({ title: "Payment account deleted successfully" });
    },
  });

  const selectedCompany = companies.find((company) => company.id === internalCompanyId);
  const selectedBank = banks.find((bank) => bank.id === bankId);
  const selectedAccountType = ACCOUNT_TYPE_OPTIONS.find((option) => option.code === accountTypeCode);

  const accountPreview = [
    selectedCompany?.abbreviation,
    selectedBank?.nickname,
    selectedAccountType?.code,
    lastFourDigits ? lastFourDigits.trim() : "",
  ]
    .filter(Boolean)
    .join(" ");

  const resetForm = () => {
    setInternalCompanyId("");
    setBankId("");
    setAccountTypeCode("");
    setLastFourDigits("");
  };

  const handleAddBank = () => {
    if (!newBankName.trim() || !newBankNickname.trim()) {
      toast({ title: "Please provide both bank name and nickname", variant: "destructive" });
      return;
    }

    createBankMutation.mutate({
      name: newBankName.trim(),
      nickname: newBankNickname.trim(),
    });
  };

  const handleSubmit = () => {
    if (!internalCompanyId || !bankId || !accountTypeCode) {
      toast({ title: "Select company, bank, and account type", variant: "destructive" });
      return;
    }

    if (lastFourDigits && !/^\d{4}$/.test(lastFourDigits)) {
      toast({ title: "Last 4 digits must be exactly 4 numbers", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      internalCompanyId,
      bankId,
      accountTypeCode,
      lastFourDigits: lastFourDigits ? lastFourDigits.trim() : null,
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>Payment Accounts</CardTitle>
        <Dialog open={open} onOpenChange={(value) => {
          setOpen(value);
          if (!value) {
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-account">
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Payment Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="account-company">Internal Company</Label>
                <Select value={internalCompanyId} onValueChange={setInternalCompanyId}>
                  <SelectTrigger id="account-company" data-testid="select-account-company">
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name} ({company.abbreviation})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="account-bank">Bank</Label>
                  <Dialog open={newBankOpen} onOpenChange={setNewBankOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="px-2" data-testid="button-add-bank">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add bank
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm">
                      <DialogHeader>
                        <DialogTitle>Add Bank</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="new-bank-name">Bank Name</Label>
                          <Input
                            id="new-bank-name"
                            value={newBankName}
                            onChange={(event) => setNewBankName(event.target.value)}
                            placeholder="e.g., Bank of America"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-bank-nickname">Nickname</Label>
                          <Input
                            id="new-bank-nickname"
                            value={newBankNickname}
                            onChange={(event) => setNewBankNickname(event.target.value)}
                            placeholder="e.g., BoA"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" className="flex-1" onClick={() => setNewBankOpen(false)}>
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            className="flex-1"
                            onClick={handleAddBank}
                            disabled={createBankMutation.isPending}
                          >
                            {createBankMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <Select value={bankId} onValueChange={setBankId}>
                  <SelectTrigger id="account-bank" data-testid="select-account-bank">
                    <SelectValue placeholder="Select bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {banks.map((bank) => (
                      <SelectItem key={bank.id} value={bank.id}>
                        {bank.name} ({bank.nickname})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-type">Account Type</Label>
                <Select value={accountTypeCode} onValueChange={setAccountTypeCode}>
                  <SelectTrigger id="account-type" data-testid="select-account-type">
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.code} value={option.code}>
                        {option.label} ({option.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-last-four">Last 4 Digits (optional)</Label>
                <Input
                  id="account-last-four"
                  value={lastFourDigits}
                  onChange={(event) => setLastFourDigits(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                  placeholder="e.g., 9876"
                  inputMode="numeric"
                  data-testid="input-account-last-four"
                />
              </div>

              <div className="space-y-1">
                <Label>Generated Name</Label>
                <Input value={accountPreview || "Select company, bank, and type"} readOnly />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}
                  className="flex-1"
                  data-testid="button-cancel-account"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  className="flex-1"
                  data-testid="button-save-account"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Adding..." : "Add Account"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {accountsLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Last 4</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => {
                const company = companies.find((item) => item.id === account.internalCompanyId);
                const bank = banks.find((item) => item.id === account.bankId);
                return (
                  <TableRow key={account.id}>
                    <TableCell data-testid={`text-account-${account.id}`}>{account.name}</TableCell>
                    <TableCell>{company ? `${company.name} (${company.abbreviation})` : "—"}</TableCell>
                    <TableCell>{bank ? `${bank.name} (${bank.nickname})` : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{account.accountType}</Badge>
                    </TableCell>
                    <TableCell className="font-mono">{account.lastFourDigits || "—"}</TableCell>
                    <TableCell>
                      {canDelete && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(account.id)}
                          data-testid={`button-delete-account-${account.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function AccountMappingsManager() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [csvAccountName, setCsvAccountName] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");

  const { data: mappings = [], isLoading } = useQuery<AccountMapping[]>({
    queryKey: ["/api/account-mappings"],
  });

  const { data: paymentAccounts = [] } = useQuery<PaymentAccount[]>({
    queryKey: ["/api/payment-accounts"],
  });

  const createMutation = useMutation({
    mutationFn: (data: { csvAccountName: string; paymentAccountId: string }) =>
      apiRequest("POST", "/api/account-mappings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account-mappings"] });
      toast({ title: "Account mapping added successfully" });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add mapping",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { csvAccountName?: string; paymentAccountId?: string } }) =>
      apiRequest("PUT", `/api/account-mappings/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account-mappings"] });
      toast({ title: "Account mapping updated successfully" });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update mapping",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/account-mappings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account-mappings"] });
      toast({ title: "Account mapping deleted successfully" });
    },
  });

  const resetForm = () => {
    setOpen(false);
    setEditingId(null);
    setCsvAccountName("");
    setPaymentAccountId("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvAccountName || !paymentAccountId) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: { csvAccountName, paymentAccountId } });
    } else {
      createMutation.mutate({ csvAccountName, paymentAccountId });
    }
  };

  const handleEdit = (mapping: AccountMapping) => {
    setEditingId(mapping.id);
    setCsvAccountName(mapping.csvAccountName);
    setPaymentAccountId(mapping.paymentAccountId);
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle>Account Mappings</CardTitle>
          <p className="text-sm text-muted-foreground">
            Map CSV bank account names to your payment accounts for automatic transaction matching
          </p>
        </div>
        <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-mapping">
              <Plus className="h-4 w-4 mr-2" />
              Add Mapping
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit" : "Add"} Account Mapping</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="csv-account-name">CSV Account Name</Label>
                <Input
                  id="csv-account-name"
                  value={csvAccountName}
                  onChange={(e) => setCsvAccountName(e.target.value)}
                  placeholder="e.g., Chase Checking x1234"
                  data-testid="input-csv-account-name"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The account name exactly as it appears in your CSV export
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-account">Payment Account</Label>
                <Select value={paymentAccountId} onValueChange={setPaymentAccountId} required>
                  <SelectTrigger id="payment-account" data-testid="select-payment-account">
                    <SelectValue placeholder="Select payment account" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} {account.lastFourDigits && `(${account.lastFourDigits})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Your internal payment account to map this CSV account to
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={resetForm} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" data-testid="button-save-mapping" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? "Update" : "Add"} Mapping
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : mappings.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <p>No account mappings configured yet.</p>
            <p className="mt-1">Add mappings to automatically match CSV transactions to your payment accounts.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CSV Account Name</TableHead>
                <TableHead>Mapped To</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((mapping) => {
                const account = paymentAccounts.find((a) => a.id === mapping.paymentAccountId);
                return (
                  <TableRow key={mapping.id}>
                    <TableCell data-testid={`text-csv-name-${mapping.id}`}>
                      {mapping.csvAccountName}
                    </TableCell>
                    <TableCell data-testid={`text-mapped-account-${mapping.id}`}>
                      {account ? (
                        <>
                          {account.name}
                          {account.lastFourDigits && (
                            <span className="text-muted-foreground ml-1">({account.lastFourDigits})</span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Unknown Account</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(mapping)}
                          data-testid={`button-edit-mapping-${mapping.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(mapping.id)}
                          data-testid={`button-delete-mapping-${mapping.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentTypesManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const canDelete = user?.role === "Admin";

  const { data: types = [], isLoading } = useQuery<PaymentType[]>({
    queryKey: ["/api/payment-types"],
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string }) =>
      apiRequest("POST", "/api/payment-types", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-types"] });
      toast({ title: "Payment type added successfully" });
      setOpen(false);
      setName("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/payment-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-types"] });
      toast({ title: "Payment type deleted successfully" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>Payment Types</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-payment-type">
              <Plus className="h-4 w-4 mr-2" />
              Add Type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Payment Type</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type-name">Payment Type Name</Label>
                <Input
                  id="type-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., ACH, Wire, Credit Card"
                  data-testid="input-payment-type-name"
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" data-testid="button-save-payment-type">
                  Add Type
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment Type</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((type) => (
                <TableRow key={type.id}>
                  <TableCell data-testid={`text-payment-type-${type.id}`}>{type.name}</TableCell>
                  <TableCell>
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(type.id)}
                        data-testid={`button-delete-payment-type-${type.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ExpenseTypesManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const canDelete = user?.role === "Admin";

  const { data: types = [], isLoading } = useQuery<ExpenseType[]>({
    queryKey: ["/api/expense-types"],
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string }) =>
      apiRequest("POST", "/api/expense-types", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-types"] });
      toast({ title: "Expense type added successfully" });
      setOpen(false);
      setName("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/expense-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-types"] });
      toast({ title: "Expense type deleted successfully" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>Expense Types</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-expense-type">
              <Plus className="h-4 w-4 mr-2" />
              Add Type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Expense Type</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="expense-type-name">Expense Type Name</Label>
                <Input
                  id="expense-type-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Insurance, Rent, Subscriptions"
                  data-testid="input-expense-type-name"
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" data-testid="button-save-expense-type">
                  Add Type
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expense Type</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((type) => (
                <TableRow key={type.id}>
                  <TableCell data-testid={`text-expense-type-${type.id}`}>{type.name}</TableCell>
                  <TableCell>
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(type.id)}
                        data-testid={`button-delete-expense-type-${type.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function UsersManager() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"Admin" | "User">("User");

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const createMutation = useMutation({
    mutationFn: (data: { username: string; password: string; role: "Admin" | "User" }) =>
      apiRequest("POST", "/api/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User created successfully" });
      setOpen(false);
      setUsername("");
      setPassword("");
      setRole("User");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create user",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete user",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ username, password, role });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>Users</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-user">
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  data-testid="input-username"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  data-testid="input-password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={(value) => setRole(value as "Admin" | "User")}>
                  <SelectTrigger id="role" data-testid="select-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="User">User</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" data-testid="button-save-user" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell data-testid={`text-username-${user.id}`}>{user.username}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "Admin" ? "default" : "secondary"} data-testid={`badge-role-${user.id}`}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(user.id)}
                      data-testid={`button-delete-user-${user.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
