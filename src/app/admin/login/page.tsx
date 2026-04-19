import { AdminLoginForm } from "./login-form"
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function AdminLoginPage() {
  const session = await auth()
  if (session) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-main">
      <div className="w-full max-w-md p-8 bg-bg-surface border border-border-subtle rounded-2xl shadow-xl">
        <div className="flex flex-col items-center mb-8 gap-3">
          <img src="/logo.jpg" alt="Logo" className="w-12 h-12 object-contain rounded-xl" />
          <h1 className="text-2xl font-bold text-text-main text-center">Administrator Login</h1>
          <p className="text-sm text-text-muted text-center">Enter your platform admin credentials to continue</p>
        </div>
        <AdminLoginForm />
      </div>
    </div>
  )
}
