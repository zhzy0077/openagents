# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Nuxt 4 application using:
- Vue 3.5+ with TypeScript
- Nuxt UI (@nuxt/ui) for component library
- ESLint for code linting
- pnpm as the package manager

## Common Commands

**Install dependencies:**
```bash
pnpm install
```

**Development server:**
```bash
pnpm dev
```
Server runs on http://localhost:3000

**Build for production:**
```bash
pnpm build
```

**Preview production build:**
```bash
pnpm preview
```

**Generate static site:**
```bash
pnpm generate
```

## Architecture

This is a minimal Nuxt starter project with the following structure:
- `app/` - Contains the main application code (currently just `app.vue`)
- `public/` - Static assets served at the root
- `.nuxt/` - Auto-generated Nuxt build files (do not edit)
- `nuxt.config.ts` - Nuxt configuration file

The TypeScript configuration uses Nuxt's auto-generated tsconfig files under `.nuxt/` directory.

## Package Manager

This project uses **pnpm** exclusively. All package management and script execution commands should use pnpm.
