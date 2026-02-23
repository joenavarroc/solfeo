let audioCtx, analyser, buffer;
let currentIndex = 0;
let exerciseNotes = [];
let octave = 0; // 0 = octava central
let freqHistory = [];
let isPlaying = false;
let minVolume = 0.01;
let compressor;
let playInterval = null;
let activeSources = [];
let isSequencePlaying = false;
let exerciseNotesAll = [];

const keySelect = document.getElementById("keySelect");
const rangeSelect = document.getElementById("rangeSelect");
const typeSelect = document.getElementById("typeSelect");
const notesDisplay = document.getElementById("notesDisplay");
const statusEl = document.getElementById("status");
const playBtn = document.getElementById("playBtn");
const startBtn = document.getElementById("startBtn");
const noteNames = ["Do","Re","Mi","Fa","Sol","La","Si"];
const volumeSlider = document.getElementById("volume");
const scaleSteps = [0,2,4,5,7,9,11]; // escala mayor
const arpeggioSteps = [0,4,7]; // tríada
const chromaticNotes = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const pianoSamples = {};

const noteNamesES = {
  "C": "Do",
  "C#": "Do#",
  "D": "Re",
  "D#": "Re#",
  "E": "Mi",
  "F": "Fa",
  "F#": "Fa#",
  "G": "Sol",
  "G#": "Sol#",
  "A": "La",
  "A#": "La#",
  "B": "Si"
};

const baseNotes = {
  "C4": 261.63,
  "C#4": 277.18,
  "D4": 293.66,
  "D#4": 311.13,
  "E4": 329.63,
  "F4": 349.23,
  "F#4": 369.99,
  "G4": 392.00,
  "G#4": 415.30,
  "A4": 440.00,
  "A#4": 466.16,
  "B4": 493.88
};

let volume = 2;

volumeSlider.oninput = e => {
  volume = parseFloat(e.target.value);
};

playBtn.onclick = () => {

  if(!audioCtx){
    statusEl.textContent = "Primero activá el micrófono";
    return;
  }

  buildExercise();
  playSequence();
  statusEl.textContent = "Escuchá y luego cantá…";
};

startBtn.onclick = async () => {

  if(audioCtx){
    statusEl.textContent = "Micrófono ya activado";
    return;
  }
  
  audioCtx = new AudioContext();
  await audioCtx.resume();

  // ✅ crear compressor GLOBAL correctamente
  compressor = audioCtx.createDynamicsCompressor();

  compressor.threshold.value = -24;
  compressor.knee.value = 30;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;

  // conectar compressor al destino
  compressor.connect(audioCtx.destination);

  // cargar samples
  await loadPianoSamples();

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    }
  });

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 4096;

  buffer = new Float32Array(analyser.fftSize);

  const source = audioCtx.createMediaStreamSource(stream);
  source.connect(analyser);

  statusEl.textContent = "Cantá las notas…";

  listen();
};

function freqToCents(freq, target){
  return 1200 * Math.log2(freq / target);
}

function getStableFreq(freq){

  if(freq <= 0) return -1;

  freqHistory.push(freq);

  if(freqHistory.length > 6)
    freqHistory.shift();

  let median = [...freqHistory].sort((a,b)=>a-b)[Math.floor(freqHistory.length/2)];

  return median;
}

function buildExercise(){
  const key = keySelect.value + "4";
  const type = typeSelect.value;

  let baseFreq = baseNotes[key] * Math.pow(2, octave);

  // 🔹 SOLO LA PRIMERA NOTA (TÓNICA)
  exerciseNotes = [baseFreq]; // <- Aquí reemplazamos steps.map

  currentIndex = 0;
  renderNotes();
}

function renderNotes(){
  notesDisplay.innerHTML = "";

  const key = keySelect.value;
  const keyIndex = chromaticNotes.indexOf(key);
  const steps = (typeSelect.value === "scale") ? scaleSteps : arpeggioSteps;

  steps.forEach(step => {
    const noteIndex = (keyIndex + step) % 12;
    const noteLetter = chromaticNotes[noteIndex];
    const noteName = noteNamesES[noteLetter];

    const div = document.createElement("div");
    div.className = "note neutral"; // neutral hasta que el usuario cante
    div.textContent = noteName;
    notesDisplay.appendChild(div);
  });
}

function playSequence(){

  if(isSequencePlaying) return;
  isSequencePlaying = true;

  stopAllNotes();

  if(playInterval){
    clearInterval(playInterval);
    playInterval = null;
  }

  currentIndex = 0;
  freqHistory = [];

  let i = 0;

  playInterval = setInterval(()=>{

    if(i >= exerciseNotes.length){

      clearInterval(playInterval);
      playInterval = null;
      isSequencePlaying = false;

      return;
    }

    playNote(exerciseNotes[i]);
    i++;

  }, 800);
}

function autoCorrelate(buffer, sampleRate) {

  let SIZE = buffer.length;
  let rms = 0;

  for (let i = 0; i < SIZE; i++) {
    let val = buffer[i];
    rms += val * val;
  }

  rms = Math.sqrt(rms / SIZE);

  if (rms < 0.003) return -1;

  let r1 = 0, r2 = SIZE - 1;
  const threshold = 0.2;

  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < threshold) {
      r1 = i;
      break;
    }
  }

  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]) < threshold) {
      r2 = SIZE - i;
      break;
    }
  }

  buffer = buffer.slice(r1, r2);
  SIZE = buffer.length;

  let c = new Array(SIZE).fill(0);

  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE - i; j++) {
      c[i] = c[i] + buffer[j] * buffer[j + i];
    }
  }

  let d = 0;
  while (d + 1 < SIZE && c[d] > c[d + 1]) d++;

  let maxval = -1, maxpos = -1;

  for (let i = d; i < SIZE; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }

  let T0 = maxpos;

  if (T0 === 0) return -1;

  return sampleRate / T0;
}

function playNote(freq){

  stopAllNotes();

  isPlaying = true;

  const noteName = getClosestNoteName(freq);

  const sampleBase = noteName.slice(0, -1) + "4";

  const sample = pianoSamples[sampleBase];

  if(!sample){
    console.warn("No sample:", sampleBase);
    isPlaying = false;
    return;
  }

  const source = audioCtx.createBufferSource();
  source.buffer = sample;
  activeSources.push(source);

  const targetOctave = parseInt(noteName.slice(-1));
  const playbackRate = Math.pow(2, targetOctave - 4);

  source.playbackRate.value = playbackRate;

  // ✅ COMPENSACIÓN DE VOLUMEN PROFESIONAL
  const gain = audioCtx.createGain();

  // compensar pérdida de energía al bajar pitch
  const octaveCompensation = 1 / playbackRate;

  // limitar para evitar distorsión
  const safeCompensation = Math.min(octaveCompensation, 4);

  gain.gain.value = volume * safeCompensation;

  source.connect(gain);
  gain.connect(compressor);

  source.start(0);

  source.onended = ()=>{

    // quitar del array
    activeSources = activeSources.filter(s => s !== source);

    setTimeout(()=>{
      isPlaying = false;
      freqHistory = [];
    },200);

  };
}

function listen(){

  analyser.getFloatTimeDomainData(buffer);

  let rms = 0;
  for(let i=0;i<buffer.length;i++)
    rms += buffer[i]*buffer[i];

  rms = Math.sqrt(rms/buffer.length);

  if(rms < 0.002){
    requestAnimationFrame(listen);
    return;
  }
  // BLOQUEAR detección mientras suena oscillator
  if(isPlaying){
    requestAnimationFrame(listen);
    return;
  }

  let freq = autoCorrelate(buffer, audioCtx.sampleRate);
  console.log("freq raw:", freq);
  if(freq !== -1){
    console.log("Frecuencia detectada:", freq);
    const note = getClosestNoteName(freq);
    console.log("Nota detectada:", note);
  }

  if(freq === -1){
    requestAnimationFrame(listen);
    return;
  }

  freq = getStableFreq(freq);

  if(freq < 80 || freq > 1200){
    requestAnimationFrame(listen);
    return;
  }

  if(currentIndex < exerciseNotesAll.length){

    let target = exerciseNotesAll[currentIndex];

    let cents = freqToCents(freq, target);

    const noteDivs = document.querySelectorAll(".note");

    if(Math.abs(cents) < 35){

      noteDivs[currentIndex].className = "note correct";

      currentIndex++;

      // limpiar historial para próxima nota
      freqHistory = [];

      if(currentIndex >= exerciseNotes.length){
        statusEl.textContent = "¡Perfecto! 🎉";
      }

    }
    else if(Math.abs(cents) < 60){

      noteDivs[currentIndex].className = "note close";

    }
    else{

      noteDivs[currentIndex].className = "note wrong";

    }

  }
  console.log("RMS:", rms);
  requestAnimationFrame(listen);
}

const octDown = document.getElementById("octDown");
const octUp = document.getElementById("octUp");
const octaveDisplay = document.getElementById("octaveDisplay");

octDown.onclick = () => {
  if(octave > -2){
    octave--;
    updateOctaveDisplay();
  }
};

octUp.onclick = () => {
  if(octave < 2){
    octave++;
    updateOctaveDisplay();
  }
};

function updateOctaveDisplay(){
  octaveDisplay.textContent = "Octava " + octave;
}

function getClosestNote(freq){

  let closest = "C";
  let minDiff = Infinity;

  for(const note in baseNotes){

    const diff = Math.abs(freq - baseNotes[note]);

    if(diff < minDiff){
      minDiff = diff;
      closest = note;
    }

  }

  return closest;
}

function getClosestNoteName(freq){

  if(freq <= 0) return "C4";

  const noteNames = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

  let closestNote = "C4";
  let minCents = Infinity;

  for(let octaveTest = 2; octaveTest <= 6; octaveTest++){

    for(const note of noteNames){

      const noteName = note + octaveTest;

      const noteFreq =
        baseNotes[note + "4"] *
        Math.pow(2, octaveTest - 4);

      const cents =
        Math.abs(1200 * Math.log2(freq / noteFreq));

      if(cents < minCents){

        minCents = cents;
        closestNote = noteName;

      }

    }

  }

  return closestNote;

}

async function loadPianoSamples(){

  for(const note in baseNotes){

    try{

      const fileName = note.replace("#", "s");

      const response = await fetch("piano/" + fileName + ".mp3");

      if(!response.ok)
        throw new Error("No existe " + fileName);

      const arrayBuffer = await response.arrayBuffer();

      pianoSamples[note] =
        await audioCtx.decodeAudioData(arrayBuffer);

      console.log("Loaded", note);

    }
    catch(e){

      console.error("Error cargando", note, e);

    }

  }

}

function stopAllNotes(){

  activeSources.forEach(src=>{
    try{ src.stop(); }catch(e){}
  });

  activeSources = [];

  isPlaying = false;
}

document.querySelectorAll(".custom-select").forEach(select => {
  const selected = select.querySelector(".selected");
  const options = select.querySelectorAll(".options div");

  selected.addEventListener("click", e => {
    e.stopPropagation(); // 🔥 evita que el document lo cierre
    select.classList.toggle("open");
  });

  options.forEach(opt => {
    opt.addEventListener("click", () => {
      selected.textContent = opt.textContent;
      select.value = opt.dataset.value;
      select.classList.remove("open");
    });
  });
});

// valores iniciales reales
keySelect.value = "C";
typeSelect.value = "scale";

document.addEventListener("click", () => {
  document.querySelectorAll(".custom-select").forEach(select => {
    select.classList.remove("open");
  });
});

function showFullExercise(){
  notesDisplay.innerHTML = "";

  const key = keySelect.value;
  const keyIndex = chromaticNotes.indexOf(key);
  const steps = (typeSelect.value === "scale") ? scaleSteps : arpeggioSteps;

  steps.forEach(step => {
    const noteIndex = (keyIndex + step) % 12;
    const noteLetter = chromaticNotes[noteIndex];
    const noteName = noteNamesES[noteLetter];

    const div = document.createElement("div");
    div.className = "note neutral";
    div.textContent = noteName;
    notesDisplay.appendChild(div);
  });
}

// Llamar al final de playSequence
if(currentIndex >= exerciseNotes.length){
  showFullExercise();
  statusEl.textContent = "¡Perfecto! 🎉";
}

function buildExercise(){
  const key = keySelect.value + "4";
  const type = typeSelect.value;
  const steps = (type === "scale") ? scaleSteps : arpeggioSteps;
  const baseFreq = baseNotes[key] * Math.pow(2, octave);

  // Solo la tónica se reproducirá
  exerciseNotes = [baseFreq];

  // Para verificación, todas las notas
  exerciseNotesAll = steps.map(step => baseFreq * Math.pow(2, step/12));

  currentIndex = 0;
  renderNotes();
}

function showFullExercise() {
  notesDisplay.innerHTML = "";

  const key = keySelect.value;
  const keyIndex = chromaticNotes.indexOf(key);
  const steps = (typeSelect.value === "scale") ? scaleSteps : arpeggioSteps;

  steps.forEach(step => {
    const noteIndex = (keyIndex + step) % 12;
    const noteLetter = chromaticNotes[noteIndex];
    const noteName = noteNamesES[noteLetter];

    const div = document.createElement("div");
    div.className = "note neutral";
    div.textContent = noteName;
    notesDisplay.appendChild(div);
  });

  // ✅ Mostrar mensaje solo al final del ejercicio, NO dentro del forEach
  if(currentIndex >= exerciseNotesAll.length){
      statusEl.textContent = "¡Perfecto! 🎉";
  }
}
