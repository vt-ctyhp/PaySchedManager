import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Upload } from "lucide-react";
import { format } from "date-fns";

interface RecordPaymentDialogProps {
  trigger?: React.ReactNode;
  scheduleId?: string;
  company?: string;
  scheduledAmount?: number;
}

export default function RecordPaymentDialog({ 
  trigger, 
  company,
  scheduledAmount,
}: RecordPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState<Date>();
  const [amount, setAmount] = useState(scheduledAmount?.toString() || "");
  const [payer, setPayer] = useState("");
  const [method, setMethod] = useState("");
  const [account, setAccount] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Record payment:", { paymentDate, amount, payer, method, account, file });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" data-testid="button-record-payment">
            Record Payment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          {company && <p className="text-sm text-muted-foreground mt-1">for {company}</p>}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Payment Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  data-testid="button-payment-date"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {paymentDate ? format(paymentDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={paymentDate}
                  onSelect={setPaymentDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-amount">Payment Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="pl-7"
                data-testid="input-payment-amount"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payer">Who Paid</Label>
            <Input
              id="payer"
              value={payer}
              onChange={(e) => setPayer(e.target.value)}
              placeholder="e.g., John Doe"
              data-testid="input-payer"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-method">Payment Method</Label>
            <Select value={method} onValueChange={setMethod} required>
              <SelectTrigger id="payment-method" data-testid="select-payment-method">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credit-card">Credit Card</SelectItem>
                <SelectItem value="debit-card">Debit Card</SelectItem>
                <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account">Account/Card (Last 4 digits)</Label>
            <Input
              id="account"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="e.g., **** 1234"
              data-testid="input-account"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Confirmation File</Label>
            <div className="flex gap-2">
              <Input
                id="file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="flex-1"
                data-testid="input-file"
              />
              <Button type="button" size="icon" variant="outline">
                <Upload className="h-4 w-4" />
              </Button>
            </div>
            {file && (
              <p className="text-xs text-muted-foreground" data-testid="text-file-name">
                {file.name}
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1" data-testid="button-cancel-record">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" data-testid="button-save-record">
              Record Payment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
