# Stitch Tracker

A local crochet stitch tracker based on `woobles_stitch_tracker.tsx`. Your computer hosts the app and saves one shared pattern. Your phone and computer see the same active row, stitch count, and completed rows. Screens refresh about once a second.

## Start on your Mac

Double-click **Start Stitch Tracker.command** in this folder. Leave the Terminal window open. The launcher builds and starts the app and prints the links for your computer and phone.

Or run:

```sh
cd stitch-tracker
npm ci
npm start
```

Requires Node.js 22.12 or newer. Dependencies need internet for the initial installation; once installed, the app runs entirely on your computer.

Open **http://localhost:3210** on your computer. On your phone, connect to the same Wi-Fi and open the **Phone** address printed in Terminal, such as `http://192.168.1.20:3210`. Use `http://`, and use the computer's network address on your phone.

If multiple phone addresses are printed, use the one for your Wi-Fi network. The address may change when you switch networks or your router assigns a new address. Bookmark the working address on your phone.

Keep the computer awake and the app running while using your phone. Press **Ctrl+C** in Terminal to stop; saved progress remains. Restart with the same launcher. If macOS asks whether Node can accept incoming network connections, allow it for phone access. If the phone cannot connect, check that both devices are on the same non-guest Wi-Fi and that a VPN or firewall is not blocking local connections.

## Saved progress

Rows sort automatically by their number: `Rnd 2`, `4`, `Rnd 10`. `Rnd 4` and `4` have the same sort position and keep their relative order; they remain separate rows. `Round` and `Row` prefixes also work. Labels without a leading row number appear last in their existing order. The active row stays selected when the list moves, and **Complete & Next** follows the sorted order.

Tap the pencil beside any row to edit its label, target, or pattern note, then choose **Save changes**. Editing a note does not automatically change its target. Existing stitches are kept; lowering a target below the current count is rejected, and increasing a target reopens a completed row. Cancel discards your draft. If another device edits the same row while your editor is open, saving is rejected so you can reopen the latest version without overwriting their changes.

Every row has a stitch progress bar, also shown larger on the active counter. A bracketed repeat such as `[2 sc, inc] x 6` makes six rounded sections of four output stitches. Each section fills as you count: at six stitches, the first section is full and the second is half full. The parser recognizes `sc`, `inc`, `dec`, `hdc`, `dc`, `tr`, `ch`, and `sl st`, with `x` or `×` for repetition. Unrecognized patterns, targets that disagree with the repeat, or more than 60 repeats use one continuous bar. The bar reflects the recorded stitch count, even if the row was manually marked complete.

All changes save to **data/pattern.json** on the computer before the app confirms them. Both devices share the active row as well as the count. Simultaneous stitch changes are applied individually, so one device cannot overwrite another device's count with an old copy. If disconnected, controls pause and the app reconnects automatically. If a request is interrupted, check the refreshed count before repeating the tap.

Technically, the browser sends a JSON action in an HTTP `POST /api/actions` request to the Node/Express server on your computer. The server applies that action to its current in-memory pattern, writes the new JSON to a temporary file, then renames it over `data/pattern.json` before replying with the updated state. Each browser polls `GET /api/state` about once per second. Revision numbers prevent an older response from replacing a newer one on screen. There is no browser localStorage or cloud database: the file is the persistent copy, and browser memory holds the displayed state and unsaved edit drafts. The server loads the saved file on restart.

Back up `data/pattern.json` to preserve your pattern. To restore a backup, stop the app, replace that file, and restart. If a save is damaged, the server stops rather than overwriting it. The original script's browser-only localStorage data is not imported automatically.

This app has no account or password: anyone who can reach the server on your network can use and change the shared pattern. Use it on your trusted home network. No router port forwarding or public hosting is needed.

## Development

```sh
npm test          # Shared updates, persistence, validation, and counter bounds
npm run build    # Type checking and bundled frontend
npm run serve    # Serve the last build, default port 3210
```

For frontend development, keep `npm run serve` running in one terminal and run `npm run dev` in another. The development server forwards API requests to port 3210.

Set `PORT=3211 npm start` to use another port. `HOST=127.0.0.1 npm start` restricts access to this computer. `DATA_FILE=/absolute/path/pattern.json npm start` selects another save file. Run only one server per save file.

The frontend uses React and the [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite). Express serves the built app and shared API; Vite is used for development and building, in line with its [deployment guidance](https://vite.dev/guide/static-deploy.html).
