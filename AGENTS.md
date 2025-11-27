# AutoQuiz Agent Guidelines

## Commands
- **Build**: `npm run build`
- **Dev**: `npm run dev`
- **Lint**: `npm run lint`
- **Start**: `npm run start`
- **Test**: No test framework configured

## Code Style

### Imports & Formatting
- Use absolute imports with `@/` prefix for internal modules
- Group imports: external libraries first, then internal modules
- Use `type` imports for types only: `import type { User } from "@supabase/supabase-js"`

### TypeScript
- Strict mode enabled
- Use explicit return types for functions
- Define interfaces/types for all data structures
- Use `Readonly<>` for immutable props

### React Components
- Use `"use client"` directive for client components
- Prefer function components with hooks
- Use `useTransition` for async operations
- Handle loading/error states explicitly

### Naming Conventions
- Components: PascalCase (e.g., `PdfUploader`)
- Functions: camelCase (e.g., `generateQuiz`)
- Variables: camelCase, descriptive names
- Files: kebab-case for utilities, PascalCase for components

### Error Handling
- Throw descriptive Error objects
- Use try/catch for async operations
- Validate inputs early in functions
- Handle user authentication checks

### Database/API
- Use Supabase server client for server actions
- Implement proper RLS policies
- Use RPC functions for atomic operations
- Handle webhook signatures securely