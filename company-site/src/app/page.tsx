import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-6 text-white drop-shadow-lg">
          Expression in the Language of Life
        </h1>
        <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl">
          Think Pichia - Get from gene to protein with BioGrammatics as your guide.
        </p>
        <div className="flex gap-4 flex-wrap justify-center">
          <Link
            href="/vectors"
            className="glass-button text-white px-8 py-3 rounded-lg text-lg"
          >
            Browse Vectors
          </Link>
          <Link
            href="/pichia_strains"
            className="px-8 py-3 rounded-lg text-lg bg-white/20 backdrop-blur border border-white/30 text-white hover:bg-white/30 transition-all"
          >
            View Strains
          </Link>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="glass-panel p-8 md:p-12 text-center">
            <p className="text-lg md:text-xl text-gray-700 leading-relaxed">
              At BioGrammatics, our mission is to advance scientific research and catalyze
              innovation to meet global challenges. Our strategy is to provide superior protein
              expression solutions, anchored by the capabilities of the methylotrophic yeast{" "}
              <em>Pichia pastoris</em> and customized to the unique demands of each of our clients.
              Over the past two decades, this commitment has facilitated significant progress in
              research, development and commercialization of Pichia produced proteins worldwide.
            </p>
          </div>
        </div>
      </section>

      {/* Products & Services Grid */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Pichia Reagents */}
            <div className="glass-panel p-8">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">Pichia Reagents</h2>
              <p className="text-gray-600 mb-6">
                Ready-to-use molecular tools for your research. High-quality vectors and
                strains optimized for reliable protein expression.
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  High-quality expression vectors
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  Optimized <em>Pichia pastoris</em> strains
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  DNA synthesis subscriptions
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  Immediate availability
                </li>
              </ul>
              <Link
                href="/products"
                className="inline-block glass-button text-white px-6 py-2 rounded-lg"
              >
                View Products
              </Link>
            </div>

            {/* Custom Projects */}
            <div className="glass-panel p-8">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">Custom Projects</h2>
              <p className="text-gray-600 mb-6">
                Tailored solutions for your specific protein expression needs. From strain
                generation to full-service project management.
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  Custom strain generation
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  Expression testing & optimization
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  Full-service project management
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  Expert consultation
                </li>
              </ul>
              <Link
                href="/services"
                className="inline-block glass-button text-white px-6 py-2 rounded-lg"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Path to Protein */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="glass-panel p-8 md:p-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-800 text-center">
              Your Path to Protein
            </h2>
            <p className="text-gray-600 mb-8 text-center text-lg">
              Our interactive tool helps you navigate the entire protein expression journey.
            </p>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-blue-600 font-bold">1-6</span>
                </div>
                <p className="text-sm text-gray-700">Guided steps from gene to protein</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-purple-600 font-bold">DIY</span>
                </div>
                <p className="text-sm text-gray-700">Mix DIY and service options</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-green-600 font-bold">$</span>
                </div>
                <p className="text-sm text-gray-700">Instant pricing estimates</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-orange-600 font-bold">Pro</span>
                </div>
                <p className="text-sm text-gray-700">Expert recommendations</p>
              </div>
            </div>
            <div className="text-center">
              <Link
                href="/path-to-protein"
                className="inline-block glass-button text-white px-8 py-3 rounded-lg text-lg"
              >
                Start Your Journey
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose BioGrammatics */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold mb-12 text-white text-center drop-shadow-lg">
            Why Choose BioGrammatics?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="glass-panel p-8 text-center">
              <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-800">Expertise</h3>
              <p className="text-gray-600">
                Decades of experience in Pichia protein expression systems
              </p>
            </div>
            <div className="glass-panel p-8 text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-800">Speed</h3>
              <p className="text-gray-600">
                Fast turnaround times to accelerate your research
              </p>
            </div>
            <div className="glass-panel p-8 text-center">
              <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-800">Quality</h3>
              <p className="text-gray-600">
                Rigorous quality control for reliable results
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 mt-16">
        <div className="container mx-auto max-w-5xl">
          <div className="glass-panel p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-gray-600">
                &copy; 2026 BioGrammatics. All rights reserved.
              </p>
              <div className="flex gap-6">
                <Link href="/privacy" className="text-gray-600 hover:text-gray-800">
                  Privacy Policy
                </Link>
                <Link href="/cookies" className="text-gray-600 hover:text-gray-800">
                  Cookie Policy
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
