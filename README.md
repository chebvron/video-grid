# Video Grid Annotator

A React + TypeScript application scaffolded with Vite that lets you place a
clickable grid overlay above a YouTube video. Capture points of interest along
the timeline, export coordinates, and fine-tune grid density to map any area of
focus.

## Features

- 🔗 Load any public YouTube video via URL or by providing its 11-character ID.
- #️⃣ Configure the capture grid with custom row and column counts.
- 🖱️ Click on the overlay to log the precise cell, coordinates, and video
  timestamp.
- 📍 Visual markers display every captured point on top of the video frame.
- 📋 Copy a JSON export of captured points or clear the set with a single click.

## Getting started

```bash
npm install
npm run dev
```

Open the development server URL shown in your terminal (default:
<http://localhost:5173/>) to interact with the app.

### Available scripts

- `npm run dev` – start the Vite development server.
- `npm run build` – create an optimized production bundle.
- `npm run preview` – preview the production build locally.
- `npm run lint` – run the default Vite ESLint configuration.

## Usage

1. Paste a YouTube link (or video ID) into the “Video source” input and press
   **Load video**.
2. Adjust the number of rows and columns to shape the overlay grid.
3. When the player finishes loading, click anywhere on the grid to capture the
   current timestamp and coordinates.
4. Review or export the captured data from the **Captured points** panel.

Captured points include:

- `time`: video timestamp in seconds.
- `row` / `column`: grid indices using 1-based numbering.
- `xPercent` / `yPercent`: precise position inside the frame (0–100%).

## Tech stack

- [React](https://react.dev)
- [Vite](https://vite.dev)
- [TypeScript](https://www.typescriptlang.org/)
- [react-youtube](https://github.com/troybetz/react-youtube) for the YouTube
  IFrame Player API integration

## License

This project is provided under the MIT license. See the [`LICENSE`](LICENSE)
file if one exists in your repository root.
