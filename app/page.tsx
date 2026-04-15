import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-indigo-500 selection:text-white">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]"></div>
      
      <main className="relative flex flex-col items-center justify-center min-h-screen px-4 overflow-hidden">
        {/* Hero Section */}
        <div className="flex flex-col items-center justify-center text-center space-y-8 z-10 w-full max-w-4xl mx-auto">
          
          <div className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-sm text-zinc-300 backdrop-blur-xl">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
            v1.0 API Aggregator Now Live
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
            One API. Infinite Models. <br className="hidden md:block"/> Zero Hassle.
          </h1>
          
          <p className="mt-4 text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto">
            Route your LLM requests to OpenRouter, Together AI, or custom nodes automatically. Built-in SaaS billing, keys management, and token analytics.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mt-8 w-full sm:w-auto">
            <Link 
              href="/dashboard" 
              className="inline-flex items-center justify-center h-12 px-6 rounded-lg bg-white text-black font-medium transition-transform hover:scale-105"
            >
              Go to Dashboard
            </Link>
            <Link 
              href="/docs" 
              className="inline-flex items-center justify-center h-12 px-6 rounded-lg bg-zinc-900 border border-zinc-800 text-white font-medium transition-colors hover:bg-zinc-800"
            >
              Read the Docs
            </Link>
          </div>
        </div>

        {/* Feature Cards Showcase */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 mb-12 z-10 w-full max-w-6xl mx-auto">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-lg transition-colors hover:bg-white/10">
             <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3z"></path><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"></path></svg>
             </div>
             <h3 className="text-lg font-semibold text-white mb-2">Smart Routing</h3>
             <p className="text-zinc-400 text-sm">Automatically route requests to the most cost-effective or fastest provider like Together AI.</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-lg transition-colors hover:bg-white/10">
             <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
             </div>
             <h3 className="text-lg font-semibold text-white mb-2">Built-in Billing</h3>
             <p className="text-zinc-400 text-sm">Manage user balances, track token consumption, and integrate PayPal/Alipay payments instantly.</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-lg transition-colors hover:bg-white/10">
             <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-rose-500/20 text-rose-400 mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
             </div>
             <h3 className="text-lg font-semibold text-white mb-2">OpenAI Compatible</h3>
             <p className="text-zinc-400 text-sm">A seamless drop-in replacement for OpenAI API. Works with your favorite tools from Day 1.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
