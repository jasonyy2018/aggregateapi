import { auth } from "@/auth";
import { signInWithGoogle } from "./actions";
import { LandingClient } from "@/components/landing-client";

export default async function Home() {
  const session = await auth();

  return (
    <LandingClient
      isLoggedIn={!!session?.user}
      userEmail={session?.user?.email}
      signInAction={signInWithGoogle}
    />
  );
}
