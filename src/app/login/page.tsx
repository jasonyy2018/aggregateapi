import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LoginClient } from "./login-client";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();
  
  // If already logged in, send them straight to dashboard
  if (session?.user) {
    redirect("/dashboard");
  }

  // Pre-load invitation code from cookies if they clicked an invite link earlier
  const cookieStore = await cookies();
  const referralCookie = cookieStore.get("referral_code")?.value || "";

  return (
    <div className="min-h-screen bg-bg-main text-text-main flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Visual background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[-10%] w-[50%] h-[300px] bg-brand-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[10%] right-[-10%] w-[50%] h-[300px] bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex flex-col items-center">
          <img src="/logo.jpg" alt="Logo" className="w-16 h-16 object-contain rounded-2xl shadow-md mb-4" />
          <h2 className="text-3xl font-extrabold tracking-tight text-center bg-gradient-to-r from-brand-primary to-purple-500 bg-clip-text text-transparent">
            AggregatAPI Gateway
          </h2>
          <p className="mt-2 text-sm text-text-muted text-center">
            Deploy, scale, and aggregate 100+ AI models seamlessly
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <LoginClient initialReferralCode={referralCookie} />
      </div>
    </div>
  );
}
