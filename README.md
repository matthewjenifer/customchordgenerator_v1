![Alt text](https://i.ibb.co/TMvzJp6Z/disk-thumb.png)

Create and export custom Native Instruments Maschine user chord sets in JSON format—no music theory or scripting required.

## What is this?

A single-page web app that lets you build custom **Maschine User Chord Sets** individually or in bundled groups. Type chord names naturally, preview them instantly, and export Maschine-compatible JSON files or full ZIP bundles with zero manual formatting.

## Features

- Build up to **16 chord sets** per bundle (Maschine-ready)
- **Bundle Mode** with 16-slot grid for managing multiple sets at once
- Name each chord set (**required**; duplicate names are blocked in bundle mode)
- Add up to **12 chords per set** using natural chord names
- **Auto-advance** to the next available slot after saving
- **Clear Chords** button to instantly wipe all chord inputs
- Automatic root voicing and note value calculation (matches Native Instruments convention)
- Optional key selection per set
- Roman Numeral chord naming (auto-enabled only when a key is selected)
- Live chord preview before saving
- Dynamic JSON preview panel that syncs to the selected slot
- Export a full **ZIP bundle** of up to 16 Maschine-compatible JSON files
- Deterministic filenames for easy Maschine import
- Clear slot or clear entire bundle controls

## How it works

### Single Set

- Enter a chord set name (e.g., "A Chords")
- Add chords by typing their names (e.g., Ama7, Ami, G7, F#min9)
- (Optional) Choose a key
- (Optional) Enable Roman Numeral Conversion
- The app calculates correct note values, with the root voiced one octave down
- Click **Generate JSON** to preview, copy, or download the file

### Bundle Mode

- Enable Bundle Mode to unlock the 16-slot grid
- Each slot represents one Maschine User Chord Set
- Enter a **unique set name** for each slot
- Click **Generate JSON / Save to Slot** to store the set
- The app automatically advances to the next empty slot
- Use **Clear Chords** to quickly reset inputs between sets
- Select any slot to instantly view its stored JSON
- Export all saved slots as a single ZIP file

**Note:**  
All note values are calculated as semitone offsets from MIDI note 60 (C3).

Example:

```json
{
  "name": "Ama7",
  "notes": [-15, 1, 4, 8]
}
```

## Installation / Usage

No installation needed. Just visit the live app or run locally:

1. Clone the repo:

```sh
git clone https://github.com/yourusername/maschine-chord-set-generator.git
cd maschine-chord-set-generator
```

2. Open `index.html` in your browser.
3. Start building chord sets.

## Supported Chord Types

- Major, Minor
- Diminished, Augmented
- Dominant, Major, Minor 7ths
- 6th, 9th, 11th, 13th chords
- Suspended (sus2, sus4)
- Add chords (add9, add11)
- Altered dominants (#9, b9, b13, etc.)

## Compatibility

- Fully compatible with Native Instruments Maschine User Chord Sets
- Tested in modern Chromium-based browsers

## License

MIT

## Feedback & Contributions

Open an issue or PR on GitHub if you find bugs, want to request features, or contribute improvements.

---

Made for musicians, producers, and anyone tired of building Maschine chord sets by hand.
