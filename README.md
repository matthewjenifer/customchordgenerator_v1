![Alt text](https://i.ibb.co/TMvzJp6Z/disk-thumb.png)

Create and export custom Native Instruments Maschine user chord sets in JSON format—no music theory or scripting required.

## What is this?

A single-page web app that lets you build up to 12 custom chord sets for use with Native Instruments Maschine’s User Chord Sets feature. Name your set, type chords naturally, and export a Maschine-compatible JSON file in seconds. No more guessing note values or formatting—just enter your chords and go.

## Features

- Build up to 12 custom chord sets per session
- Name each chord set
- Add up to 12 chords per set (supports standard chord names: major, minor, 7th, 9th, sus2, etc.)
- Automatic root voicing and note value calculation (matches Native Instruments convention)
- Optional key selection for each set
- Roman numeral chord naming (for theory-minded users)
- Preview each chord before adding it to your set
- Export one or more chord sets as a single Maschine-compatible JSON file
- Copy or download your generated file instantly

## How it works

- Enter a chord set name (e.g., "A Chords")
- Add chords by typing their names (e.g., Ama7, Ami, G7, F#min9)
- Instantly preview any chord with the built-in sound engine before finalizing your set
- (Optional) Choose a key for the set
- (Optional) Enable Roman Numeral Chord Naming (chords will display as I, ii, V7, etc.)
- The app calculates the correct note values, with the root always voiced one octave down (as Maschine expects)
- Click **Generate JSON** to view your file, then copy or download it
     

**Note:**
All note values are calculated as semitone offsets from MIDI note 60 (C3).
For example, Ama7 will output:

```json
{
  "name": "Ama7",
  "notes": [-15, 1, 4, 8]
}
```

## Installation / Usage

No installation needed! Just visit [customchordgenerator-v1.vercel.app](https://customchordgenerator-v1.vercel.app) or:

1. Download or clone this repo:

   ```sh
   git clone https://github.com/yourusername/maschine-chord-set-generator.git
   cd maschine-chord-set-generator
   ```
2. Open `index.html` in your browser.
3. Start building your sets.

## Supported Chord Types

* Major (C, Cmaj)
* Minor (Cm, Cmin)
* Diminished (Cdim)
* Augmented (Caug)
* Dominant 7th (C7), Major 7th (Cmaj7), Minor 7th (Cm7)
* 6th, 9th, 11th, 13th chords (C6, C9, C11, etc.)
* Suspended (Csus2, Csus4), Add chords (Cadd9)

If you need a chord type not listed here, open an issue or send a pull request.

## Compatibility

* Output JSON files are fully compatible with Native Instruments Maschine's User Chord Set import
* Tested on the latest versions of Chrome, Firefox, and Edge

## License

MIT

## Feedback & Contributions

Open an issue or PR on GitHub if you find bugs, want to request features, or contribute improvements.

---

Made for musicians, producers, and anyone tired of building Maschine chord sets by hand.
