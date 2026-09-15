# Tideman Alternative Vote

Static site for public polls decided by the Tideman Alternative method (Smith set, then instant-runoff elimination). Hosted on GitHub Pages; poll and vote data live in a Firebase Realtime Database.

## Setup

1. Create a Firebase project at https://console.firebase.google.com and add a Realtime Database.
2. In the database's **Rules** tab, paste the contents of `database.rules.json` and publish. Polls and votes become write-once and publicly readable.
3. Set `DB_URL` at the top of `app.js` to the database URL (for example `https://<project>-default-rtdb.firebaseio.com`).
4. Enable GitHub Pages for this repository (Settings → Pages → deploy from the `main` branch, root folder).

## Files

- `index.html` – page shell and styles
- `app.js` – poll creation, voting, results, routing (`#p/<id>` vote, `#r/<id>` results)
- `tideman.js` – the election method
- `database.rules.json` – Firebase security rules
