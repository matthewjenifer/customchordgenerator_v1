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

const downloadBundleBtn = document.getElementById("downloadBundleBtn");
if (downloadBundleBtn) {
  downloadBundleBtn.addEventListener("click", downloadBundleZip);
}


    // --- Bundle Builder State (in-memory) ---

const BUNDLE_SLOT_COUNT = 16;

const bundleState = {
  // optional project meta
  bundleName: "",                 // user-facing bundle/project name (optional)
  filePrefix: "user_chord_set_",   // used for zip filenames
  createdAt: Date.now(),
  updatedAt: Date.now(),

  // navigation
  currentSlotIndex: 0,             // 0..15

  // slots
  slots: Array.from({ length: BUNDLE_SLOT_COUNT }, (_, i) => ({
    index: i,                      // 0..15
    displayName: `Set ${String(i + 1).padStart(2, "0")}`, // optional label in UI
    fileName: `user_chord_set_${String(i + 1).padStart(2, "0")}.json`,

    // payload
    data: null,                    // the JSON object your generateJSON() builds
    jsonString: "",                // cached string for download/zip
    uuid: "",                      // convenience: store data.uuid here too

    // validation/status
    status: "empty",               // "empty" | "saved" | "error"
    error: "",                     // last error if status === "error"

    // optional helpful metadata (for UI/persistence)
    key: "_",                      // key selector value when saved
    romanNumeralMode: false,       // whether roman numerals were on
    chordCount: 0,                 // number of chords saved
    savedAt: null,                 // timestamp
})),
};

loadBundleState();


function goToSlot(index) {
  if (index < 0 || index >= BUNDLE_SLOT_COUNT) return;

  bundleState.currentSlotIndex = index;
  updateSlotIndicator();
}

function nextSlot() {
  if (bundleState.currentSlotIndex < BUNDLE_SLOT_COUNT - 1) {
    goToSlot(bundleState.currentSlotIndex + 1);
  }
}

function prevSlot() {
  if (bundleState.currentSlotIndex > 0) {
    goToSlot(bundleState.currentSlotIndex - 1);
  }
}

function goToNextAvailableSlot() {
  const start = bundleState.currentSlotIndex;

  // First pass: next slot forward that isn't saved
  for (let i = start + 1; i < BUNDLE_SLOT_COUNT; i++) {
    if (bundleState.slots[i].status !== "saved") {
      goToSlot(i);
      return;
    }
  }

  // Second pass: wrap around
  for (let i = 0; i < start; i++) {
    if (bundleState.slots[i].status !== "saved") {
      goToSlot(i);
      return;
    }
  }

  // If all saved, just move forward if possible
  if (start < BUNDLE_SLOT_COUNT - 1) {
    goToSlot(start + 1);
  }
}


function saveCurrentSetToSlot(slotIndex) {
  const result = buildJsonDataFromUI();

  const slot = bundleState.slots[slotIndex];
  bundleState.updatedAt = Date.now();

// ✅ NEW: block duplicate set names across saved slots (bundle mode)
  if (!result.error && isBundleModeEnabled()) {
    const nameToCheck = result.meta?.setName || result.jsonData?.name || "";

    if (nameToCheck) {
      const dupeIndex = bundleState.slots.findIndex((s, i) => {
        if (i === slotIndex) return false;
        if (s.status !== "saved") return false;

        // Prefer parsed slot.data if present
        if (s.data?.name) return s.data.name === nameToCheck;

        // Fallback if needed
        return typeof s.jsonString === "string" && s.jsonString.includes(`"name": "${nameToCheck}"`);
      });

      if (dupeIndex >= 0) {
        slot.status = "error";
        slot.error = `Set name already used in Slot ${dupeIndex + 1}. Choose a unique name before saving.`;
        console.warn(`Slot ${slotIndex + 1}:`, slot.error);
        return false;
      }
    }
  }

  if (result.error) {
    slot.status = "error";
    slot.error = result.error;
    console.warn(`Slot ${slotIndex + 1}:`, result.error);
    return false;
  }

  slot.data = result.jsonData;
  slot.jsonString = result.jsonString;
  slot.uuid = result.jsonData.uuid;
  slot.key = result.meta.key;
  slot.romanNumeralMode = result.meta.romanNumeralMode;
  slot.chordCount = result.meta.chordCount;
  slot.savedAt = Date.now();
  slot.status = "saved";
  slot.error = "";

  console.log(`Saved set to slot ${slotIndex + 1}`);
  return true;
}



function saveCurrentSlot() {
  return saveCurrentSetToSlot(bundleState.currentSlotIndex);
}

function saveAndAdvance() {
  const success = saveCurrentSlot();
  if (success) nextSlot();
}

function validateFullBundle() {
  const missing = bundleState.slots.filter(slot => slot.status !== "saved");

  if (missing.length > 0) {
    return {
      valid: false,
      missingSlots: missing.map(s => s.index + 1)
    };
  }

  return { valid: true };
}

// ---------- Bundle Persistence ----------
const BUNDLE_STORAGE_KEY = "masch_bundle_state_v1";

function serializeBundleState() {
  return {
    bundleName: bundleState.bundleName,
    filePrefix: bundleState.filePrefix,
    currentSlotIndex: bundleState.currentSlotIndex,
    slots: bundleState.slots.map(s => ({
      index: s.index,
      displayName: s.displayName,
      fileName: s.fileName,
      jsonString: s.jsonString,
      uuid: s.uuid,
      status: s.status,
      error: s.error,
      key: s.key,
      romanNumeralMode: s.romanNumeralMode,
      chordCount: s.chordCount,
      savedAt: s.savedAt
    }))
  };
}

function persistBundleState() {
  try {
    localStorage.setItem(BUNDLE_STORAGE_KEY, JSON.stringify(serializeBundleState()));
  } catch (e) {
    console.warn("Could not persist bundle state:", e);
  }
}

function loadBundleState() {
  try {
    const raw = localStorage.getItem(BUNDLE_STORAGE_KEY);
    if (!raw) return;

    const saved = JSON.parse(raw);
    if (!saved || !Array.isArray(saved.slots)) return;

    bundleState.bundleName = saved.bundleName || "";
    bundleState.filePrefix = saved.filePrefix || bundleState.filePrefix;
    bundleState.currentSlotIndex = Number.isInteger(saved.currentSlotIndex) ? saved.currentSlotIndex : 0;

    // merge slots (don’t replace object identity)
    saved.slots.forEach(ss => {
      const slot = bundleState.slots[ss.index];
      if (!slot) return;

      slot.displayName = ss.displayName ?? slot.displayName;
      slot.fileName = ss.fileName ?? slot.fileName;
      slot.jsonString = ss.jsonString ?? "";
      slot.status = ss.status || (slot.jsonString ? "saved" : "empty");
      slot.error = ss.error || "";
      slot.data = null;
if (slot.jsonString) {
  try {
    slot.data = JSON.parse(slot.jsonString);
  } catch (e) {
    slot.status = "error";
    slot.error = "Saved slot data was corrupted (could not parse).";
    slot.jsonString = "";
    slot.uuid = "";        
    slot.savedAt = null;   
  }
}

      slot.uuid = ss.uuid ?? (slot.data?.uuid || "");
      slot.key = ss.key ?? "_";
      slot.romanNumeralMode = !!ss.romanNumeralMode;
      slot.chordCount = Number(ss.chordCount || 0);
      slot.savedAt = ss.savedAt ?? null;
    });
  } catch (e) {
    console.warn("Could not load bundle state:", e);
  }
}

// ---------- Slot Grid ----------
function renderSlotGrid() {
  const grid = document.getElementById("bundleSlotGrid");
  if (!grid) return;

  grid.innerHTML = "";

  bundleState.slots.forEach((slot, index) => {
    const btn = document.createElement("button");
    const slotNum = String(index + 1).padStart(2, "0");
    btn.textContent = slotNum;

    btn.className = "px-3 py-3 rounded-lg border text-sm font-semibold transition";

    if (index === bundleState.currentSlotIndex) {
      btn.classList.add("ring-2", "ring-purple-500");
    }

    if (slot.status === "saved") {
      btn.classList.add("bg-green-700", "border-green-600", "text-white");
    } else if (slot.status === "error") {
      btn.classList.add("bg-red-700", "border-red-600", "text-white");
    } else {
      btn.classList.add("bg-gray-700", "border-gray-600", "text-gray-300", "hover:bg-gray-600");
    }

    btn.addEventListener("click", () => {
      goToSlot(index);
      // goToSlot already calls updateSlotIndicator()
    });

    grid.appendChild(btn);
  });
}

// ---------- ZIP button gating ----------
function updateZipButtonState() {
  const btn = document.getElementById("downloadBundleBtn");
  if (!btn) return;

  const check = validateFullBundle();
  btn.disabled = !check.valid;
  btn.title = check.valid ? "Download bundle zip" : `Missing slots: ${check.missingSlots.join(", ")}`;
}

// ---------- fileNumber locking / syncing ----------
function setFileNumberBundleMode(isEnabled) {
  const fileNumberInput = document.getElementById("fileNumber");
  if (!fileNumberInput) return;

  if (isEnabled) {
    fileNumberInput.disabled = true;
    fileNumberInput.classList.add("opacity-50", "cursor-not-allowed");
    fileNumberInput.value = String(bundleState.currentSlotIndex + 1);
  } else {
    fileNumberInput.disabled = false;
    fileNumberInput.classList.remove("opacity-50", "cursor-not-allowed");
  }
}

// ---------- Clear bundle ----------
function clearBundle() {
  for (const slot of bundleState.slots) {
    slot.data = null;
    slot.jsonString = "";
    slot.uuid = "";
    slot.status = "empty";
    slot.error = "";
    slot.key = "_";
    slot.romanNumeralMode = false;
    slot.chordCount = 0;
    slot.savedAt = null;
  }
  bundleState.currentSlotIndex = 0;
  bundleState.updatedAt = Date.now();
  persistBundleState();
  updateSlotIndicator();
}

function syncJsonPanelToCurrentSlot() {
  const slot = bundleState.slots[bundleState.currentSlotIndex];

  // These already exist in your file as globals:
  // const outputSection = document.getElementById('outputSection');
  // const jsonOutput = document.getElementById('jsonOutput');
  // :contentReference[oaicite:3]{index=3}

  // If you're in bundle mode, keep the panel usable while navigating
  if (isBundleModeEnabled()) {
    outputSection.classList.remove("hidden"); // outputSection is hidden by default :contentReference[oaicite:4]{index=4}

    if (slot.status === "saved" && slot.jsonString) {
      jsonOutput.textContent = slot.jsonString; // jsonOutput is your <pre id="jsonOutput"> :contentReference[oaicite:5]{index=5}
    } else if (slot.status === "error") {
      jsonOutput.textContent = `// Slot ${String(slot.index + 1).padStart(2, "0")} error:\n// ${slot.error || "Unknown error"}`;
    } else {
      jsonOutput.textContent = `// Slot ${String(slot.index + 1).padStart(2, "0")} is empty.\n// Generate JSON to save into this slot.`;
    }
  }
}

// ---------- IMPORTANT: replace your current updateSlotIndicator with this upgraded one ----------
function updateSlotIndicator() {
  const slot = bundleState.slots[bundleState.currentSlotIndex];
  const slotNum = String(slot.index + 1).padStart(2, "0");

  const currentSlotLabel = document.getElementById("currentSlotLabel");
  const currentSlotStatus = document.getElementById("currentSlotStatus");
  const currentSlotMeta = document.getElementById("currentSlotMeta");

  if (currentSlotLabel) currentSlotLabel.textContent = `${slotNum}/${BUNDLE_SLOT_COUNT}`;

  if (currentSlotStatus) {
    const label = slot.status === "saved" ? "Saved" : (slot.status === "error" ? "Error" : "Empty");
    currentSlotStatus.textContent = label;
    currentSlotStatus.className = "text-xs px-2 py-1 rounded-md border";

    if (slot.status === "saved") {
      currentSlotStatus.classList.add("bg-green-700", "text-white", "border-green-600");
    } else if (slot.status === "error") {
      currentSlotStatus.classList.add("bg-red-700", "text-white", "border-red-600");
    } else {
      currentSlotStatus.classList.add("bg-gray-700", "text-gray-200", "border-gray-600");
    }
  }

  if (currentSlotMeta) {
    if (slot.status === "saved") {
      const key = slot.key && slot.key !== "_" ? slot.key : "—";
      const rn = slot.romanNumeralMode ? "RN" : "No RN";
      currentSlotMeta.textContent = `${slot.chordCount} chords | Key: ${key} | ${rn}`;
      currentSlotMeta.classList.remove("hidden");
    } else if (slot.status === "error") {
      currentSlotMeta.textContent = slot.error || "Error saving slot";
      currentSlotMeta.classList.remove("hidden");
    } else {
      currentSlotMeta.textContent = "—";
      currentSlotMeta.classList.add("hidden");
    }
  }

  // Keep fileNumber synced (in bundle mode it’s disabled)
  const fileNumberInput = document.getElementById("fileNumber");
  if (fileNumberInput) fileNumberInput.value = String(slot.index + 1);

  const hint = document.getElementById("bundleModeHint");
if (hint) {
  if (isBundleModeEnabled()) hint.classList.remove("hidden");
  else hint.classList.add("hidden");
}

  syncJsonPanelToCurrentSlot();

  renderSlotGrid();
  updateZipButtonState();
  persistBundleState();
}


// Bundle UI wiring
const bundlePrevBtn = document.getElementById("bundlePrevBtn");
const bundleNextBtn = document.getElementById("bundleNextBtn");
const bundleClearChordsBtn = document.getElementById("bundleClearChordsBtn");
const bundleClearSlotBtn = document.getElementById("bundleClearSlotBtn");
const bundleClearBundleBtn = document.getElementById("bundleClearBundleBtn");
const bundleNameInput = document.getElementById("bundleNameInput");

if (bundlePrevBtn) bundlePrevBtn.addEventListener("click", prevSlot);
if (bundleNextBtn) bundleNextBtn.addEventListener("click", nextSlot);



if (bundleClearSlotBtn) bundleClearSlotBtn.addEventListener("click", () => {
  const slot = bundleState.slots[bundleState.currentSlotIndex];
  slot.data = null;
  slot.jsonString = "";
  slot.uuid = "";
  slot.status = "empty";
  slot.error = "";
  slot.key = "_";
  slot.romanNumeralMode = false;
  slot.chordCount = 0;
  slot.savedAt = null;
  updateSlotIndicator();
});

if (bundleClearBundleBtn) bundleClearBundleBtn.addEventListener("click", clearBundle);

if (bundleClearChordsBtn) bundleClearChordsBtn.addEventListener("click", () => {
  clearChordInputs();
});


if (bundleNameInput) {
  bundleNameInput.addEventListener("input", (e) => {
    bundleState.bundleName = e.target.value.trim();
    updateZipButtonState();
    persistBundleState();
  });
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

updateSlotIndicator();

    // Event listeners
    addChordBtn.addEventListener('click', addChordInput);
    generateBtn.addEventListener('click', generateJSON);
    copyBtn.addEventListener('click', copyToClipboard);
    downloadBtn.addEventListener('click', downloadJSON);

    function updateRomanToggleState() {
  const keySelector = document.getElementById("keySelector");
  if (keySelector) {
  keySelector.addEventListener("change", updateRomanToggleState);
}
  const romanToggle = document.getElementById("romanNumeralMode");

  if (!keySelector || !romanToggle) return;

  const hasKey = keySelector.value && keySelector.value !== "_";

  romanToggle.disabled = !hasKey;

  if (!hasKey) {
    romanToggle.checked = false; // prevent stale state
    romanToggle.classList.add("opacity-50", "cursor-not-allowed");
  } else {
    romanToggle.classList.remove("opacity-50", "cursor-not-allowed");
  }
}


    document.addEventListener('keydown', function (e) {
        // If Shift + Z is pressed
        if (e.shiftKey && (e.key === 'Z' || e.key === 'z')) {
            const annotateBtn = document.getElementById('annotateExportBtn');
            if (annotateBtn) annotateBtn.style.display = "block";
            const romanNumeralDiv = document.getElementById('romanNumeralDiv');
            if (romanNumeralDiv) romanNumeralDiv.style.display = "block";
            const keySelectorDiv = document.getElementById('keySelectorDiv');
            if (keySelectorDiv) keySelectorDiv.style.display = "block";

            updateRomanToggleState();


            const bundleSection = document.getElementById("bundleSection");
            if (bundleSection) bundleSection.classList.remove("hidden");
            setFileNumberBundleMode(true);
            updateSlotIndicator();
            updateGenerateButtonLabel();


            // Make JSON output editable on Shift+Z
            const jsonOutput = document.getElementById('jsonOutput');
            if (jsonOutput) jsonOutput.setAttribute('contenteditable', 'true');

        }
    });


    // Annotated export (private feature)

    // const annotateExportBtn = document.getElementById('annotateExportBtn');
    // if (annotateExportBtn) {
    //     annotateExportBtn.addEventListener('click', function () {
    //         const setName = document.getElementById('setName').value.trim() || 'Chord Set';
    //         const key = document.getElementById('keySelector').value;
    //         // Pull from the chordContainer you initialized at the top
    //         const chordInputs = chordContainer.querySelectorAll('input');

    //         // Build chordNames just like in generateJSON
    //         const chordNames = Array.from(chordInputs).map(input => input.value.trim()).filter(
    //             name => name);

    //         if (chordNames.length === 0) {
    //             alert('No chords to annotate.');
    //             return;
    //         }

    //         let output = `Chord Set: ${setName}\nKey: ${key} Major\n\n`;
    //         output += "Pad\tChord\tAnalysis\n";
    //         output += "----------------------------------------\n";
    //         chordNames.forEach((chord, i) => {
    //             let theory = detectChordOriginAuto(chord, key);
    //             output += `${i + 1}\t${chord}\t${theory}\n`;
    //         });

    //         // Download as text file
    //         const blob = new Blob([output], {
    //             type: 'text/plain'
    //         });
    //         const url = URL.createObjectURL(blob);
    //         const a = document.createElement('a');
    //         a.href = url;
    //         a.download = `annotated_${setName.replace(/\s+/g, "_")}.txt`;
    //         document.body.appendChild(a);
    //         a.click();
    //         document.body.removeChild(a);
    //         URL.revokeObjectURL(url);
    //     });
    // }

function clearChordInputs() {
  const chordContainer = document.querySelector(".chord-input-container");
  if (!chordContainer) return;

  const inputs = chordContainer.querySelectorAll("input");
  inputs.forEach((input) => (input.value = ""));

  // optional: move cursor to pad 1 so it feels instant
  if (inputs[0]) inputs[0].focus();
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
        'madd9': [0, 4, 7, 11, 14],
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
        'b5': [0, 4, 6],
        'm6/9': [0, 3, 7, 9, 14],
        'maj6/9': [0, 4, 7, 9, 14],

        // Sharp(#)5 chords
        'm#5': [0, 3, 8],
        'mi#5': [0, 3, 8],
        'min#5': [0, 3, 8],

        // Dominant sus
        '7sus4': [0, 5, 7, 10],

        // Altered dominants (single alteration)
        '7#9':  [0, 4, 7, 10, 15], // #9 = 15
        '7b13': [0, 4, 7, 10, 20], // b13 = 20

        '7sus2': [0, 2, 7, 10],      // Eb7sus2
        '7add11': [0, 4, 7, 10, 17], // A7add11 (your preferred "11 behavior" basically)
        '7#11': [0, 4, 7, 10, 18],   // B7#11
        '7alt': [0, 4, 6, 10, 15, 20], // C7alt (common altered set: b5, #9, b13)

        '6add9': [0, 4, 7, 9, 14],
        'm6add9': [0, 3, 7, 9, 14],
        'maj6add9': [0, 4, 7, 9, 14],


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

        // --- slash-friendly / common shorthand ---
        'sus7': '7sus4',     // BbSus7 -> Bb7sus4 (common shorthand)
        '7sus': '7sus4',     // sometimes people type this
        'add7': '7',         // Fadd7 -> treat like F7 (triad + b7)
        '7add11': '7add11',  // allow as explicit type


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
  // 1) direct match wins
  if (chordMap[type]) return chordMap[type];

  // 2) If it's a dominant with modifiers, build it
  // Supports: 7b9, 7#9, 7b13, 7#11, 7b5, 7#5, combos like 7b9#5, plus sus2/sus4 and add11
  if (type.startsWith('7')) {
    let intervals = [0, 4, 7, 10]; // base dominant 7

    // SUS replaces the 3rd
    if (type.includes('sus2')) {
      intervals = [0, 2, 7, 10];
    } else if (type.includes('sus4') || type === '7sus') {
      intervals = [0, 5, 7, 10];
    }

    // add11 (keep 3rd, add 11)
    if (type.includes('add11')) intervals.push(17);

    // alterations
    const hasB5 = type.includes('b5');
    const hasSharp5 = type.includes('#5');
    const hasB9 = type.includes('b9');
    const hasSharp9 = type.includes('#9');
    const hasSharp11 = type.includes('#11');
    const hasB13 = type.includes('b13');

    // handle 5th alteration by replacing 7 if present
    if (hasB5 || hasSharp5) {
      intervals = intervals.map(i => (i === 7 ? (hasB5 ? 6 : 8) : i));
    }

    if (hasB9) intervals.push(13);
    if (hasSharp9) intervals.push(15);
    if (hasSharp11) intervals.push(18);
    if (hasB13) intervals.push(20);

    // unique + sorted
    intervals = Array.from(new Set(intervals)).sort((a, b) => a - b);
    return intervals;
  }

  // 3) fallback: plain triad
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
        let mainChord = splitSlashBassSmart(chordName).main;
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

function isNoteToken(token) {
  return /^[A-G](?:b|#)?$/i.test(token.trim());
}

function isSlashExtensionToken(token) {
  return /^(?:b|#)?(?:9|11|13)$/.test(token.trim());
}

function normalizeSlashExtensions(chordName) {
  chordName = chordName.trim();

  const parts = chordName.split("/").map(s => s.trim());
  if (parts.length === 1) return chordName;

  let base = parts[0];
  const tail = parts.slice(1);

  // If first slash token is a note, it's a real slash chord
  if (tail.length && isNoteToken(tail[0])) {
    return chordName;
  }

  for (const t of tail) {
    if (isSlashExtensionToken(t)) {
      base += `add${t}`;
    } else {
      // unknown slash usage, do nothing
      return chordName;
    }
  }

  return base;
}



    // Function to parse chord name and return note values
    function parseChord(chordName) {

       // 🔧 normalize compound slash-extensions FIRST
  chordName = normalizeSlashExtensions(chordName);

  // 1) Exact-match override
  if (explicitVoicing[chordName]) return explicitVoicing[chordName];

  let mainChord = chordName;
  let bassNote = null;

  // 2) Slash chords
  if (chordName.includes("/")) {
    [mainChord, bassNote] = chordName.split("/");
    mainChord = mainChord.trim();
    bassNote = bassNote.trim();
  }

  // 3) Root + type
  const rootMatch = mainChord.match(/^([A-Ga-g][#b]?)/i);
  if (!rootMatch) return null;

  let root = rootMatch[1];
  root = root.charAt(0).toUpperCase() + (root.length > 1 ? root.slice(1).toLowerCase() : "");

  let type = mainChord.slice(rootMatch[0].length).toLowerCase();
  type = chordAliases[type] || type;

    // normalize "6add9" -> "6/9" so it hits chordMap
  type = type
    .replace(/^6add9$/, "6/9")
    .replace(/^m6add9$/, "m6/9")
    .replace(/^maj6add9$/, "maj6/9");


  const intervals = getChordIntervals(type);

  const rootSemitone = rootNoteMap[root];
  if (rootSemitone === undefined) return null;

  const rootMidi = rootSemitone + 48;

  let noteValues = [];

  // 4) Bass handling
  if (bassNote) {
    const bassRootMatch = bassNote.match(/^([A-Ga-g][#b]?)/i);
    if (bassRootMatch) {
      let bassRoot = bassRootMatch[1];
      bassRoot = bassRoot.charAt(0).toUpperCase() + (bassRoot.length > 1 ? bassRoot.slice(1).toLowerCase() : "");
      const bassSemitone = rootNoteMap[bassRoot];
      if (bassSemitone !== undefined) {
        const bassMidi = bassSemitone + 48;
        noteValues.push(midiToValue(bassMidi - 12));
      }
    }
  } else {
    // default bass = root down an octave
    noteValues.push(midiToValue(rootMidi - 12));
  }

  // 5) Chord tones: root + all intervals
  noteValues.push(midiToValue(rootMidi)); // root
  for (let i = 1; i < intervals.length; i++) {
    noteValues.push(midiToValue(rootMidi + intervals[i]));
  }

  // 6) Optional octave root (ONLY when safe)
  // Avoid for altered dominants / tension-heavy stuff (b/# 5,9,11,13 or "alt")
  if (!/^7.*([b#](5|9|11|13)|alt)/.test(type)) {
    noteValues.push(midiToValue(rootMidi + 12));
  }

  // 7) Clean up
  noteValues = Array.from(new Set(noteValues)).sort((a, b) => a - b);
  return noteValues;
}


function isBundleModeEnabled() {
  const bundleSection = document.getElementById("bundleSection");
  const fileNumberInput = document.getElementById("fileNumber");

  // Bundle mode is considered "on" once Shift+Z reveals the bundle section OR locks fileNumber
  const sectionVisible = bundleSection && !bundleSection.classList.contains("hidden");
  const fileLocked = fileNumberInput && fileNumberInput.disabled;

  return !!(sectionVisible || fileLocked);
}

function updateGenerateButtonLabel() {
  const btn = document.getElementById("generateBtn");
  if (!btn) return;

  if (isBundleModeEnabled()) {
    btn.innerHTML = "&lt;/&gt; Generate JSON / Save to Slot";
  } else {
    btn.textContent = "Generate JSON";
  }
}


   // Function to generate JSON output (now also auto-saves in bundle mode)
function generateJSON() {
  const result = buildJsonDataFromUI();

  if (result.error) {
    alert(result.error);
    return;
  }

  // Display the JSON (single source of truth)
  jsonOutput.textContent = result.jsonString;
  outputSection.classList.remove('hidden');
  const annotateBtn = document.getElementById('annotateExportBtn');
if (annotateBtn) annotateBtn.style.display = "none";


  // Auto-save into the current bundle slot if bundle mode is enabled
  if (isBundleModeEnabled()) {
  const ok = saveCurrentSlot();

  updateSlotIndicator();

  if (!ok) {
    const slot = bundleState.slots[bundleState.currentSlotIndex];
    if (slot?.error) alert(slot.error);
    return;
  }

  goToNextAvailableSlot();

  // keep showing generated JSON (your existing behavior)
  jsonOutput.textContent = result.jsonString;
  outputSection.classList.remove("hidden");

  // ✅ NEW: wipe set name after successful save + advance
  const setNameInput = document.getElementById("setName");
  if (setNameInput) {
    setNameInput.value = "";
    setNameInput.focus();
  }
}


}


function buildJsonDataFromUI() {
  const setName = document.getElementById('setName').value.trim();
  if (!setName) {
    return { error: "Set name is required" };
  }

  const chordInputs = chordContainer.querySelectorAll('input');
  const chordNames = Array.from(chordInputs)
    .map(input => input.value.trim())
    .filter(Boolean);

  if (chordNames.length === 0) {
    return { error: "At least one chord is required" };
  }

  const romanNumeralMode = document.getElementById('romanNumeralMode').checked;
  const key = document.getElementById('keySelector').value;

  const chords = [];

  for (const chordName of chordNames) {
    const noteValues = parseChord(chordName);
    if (!noteValues) {
      return { error: `Invalid chord: ${chordName}` };
    }

    let mainChord = chordName.includes("/") ? chordName.split("/")[0].trim() : chordName;
    const rootMatch = mainChord.match(/^([A-Ga-g][#b]?)/i);
    let root = rootMatch ? rootMatch[1] : chordName;
    root = root.charAt(0).toUpperCase() + root.slice(1).toLowerCase();
    let type = mainChord.slice(rootMatch ? rootMatch[0].length : 0).toLowerCase();

    let displayName = chordName;
    if (romanNumeralMode) {
      const roman = getRomanNumeralName(root, type, key);
      displayName = roman === "?" ? chordName : roman;
    }

    chords.push({
      name: displayName,
      notes: noteValues
    });
  }

  const finalName = key === "_" ? setName : `${key}_${setName}`;

  const jsonData = {
    chords,
    name: finalName,
    typeId: "native-instruments-chord-set",
    uuid: crypto.randomUUID(),
    version: "1.0.0"
  };

  return {
    jsonData,
    jsonString: JSON.stringify(jsonData, null, 2),
    meta: {
      setName: finalName,
      key,
      romanNumeralMode,
      chordCount: chords.length
    }
  };
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

async function downloadBundleZip() {
  // strict 16/16 enforcement
  const check = validateFullBundle();
  if (!check.valid) {
    alert(`Bundle incomplete. Missing slots: ${check.missingSlots.join(", ")}`);
    return;
  }

  if (typeof JSZip === "undefined") {
    alert("JSZip not found. Make sure JSZip is loaded before your main script.");
    return;
  }

  const zip = new JSZip();

  // optional: put files inside a folder in the zip
  const folderName = (bundleState.bundleName || "user_chord_sets")
    .trim()
    .replace(/[^\w\-]+/g, "_");
  const folder = zip.folder(folderName);

  // add each slot as a file
  for (const slot of bundleState.slots) {
    // safety guard (should already be saved due to strict check)
    if (slot.status !== "saved" || !slot.jsonString) continue;

    // deterministic naming
    const fileName =
      `${bundleState.filePrefix}${String(slot.index + 1).padStart(2, "0")}.json`;

    folder.file(fileName, slot.jsonString);
  }

  const blob = await zip.generateAsync({ type: "blob" });

  const zipName = `${folderName}.zip`;
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
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