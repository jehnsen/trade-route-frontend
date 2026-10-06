"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Clock, Mail, MapPin, MessageCircle, Phone, ShieldCheck, UserRound } from "lucide-react";
import { useAppStore, usePortalCustomerId } from "@/lib/store";
import { PortalAccountGate } from "@/components/portal/portal-sign-in";
import { useSalesCustomerStats } from "@/hooks/use-data";
import { COMPANY, staffById } from "@/data/company";
import { productById, productLabel } from "@/data/products";
import { fmtDate, peso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, Input, Textarea } from "@/components/ui/primitives";
import { Field } from "@/components/ui/form-controls";
import { AddressDisplay, CapacityBar, Stat } from "@/components/shared/common";

export function PortalAccount() {
  const customerId = usePortalCustomerId();
  return <PortalAccountGate what="see your business account">{customerId && <BusinessAccount customerId={customerId} />}</PortalAccountGate>;
}

function BusinessAccount({ customerId }: { customerId: string }) {
  const customer = useAppStore((s) => s.customers.find((c) => c.id === customerId));
  const stats = useSalesCustomerStats().get(customerId);
  if (!customer || !stats) return null;
  const sp = staffById(customer.salespersonId);
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Business account</h1>
      <p className="text-sm text-muted-foreground">
        {customer.name} · customer since {fmtDate(customer.customerSince)}
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Business profile</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Stat label="Registered name" value={customer.name} />
            <Stat label="Business type" value={customer.type} />
            <Stat label="Account no." value={customer.id} />
            <Stat label="Your sales contact" value={sp?.name ?? "—"} sub={sp?.phone} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-success" /> Credit account
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Payment terms" value={customer.paymentTerms} />
              <Stat label="Credit limit" value={peso(customer.creditLimit)} />
              <Stat label="Outstanding" value={peso(stats.outstanding)} />
              <Stat label="Available credit" value={peso(Math.max(0, customer.creditLimit - stats.outstanding))} />
            </div>
            <CapacityBar used={stats.outstanding} capacity={customer.creditLimit} showNumbers={false} label="Credit used" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {customer.contacts.map((c) => (
              <div key={c.name} className="flex items-center gap-2 text-sm">
                <UserRound className="size-4 text-muted-foreground" />
                <span className="flex-1">
                  {c.name} <span className="text-muted-foreground">· {c.position}</span>
                </span>
                <span className="tabular">{c.phone}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Delivery addresses</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {customer.addresses.map((a) => (
              <AddressDisplay key={a.id} address={a} />
            ))}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Usual products</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {customer.preferredProductIds.map((p) => (
              <span key={p} className="rounded-full border px-3 py-1 text-sm">
                {productLabel(productById(p))}
              </span>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const schema = z.object({
  name: z.string().min(2, "Your name is required"),
  business: z.string().min(2, "Business name is required"),
  mobile: z.string().regex(/^09\d{2}\s?\d{3}\s?\d{4}$/, "Use a PH mobile number, e.g. 0917 123 4567"),
  message: z.string().min(10, "Tell us a bit more (at least 10 characters)"),
});
type Values = z.infer<typeof schema>;

export function PortalContact() {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", business: "", mobile: "", message: "" } });
  const e = form.formState.errors;
  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 md:grid-cols-2">
      <div className="grid content-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contact the order desk</h1>
          <p className="text-sm text-muted-foreground">Open a wholesale or credit account, ask about delivery areas, or place an order by phone.</p>
        </div>
        {[
          { icon: Phone, l: "Mobile / Viber", v: COMPANY.mobile },
          { icon: Phone, l: "Landline", v: COMPANY.phone },
          { icon: MessageCircle, l: "Facebook Messenger", v: COMPANY.messenger },
          { icon: Mail, l: "E-mail", v: COMPANY.email },
          { icon: MapPin, l: "Bodega (pickups)", v: COMPANY.address },
          { icon: Clock, l: "Order desk hours", v: COMPANY.businessHours },
        ].map((c) => (
          <div key={c.l} className="flex gap-3 rounded-xl border bg-card p-4">
            <c.icon className="mt-0.5 size-5 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">{c.l}</div>
              <div className="font-medium">{c.v}</div>
            </div>
          </div>
        ))}
      </div>
      <Card className="content-start">
        <CardHeader>
          <CardTitle>Send us a message</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit(() => {
              toast.success("Message sent", { description: "Our sales team will get back to you within the day." });
              form.reset();
            })}
          >
            <Field label="Your name" htmlFor="ct-n" error={e.name?.message} required>
              <Input id="ct-n" aria-invalid={!!e.name} {...form.register("name")} />
            </Field>
            <Field label="Business name" htmlFor="ct-b" error={e.business?.message} required>
              <Input id="ct-b" aria-invalid={!!e.business} {...form.register("business")} />
            </Field>
            <Field label="Mobile number" htmlFor="ct-m" error={e.mobile?.message} required>
              <Input id="ct-m" type="tel" inputMode="tel" aria-invalid={!!e.mobile} {...form.register("mobile")} />
            </Field>
            <Field label="Message" htmlFor="ct-msg" error={e.message?.message} required>
              <Textarea id="ct-msg" rows={5} aria-invalid={!!e.message} {...form.register("message")} />
            </Field>
            <Button type="submit">Send message</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
