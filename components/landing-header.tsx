"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";

export default function LandingHeader() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const isLoggedIn = !isPending && !!session;

  const handleSignOut = async () => {
    await signOut();
    router.refresh();
  };

  return (
    <header className="bg-primary text-white shadow-lg">
      <div className="container py-4">
        <div className="flex items-center justify-between">
          <Link href={isLoggedIn ? "/dashboard" : "/"}>
            <Image
              src="/logo.png"
              width={64}
              height={64}
              alt="MACHO App"
              className="rounded-lg"
            />
          </Link>
          <nav className="flex items-center gap-4">
            {isLoggedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-white/80 hover:text-white text-sm font-medium transition-colors"
                >
                  Dashboard
                </Link>
                <button
                  onClick={handleSignOut}
                  className="border-2 border-white/30 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-white/10 transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-white/80 hover:text-white text-sm font-medium transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="bg-white text-primary px-5 py-2 rounded-lg text-sm font-semibold hover:bg-white/90 transition-colors shadow-sm"
                >
                  Get Started
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}