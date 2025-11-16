# CPReconcile Dashboard

Modern React dashboard built with Vite, TypeScript, Tailwind CSS, and shadcn/ui components.

## Features

- ✅ **Dark Mode** - Toggle between light and dark themes with persistent storage
- ✅ **Real-time Stats** - Live dashboard showing counts for all platforms
- ✅ **Platform Sync** - Sync data from Shopify, Razorpay, and Easyecom
- ✅ **Reconciliation** - Run reconciliation jobs and view results
- ✅ **Recent Runs** - Track history of reconciliation runs
- ✅ **Responsive Design** - Works on all device sizes

## Tech Stack

- **React 18** with TypeScript
- **Vite** for blazing fast development
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **Radix UI** primitives
- **Lucide React** for icons

## Getting Started

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The dashboard will be available at `http://localhost:5173`

The backend API should be running at `http://localhost:3000`

### Build for Production

```bash
# Build the project
npm run build

# Preview production build
npm run preview
```

## Components

### UI Components

- **Button** - Multiple variants (default, destructive, outline, secondary, ghost, link)
- **Card** - Container with header, content, and footer
- **Badge** - Status indicators with color variants
- **Switch** - Toggle for dark mode

### Theme

- **ThemeProvider** - Context provider for theme management
- **ThemeToggle** - Button to toggle between light/dark modes
- **CSS Variables** - HSL-based color system for easy theming

## API Integration

The dashboard connects to the backend API at `/api`:

- `GET /api/health/status` - System stats
- `POST /api/sync/:platform` - Sync platform data
- `POST /api/reconciliation/run` - Run reconciliation
- `GET /api/reconciliation/logs` - Get recent runs

## Dark Mode

Dark mode is implemented using:
- Tailwind's `dark:` class prefix
- CSS variables for colors
- LocalStorage for persistence
- System preference detection

Toggle dark mode using the sun/moon icon button in the header.

## Development

### File Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── ui/           # shadcn/ui components
│   │   ├── dashboard.tsx # Main dashboard
│   │   ├── theme-provider.tsx
│   │   └── theme-toggle.tsx
│   ├── lib/
│   │   └── utils.ts      # Utility functions
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css         # Global styles
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

### Adding New Components

1. Create component in `src/components/ui/`
2. Use the `cn()` utility for conditional classes
3. Follow shadcn/ui patterns for consistency

### Customizing Theme

Edit `src/index.css` to modify color variables:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 160 84% 39%;
  /* ... */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... */
}
```
