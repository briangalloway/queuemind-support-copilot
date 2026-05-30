# QueueMind Copilot - Design System Guidelines

This document outlines the design tokens, layout principles, and components for **QueueMind Copilot**, an AI-driven support operations Chrome extension sidebar.

## 🎨 Design Tokens

### Color Palette (Premium Dark Glassmorphism)

Our theme is built on a deep, dark glassmorphic layout optimized for technical support agent portals.

*   **Backgrounds**:
    *   `--bg-main`: `#0a0f1d` (Deep Midnight Blue)
    *   `--bg-card`: `rgba(22, 30, 49, 0.7)` (Translucent Dark Indigo-Slate)
    *   `--bg-card-hover`: `rgba(28, 38, 62, 0.85)` (Hover state highlight)
*   **Borders & Shadows**:
    *   `--border-glass`: `rgba(255, 255, 255, 0.06)` (Subtle reflective edge)
    *   `--border-glow`: `rgba(99, 102, 241, 0.2)` (Default focused or active card highlight)
*   **Brand & Accents**:
    *   `--primary-accent` (Zapier Orange): `#ff4f00` (Main brand color for active indicators, focus states)
    *   `--primary-glow`: `rgba(255, 79, 0, 0.15)` (Accent glow shadow)
    *   `--secondary-accent` (Indigo): `#6366f1` (Secondary branding and badges)
*   **High-Contrast Text Tokens (WCAG 2.1 AA Compliant)**:
    *   `--color-text-main`: `#f3f4f6` (High contrast off-white for primary labels)
    *   `--color-text-muted`: `#9ca3af` (Readable mid-gray for descriptions)
    *   `--color-text-dim`: `#949ea7` (Subtle metadata captions)
    *   `--color-primary-light`: `#ff8040` (Light Orange - used for tab text and coaching titles)
    *   `--color-secondary-light`: `#818cf8` (Light Indigo - used for links and ticket ID tags)
    *   `--color-success-light`: `#34d399` (Mint Green - used for positive sentiment and low complexity ratings)
    *   `--color-danger-light`: `#f87171` (Light Coral - used for negative sentiment and high complexity alerts)
*   **Default Status Accents (Non-Text Icons)**:
    *   `--color-success`: `#10b981` (Emerald Green)
    *   `--color-warning`: `#f59e0b` (Amber Orange)
    *   `--color-danger`: `#ef4444` (Rose Red)

### Typography

*   **System Fonts**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
*   **Monospace Font**: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` (used for Ticket IDs and raw code logs)
*   **Hierarchy**:
    *   App Title: `14px` Bold, `0.5px` Letter spacing
    *   Ticket Subjects: `15px` Bold, `1.35` Line height
    *   Standard Labels/Paragraphs: `13px`, `1.4` Line height
    *   Metadata/Badges: `10px`–`11px` Bold, `0.5px` Letter spacing for capitalized text

## 🧩 UI Component Standards

### 1. Glassmorphism Cards (`.section-card`)
All content blocks use card containers to layer visual information over the deep main background.
*   **Styling**: 
    *   `background: var(--bg-card)`
    *   `backdrop-filter: blur(12px)`
    *   `border: 1px solid var(--border-glass)`
    *   `border-radius: 12px`
*   **Behavior**: When hovered, cards slightly highlight border-color (`rgba(255, 255, 255, 0.09)`) and background to improve depth perception.

### 2. Tab Navigation
*   **Active Tab State**: Active text is styled with `--color-primary-light` and sits above a vertical `2px` border-bottom pill highlighted with `--primary-accent` and a neon orange accent glow.
*   **Inactive Tab State**: Muted labels transition smoothly to main text on hover.

### 3. Keyboard Focus Outline (`:focus-visible`)
To comply with WCAG 2.1 AA keyboard accessibility guidelines, all navigable elements (tabs, accordion headers, ticket list rows, and info icons) must render a glowing orange focus ring:
*   `outline: 2px solid var(--primary-accent);`
*   `outline-offset: -2px;`

### 4. Status Sentiment Indicators
Sentiment is represented both quantitatively (metric circles) and qualitatively (color badges):
*   **Critical Risk (Red)**: Urgency score $\ge 75$ or Sentiment $< 40$. Uses Coral text (`--color-danger-light`) for alerts and Rose Red (`--color-danger`) for status circles.
*   **Caution (Yellow)**: Sentiment $40$–$74$. Uses Amber text/border (`--color-warning`).
*   **Stable (Green)**: Sentiment $\ge 75$. Uses Mint Green text (`--color-success-light`) and Emerald Green (`--color-success`).
