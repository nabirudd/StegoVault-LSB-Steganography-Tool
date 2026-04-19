# StegoVault — LSB Steganography Tool

> **Hide secrets where no one thinks to look.**
> A visual, browser-based steganography tool that embeds encrypted messages inside ordinary PNG images using Least Significant Bit (LSB) encoding — with optional AES-256-GCM encryption.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/nabirudd/StegoVault-LSB-Steganography-Tool)

**Live Demo:** <!-- paste your Render URL here once deployed -->

---

## What Is This?

StegoVault is a Python/Flask web application I built to understand and demonstrate **steganography** — the practice of hiding secret information inside an ordinary, innocent-looking file. Unlike cryptography (which scrambles a message so it *looks* secret), steganography hides the very *existence* of the message inside a carrier file, in this case a PNG image.

The tool supports two modes:

| Mode | What it does |
|------|-------------|
| **Encode** | Takes a cover image + your secret message, embeds the message into the image's pixels, and outputs a new PNG that looks identical to the original |
| **Decode** | Takes a steganographic image (and optionally a passphrase), extracts and decrypts the hidden message |

---

## Why I Built This

I'm transitioning from Data Analysis into Cyber Security, and steganography kept coming up — both in **CTF (Capture The Flag)** competitions and in real-world digital forensics scenarios. I'd hit steg challenges and reach for existing CLI tools (`steghide`, `zsteg`, `stegsolve`) but always wanted to understand the *underlying mechanism* at the bit level, not just run a command.

Building StegoVault forced me to:
- Read and manipulate raw pixel data (not just images as a whole)
- Understand binary encoding and bit-level operations
- Implement a proper encryption pipeline from scratch (PBKDF2 key derivation → AES-256-GCM)
- Think like both an attacker (hiding data) and a defender (detecting hidden data)

---

## How It Works — Technical Deep Dive

### 1. The Cover Image & Pixel Structure

Every PNG image is a grid of pixels. Each pixel contains three colour channels: **Red, Green, Blue** — each an 8-bit integer (0–255). A 1920×1080 image has:

```
1920 × 1080 = 2,073,600 pixels
× 3 channels = 6,220,800 bits of storage
÷ 8          = ~777 KB of potential payload space
```

### 2. LSB (Least Significant Bit) Encoding

The least significant bit of any colour value has the smallest visual impact. Flipping a pixel's red channel from `200` to `201` is completely invisible to the human eye:

```
Original:  R = 200  →  binary: 1100100[0]
Modified:  R = 201  →  binary: 1100100[1]
                                        ↑
                              This bit carries your message
```

StegoVault uses **1 bit per channel** (R, G, B), so **3 bits per pixel**. The full encoding process:

1. Convert the message string to bytes (`UTF-8`)
2. Optionally encrypt the bytes with AES-256-GCM (see below)
3. Prepend a **5-byte header**: 4 bytes for payload length + 1 byte encryption flag
4. Convert the full payload to a binary bit stream
5. Replace the LSB of each colour channel across pixels, left to right, top to bottom
6. Save the result as a new PNG (lossless — JPEG would destroy the embedded bits)

### 3. AES-256-GCM Encryption Layer

When a passphrase is provided, the message is encrypted **before** embedding. This adds two layers of protection:

- Even if someone suspects and extracts the LSB payload, they get encrypted ciphertext
- The GCM authentication tag means any tampering with the ciphertext is detected on decryption

**Key Derivation (PBKDF2):**
```
passphrase + random 16-byte salt
        ↓
  PBKDF2-SHA1 (100,000 iterations)
        ↓
  32-byte AES-256 key
```

The high iteration count (100k) makes brute-forcing the passphrase computationally expensive.

**Payload structure in the image:**

```
[ 5-byte header | 16-byte salt | 16-byte nonce | 16-byte GCM tag | ciphertext ]
```

### 4. Detection Resistance

LSB steganography is statistically subtle:

- Only 1 bit out of 8 is modified per channel
- The change in pixel values is ±1 at most
- Visual inspection reveals nothing
- Basic histogram analysis shows negligible statistical deviation

However, **Chi-square steganalysis** and **RS analysis** can detect LSB embedding in images with large amounts of hidden data. For maximum stealth: keep the payload small relative to the image size, and always encrypt the payload so it appears as uniform random noise.

---

## Payload Size Reference

| Image Resolution | Pixels | Raw Capacity | With AES Overhead |
|-----------------|--------|-------------|------------------|
| 640 × 480       | 307,200 | ~115 KB | ~115 KB |
| 1280 × 720 (HD) | 921,600 | ~345 KB | ~345 KB |
| 1920 × 1080 (FHD) | 2,073,600 | ~777 KB | ~777 KB |
| 3840 × 2160 (4K) | 8,294,400 | ~3.1 MB | ~3.1 MB |

AES-256-GCM overhead is only **48 bytes** (salt + nonce + tag) — negligible at any resolution.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3, Flask |
| Steganography | Pillow (PIL) — raw pixel read/write |
| Encryption | pycryptodome — AES-256-GCM, PBKDF2 |
| Frontend | Vanilla JS, CSS custom properties |
| UI Theme | Matrix-rain background, dark cybersecurity aesthetic |
| Storage | Stateless — images are processed in-memory and never saved to disk |

---

## Project Structure

```
Steganography Tool/
├── app.py              # Flask routes — encode/decode API endpoints
├── steg.py             # Core steganography + encryption logic
├── requirements.txt    # Python dependencies
├── templates/
│   └── index.html      # Single-page UI (encode / decode / about tabs)
├── static/
│   ├── css/style.css   # Dark cybersecurity theme
│   └── js/main.js      # Matrix rain, drag-drop, fetch API calls
└── uploads/            # Kept empty — images processed in-memory
```

---

## Installation & Running Locally

```bash
# 1. Clone the repository
git clone https://github.com/Nabir/stego-vault.git
cd stego-vault

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run the server
python app.py

# 4. Open in your browser
# http://localhost:5002
```

**Requirements:** Python 3.8+, pip

---

## How to Use

### Hiding a Message

1. Go to the **Encode** tab
2. Upload any PNG or JPEG image (the "cover image")
3. Type your secret message in the text area
4. *(Optional)* Enter a passphrase — this enables AES-256-GCM encryption
5. Click **Hide Message**
6. Download the output PNG — it looks identical to your original but contains the hidden message

### Extracting a Message

1. Go to the **Decode** tab
2. Upload the steganographic PNG
3. *(If encrypted)* Enter the passphrase
4. Click **Extract Hidden Message**
5. The message appears in the terminal-style output box

---

## CTF / Security Context

This tool was directly inspired by Capture The Flag competitions. Common steg CTF patterns I encountered:

- Images with hidden flags embedded in LSBs (extractable with `zsteg` or custom scripts)
- Encrypted payloads requiring a passphrase hidden elsewhere in the challenge
- Multi-layer challenges: steganography wrapping cryptography wrapping the flag
- Metadata hiding (EXIF data, PNG chunk injection) — different from LSB but related

StegoVault handles the LSB + encryption layer. Understanding how the encoding works is what lets you *reverse* it during a CTF challenge — you can't solve what you don't understand.

---

## What I Learned

- **Bit manipulation in Python** — working at the individual bit level with integers, bitwise AND/OR, struct packing
- **Image internals** — PNG vs JPEG (why JPEG breaks LSB: lossy compression modifies pixel values), colour channels, raw pixel access via Pillow
- **Applied cryptography** — AES-GCM mode (authenticated encryption), why GCM beats CBC (built-in integrity check), PBKDF2 key stretching and why salt prevents rainbow table attacks
- **Flask API design** — multipart form-data file uploads, base64 image transfer to the browser, proper error handling with HTTP status codes
- **Steganalysis basics** — how attackers detect LSB embedding (chi-square test, RS analysis) and why encryption matters even inside steganography
- **Security thinking** — threat modelling a tool: who's the attacker, what are they looking for, what does the tool expose

---

## Future Improvements

- [ ] **Audio steganography** — LSB encoding in WAV files (same principle, different carrier)
- [ ] **JPEG-compatible mode** — DCT coefficient manipulation instead of pixel LSB
- [ ] **Steganalysis detector** — a tab that analyses an uploaded image and estimates the probability it contains hidden data
- [ ] **Multi-image splitting** — split a large payload across multiple images for extra stealth
- [ ] **CLI mode** — a command-line interface alongside the web UI for scripted use in CTF pipelines
- [ ] **Batch decode** — upload multiple images and detect which ones contain hidden messages
- [ ] **Docker deployment** — containerised build for easy self-hosting
- [ ] **F5 algorithm** — implement the F5 JPEG steganography algorithm for truly covert JPEG embedding

---

## Disclaimer

StegoVault is built for **educational purposes**, **CTF competitions**, and **security research**. Use it to learn, to practice, and to understand how steganography works from both the offensive and defensive perspective. Do not use it to conceal illegal content or activities.

---

## Author

**Nabir** — Data Analyst transitioning into Cyber Security.
Building portfolio projects at the intersection of data, security, and code.

*"In security, what you don't know can hurt you. Build it, break it, understand it."*
