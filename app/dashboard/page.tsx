import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await auth()
  
  // Need MVP mocked state if no DB is connected, but for structural MVP we can show data
  // if (!session) {
  //   redirect('/api/auth/signin')
  // }

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 bg-zinc-950 p-6 flex flex-col hidden md:flex">
        <div className="font-bold text-xl mb-12 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
          AggregatAPI
        </div>
        <nav className="space-y-4 flex-1">
          <Link href="/dashboard" className="block px-4 py-2 rounded-lg bg-white/10 text-white font-medium hover:bg-white/15 transition-colors">
            Overview
          </Link>
          <Link href="/dashboard/keys" className="block px-4 py-2 rounded-lg text-zinc-400 hover:bg-white/5 transition-colors">
            API Keys
          </Link>
          <Link href="/dashboard/billing" className="block px-4 py-2 rounded-lg text-zinc-400 hover:bg-white/5 transition-colors">
            Billing & Usage
          </Link>
        </nav>
        <div className="mt-auto border-t border-white/10 pt-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
            {session?.user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{session?.user?.name || 'Developer'}</span>
            <span className="text-xs text-zinc-500 truncate w-32">{session?.user?.email || 'dev@example.com'}</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex items-center justify-between mb-10">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors">
            Top Up Balance
          </button>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="p-6 rounded-2xl bg-zinc-900 border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
               <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            </div>
            <h3 className="text-zinc-400 text-sm font-medium mb-1">Available Balance</h3>
            <p className="text-3xl font-bold">$12.50</p>
          </div>
          
          <div className="p-6 rounded-2xl bg-zinc-900 border border-white/10 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
               <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
            </div>
            <h3 className="text-zinc-400 text-sm font-medium mb-1">Requests (30d)</h3>
            <p className="text-3xl font-bold mt-1">45,231</p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900 border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
               <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4l3 3"></path></svg>
            </div>
            <h3 className="text-zinc-400 text-sm font-medium mb-1">Avg Latency</h3>
            <p className="text-3xl font-bold mt-1 text-emerald-400">420ms</p>
          </div>
        </div>

        {/* Recent Usage Log Table */}
        <div className="rounded-2xl border border-white/10 bg-zinc-900 overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-semibold">Recent API Calls</h2>
          </div>
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="bg-zinc-950/50 text-zinc-300">
              <tr>
                <th className="px-6 py-4 font-medium">Time</th>
                <th className="px-6 py-4 font-medium">Model</th>
                <th className="px-6 py-4 font-medium">Tokens</th>
                <th className="px-6 py-4 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4">2 mins ago</td>
                <td className="px-6 py-4"><span className="px-2 py-1 bg-white/10 rounded text-xs text-white">openai/gpt-4o</span></td>
                <td className="px-6 py-4">1,240</td>
                <td className="px-6 py-4 text-emerald-400">-$0.0024</td>
              </tr>
              <tr className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4">15 mins ago</td>
                <td className="px-6 py-4"><span className="px-2 py-1 bg-white/10 rounded text-xs text-white">meta-llama/Llama-3-8b</span></td>
                <td className="px-6 py-4">521</td>
                <td className="px-6 py-4 text-emerald-400">-$0.0002</td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
