# The Mobility Lab

**The Mobility Lab** is an interactive, browser-based simulation environment that explores the complex economic and social trade-offs of urban mobility policy. 

Built with React and Vite, the game challenges players to step into the role of a city's Transport Director. You must balance the municipal budget, manage traffic congestion, and ensure citizens can actually get where they need to go—all while navigating highly realistic urban challenges like induced demand, climate extremes, and demographic inequity.

## 🎮 Gameplay Overview

The simulation proceeds through progressively difficult scenarios, each introducing new layers of policy mechanics based on real-world transit economics research. Progress is tracked via a career menu, and cities are unlocked sequentially.

### 🏙️ City 1: Smallville
Learn the foundational economic tradeoff: taxing private ride-sharing (Uber) generates municipal revenue and cuts congestion, but reduces overall mobility. You must use that tax revenue to aggressively subsidize public buses to keep the city moving.

### 🌡️ City 2: Riverdale
Seasons matter. In larger cities, extreme weather (heatwaves and cold snaps) drives riders off uncomfortable buses and into ride-sharing, spiking congestion. You must proactively invest your budget into Bus AC & Heating to keep transit viable year-round.

### ⚖️ City 3: Gilded Hollow
Policies aren't one-size-fits-all. The city is split into wealthy and low-income demographics with drastically different price elasticities. A flat Uber tax is highly regressive, destroying poor mobility while the wealthy barely notice. You must carefully cross-subsidize transit systems to narrow the "Equity Gap" while avoiding bankruptcy.

## 🔗 Live Simulation
Access the live environment: [the-mobility-lab.vercel.app](https://the-mobility-lab.vercel.app)

## 📚 Academic Foundation
The mechanics, price sensitivities, and mode-substitution scenarios within this simulation are heavily inspired by modern transport economics research, specifically:
- **Christensen & Osman (2025):** *"Demand for Mobility"* 
- **Christensen & Osman (2023):** *"Weathering the Ride"*

## 💾 State & Persistence

The simulation features a robust persistence system using `localStorage`:
- **Career Progression**: Unlocked cities and tutorial completion are saved globally (`atlas_progress`).
- **City Saves**: If you exit to the menu during a city simulation, your month, budget, and policies are saved automatically (`atlas_save_cityX`). You can resume any active mission directly from the main menu.

## 🛠️ Technical Architecture

This repository uses a single-codebase, dual-environment approach:
- **Game Mode (Default)**: A premium, branded career experience with progression locking and onboarding.
- **Testbed Mode**: A developer-focused sandbox for rapid testing of specific cities and mechanics.
  - Access via: `http://localhost:5173/?testbed`

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) installed on your machine.

### Installation & Execution
1. Clone this repository.
2. Navigate into the project directory via your terminal.
3. Install the required dependencies:
   ```bash
   npm install
   ```
4. Start the local development server:
   ```bash
   npm run dev
   ```
5. Open your browser to `http://localhost:5173`.

## 📦 Technologies Used
- **React** – Component-based UI and complex state management.
- **Recharts** – Rendering end-of-year metric tracking and data visualizations.
- **Vite** – Fast, modern frontend tooling and bundling.

## 🤝 Contributing
Contributions, bug reports, and feature requests are welcome! 

## 📝 License
This project is licensed under the MIT License.
