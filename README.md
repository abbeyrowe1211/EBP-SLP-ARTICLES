# EBP-SLP — iOS app (v0.1)

This is the actual app codebase. Three clicks to run it on your iPhone.

---

## What you need first

- Node.js installed on your Mac (download LTS from https://nodejs.org if you haven't already)
- **Expo Go** app installed on your iPhone (free, from the App Store)
- iPhone and Mac on the same Wi-Fi network

---

## How to run it

### 1. Unzip the app folder
Double-click `ebp_slp_app_v01b.zip` in Finder. macOS will unzip it automatically and create a folder called `ebp-slp-app`.

### 2. Open the unzipped folder
Double-click the `ebp-slp-app` folder to open it in Finder.

### 3. Double-click `start.command`

A Terminal window will open and do everything automatically — install dependencies (1–3 minutes the first time), then show a QR code.

**If macOS blocks it the first time** ("cannot be opened because the developer cannot be verified"):
- Click `Cancel` on the popup
- **Right-click** (or Control-click) on `start.command` → choose **Open**
- A new popup appears with an `Open` button — click it
- It will only ask once. Future double-clicks work normally.

### 4. Scan the QR code
When the QR code appears in Terminal, open the **Camera** app on your iPhone, point it at the QR code, and tap the yellow notification that appears.

The app will launch in Expo Go. First load takes 30–60 seconds, then you're in.

---

## What's in this build

- ✅ Brand colors, Quicksand font, hand-drawn SVG icons
- ✅ Bottom tab nav (Home, Browse, Sessions, Library, Profile)
- ✅ **Home screen** matching the prototype — greeting, search, ASHA Big Nine area grid, browse-by-setting row, foundations card
- 🚧 Browse, Sessions, Library, Profile — placeholder stubs for now (next build phases)

---

## To stop the app
Press `Ctrl + C` in the Terminal window, then close the window.

## To run it again later
Just double-click `start.command`. It'll skip the install step and start in 5 seconds.

---

## If something breaks
Take a screenshot of the Terminal window and send to Claude. Don't try to fix it yourself — easier for us to debug together.
