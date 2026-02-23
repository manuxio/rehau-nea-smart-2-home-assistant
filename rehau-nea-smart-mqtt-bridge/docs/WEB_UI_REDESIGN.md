# Web UI Redesign - Sleek & Minimalist

## Overview
Complete redesign of the web UI to match a modern, sleek, and minimalist aesthetic inspired by premium thermostat interfaces.

## Key Design Changes

### 1. Dark Theme
- **Background**: Dark slate blue (#2a3441)
- **Cards**: Slightly lighter dark (#252d3a)
- **Text**: White primary, muted gray secondary
- **Accent Colors**:
  - Blue: #4a9eff (cool)
  - Green: #00d4aa (perfect/comfort)
  - Orange: #ff6b35 (warm/heat)

### 2. Circular Temperature Displays
- Large circular gauges with gradient arcs
- Temperature-based color coding:
  - Blue when below target
  - Green when at target
  - Orange when above target
- Clean typography with large, readable numbers
- Minimalist "°" degree symbol

### 3. Card Design
- Rounded corners (24px border-radius)
- Subtle shadows for depth
- Hover effects with smooth transitions
- Glass-morphism effects on headers

### 4. Typography
- System fonts for native feel
- Uppercase labels with letter-spacing
- Weight hierarchy (300-600)
- Negative letter-spacing for large numbers

### 5. Interactive Elements
- Smooth hover animations
- Subtle scale transforms
- Color transitions
- Active state indicators with top accent bars

### 6. Bottom Navigation
- Backdrop blur effect
- Active indicator with green accent bar
- Icon scale on hover
- Uppercase labels

## Files Modified

### Core Styles
- `src/index.css` - Global theme variables and base styles

### Pages
- `src/pages/Dashboard.tsx` & `.css` - Dashboard with dark cards
- `src/pages/Zones.tsx` & `.css` - Zone cards with circular temp displays
- `src/pages/ZoneDetail.tsx` & `.css` - Large circular display for zone control
- `src/pages/System.css` - System info with dark theme
- `src/pages/Settings.css` - Settings with dark cards
- `src/pages/Logs.css` - Logs viewer with dark theme
- `src/pages/Login.css` - Login page with dark card

### Components
- `src/components/BottomNav.css` - Modern navigation bar

## Design Principles

1. **Minimalism**: Remove unnecessary elements, focus on essential information
2. **Hierarchy**: Clear visual hierarchy through size, weight, and color
3. **Consistency**: Uniform spacing, border-radius, and transitions
4. **Accessibility**: High contrast ratios, readable font sizes
5. **Responsiveness**: Mobile-first approach with fluid layouts
6. **Performance**: CSS-only animations, no heavy libraries

## Color Palette

```css
--bg-primary: #2a3441      /* Main background */
--bg-secondary: #1e2530    /* Headers, nav */
--bg-card: #252d3a         /* Card backgrounds */
--text-primary: #ffffff    /* Main text */
--text-secondary: #8b95a5  /* Secondary text */
--accent-blue: #4a9eff     /* Cool/info */
--accent-green: #00d4aa    /* Success/perfect */
--accent-orange: #ff6b35   /* Warm/warning */
--shadow: 0 8px 32px rgba(0, 0, 0, 0.3)
```

## Build & Deploy

```bash
cd web-ui
npm run build
```

The built files are in `web-ui/dist/` and are automatically served by the bridge.

## Browser Support
- Modern browsers with CSS Grid and Flexbox
- CSS custom properties (variables)
- SVG support for circular displays
- Backdrop-filter for blur effects
