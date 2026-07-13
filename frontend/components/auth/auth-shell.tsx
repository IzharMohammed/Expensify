import { Mic, ScanLine, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme/theme-toggle';

export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col xl:p-16">
        <div className="absolute -left-24 -top-32 h-96 w-96 rounded-full border border-primary-foreground/10" />
        <div className="absolute -left-10 -top-20 h-64 w-64 rounded-full border border-primary-foreground/10" />
        <Link className="relative flex items-center gap-3" href="/"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-foreground text-primary"><span className="font-display text-xl italic">L</span></span><span className="font-display text-2xl">Ledger</span></Link>
        <div className="relative my-auto max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary-foreground/55">Personal finance, clearly</p>
          <h2 className="mt-5 font-display text-6xl leading-[1.02] tracking-[-0.035em] xl:text-7xl">Know where your money goes.</h2>
          <p className="mt-6 max-w-lg text-base leading-7 text-primary-foreground/65">Capture expenses naturally, understand the patterns, and make progress without living in a spreadsheet.</p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            <Feature icon={Mic} label="Speak it" />
            <Feature icon={ScanLine} label="Scan it" />
            <Feature icon={ShieldCheck} label="Own your data" />
          </div>
        </div>
        <p className="relative text-xs text-primary-foreground/45">A calmer relationship with your money.</p>
      </section>

      <section className="flex min-h-screen flex-col p-5 sm:p-8 lg:p-12">
        <div className="flex items-center justify-between lg:justify-end">
          <Link className="flex items-center gap-2 lg:hidden" href="/"><span className="grid h-9 w-9 place-items-center rounded-[10px] bg-primary text-primary-foreground"><span className="font-display italic">L</span></span><span className="font-display text-xl">Ledger</span></Link>
          <ThemeToggle />
        </div>
        <div className="mx-auto my-auto w-full max-w-md py-12">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Welcome to Ledger</p>
          <h1 className="mt-3 font-display text-4xl tracking-[-0.025em] sm:text-5xl">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}

function Feature({ icon: Icon, label }: { icon: typeof Mic; label: string }) {
  return <div className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/[0.06] p-4"><Icon className="h-5 w-5" strokeWidth={1.7} /><p className="mt-3 text-xs font-semibold text-primary-foreground/70">{label}</p></div>;
}
