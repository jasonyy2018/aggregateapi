"use client"

import { useState } from "react"
import { signInWithCredentials } from "@/app/actions"

export function AdminLoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await signInWithCredentials(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div className="p-3 text-sm text-[#ff4d4f] bg-[#ff4d4f]/10 border border-[#ff4d4f]/20 rounded-lg">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-text-main">Email (Admin)</label>
        <input 
          type="email" 
          name="email" 
          required 
          className="w-full px-4 py-2 bg-bg-main border border-border-subtle rounded-lg focus:outline-none focus:border-brand-primary text-text-main placeholder:text-text-muted"
          placeholder="admin@example.com"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-text-main">Password</label>
        <input 
          type="password" 
          name="password" 
          required 
          className="w-full px-4 py-2 bg-bg-main border border-border-subtle rounded-lg focus:outline-none focus:border-brand-primary text-text-main placeholder:text-text-muted"
          placeholder="••••••••"
        />
      </div>
      <button 
        type="submit" 
        disabled={loading}
        className="w-full mt-2 py-2.5 bg-brand-primary text-brand-primary-text rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? "Authenticating..." : "Sign In"}
      </button>
    </form>
  )
}
