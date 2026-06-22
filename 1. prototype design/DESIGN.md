---
name: SonicCube
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#849495'
  outline-variant: '#3a494b'
  surface-tint: '#00dbe7'
  primary: '#e1fdff'
  on-primary: '#00363a'
  primary-container: '#00f2ff'
  on-primary-container: '#006a71'
  inverse-primary: '#00696f'
  secondary: '#ebb2ff'
  on-secondary: '#520071'
  secondary-container: '#ce5dff'
  on-secondary-container: '#480064'
  tertiary: '#f9f6ff'
  on-tertiary: '#2f303b'
  tertiary-container: '#dad9e9'
  on-tertiary-container: '#5e5e6c'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#74f5ff'
  primary-fixed-dim: '#00dbe7'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f54'
  secondary-fixed: '#f8d8ff'
  secondary-fixed-dim: '#ebb2ff'
  on-secondary-fixed: '#320047'
  on-secondary-fixed-variant: '#74009f'
  tertiary-fixed: '#e2e1f1'
  tertiary-fixed-dim: '#c6c5d4'
  on-tertiary-fixed: '#1a1b26'
  on-tertiary-fixed-variant: '#454652'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  label-mono-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  panel-gap: 1px
---

## Brand & Style
The brand personality is high-precision, technical, and immersive. It targets audio engineers, researchers, and digital signal processing specialists who require absolute clarity in complex data environments. The design system leverages a **Cyber-Technical Glassmorphism** style, blending the utility of professional laboratory equipment with a futuristic, dark-mode aesthetic. 

The emotional response should be one of "controlled power"—users should feel they are operating a sophisticated instrument where every pixel serves a functional purpose. The interface utilizes translucent layers and vibrant blurs to create depth without sacrificing the density of information required for 3D spectral analysis.

## Colors
The palette is engineered for a low-light "control room" environment.
- **Primary (Electric Cyan):** Used for active data signals, primary action buttons, and critical frequency markers. It provides the highest luminosity against the dark background.
- **Secondary (Neon Magenta):** Reserved for peak indicators, transient alerts, and secondary data series to provide immediate visual distinction from the primary signal.
- **Surface/Tertiary:** A deep, desaturated charcoal-navy (#1A1B26) serves as the foundation, ensuring that the neon highlights do not cause eye strain during long sessions.
- **Neutral:** Mid-range grays are used for the 3D grid lines, axis labels, and inactive UI states to maintain a clear visual hierarchy.

## Typography
The typography system prioritizes legibility in high-density data views. 
- **Geist** is used for the primary UI framework, headings, and descriptive text, providing a clean, modern, and technical feel.
- **JetBrains Mono** is utilized for all numerical readouts, frequency values, timestamps, and coordinate data. The monospaced nature ensures that jumping digits in live meters remain stable and easy to track.
- Use uppercase for labels and small data points to enhance the "instrumental" aesthetic.

## Layout & Spacing
The layout follows a **Fixed-Panel Grid** system. The screen is divided into functional zones: a global toolbar, a primary 3D visualization viewport, and sidebars for spectral controls. 

- **The Grid:** A 12-column grid is used for the overlay UI, while the 3D viewport remains fluid.
- **The Gap:** Use a minimal 1px gap between glass panels to create a "tectonic" look where panels appear to be milled from the same dark glass substrate.
- **Breakpoints:** 
  - **Mobile (<768px):** Sidebars collapse into bottom sheets. The 3D view occupies the top 50% of the screen.
  - **Desktop (>1024px):** Multi-pane workflow with persistent frequency analyzers and parameter sliders.

## Elevation & Depth
Depth is achieved through **Glassmorphism and Internal Glow** rather than traditional drop shadows.
- **Base Layer:** The deepest navy background.
- **Glass Panels:** Background blur (20px) with a 10% white opacity fill. Each panel must have a 1px solid stroke (20% opacity white) to define its edge against the dark background.
- **Active State Elevation:** Elements in focus or "active" receive a subtle inner-glow (box-shadow: inset) using the Primary Electric Cyan color at 15% opacity.
- **3D Grid:** Rendered with a slight additive blend mode to appear as if it is projected light within the interface.

## Shapes
This design system utilizes a **Soft-Industrial** shape language. 
- A consistent `0.25rem` (4px) corner radius is applied to panels and buttons to maintain a precise, engineered appearance.
- Avoid large circular treatments unless used for dial/knob components, which are essential for audio frequency manipulation. 
- Data points in the 3D view should be rendered as sharp pixels or small cubes to emphasize the "SonicCube" theme.

## Components
- **Buttons:** Primary buttons use a solid Electric Cyan fill with black text. Ghost buttons use the primary color for the border and text, with a subtle backdrop blur.
- **Input Fields:** Stepper-style inputs are preferred over standard text boxes. They should appear as recessed glass wells with monospaced text.
- **Glass Cards:** All containers must feature the backdrop-blur effect. Information density should be high, using small monospaced labels to categorize data.
- **Sliders/Faders:** Vertical faders should mimic physical mixing console sliders, featuring a "track" glow when the value increases.
- **Frequency Meters:** High-refresh-rate vertical bars using a gradient from Electric Cyan to Neon Magenta for the top 10% of the range (the "peak" zone).
- **Checkboxes:** Square-shaped with a "cyan-pixel" checkmark for a digital, retro-tech feel.