# Gin Rummy Card Game

A web-based implementation of the classic Gin Rummy card game using PixiJS and GSAP.

## Overview

This game is a browser-based Gin Rummy card game with the following features:
- Responsive design that works on both desktop and mobile
- Clean, attractive card game interface
- Animated card dealing and gameplay
- Touch-friendly controls
- Progressive Web App (PWA) support for installation on devices

## Setup Instructions

### Prerequisites
- A web server (like http-server, live-server, or any other static file server)
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. Clone this repository
```
git clone <repository-url>
```

2. Navigate to the project directory
```
cd gin-rummy-card-game
```

3. Install dependencies
```
npm install
```

4. Start the local development server
```
npm start
```

5. Open your browser and navigate to `http://localhost:8080`

### Project Structure

```
├── assets/                 # Game assets
│   ├── cards/              # Card images
│   │   ├── clubs/          # Club suit cards
│   │   ├── diamonds/       # Diamond suit cards
│   │   ├── hearts/         # Heart suit cards
│   │   └── spades/         # Spade suit cards
│   ├── CardBack_Blue.webp   # Card back design
│   ├── background.webp      # Game background
│   ├── blue_avatar.webp     # Player avatar
│   ├── red_avatar.webp      # Opponent avatar
│   ├── settingsButton.webp  # Settings button
│   ├── newGameButton.webp   # New game button
│   ├── Top_navigation.webp  # Top navigation bar
│   ├── TopBanner.webp       # Top banner with ad
│   ├── logo_192.webp        # App icon (192x192)
│   └── logo_512.webp        # App icon (512x512)
├── index.html              # Main HTML file
├── game.js                 # Game implementation
├── manifest.json           # PWA manifest
├── service-worker.js       # Service worker for offline support
├── package.json            # NPM package configuration
└── README.md               # This file
```

## Game Rules

Gin Rummy is a classic card game where the objective is to collect sets (3 or 4 cards of the same rank) and runs (3 or more consecutive cards of the same suit).

### Basic Rules:
1. Each player is dealt 10 cards
2. Players take turns drawing a card (from the deck or discard pile) and discarding a card
3. A player can "knock" when their deadwood (unmatched cards) is 10 points or less
4. Face cards (J, Q, K) are worth 10 points, Aces are worth 1 point, and number cards are worth their face value
5. The game ends when a player knocks or the deck is depleted

## Development

This game is built with:
- [PixiJS](https://pixijs.com/) - for 2D rendering
- [GSAP](https://greensock.com/gsap/) - for animations
- Standard HTML5, CSS3, and JavaScript

### Building for Production

To build the project for production:

```
npm run build
```

This will create a `dist` folder with all the necessary files to deploy the game.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Card assets and game design inspired by classic card games
- Built with PixiJS and GSAP libraries