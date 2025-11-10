# Agent Guidelines for bradmode-tools

## Build/Lint/Test Commands
- **Dev server**: `npm run dev`
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **No test suite configured**

## Tech Stack
- Next.js 15.5.3 with App Router
- React 19.1.0, TypeScript 5
- Tailwind CSS 4
- jsPDF for PDF generation

## Code Style
- **Client components**: Add `'use client';` at top of interactive components
- **Imports**: Group by: React/Next.js, third-party, local components, types
- **Types**: Define interfaces above components, use TypeScript strict mode
- **Naming**: PascalCase for components/interfaces, camelCase for functions/variables
- **Paths**: Use `@/*` alias for src imports (e.g., `import { Foo } from '@/components/Foo'`)
- **Comments**: Use section dividers like `// ============ SECTION NAME ============`
- **Formatting**: Use arrow functions for components, explicit return types for functions
- **Error handling**: Type all parameters and return values, avoid `any` types
