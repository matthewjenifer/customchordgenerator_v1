document.addEventListener('DOMContentLoaded', function () {

    // Create the synth (PolySynth for chords, Monosynth for single notes)
    const synth = new Tone.PolySynth(Tone.FMSynth).toDestination();

    // Make sure the audio context is started on first user gesture
    let toneStarted = false;

    function startToneIfNeeded() {
        if (!toneStarted) {
            Tone.start();
            toneStarted = true;
        }
    }


    // Initialize chord inputs
    const chordContainer = document.querySelector('.chord-input-container');
    const addChordBtn = document.getElementById('addChordBtn');
    const generateBtn = document.getElementById('generateBtn');
    const outputSection = document.getElementById('outputSection');
    const jsonOutput = document.getElementById('jsonOutput');
    const copyBtn = document.getElementById('copyBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const copyNotification = document.getElementById('copyNotification');

    // Add initial chord inputs
    for (let i = 0; i < 12; i++) {
        addChordInput();
    }

    // Event listeners
    addChordBtn.addEventListener('click', addChordInput);
    generateBtn.addEventListener('click', generateJSON);
    copyBtn.addEventListener('click', copyToClipboard);
    downloadBtn.addEventListener('click', downloadJSON);

    document.addEventListener('keydown', function (e) {
        // If Shift + Z is pressed
        if (e.shiftKey && (e.key === 'Z' || e.key === 'z')) {
            const annotateBtn = document.getElementById('annotateExportBtn');
            if (annotateBtn) annotateBtn.style.display = "block";
            const romanNumeralDiv = document.getElementById('romanNumeralDiv');
            if (romanNumeralDiv) romanNumeralDiv.style.display = "block";

        }
    });


    // Annotated export (private feature)
    const annotateExportBtn = document.getElementById('annotateExportBtn');
    if (annotateExportBtn) {
        annotateExportBtn.addEventListener('click', function () {
            const setName = document.getElementById('setName').value.trim() || 'Chord Set';
            const key = document.getElementById('keySelector').value;
            // Pull from the chordContainer you initialized at the top
            const chordInputs = chordContainer.querySelectorAll('input');

            // Build chordNames just like in generateJSON
            const chordNames = Array.from(chordInputs).map(input => input.value.trim()).filter(
                name => name);

            if (chordNames.length === 0) {
                alert('No chords to annotate.');
                return;
            }

            let output = `Chord Set: ${setName}\nKey: ${key} Major\n\n`;
            output += "Pad\tChord\tAnalysis\n";
            output += "----------------------------------------\n";
            chordNames.forEach((chord, i) => {
                let theory = detectChordOriginAuto(chord, key);
                output += `${i + 1}\t${chord}\t${theory}\n`;
            });

            // Download as text file
            const blob = new Blob([output], {
                type: 'text/plain'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `annotated_${setName.replace(/\s+/g, "_")}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }



    // Function to add a new chord input field
    function addChordInput() {
        const inputCount = chordContainer.querySelectorAll('input').length;
        if (inputCount >= 12) {
            alert('Maximum of 12 chords allowed');
            return;
        }

        const inputDiv = document.createElement('div');
        inputDiv.className = 'flex items-center';
        inputDiv.innerHTML = `
                    <input type="text" placeholder="Pad ${inputCount + 1}" 
                        class="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-white">
                    <button class="ml-2 text-gray-400 hover:text-green-400 play-chord-btn" title="Play Chord">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="ml-2 text-gray-400 hover:text-red-400 remove-chord-btn">
                        <i class="fas fa-times"></i>
                    </button>
                `;
        chordContainer.appendChild(inputDiv);

        // Add event listeners
        const removeBtn = inputDiv.querySelector('.remove-chord-btn');
        removeBtn.addEventListener('click', function () {
            chordContainer.removeChild(inputDiv);
        });

        const playBtn = inputDiv.querySelector('.play-chord-btn');
        playBtn.addEventListener('click', function () {
            startToneIfNeeded();

            const chordName = inputDiv.querySelector('input').value.trim();
            if (!chordName) return;

            const noteValues = parseChord(chordName);
            if (!noteValues) return;

            // Convert note values to actual notes (C3 = 48)
            const notes = noteValues.map(val => {
                const midiNote = val + 60; // Convert back to MIDI
                return Tone.Frequency(midiNote, "midi").toNote();
            });

            // Play the chord
            synth.triggerAttackRelease(notes, "2n", undefined, 0.25);
        });

    }

    // MIDI note to Maschine value mapping (value = MIDI_note - 60, where C3 = 60 in Maschine)
    const midiToValue = (midiNote) => midiNote - 60;

    // Chord type to note intervals mapping
    const chordMap = {
        // Major/Minor triads
        '': [0, 4, 7],
        'maj': [0, 4, 7],
        'm': [0, 3, 7],
        'min': [0, 3, 7],
        'dim': [0, 3, 6],
        'aug': [0, 4, 8],

        // 7th chords
        '7': [0, 4, 7, 10],
        'maj7': [0, 4, 7, 11],
        'm7': [0, 3, 7, 10],
        'min7': [0, 3, 7, 10],
        'dim7': [0, 3, 6, 9],
        'm7b5': [0, 3, 6, 10],

        // 6th chords
        '6': [0, 4, 7, 9],
        'm6': [0, 3, 7, 9],

        // 6/9 chords
        '6/9': [0, 4, 7, 9, 14],
        'm6/9': [0, 3, 7, 9, 14],
        'mi6/9': [0, 3, 7, 9, 14],
        'min6/9': [0, 3, 7, 9, 14],
        'maj6/9': [0, 4, 7, 9, 14],


        // 9th, 11th, 13th
        '9': [0, 4, 7, 10, 14],
        'maj9': [0, 4, 7, 11, 14],
        'm9': [0, 3, 7, 10, 14],
        'min9': [0, 3, 7, 10, 14],
        '11': [0, 4, 7, 10, 14, 17],
        'maj11': [0, 4, 7, 11, 14, 17],
        'min11': [0, 3, 7, 10, 14, 17],
        '13': [0, 4, 7, 10, 14, 17, 21],
        'maj13': [0, 4, 7, 11, 14, 17, 21],
        'min13': [0, 3, 7, 10, 14, 17, 21],

        // Suspended chords
        'sus2': [0, 2, 7],
        'sus4': [0, 5, 7],
        'sus': [0, 5, 7],

        // Add chords
        'add9': [0, 4, 7, 14],
        'add11': [0, 4, 7, 17],
        'add13': [0, 4, 7, 21],

        // Altered and hybrid chords
        '#5': [0, 4, 8],
        'm#5': [0, 3, 8],
        'b5': [0, 4, 6],
        'm6/9': [0, 3, 7, 9, 14],
        'maj6/9': [0, 4, 7, 9, 14],

        // Sharp(#)5 chords
        'm#5': [0, 3, 8],
        'mi#5': [0, 3, 8],
        'min#5': [0, 3, 8],
    };


    // Chord type aliases mapping
    const chordAliases = {
        // Major/minor abbreviations
        'ma': 'maj',
        'major': 'maj',
        'mi': 'm',
        'minor': 'm',

        // 7th, 9th, 11th, 13th variants
        'ma7': 'maj7',
        'major7': 'maj7',
        'mi7': 'm7',
        'min7': 'm7',
        'minor7': 'm7',
        'ma9': 'maj9',
        'major9': 'maj9',
        'mi9': 'min9',
        'min9': 'min9',
        'minor9': 'min9',
        'ma11': 'maj11',
        'major11': 'maj11',
        'mi11': 'min11',
        'min11': 'min11',
        'minor11': 'min11',
        'ma13': 'maj13',
        'major13': 'maj13',
        'mi13': 'min13',
        'min13': 'min13',
        'minor13': 'min13',

        // 6th and hybrid/compound extensions
        'ma6': '6',
        'major6': '6',
        'mi6': 'm6',
        'min6': 'm6',
        'minor6': 'm6',
        'ma6/9': 'maj6/9',
        'major6/9': 'maj6/9',
        'mi6/9': 'm6/9',
        'min6/9': 'm6/9',
        'minor6/9': 'm6/9',

        // Add chords
        'madd9': 'add9',
        'minadd9': 'add9',
        'madd11': 'add11',
        'minadd11': 'add11',

        // Diminished/augmented
        'diminished': 'dim',
        'augmented': 'aug',
        'b5': 'dim',
        '#5': 'aug',

        // Suspended
        'sus': 'sus4',
        'sus2': 'sus2',
        'sus4': 'sus4',

        // m7b5 and other half-diminished forms
        'min7b5': 'm7b5',
        'mi7b5': 'm7b5',
        'half-diminished': 'm7b5',

        // Misc alternate spellings (optional, add as needed)
        'mi#5': 'm#5',
        'min#5': 'm#5',
        'minor#5': 'm#5',
        'maj#5': 'maj#5',
        'ma#5': 'maj#5',

        // Extended jazz/pop notation
        'maj6/9': 'maj6/9',
        'm6/9': 'm6/9',
        'min6/9': 'm6/9',

        // Chord names can be extended with more cases as you see them in your user data
    };



    // Root note to MIDI note value mapping (C3 = 48, A3 = 57, etc.)
    const rootNoteMap = {
        'C': 0,
        'C#': 1,
        'Db': 1,
        'D': 2,
        'D#': 3,
        'Eb': 3,
        'E': 4,
        'F': 5,
        'F#': 6,
        'Gb': 6,
        'G': 7,
        'G#': 8,
        'Ab': 8,
        'A': 9,
        'A#': 10,
        'Bb': 10,
        'B': 11
    };

    const explicitVoicing = {
        "Dbma7_F": [-19, -11, -7, -4, 0, 12],
        "Db_Ab": [-16, -11, -7, -4],
        "Cmi6_9": [-12, -9, -5, -3, 9],
        "Cmi_#5": [-12, -9, -5],
        "Ami6_9": [-3, 0, 4, 6, 18],
        "G7_B": [-13, -5, -1, 2, 5, 17],
        "Db_C": [-24, -11, -7, -4],
        "Db_F": [-19, -7, -4, 1],
        "Dmi_Ab": [-16, -10, -7, -3],
        "Fmi_Ab": [-16, 0, 5, 8],
        "Fmi_G": [-17, 0, 5, 8],
        "Ami_C": [-12, 0, 4, 9],
        "Dbma7/F": [-19, -11, -7, -4, 0, 12],
        "Db/Ab": [-16, -11, -7, -4],
        "Cmi6/9": [-12, -9, -5, -3, 9],
        "Cmi/#5": [-12, -9, -5],
        "Ami6/9": [-3, 0, 4, 6, 18],
        "G7/B": [-13, -5, -1, 2, 5, 17],
        "Db/C": [-24, -11, -7, -4],
        "Db/F": [-19, -7, -4, 1],
        "Dmi/Ab": [-16, -10, -7, -3],
        "Fmi/Ab": [-16, 0, 5, 8],
        "Fmi/G": [-17, 0, 5, 8],
        "Ami/C": [-12, 0, 4, 9]
        // ...add more as needed
    };

    function getChordIntervals(type) {
        // Try direct match
        if (chordMap[type]) return chordMap[type];
        // Try longest substring in chordMap (not just start)
        let longestMatch = '';
        for (let key in chordMap) {
            if (type.includes(key) && key.length > longestMatch.length) {
                longestMatch = key;
            }
        }
        if (longestMatch) return chordMap[longestMatch];
        return chordMap[''];
    }

    const majorNumerals = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
    const minorNumerals = ["i", "ii°", "III", "iv", "v", "VI",
        "VII"
    ]; // If you want minor key support later

    function getRomanNumeralName(chordRoot, chordType, key) {
        // Get root number for both chord and key
        const rootMap = {
            'C': 0,
            'C#': 1,
            'Db': 1,
            'D': 2,
            'D#': 3,
            'Eb': 3,
            'E': 4,
            'F': 5,
            'F#': 6,
            'Gb': 6,
            'G': 7,
            'G#': 8,
            'Ab': 8,
            'A': 9,
            'A#': 10,
            'Bb': 10,
            'B': 11
        };

        // Get semitone distance from key root to chord root, always positive (mod 12)
        let keyNum = rootMap[key];
        let chordNum = rootMap[chordRoot];
        if (keyNum === undefined || chordNum === undefined) return chordRoot;

        let interval = (chordNum - keyNum + 12) % 12;

        // Roman numerals for C major: [C,D,E,F,G,A,B] → [I,ii,iii,IV,V,vi,vii°]
        let numeral;
        switch (interval) {
            case 0:
                numeral = "I";
                break;
            case 2:
                numeral = "ii";
                break;
            case 4:
                numeral = "iii";
                break;
            case 5:
                numeral = "IV";
                break;
            case 7:
                numeral = "V";
                break;
            case 9:
                numeral = "vi";
                break;
            case 11:
                numeral = "vii°";
                break;
                // For accidentals (e.g., C# in C): use # or b + numeral, e.g. "#IV"
            default:
                // Could try to label as '#IV', 'bIII', etc., but for now:
                numeral = "?";
        }

        // Basic type logic
        if (/m(?!a)/i.test(chordType)) { // matches "m" but not "maj"
            if (numeral === "I") numeral = "i";
            else if (numeral === "IV") numeral = "iv";
            else if (numeral === "V") numeral = "v";
            else if (numeral === "vi") numeral =
                "VI"; // minor vi is VI in minor key, but let’s keep it simple
        }
        if (/dim|°/i.test(chordType)) numeral += "°";
        if (/aug|\+/i.test(chordType)) numeral += "+";

        // Add extensions (e.g., "7", "9", "13") to the numeral if present in chordType
        let extension = chordType.match(/7|9|11|13/);
        if (extension) numeral += extension[0];

        return numeral;
    }

    // let theoryInfo = detectChordOriginAuto(chordName, key);


    // --- Chord Theory Detection Helpers ---

    const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];

    const MODE_INFO = {
        "ionian": ["maj", "min", "min", "maj", "maj", "min", "dim"],
        "dorian": ["min", "min", "maj", "maj", "min", "dim", "maj"],
        "phrygian": ["min", "maj", "maj", "min", "dim", "maj", "min"],
        "lydian": ["maj", "maj", "min", "dim", "maj", "min", "min"],
        "mixolydian": ["maj", "min", "dim", "maj", "min", "min", "maj"],
        "aeolian": ["min", "dim", "maj", "min", "min", "maj", "maj"],
        "locrian": ["dim", "maj", "min", "min", "maj", "maj", "min"],
    };

    const FLAT_KEYS = ["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"];
    const ALL_ROOTS_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const ALL_ROOTS_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    const MODE_NAMES = ["ionian", "dorian", "phrygian", "lydian", "mixolydian", "aeolian", "locrian"];

    function getNoteNames(keyRoot) {
        return FLAT_KEYS.includes(keyRoot) ? ALL_ROOTS_FLAT : ALL_ROOTS_SHARP;
    }

    function getScaleRoots(keyRoot, mode) {
        const noteNames = getNoteNames(keyRoot);
        let rootIdx = noteNames.indexOf(keyRoot);
        if (rootIdx === -1) throw new Error("Unsupported key: " + keyRoot);

        let intervals = MAJOR_SCALE_INTERVALS.slice();
        let modeIdx = MODE_NAMES.indexOf(mode.toLowerCase());
        if (modeIdx === -1) modeIdx = 0; // default to major (ionian)
        intervals = intervals.slice(modeIdx).concat(intervals.slice(0, modeIdx));
        let scale = [];
        for (let i = 0; i < intervals.length; i++) {
            let noteIdx = (rootIdx + intervals[i]) % 12;
            scale.push(noteNames[noteIdx]);
        }
        return scale;
    }

    function getDiatonicChords(keyRoot, mode) {
        const scale = getScaleRoots(keyRoot, mode);
        const qualities = MODE_INFO[mode.toLowerCase()];
        return scale.map((note, i) =>
            (note + (qualities[i] === "maj" ? "" : qualities[i]))
        );
    }

    // Returns Roman numeral string for a degree (e.g., "bVII", "iv", "I", etc.)
    function romanNumeral(degree, quality, accidental = 0) {
        const numerals = ["I", "II", "III", "IV", "V", "VI", "VII"];
        let n = numerals[degree % 7];
        if (quality === "min") n = n.toLowerCase();
        if (quality === "dim") n = n.toLowerCase() + "°";
        if (accidental === 1) n = "#" + n;
        if (accidental === -1) n = "b" + n;
        return n;
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Main detector: call with (chordName, keyRoot) -- always assumes "major"
    function detectChordOriginAuto(chordName, keyRoot) {
        // Parse chord root and basic type
        let mainChord = chordName.split("/")[0].trim();
        const match = mainChord.match(/^([A-G][b#]?)(m|dim|maj|min)?/i);
        if (!match) return "Unrecognized chord";
        let root = match[1];
        let quality = match[2] || '';
        if (quality.toLowerCase() === "min") quality = "m";
        if (quality.toLowerCase() === "maj") quality = "";
        if (quality.toLowerCase() === "dim") quality = "dim";
        let basicChord = root + quality;

        // 1. Diatonic in main key (Ionian)?
        const mainMode = "ionian";
        const diatonics = getDiatonicChords(keyRoot, mainMode);
        if (diatonics.includes(basicChord)) {
            const idx = diatonics.indexOf(basicChord);
            return `Diatonic (I${idx+1} - ${romanNumeral(idx, MODE_INFO[mainMode][idx])} in ${keyRoot} Major)`;
        }

        // 2. Diatonic in any parallel mode? (skip Ionian)
        for (let mode of MODE_NAMES) {
            if (mode === mainMode) continue;
            const modeChords = getDiatonicChords(keyRoot, mode);
            if (modeChords.includes(basicChord)) {
                const idx = modeChords.indexOf(basicChord);
                const numeral = romanNumeral(idx, MODE_INFO[mode][idx]);
                return `Borrowed from parallel ${capitalize(mode)} (${numeral} in ${keyRoot} ${capitalize(mode)})`;
            }
        }

        // 3. Not diatonic in any parallel mode
        return "Non-diatonic (no common modal origin)";
    }



    // Function to parse chord name and return note values
    function parseChord(chordName) {
        // 1. First, check explicit voicing dictionary for an exact match (with strict / keys)
        if (explicitVoicing[chordName]) {
            return explicitVoicing[chordName];
        }

        // 2. Algorithmic fallback if not found in explicit voicing
        let mainChord = chordName;
        let bassNote = null;

        // Handle slash chords
        if (chordName.includes("/")) {
            [mainChord, bassNote] = chordName.split("/");
            mainChord = mainChord.trim();
            bassNote = bassNote.trim();
        }

        // Extract root note and chord type
        const rootMatch = mainChord.match(/^([A-Ga-g][#b]?)/i);
        if (!rootMatch) return null;

        let root = rootMatch[1];
        root = root.charAt(0).toUpperCase() + (root.length > 1 ? root.slice(1).toLowerCase() : '');

        let type = mainChord.slice(rootMatch[0].length).toLowerCase();
        type = chordAliases[type] || type;

        // Use your getChordIntervals function for the most accurate mapping
        const intervals = getChordIntervals(type);
        const rootMidi = rootNoteMap[root] + 48;
        if (rootMidi === undefined) return null;

        let noteValues = [];

        // 3. Handle bass note (for slash chords)
        if (bassNote) {
            let bassRootMatch = bassNote.match(/^([A-Ga-g][#b]?)/i);
            if (bassRootMatch) {
                let bassRoot = bassRootMatch[1];
                bassRoot = bassRoot.charAt(0).toUpperCase() + (bassRoot.length > 1 ? bassRoot.slice(1)
                    .toLowerCase() : '');
                let bassMidi = rootNoteMap[bassRoot] + 48;
                let bassValue = midiToValue(bassMidi - 12);
                noteValues.push(bassValue);
            }
        } else {
            noteValues.push(midiToValue(rootMidi - 12));
        }

        // 4. Add root, 3rd, 5th, 7th, etc. in main octave
        noteValues.push(midiToValue(rootMidi)); // Root (main octave)
        if (intervals.length > 1) noteValues.push(midiToValue(rootMidi + intervals[1]));
        if (intervals.length > 2) noteValues.push(midiToValue(rootMidi + intervals[2]));
        if (intervals.length > 3) noteValues.push(midiToValue(rootMidi + intervals[3]));

        // 5. For extended chords, add highest interval one octave up (if present)
        if (intervals.length > 3) {
            noteValues.push(midiToValue(rootMidi + intervals[intervals.length - 1] + 12));
        }

        // 6. Remove duplicates and sort ascending
        noteValues = Array.from(new Set(noteValues));
        noteValues.sort((a, b) => a - b);

        return noteValues;
    }



    // Function to generate JSON output
    function generateJSON() {

        const setName = document.getElementById('setName').value.trim();

        if (!setName) {
            alert('Please enter a chord set name');
            return;
        }

        const chordInputs = chordContainer.querySelectorAll('input');
        const chords = [];

        // Get all chord names from inputs
        const chordNames = Array.from(chordInputs).map(input => input.value.trim()).filter(name =>
            name);

        if (chordNames.length === 0) {
            alert('Please enter at least one chord');
            return;
        }

        const romanNumeralMode = document.getElementById('romanNumeralMode').checked;


        const key = document.getElementById('keySelector').value;


        for (const chordName of chordNames) {
            const noteValues = parseChord(chordName);
            if (!noteValues) {
                alert(`Invalid chord format: ${chordName}`);
                return;
            }

            let mainChord = chordName;
            if (chordName.includes("/")) {
                [mainChord] = chordName.split("/");
                mainChord = mainChord.trim();
            }
            const rootMatch = mainChord.match(/^([A-Ga-g][#b]?)/i);
            let root = rootMatch ? rootMatch[1] : chordName;
            root = root.charAt(0).toUpperCase() + (root.length > 1 ? root.slice(1).toLowerCase() : '');
            let type = mainChord.slice(rootMatch ? rootMatch[0].length : 0).toLowerCase();

            let numeralName = chordName;
            if (romanNumeralMode) {
                const roman = getRomanNumeralName(root, type, key);
                numeralName = (roman === "?") ? chordName : roman;
            }

            chords.push({
                name: numeralName,
                notes: noteValues
            });
        }

        // Generate UUID (simplified version)
        function generateUUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }

        // Create the JSON object
        const jsonData = {
            chords: chords,
            name: setName ? (key + "_" + setName) : key,
            typeId: "native-instruments-chord-set",
            uuid: generateUUID(),
            version: "1.0.0"
        };


        // Display the JSON
        jsonOutput.textContent = JSON.stringify(jsonData, null, 2);
        outputSection.classList.remove('hidden');
        document.getElementById('annotateExportBtn').style.display = "none";
    }



    // Function to copy JSON to clipboard
    function copyToClipboard() {
        navigator.clipboard.writeText(jsonOutput.textContent)
            .then(() => {
                copyNotification.classList.add('show');
                setTimeout(() => {
                    copyNotification.classList.remove('show');
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy: ', err);
            });
    }

    // Function to download JSON as file
    async function downloadJSON() {
        const setName = document.getElementById('setName').value.trim() || 'chord_set';
        const fileNumber = document.getElementById('fileNumber').value;
        const paddedNumber = fileNumber.toString().padStart(2, '0');
        const fileName = `user_chord_set_${paddedNumber}.json`;
        const jsonStr = jsonOutput.textContent;

        // Try File System Access API (Chrome/Edge/Brave)
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{
                        description: 'JSON Files',
                        accept: {
                            'application/json': ['.json']
                        },
                    }, ],
                });
                const writable = await handle.createWritable();
                await writable.write(jsonStr);
                await writable.close();

                // Store the last folder handle (requires user consent)
                window.lastChordSetFolderHandle = handle;
            } catch (err) {
                if (err.name !== 'AbortError') {
                    alert('Failed to save file: ' + err.message);
                }
            }
        } else {
            // Fallback: Classic download (user sets download folder in browser settings)
            const blob = new Blob([jsonStr], {
                type: 'application/json'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert("Your browser doesn't support folder selection. Default download was used.");
        }
    }

});