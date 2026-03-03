# Software Prototype Setup

## Setup Flow

1. Ask project name
2. Ask: "Do you want shadcn?" (Yes → install shadcn, No → plain Tailwind)
3. Ask: "Are you using Figma designs?" (Yes → run design rules setup after)
4. Create project directory
5. Run setup commands below
6. Copy CLAUDE.md and DESIGN_RULES.md to project
7. Git init + initial commit
8. Create GitHub repository

## Setup Commands

```
npm create vite@latest . -- --template react
npm install
npm install -D tailwindcss postcss autoprefixer @tailwindcss/postcss
```

**If shadcn: Yes**
```
npx shadcn@latest init
npx shadcn@latest add button card input form label
```
