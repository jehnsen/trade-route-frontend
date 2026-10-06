"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, LogIn } from "lucide-react";
import type { Role } from "@/types";
import { useAppStore } from "@/lib/store";
import { useSession } from "@/lib/session";
import { errorMessage } from "@/lib/api/client";
import { ROLE_META } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { Card, Input } from "@/components/ui/primitives";
import { Field } from "@/components/ui/form-controls";
import { Logo } from "@/components/layout/brand";

const schema = z.object({
  email: z.string().trim().email("Enter the email you sign in with"),
  password: z.string().min(1, "Enter your password"),
});
type Values = z.infer<typeof schema>;

/** Seeded logins of the Lucena Fresh demo organization (backend `npm run seed`). Development only. */
const DEMO_LOGINS: { email: string; name: string; role: Role; note: string }[] = [
  { email: "owner@lucenafresh.local", name: "Rodel Samonte", role: "owner", note: "Full access · can preview every desk" },
  { email: "dispatch@lucenafresh.local", name: "Noel Pascual", role: "dispatcher", note: "Trips, dispatch, Load Board" },
  { email: "sales@lucenafresh.local", name: "Kristine Ramos", role: "sales", note: "Quotes, jobs, customers" },
  { email: "accounting@lucenafresh.local", name: "Grace Lontoc", role: "accounting", note: "Billing and collections" },
  { email: "warehouse@lucenafresh.local", name: "Bong Esguerra", role: "warehouse", note: "Loading and cargo" },
  { email: "procurement@lucenafresh.local", name: "Edwin Manalo", role: "procurement", note: "Backhaul cargo" },
  { email: "driver@lucenafresh.local", name: "Joel Mendoza", role: "driver", note: "Driver app · Truck 01" },
  { email: "marco@seasidegrill.local", name: "Marco Villareal", role: "customer", note: "Customer portal · Seaside Grill Bacoor" },
];
const SHOW_DEMO = process.env.NEXT_PUBLIC_DEMO_LOGINS === "true";
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "";

/** Resolves once the signed-in organization's data has loaded. */
function dataLoaded() {
  return new Promise<void>((resolve, reject) => {
    const check = (s: ReturnType<typeof useAppStore.getState>) => {
      if (s.status === "ready") (unsubscribe(), resolve());
      else if (s.status === "error") (unsubscribe(), reject(new Error(s.loadError)));
    };
    const unsubscribe = useAppStore.subscribe(check);
    check(useAppStore.getState());
  });
}

/** Only local paths, so a crafted link can't send people elsewhere after signing in. */
const safeNext = (next?: string) => (next && next.startsWith("/") && !next.startsWith("//") ? next : undefined);

export function LoginView({ next }: { next?: string }) {
  const router = useRouter();
  const session = useSession((s) => s.status);
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });
  const errors = form.formState.errors;

  const goHome = React.useCallback(async () => {
    await dataLoaded();
    const role = useAppStore.getState().role;
    router.replace(safeNext(next) ?? ROLE_META[role].home);
  }, [next, router]);

  React.useEffect(() => {
    if (session === "signedIn" && !form.formState.isSubmitting) void goHome().catch(() => undefined);
  }, [session, goHome, form.formState.isSubmitting]);

  const submit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await useSession.getState().login(v.email, v.password);
      await goHome();
    } catch (e) {
      setError(e instanceof Error && !("status" in e) ? e.message : errorMessage(e));
    }
  });

  const signInAs = (email: string) => {
    form.setValue("email", email, { shouldValidate: true });
    form.setValue("password", DEMO_PASSWORD, { shouldValidate: true });
    void submit();
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-10">
      <Logo tone="light" />
      <Card className="w-full max-w-md gap-5 p-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Jobs, trips, deliveries and collections for your team.</p>
        </div>
        <form noValidate onSubmit={submit} className="grid gap-4">
          <Field label="Email" htmlFor="login-email" error={errors.email?.message} required>
            <Input id="login-email" type="email" autoComplete="username" autoFocus aria-invalid={!!errors.email} {...form.register("email")} />
          </Field>
          <Field label="Password" htmlFor="login-password" error={errors.password?.message} required>
            <Input id="login-password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...form.register("password")} />
          </Field>
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            <LogIn /> {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>

      {SHOW_DEMO && (
        <Card className="w-full max-w-md gap-3 p-5">
          <div>
            <h2 className="text-sm font-semibold">Demo accounts</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Lucena Fresh Trading & Logistics (development seed). One account per desk.</p>
          </div>
          <ul className="grid gap-1">
            {DEMO_LOGINS.map((d) => {
              const Icon = ROLE_META[d.role].icon;
              return (
                <li key={d.email}>
                  <button
                    type="button"
                    onClick={() => signInAs(d.email)}
                    disabled={form.formState.isSubmitting}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 cursor-pointer"
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {ROLE_META[d.role].label} <span className="font-normal text-muted-foreground">· {d.name}</span>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{d.note}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </main>
  );
}
