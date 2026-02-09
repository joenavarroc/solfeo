let audioCtx, analyser, buffer;
let currentIndex = 0;
let exerciseNotes = [];
let octave = 0; // 0 = octava central


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
  C: 261.63,
  D: 293.66,
  E: 329.63,
  F: 349.23,
  G: 392.00,
  A: 440.00,
  B: 493.88
};

let volume = 0.7;

volumeSlider.oninput = e => {
  volume = parseFloat(e.target.value);
};

playBtn.onclick = () => {
  buildExercise();
  playSequence();
  statusEl.textContent = "Escuchá y luego cantá…";
};

startBtn.onclick = async () => {
  audioCtx = new AudioContext();
  await audioCtx.resume();
  const stream = await navigator.mediaDevices.getUserMedia({audio:true});
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  buffer = new Float32Array(analyser.fftSize);
  const source = audioCtx.createMediaStreamSource(stream);
  source.connect(analyser);
  statusEl.textContent = "Cantá las notas…";
  listen();
};

function buildExercise(){
  const key = keySelect.value;
  const type = typeSelect.value;

  // frecuencia base según la nota elegida
  let baseFreq = baseNotes[key];

  // aplicar octava (−2, −1, 0, +1, +2, etc.)
  baseFreq = baseFreq * Math.pow(2, octave);

  // elegir si es escala o arpegio
  let steps = (type === "scale") ? scaleSteps : arpeggioSteps;

  // construir las frecuencias finales
  exerciseNotes = steps.map(step => 
    baseFreq * Math.pow(2, step / 12)
  );

  currentIndex = 0;
  renderNotes();
}

function renderNotes(){
  notesDisplay.innerHTML = "";

  const key = keySelect.value; // C, D, E...
  const keyIndex = chromaticNotes.indexOf(key);

  const steps = (typeSelect.value === "scale") 
    ? scaleSteps 
    : arpeggioSteps;

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

function playSequence(){
  let i = 0;
  const interval = setInterval(()=>{
    playNote(exerciseNotes[i]);
    i++;
    if(i >= exerciseNotes.length) clearInterval(interval);
  }, 800);
}

function playNote(freq){
  if(!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.frequency.value = freq;
  osc.type = "sine"; // más limpio para cantar

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  gain.gain.value = volume;

  osc.start();
  osc.stop(audioCtx.currentTime + 0.6);
  
}

function autoCorrelate(buf,sr){
  let SIZE=buf.length;
  let rms=0;
  for(let i=0;i<SIZE;i++) rms+=buf[i]*buf[i];
  rms=Math.sqrt(rms/SIZE);
  if(rms<0.01) return -1;

  let c=new Array(SIZE).fill(0);
  for(let i=0;i<SIZE;i++)
    for(let j=0;j<SIZE-i;j++)
      c[i]+=buf[j]*buf[j+i];

  let d=0;
  while(c[d]>c[d+1]) d++;

  let max=-1,pos=-1;
  for(let i=d;i<SIZE;i++){
    if(c[i]>max){max=c[i];pos=i;}
  }
  return sr/pos;
}

function listen(){
  analyser.getFloatTimeDomainData(buffer);
  let freq = autoCorrelate(buffer,audioCtx.sampleRate);

  if(freq === -1 || freq < 80 || freq > 1200){
    requestAnimationFrame(listen);
    return;
  }

  if(freq !== -1 && currentIndex < exerciseNotes.length){
    let target = exerciseNotes[currentIndex];
    let diff = freq - target;

    const noteDivs = document.querySelectorAll(".note");

    if(Math.abs(diff) < 15){
      noteDivs[currentIndex].className = "note correct";
      currentIndex++;
    } else {
      noteDivs[currentIndex].className = "note wrong";
    }
  }

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
