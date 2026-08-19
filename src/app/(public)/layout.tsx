import Link from 'next/link';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-[100dvh] font-sans bg-white">
      <header className="h-20 border-b border-slate-200/50 flex items-center justify-between px-6 md:px-12 z-10 sticky top-0 bg-white/80 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center">
            <img 
              src="https://upload.wikimedia.org/wikipedia/en/3/30/Indian_Institute_of_Technology_Mandi_Logo.png" 
              alt="IIT Mandi Logo" 
              className="h-12 w-auto object-contain"
            />
          </div>
          <div className="hidden sm:block">
            <span className="block font-serif font-semibold tracking-tight text-zinc-900 text-xl leading-none">Automated Ranking Portal</span>
            <span className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mt-1">IIT Mandi</span>
          </div>
        </div>
        <nav className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold text-zinc-600 hover:text-zinc-900 transition-colors hidden md:block">Home</Link>
          <div className="flex items-center gap-3 ml-2 border-l border-slate-200 pl-6">
            <Link href="/nodal-officer" className="text-sm font-semibold text-zinc-600 hover:text-zinc-900 transition-colors">Officer Portal</Link>
            <Link href="/admin" className="bg-zinc-900 hover:bg-black active:scale-[0.98] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md">
              Admin Login
            </Link>
          </div>
        </nav>
      </header>
      <main className="flex-1">
        {children}
      </main>
      <footer className="py-8 border-t border-slate-200/50 text-center text-zinc-500 text-sm">
        &copy; {new Date().getFullYear()} Indian Institute of Technology Mandi. All rights reserved.
      </footer>
    </div>
  );
}
