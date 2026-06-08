# Testing `main` live in a BBB room

Run the plugin from your local `main`, expose it with a temporary tunnel, and
spin up a throwaway room on the production BBB server that loads **your** build.
Use this to verify what's on `main` before approving or merging anything.

> ⚠️ **Secret handling.** You need the BBB shared secret to create rooms. Get it
> from Justin directly. **Never** paste it into a file, commit it, or screenshot
> it. `bbb0-v3` is the **production** server with real classes — always use a
> **unique meeting ID**, and never join or touch a room that isn't yours.

---

## Prerequisites (one-time)

- Node + npm installed
- `cloudflared` installed → `brew install cloudflared`
- Repo cloned: `github.com/jcw-rgb/fullmind-classroom-plugin`
- `npm install` run once inside it
- The BBB shared secret (from Justin)

---

## Step 1 — Get the latest `main`

```bash
cd path/to/fullmind-classroom-plugin
git checkout main
git pull
```

## Step 2 — Start the dev server

```bash
npm start
```

Leave it running. It serves the three files BBB needs — `manifest.json`,
`FullmindClassroom.js`, `fullmind-bbb-base.css` — on `http://localhost:4701`.
Wait for **"compiled successfully."**

## Step 3 — Open a public tunnel (second terminal)

```bash
cloudflared tunnel --url http://localhost:4701
```

It prints a URL like `https://something-random.trycloudflare.com`. **Copy it** —
it's new every time you start the tunnel.

Sanity check (third terminal, swap in your URL — all three should say `200`):

```bash
T="https://something-random.trycloudflare.com"
for f in manifest.json FullmindClassroom.js fullmind-bbb-base.css; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' "$T/$f")  $f"
done
```

If you get `530`: the tunnel is still warming up (wait ~10s) or it's a bad
instance — `Ctrl-C` it and rerun Step 3.

## Step 4 — Create the room + get a join link

Save this as `make-room.py`. It reads the secret from the environment, so the
secret never lives in the file:

```python
import os, hashlib, urllib.parse, urllib.request

secret  = os.environ["SECRET"]
api     = "https://bbb0-v3.fullmindlearning.com/bigbluebutton/api"
TUNNEL  = "https://something-random.trycloudflare.com"   # <-- paste YOUR tunnel URL
MEETING = "yourname-test-1"                               # <-- unique ID, change every run

def signed_url(method, params):
    qs = urllib.parse.urlencode(params)
    checksum = hashlib.sha1((method + qs + secret).encode()).hexdigest()
    return f"{api}/{method}?{qs}&checksum={checksum}"

def call(method, params):
    with urllib.request.urlopen(signed_url(method, params), timeout=25) as r:
        return r.read().decode()

print(call("create", {
    "name": "Main build test",
    "meetingID": MEETING,
    "attendeePW": "att-pw",
    "moderatorPW": "mod-pw",
    "record": "false",
    "pluginManifests": '[{"url":"%s/manifest.json"}]' % TUNNEL,
}))

print("\nJOIN URL:\n" + signed_url("join", {
    "fullName": "YourName",
    "meetingID": MEETING,
    "role": "MODERATOR",
    "redirect": "true",
}))
```

Edit the two marked lines (`TUNNEL`, `MEETING`), then run it with the secret
passed inline (never hardcoded):

```bash
SECRET='<paste-secret-from-Justin>' python3 make-room.py
```

You'll get `<returncode>SUCCESS</returncode>` and a **JOIN URL** at the bottom.

## Step 5 — Open the join URL in Chrome

Paste it into the address bar. The BBB client loads — pick **Listen only** on the
audio prompt — and you're in a room running your local `main` build.

## Step 6 — If something looks stale, hard-refresh

BBB caches the plugin with a service worker. After any code change (or if the
reskin looks old), do a **manual hard-refresh**: `Cmd+Shift+R`. That's the
reliable way to bust it.

---

## What you should see if `main` is healthy

- **Top edge:** a full-width **"Session Progress"** band in its own reserved
  strip — not overlapping the meeting title.
- **Top bar:** plum, with the **Fullmind** wordmark.
- **Left nav:** coral **"Chat"** active tab (white text), **"Notes"**, a gray
  rail, and a coral **Send** button.

## How it works (why these steps)

- `npm start`'s webpack config has middleware that serves all three files BBB
  needs, so there's no separate build step for dev.
- The room's `pluginManifests` param points BBB at your tunnel's `manifest.json`.
- The plugin then **self-loads** the base CSS from its own origin (your tunnel),
  so the plum bars / logo / fonts arrive a beat after the nav reskin.
- For **production** (not this dev path), all three `dist/` files are uploaded to
  S3 instead — see `DEV-HANDOFF.md`.
