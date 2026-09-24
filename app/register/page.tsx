"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"passenger" | "driver">("passenger");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    // Phone is required: passengers and drivers need to be able to call
    // each other off-app once a trip is active.
    const trimmedPhone = phone.trim();
    if (trimmedPhone.replace(/\D/g, "").length < 7) {
      setError("Enter a valid phone number");
      return;
    }

    setLoading(true);

    try {
      const { error: signUpError } = await signUp.email({
        name,
        email,
        password,
        role,
      } as Parameters<typeof signUp.email>[0]);

      if (signUpError) {
        setError(signUpError.message || "Failed to create account");
        return;
      }

      // Persist the phone onto the freshly-created role profile. Best-effort:
      // registration has already succeeded, and users can also set it later
      // from the profile prompt, so a failure here must not block signup.
      try {
        await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: trimmedPhone }),
        });
      } catch {
        // ignore — profile can be completed later
      }

      // replace() so the register page does not linger in history (back
      // button would otherwise return to the form after signing up).
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            {/* <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-lg">
              K
            </div>
            <span className="text-xl font-bold">MACHO App</span> */}
            <img src={"/logo.png"} width={150} height={150} />
          </Link>
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-muted mt-2">
            Join Ghana's transportation platform
          </p>
        </div>

        <div className="card">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {/* Role Selection */}
          <div className="mb-6">
            <label className="label">I want to</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole("passenger")}
                className={`p-4 rounded-lg border-2 text-center transition ${
                  role === "passenger"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-muted"
                }`}
              >
                <div className="font-semibold text-sm">Transport Goods</div>
                <div className="text-xs text-muted mt-1">Passenger</div>
              </button>
              <button
                type="button"
                onClick={() => setRole("driver")}
                className={`p-4 rounded-lg border-2 text-center transition ${
                  role === "driver"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-muted"
                }`}
              >
                <div className="font-semibold text-sm">Haul Goods</div>
                <div className="text-xs text-muted mt-1">Driver</div>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="label">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="At least 8 characters"
                required
                minLength={8}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
                placeholder="Confirm your password"
                required
              />
            </div>

            <div>
              <label htmlFor="phone" className="label">
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
                placeholder="e.g. 024 123 4567"
                required
              />
              <p className="text-xs text-muted mt-1">
                Shared only with your matched {role === "driver" ? "customer" : "driver"} so you can call each other.
              </p>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm text-muted mt-6">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-primary font-medium hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
