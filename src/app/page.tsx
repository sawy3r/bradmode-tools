import Link from 'next/link';
import { Calculator, Wrench } from 'lucide-react';

const tools = [
  {
    name: 'Australian Pay Calculator',
    description: 'Calculate payslip amounts, tax, super, and YTD figures for Australian employees',
    href: '/tools/pay-calculator',
    icon: Calculator,
    status: 'ready'
  },
  // Add more tools here as you build them
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Wrench className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Personal Tools</h1>
            </div>
            <nav className="flex space-x-8">
              <Link href="/" className="text-gray-600 hover:text-gray-900">
                Home
              </Link>
              <Link href="/tools" className="text-gray-600 hover:text-gray-900">
                Tools
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Useful Tools & Calculators
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            A collection of practical tools for everyday calculations and tasks.
            Built for personal use, shared for everyone.
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => {
            const IconComponent = tool.icon;
            return (
              <Link
                key={tool.name}
                href={tool.href}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200 hover:border-blue-300"
              >
                <div className="flex items-center mb-4">
                  <IconComponent className="h-8 w-8 text-blue-600 mr-3" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    {tool.name}
                  </h3>
                </div>
                <p className="text-gray-600 mb-4">{tool.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-600 font-medium">
                    Open Tool →
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    tool.status === 'ready' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {tool.status}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-gray-500">
          <p>Built with Next.js and hosted on Vercel</p>
        </footer>
      </main>
    </div>
  );
}// test
