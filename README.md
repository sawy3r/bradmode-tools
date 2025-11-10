# Bradmode Tools

A collection of practical web-based tools and calculators. Built with Next.js, TypeScript, and Tailwind CSS.

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ 
- npm, yarn, pnpm, or bun

### Development
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Build & Deploy
```bash
npm run build
npm run start
```

## 📦 Current Tools

### Australian Pay Calculator
Calculate payslip amounts, tax, superannuation, and year-to-date figures for Australian employees. Generates professional PDF payslips in multiple template styles (Xero-like, SAP-like, Simple, Government).

**Features:**
- Full Australian tax calculation (2024-25, 2025-26 tax years)
- Medicare levy & surcharge calculation
- Superannuation calculation
- Pre-tax and post-tax deductions
- Leave accrual tracking
- Multiple PDF template styles
- Batch payslip generation

## 🛠️ Adding a New Tool

### Step 1: Create the Component
Create your tool component in `src/components/tools/`:

```tsx
// src/components/tools/YourTool.tsx
'use client';

import React, { useState } from 'react';
import { YourIcon } from 'lucide-react';

const YourTool: React.FC = () => {
  const [input, setInput] = useState<string>('');
  
  return (
    <div className="max-w-7xl mx-auto p-6 bg-white">
      <div className="flex items-center gap-3 mb-8">
        <YourIcon className="w-8 h-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-gray-900">Your Tool Name</h1>
      </div>
      
      {/* Your tool UI here */}
    </div>
  );
};

export default YourTool;
```

### Step 2: Create the Page
Create a page in `src/app/tools/your-tool/`:

```tsx
// src/app/tools/your-tool/page.tsx
import YourTool from '@/components/tools/YourTool';

export default function YourToolPage() {
  return <YourTool />;
}
```

### Step 3: Add to Tools Index
Update `src/app/tools/page.tsx` to include your new tool:

```tsx
const tools = [
  // ... existing tools
  {
    name: 'Your Tool Name',
    description: 'Brief description of what your tool does',
    href: '/tools/your-tool',
    icon: YourIcon,
    status: 'ready' // or 'beta'
  }
];
```

### Step 4: Update Home Page
Add your tool to the home page grid in `src/app/page.tsx` using the same structure.

## 📁 Project Structure

```
bradmode-tools/
├── src/
│   ├── app/
│   │   ├── tools/
│   │   │   ├── pay-calculator/
│   │   │   │   └── page.tsx          # Pay calculator page
│   │   │   └── page.tsx               # Tools index page
│   │   ├── layout.tsx                 # Root layout
│   │   ├── page.tsx                   # Home page
│   │   └── globals.css                # Global styles
│   └── components/
│       └── tools/
│           ├── PayslipCalculator.tsx  # Pay calculator component
│           └── BarcodeGenerator.tsx   # Barcode generator component
├── public/                            # Static assets
├── AGENTS.md                          # Guidelines for AI coding agents
└── package.json
```

## 🎨 Code Style Guidelines

- **Client Components**: Add `'use client';` at the top of interactive components
- **Imports**: Group by React/Next.js, third-party libraries, local components, then types
- **Types**: Define interfaces above components, use TypeScript strict mode
- **Naming**: PascalCase for components/interfaces, camelCase for functions/variables
- **Path Aliases**: Use `@/*` for src imports (e.g., `import { Foo } from '@/components/Foo'`)
- **Section Comments**: Use dividers like `// ============ SECTION NAME ============`
- **Formatting**: Arrow functions for components, explicit return types for functions

## 🧪 Tech Stack

- **Framework**: Next.js 15.5.3 with App Router
- **Language**: TypeScript 5
- **UI**: React 19.1.0
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React
- **PDF Generation**: jsPDF with jsPDF-AutoTable

## 📝 Code Quality

```bash
# Lint code
npm run lint

# Build for production
npm run build
```

## 🤝 Contributing

1. Create a new tool following the structure above
2. Ensure TypeScript strict mode compliance
3. Test across different screen sizes (mobile, tablet, desktop)
4. Run `npm run lint` and fix any issues
5. Test the production build with `npm run build`

## 📄 License

© sawyer.net.au

---

**Note**: This is a personal collection of tools. Use at your own discretion. No warranty or support is provided.
