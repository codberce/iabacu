import Link from "next/link";
const footerLinks = [
  { href: "/bacalaureat", label: "Bacalaureat" },
  { href: "/evaluare-nationala", label: "Evaluarea Națională" },
  { href: "/olimpiade", label: "Olimpiade" },
  { href: "/despre", label: "Despre iabacu" },
  { href: "/metodologie", label: "Surse și metodologie" },
  { href: "https://github.com/codberce/iabacu", label: "GitHub" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-white text-zinc-700">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link href="/" className="font-bold tracking-[-0.02em] text-emerald-800 hover:text-emerald-950">
          iabacu.ro
        </Link>
        <nav aria-label="Navigare subsol" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
          {footerLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-emerald-800">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
