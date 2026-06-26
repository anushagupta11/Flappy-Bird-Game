# Implementation Plan - Find My Worm (Bird and Worm [MintFire])

A premium Flappy Bird-inspired game called **Find_My_Worm** developed by **Bird and Worm [MintFire]** using Vite + TypeScript and Firebase. The player controls a cute bird navigating through vertical obstacles (buildings/pipes) and dodging randomly spawned enemies (bees/ladybugs) while collecting worms for bonus points. It features smooth physics, parallax scrolling backgrounds, a dynamic Web Audio SFX engine, and a global leaderboard integrated with Firebase Firestore (with local storage fallback).

---

## User Review Required

> [!IMPORTANT]
> **Firebase Setup & Fallback**
> Since we do not have pre-configured Firebase project credentials, the game will include a **Local Storage Fallback** out of the box. 
> - A settings panel will allow you to paste your Firebase Configuration directly in the browser to sync scores in real-time.
> - Alternatively, you can configure it via a `.env` file (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, etc.) before building.
> - The leaderboard will display global scores when Firebase is connected, and local high scores otherwise.

---

## Proposed Architecture & File Structure

We will create a Vite TypeScript project. The game UI overlays will be built using modern, clean HTML/CSS with standard Vite assets, and the game loop will render on an HTML5 `<canvas>` for maximum performance and buttery-smooth 60fps animations.

```
Find-My-Bird-Game/
├── .env.example              # Template for Firebase environment variables
├── index.html                # Main game shell (UI overlays and Canvas mount)
├── package.json              # App dependencies (firebase, vite, typescript)
├── tsconfig.json             # TypeScript configuration
├── vite.config.ts            # Vite bundler configuration
├── src/
│   ├── main.ts               # App initialization and entry point
│   ├── style.css             # Main styling (Glassmorphism, gradients, animations)
│   ├── firebase.ts           # Firebase connection and leaderboard services
│   ├── game/
│   │   ├── AudioManager.ts   # Web Audio API retro synthesizer for sound effects
│   │   ├── Background.ts     # Parallax background scrolling manager
│   │   ├── Bird.ts           # Player bird controller (physics, jump, tilt, collision box)
│   │   ├── Engine.ts         # Main game loop, state controller, and collision detection
│   │   ├── Obstacles.ts      # Pipes/Buildings & randomly spawned moving enemies
│   │   └── Particle.ts       # Feather & worm collection particle system
```

---

## Proposed Changes

### Component 1: Project Setup

#### [NEW] [package.json](file:///c:/Users/sg130/OneDrive/Desktop/Flappy-Bird-Game/package.json)
Contains project script configurations and dependencies, including:
- `vite` and `typescript` as build tools.
- `firebase` client SDK.

#### [NEW] [tsconfig.json](file:///c:/Users/sg130/OneDrive/Desktop/Flappy-Bird-Game/tsconfig.json)
Standard modern TypeScript configuration for browser-targeted bundle.

#### [NEW] [vite.config.ts](file:///c:/Users/sg130/OneDrive/Desktop/Flappy-Bird-Game/vite.config.ts)
Vite configuration for building the application.

#### [NEW] [.env.example](file:///c:/Users/sg130/OneDrive/Desktop/Flappy-Bird-Game/.env.example)
Example environment file containing placeholder variables for Firebase configuration.

---

### Component 2: Frontend Layout and Styling

#### [NEW] [index.html](file:///c:/Users/sg130/OneDrive/Desktop/Flappy-Bird-Game/index.html)
The HTML template containing:
- Canvas element for rendering the game.
- Start screen overlay (Title logo, play button, skin selector, developer credits, leaderboard).
- Game-over overlay (Score display, name input form, leaderboard, restart button).
- In-game HUD (Live score, worms collected, pause button).
- Configuration overlay (To paste Firebase settings on the fly).

#### [NEW] [style.css](file:///c:/Users/sg130/OneDrive/Desktop/Flappy-Bird-Game/src/style.css)
Vanila CSS implementation styling the screens with:
- Outfit or Inter Google Fonts for high-quality modern typography.
- Glassmorphic panels with blur and subtle shadows.
- Micro-animations (hover transitions, score pop-ups, pulsating buttons).
- Dynamic gradients (sunset sky motif, golden accents for high scores).

---

### Component 3: Firebase Database Layer

#### [NEW] [firebase.ts](file:///c:/Users/sg130/OneDrive/Desktop/Flappy-Bird-Game/src/firebase.ts)
A database module that manages:
- Reading env variables or local browser configurations.
- Initializing the Firestore connection.
- `saveHighScore(name, score, worms)`: Saves score to Firestore database (or falls back to `localStorage` on connection error or missing keys).
- `getLeaderboard()`: Fetches top 10 scores (global if online, local if offline).

---

### Component 4: Game Engine & Logic

#### [NEW] [AudioManager.ts](file:///c:/Users/sg130/OneDrive/Desktop/Flappy-Bird-Game/src/game/AudioManager.ts)
Web Audio API synthesizer to generate standard retro arcade sounds without needing asset files:
- *Jump Sound*: Short pitch sweep upwards.
- *Point Sound*: High double-tone chime.
- *Worm Collect*: Soft sparkling tone.
- *Hit Sound*: Hard noise decay.
- *Background Music*: Optional simple low-volume synth track.

#### [NEW] [Bird.ts](file:///c:/Users/sg130/OneDrive/Desktop/Flappy-Bird-Game/src/game/Bird.ts)
Handles the player object:
- Gravitational pull and jumping physics (clamped velocity, rotation matching vertical velocity).
- Multiple skins (e.g., Orange Flapper, Blue Jet, Golden Phoenix) selectable from the UI.
- Precise circular and bounding-box collision parameters.

#### [NEW] [Obstacles.ts](file:///c:/Users/sg130/OneDrive/Desktop/Flappy-Bird-Game/src/game/Obstacles.ts)
Handles obstacles in the path:
- **Pipes/Buildings**: Pairs of vertical columns moving leftward, with randomized gap heights.
- **Random Objects**: Floating pests (bees, ladybugs) that move up and down or speed across the screen horizontally, requiring additional evasion.
- **Worms**: Floating worm collectibles placed in challenging spots (inside gaps, above pipes) that award bonus points.

#### [NEW] [Background.ts](file:///c:/Users/sg130/OneDrive/Desktop/Flappy-Bird-Game/src/game/Background.ts)
Renders a scrolling parallax scene (sky background, distant clouds, cityscape, scrolling grass ground) matching the player's speed.

#### [NEW] [Particle.ts](file:///c:/Users/sg130/OneDrive/Desktop/Flappy-Bird-Game/src/game/Particle.ts)
Adds juice to the gameplay by spawning particle bursts when:
- The bird flaps (spawns subtle feathers).
- The bird collects a worm (spawns sparkling green/gold dust).
- The bird collides with an obstacle (spawns shockwave dust).

#### [NEW] [Engine.ts](file:///c:/Users/sg130/OneDrive/Desktop/Flappy-Bird-Game/src/game/Engine.ts)
The central game loop coordinator:
- Integrates Canvas context, screen scaling, and input events (Tap/Click/Spacebar).
- Coordinates update and render cycles of background, bird, obstacles, worms, and particles.
- Performs collision detection (Bird vs. Floor, Bird vs. Ceiling, Bird vs. Pipes, Bird vs. Random Obstacles).
- Increments live scores when pipes are successfully cleared.
- Manages game states: `START`, `PLAYING`, `PAUSED`, `GAMEOVER`.

---

## Verification Plan

### Automated Tests
- Since it is a Canvas-based game, verification will center on visual execution and browser runtime performance.
- We will run the Vite development server to test features interactively.

### Manual Verification
- **Gameplay Smoothness**: Run the browser subagent to verify 60fps scrolling, jump reactivity, and obstacle generation.
- **Collision Boundaries**: Verify that hitting the top edge (ceiling) and bottom edge (ground) triggers Game Over, as well as hitting buildings or flying insects.
- **Score Counter & Leaderboard**: Confirm scores increment correctly and database items persist locally or upload to Firebase upon game over.
- **Responsive Layout**: Verify the interface adjusts perfectly on mobile screens as well as desktop viewports.
- **Web Audio Sound Effects**: Verify sound plays correctly during jumps, point scoring, and crashes.
