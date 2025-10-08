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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InternalCompany, PaymentAccount, PaymentType, ExpenseType } from "@shared/schema";

export default function Settings() {
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
            <TabsTrigger value="payment-types" data-testid="tab-payment-types">Payment Types</TabsTrigger>
            <TabsTrigger value="expense-types" data-testid="tab-expense-types">Expense Types</TabsTrigger>
          </TabsList>

          <TabsContent value="companies">
            <InternalCompaniesManager />
          </TabsContent>

          <TabsContent value="accounts">
            <PaymentAccountsManager />
          </TabsContent>

          <TabsContent value="payment-types">
            <PaymentTypesManager />
          </TabsContent>

          <TabsContent value="expense-types">
            <ExpenseTypesManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function InternalCompaniesManager() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");

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
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(company.id)}
                      data-testid={`button-delete-company-${company.id}`}
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

function PaymentAccountsManager() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState("");
  const [lastFourDigits, setLastFourDigits] = useState("");

  const { data: accounts = [], isLoading } = useQuery<PaymentAccount[]>({
    queryKey: ["/api/payment-accounts"],
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; accountType: string; lastFourDigits?: string }) =>
      apiRequest("POST", "/api/payment-accounts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-accounts"] });
      toast({ title: "Payment account added successfully" });
      setOpen(false);
      setName("");
      setAccountType("");
      setLastFourDigits("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to add payment account", 
        description: error.message || "Please try again",
        variant: "destructive" 
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

  const handleSubmit = () => {
    if (!name || !accountType) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate({ name, accountType, lastFourDigits: lastFourDigits || undefined });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>Payment Accounts</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-account">
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Payment Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="account-name">Account Name</Label>
                <Input
                  id="account-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Chase Business Card"
                  data-testid="input-account-name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-type">Account Type</Label>
                <Input
                  id="account-type"
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value)}
                  placeholder="e.g., Credit Card, Bank Account"
                  data-testid="input-account-type"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-four">Last 4 Digits (Optional)</Label>
                <Input
                  id="last-four"
                  value={lastFourDigits}
                  onChange={(e) => setLastFourDigits(e.target.value)}
                  placeholder="e.g., 1234"
                  maxLength={4}
                  data-testid="input-last-four"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1" data-testid="button-cancel-account">
                  Cancel
                </Button>
                <Button type="button" onClick={handleSubmit} className="flex-1" data-testid="button-save-account" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Adding..." : "Add Account"}
                </Button>
              </div>
            </div>
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
                <TableHead>Account Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Last 4 Digits</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell data-testid={`text-account-${account.id}`}>{account.name}</TableCell>
                  <TableCell>{account.accountType}</TableCell>
                  <TableCell className="font-mono">{account.lastFourDigits || "—"}</TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(account.id)}
                      data-testid={`button-delete-account-${account.id}`}
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

function PaymentTypesManager() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

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
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(type.id)}
                      data-testid={`button-delete-payment-type-${type.id}`}
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

function ExpenseTypesManager() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

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
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(type.id)}
                      data-testid={`button-delete-expense-type-${type.id}`}
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
