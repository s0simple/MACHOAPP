import Link from "next/link";
import Image from "next/image";
import LandingHeader from "@/components/landing-header";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <LandingHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-primary via-primary-dark to-primary text-white overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/[0.03] rounded-full blur-3xl"></div>
          </div>

          <div className="container relative py-24 md:py-32 lg:py-40">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Text Content */}
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-4 mt-4">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  <span className="text-sm font-medium text-white/90">
                    Ghana's #1 Truck Platform
                  </span>
                </div>
                <h1 className="text-4xl md:text-4xl lg:text-5xl font-bold leading-[1.1] mb-8 tracking-tight">
                  Transport Your Goods{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500">
                    Anywhere
                  </span>{" "}
                  in Ghana
                </h1>
                <p className="text-md text-white/75 mb-10 leading-relaxed max-w-lg">
                  Connect with reliable truck drivers to transport your goods
                  across Ghana. Real-time tracking, transparent pricing, and
                  verified drivers — all in one platform.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link
                    href="/register"
                    className="bg-white text-primary px-8 py-4 rounded-xl font-bold text-md hover:bg-white/90 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
                  >
                    Request a Truck
                  </Link>
                  <Link
                    href="/register"
                    className="border-2 border-white/30 text-white px-8 py-4 rounded-xl font-bold text-md hover:bg-white/10 transition-all hover:-translate-y-0.5"
                  >
                    Register as Driver
                  </Link>
                </div>
                {/* Trust indicators */}
                <div className="flex items-center gap-8 mt-12 pt-8 border-t border-white/10">
                  <div>
                    <div className="text-2xl font-bold">500+</div>
                    <div className="text-sm text-white/60">
                      Verified Drivers
                    </div>
                  </div>
                  <div className="w-px h-10 bg-white/20"></div>
                  <div>
                    <div className="text-2xl font-bold">2,000+</div>
                    <div className="text-sm text-white/60">Deliveries</div>
                  </div>
                  <div className="w-px h-10 bg-white/20"></div>
                  <div>
                    <div className="text-2xl font-bold">16</div>
                    <div className="text-sm text-white/60">Regions</div>
                  </div>
                </div>
              </div>

              {/* Hero Image */}
              <div className="relative flex justify-center lg:justify-end">
                <div className="relative">
                  {/* Glow behind image */}
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-400/30 to-primary-light/30 rounded-3xl blur-3xl scale-110"></div>
                  <div className="absolute inset-0 bg-white/10 rounded-3xl blur-2xl scale-105"></div>
                  <Image
                    src="/vURflJPuBzRbD9rNz_VFl_DyKJBm0A.png"
                    width={640}
                    height={480}
                    alt="Truck transportation service in Ghana"
                    className="relative rounded-3xl shadow-2xl object-cover w-full max-w-[640px] h-auto border border-white/10"
                    priority
                  />
                  {/* Floating badge */}
                  <div className="absolute -bottom-4 -left-4 bg-white text-primary rounded-2xl shadow-xl px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-green-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="font-bold text-sm">
                          Verified & Insured
                        </div>
                        <div className="text-xs text-muted">
                          All drivers checked
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Floating rating badge */}
                  <div className="absolute -top-4 -right-4 bg-white text-primary rounded-2xl shadow-xl px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <svg
                            key={star}
                            className="w-4 h-4 text-amber-400 fill-current"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <span className="font-bold text-sm">4.8</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features / How It Works */}
        <section className="py-20 bg-surface">
          <div className="container">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold mb-4">How It Works</h2>
              <p className="text-muted max-w-2xl mx-auto">
                Get your goods transported in three simple steps. Our platform
                makes it easy to connect with verified drivers across Ghana.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="card text-center hover:shadow-lg transition-shadow">
                <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-5">
                  <span className="text-primary font-bold text-2xl">1</span>
                </div>
                <h3 className="font-semibold text-lg mb-3">
                  Post Your Request
                </h3>
                <p className="text-muted text-sm leading-relaxed">
                  Enter pickup and destination locations, describe your goods,
                  and specify weight and dimensions.
                </p>
              </div>
              <div className="card text-center hover:shadow-lg transition-shadow">
                <div className="w-14 h-14 bg-secondary/10 rounded-xl flex items-center justify-center mx-auto mb-5">
                  <span className="text-secondary font-bold text-2xl">2</span>
                </div>
                <h3 className="font-semibold text-lg mb-3">Get Matched</h3>
                <p className="text-muted text-sm leading-relaxed">
                  Our intelligent system matches you with the best available
                  trucks based on location, capacity, and price.
                </p>
              </div>
              <div className="card text-center hover:shadow-lg transition-shadow">
                <div className="w-14 h-14 bg-amber-50 rounded-xl flex items-center justify-center mx-auto mb-5">
                  <span className="text-amber-600 font-bold text-2xl">3</span>
                </div>
                <h3 className="font-semibold text-lg mb-3">Track & Deliver</h3>
                <p className="text-muted text-sm leading-relaxed">
                  Track your goods in real-time with GPS. Get notifications at
                  every step until delivery is complete.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-20">
          <div className="container">
            <div className="stats-grid max-w-4xl mx-auto">
              <div className="stat-card text-center hover:shadow-md transition-shadow">
                <div className="stat-value text-primary">500+</div>
                <div className="stat-label">Verified Drivers</div>
              </div>
              <div className="stat-card text-center hover:shadow-md transition-shadow">
                <div className="stat-value text-secondary">2,000+</div>
                <div className="stat-label">Deliveries Completed</div>
              </div>
              <div className="stat-card text-center hover:shadow-md transition-shadow">
                <div className="stat-value text-amber-500">16</div>
                <div className="stat-label">Regions Covered</div>
              </div>
              <div className="stat-card text-center hover:shadow-md transition-shadow">
                <div className="stat-value text-primary">4.8</div>
                <div className="stat-label">Average Rating</div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-gradient-to-br from-primary-dark to-primary text-white">
          <div className="container text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-white/80 mb-8 max-w-lg mx-auto leading-relaxed">
              Whether you need to transport goods or you're a driver looking for
              haulage opportunities, MACHO App connects you to the right people.
            </p>
            <div className="flex justify-center gap-4">
              <Link
                href="/register"
                className="bg-white text-primary px-7 py-3 rounded-lg font-semibold hover:bg-white/90 transition-colors shadow-md"
              >
                Create Account
              </Link>
              <Link
                href="/login"
                className="border-2 border-white/30 text-white px-7 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <Image
              src="/logo.png"
              width={48}
              height={48}
              alt="MACHO App"
              className="rounded-lg"
            />
            <p className="text-muted text-sm">
              &copy; 2026 MACHO App. Ghana's Truck Transportation System. All
              rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
