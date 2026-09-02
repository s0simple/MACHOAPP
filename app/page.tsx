import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <header className="bg-primary text-white">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center font-bold text-lg">
                K
              </div>
              <span className="text-xl font-bold">MACHO App</span>
            </div>
            <nav className="flex items-center gap-4">
              <Link href="/login" className="text-white/80 hover:text-white text-sm font-medium">
                Sign In
              </Link>
              <Link href="/register" className="bg-white text-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/90">
                Get Started
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-primary text-white py-20">
          <div className="container">
            <div className="max-w-3xl">
              <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
                Ghana's Trusted Truck Transportation Platform
              </h1>
              <p className="text-lg text-white/80 mb-8 max-w-2xl">
                Connect with reliable truck drivers to transport your goods across Ghana. 
                Real-time tracking, transparent pricing, and verified drivers — all in one platform.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/register"
                  className="bg-white text-primary px-6 py-3 rounded-lg font-semibold hover:bg-white/90 transition"
                >
                  Request a Truck
                </Link>
                <Link
                  href="/register"
                  className="border border-white/30 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/10 transition"
                >
                  Register as Driver
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 bg-surface">
          <div className="container">
            <h2 className="text-2xl font-bold text-center mb-12">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="card text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-primary font-bold text-xl">1</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">Post Your Request</h3>
                <p className="text-muted text-sm">
                  Enter pickup and destination locations, describe your goods, and specify weight and dimensions.
                </p>
              </div>
              <div className="card text-center">
                <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-secondary font-bold text-xl">2</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">Get Matched</h3>
                <p className="text-muted text-sm">
                  Our intelligent system matches you with the best available trucks based on location, capacity, and price.
                </p>
              </div>
              <div className="card text-center">
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-amber-600 font-bold text-xl">3</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">Track & Deliver</h3>
                <p className="text-muted text-sm">
                  Track your goods in real-time with GPS. Get notifications at every step until delivery is complete.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-16">
          <div className="container">
            <div className="stats-grid max-w-4xl mx-auto">
              <div className="stat-card text-center">
                <div className="stat-value text-primary">500+</div>
                <div className="stat-label">Verified Drivers</div>
              </div>
              <div className="stat-card text-center">
                <div className="stat-value text-secondary">2,000+</div>
                <div className="stat-label">Deliveries Completed</div>
              </div>
              <div className="stat-card text-center">
                <div className="stat-value text-accent">16</div>
                <div className="stat-label">Regions Covered</div>
              </div>
              <div className="stat-card text-center">
                <div className="stat-value text-primary">4.8</div>
                <div className="stat-label">Average Rating</div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-surface">
          <div className="container text-center">
            <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-muted mb-8 max-w-lg mx-auto">
              Whether you need to transport goods or you're a driver looking for haulage opportunities, 
              MACHO App connects you to the right people.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/register" className="btn btn-primary">
                Create Account
              </Link>
              <Link href="/login" className="btn btn-outline">
                Sign In
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">
                K
              </div>
              <span className="font-semibold">MACHO App</span>
            </div>
            <p className="text-muted text-sm">
              &copy; 2026 MACHO App. Ghana's Truck Transportation System. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}