'use client';

import Link from 'next/link';
import { ArrowLeft, Wrench } from 'lucide-react';
import PayslipCalculator from '@/components/tools/PayslipCalculator';

export default function PayCalculatorPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Link href="/" className="flex items-center mr-4">
                <Wrench className="h-8 w-8 text-blue-600 mr-3" />
                <h1 className="text-2xl font-bold text-gray-900">Personal Tools</h1>
              </Link>
            </div>
            <nav className="flex items-center space-x-8">
              <Link 
                href="/" 
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Tools
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-8">
        <PayslipCalculator />
      </main>
    </div>
  );
}