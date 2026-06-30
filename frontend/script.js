const API_URL = "http://127.0.0.1:8000/predict";
const HISTORY_KEY = "bhava_history";
const MAX_HISTORY = 12;

/* Order must match predictor.py EMOTIONS array exactly.
   Colors loosely follow the traditional Natyashastra rasa-color associations. */
const RASAS = [
  { key: "Veera",     label: "V\u012Bra",      desc: "Heroism",     color: "#D9A441" },
  { key: "Karuna",    label: "Karu\u1E47\u0101", desc: "Compassion",  color: "#9C9690" },
  { key: "Rowdra",    label: "Raudra",      desc: "Fury",        color: "#A6231C" },
  { key: "Haasya",    label: "H\u0101sya",     desc: "Mirth",       color: "#E8C36B" },
  { key: "Shantha",   label: "\u015A\u0101nta",   desc: "Peace",       color: "#9FC2B4" },
  { key: "Singara",   label: "\u015A\u1E5B\u0144g\u0101ra", desc: "Love",        color: "#1F5C4A" },
  { key: "Bhayanaka", label: "Bhay\u0101naka", desc: "Fear",        color: "#3A2E28" },
  { key: "Adbhuta",   label: "Adbhuta",     desc: "Wonder",      color: "#D9B23E" },
  { key: "Bhibatsya", label: "B\u012Bbhatsa",  desc: "Disgust",     color: "#27506B" }
];

const SEGMENT_ANGLE = 360 / RASAS.length;

/* ---------- DOM refs ---------- */
const dropzone = document.getElementById("dropzone");
const dropzoneEmpty = document.getElementById("dropzoneEmpty");
const dropzoneFilled = document.getElementById("dropzoneFilled");
const imageInput = document.getElementById("imageInput");
const preview = document.getElementById("preview");
const changeImageBtn = document.getElementById("changeImageBtn");
const predictBtn = document.getElementById("predictBtn");
const btnSpinnerImg = document.getElementById("btnSpinnerImg");
const errorMsg = document.getElementById("errorMsg");
const mandalaSvg = document.getElementById("mandalaSvg");
const centerLabel = document.getElementById("centerLabel");
const centerSub = document.getElementById("centerSub");
const resultBanner = document.getElementById("resultBanner");
const resultName = document.getElementById("resultName");
const confidenceBlock = document.getElementById("confidenceBlock");
const confidenceValue = document.getElementById("confidenceValue");
const confidenceFill = document.getElementById("confidenceFill");
const legend = document.getElementById("legend");
const historyStrip = document.getElementById("historyStrip");
const historyEmpty = document.getElementById("historyEmpty");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

const modeImageBtn = document.getElementById("modeImageBtn");
const modeWebcamBtn = document.getElementById("modeWebcamBtn");
const imageMode = document.getElementById("imageMode");
const webcamMode = document.getElementById("webcamMode");
const webcamVideo = document.getElementById("webcamVideo");
const webcamCanvas = document.getElementById("webcamCanvas");
const webcamStatus = document.getElementById("webcamStatus");
const startCameraBtn = document.getElementById("startCameraBtn");
const captureBtn = document.getElementById("captureBtn");
const btnSpinnerCam = document.getElementById("btnSpinnerCam");
const liveToggle = document.getElementById("liveToggle");

let selectedFile = null;
let webcamStream = null;
let liveIntervalId = null;

/* ---------- Mandala drawing ---------- */
function polarToCartesian(cx, cy, r, angleDeg) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return ["M", cx, cy, "L", start.x, start.y, "A", r, r, 0, largeArc, 0, end.x, end.y, "Z"].join(" ");
}

function buildMandala() {
  const cx = 150, cy = 150, r = 132;
  const parts = [];

  RASAS.forEach((rasa, i) => {
    const startAngle = i * SEGMENT_ANGLE;
    const endAngle = startAngle + SEGMENT_ANGLE;
    parts.push(
      `<path class="mandala-seg" data-key="${rasa.key}" d="${arcPath(cx, cy, r, startAngle, endAngle)}" fill="${rasa.color}" stroke="#FAF2E1" stroke-width="2"></path>`
    );
  });

  // outer ring + center medallion
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#C9972C" stroke-width="1.5" opacity="0.5"></circle>`);
  parts.push(`<circle cx="${cx}" cy="${cy}" r="46" fill="#FAF2E1" stroke="#C9972C" stroke-width="1.5"></circle>`);

  // simple original lotus-style center mark (geometric, not a reproduction of any existing artwork)
  parts.push(`<g opacity="0.55" stroke="#6B0F1A" stroke-width="1.2" fill="none">
    <path d="M150 118 C158 130 158 142 150 150 C142 142 142 130 150 118 Z"></path>
    <path d="M122 134 C136 138 144 146 146 156 C132 154 122 146 122 134 Z"></path>
    <path d="M178 134 C164 138 156 146 154 156 C168 154 178 146 178 134 Z"></path>
  </g>`);

  // needle
  parts.push(`<line id="mandalaNeedle" class="mandala-needle" x1="150" y1="150" x2="150" y2="28" transform="rotate(${SEGMENT_ANGLE / 2} 150 150)"></line>`);
  parts.push(`<circle cx="150" cy="150" r="5" fill="#C9972C"></circle>`);

  mandalaSvg.innerHTML = parts.join("");
}

function buildLegend() {
  legend.innerHTML = RASAS.map(
    (rasa) =>
      `<li class="legend-item" data-key="${rasa.key}">
         <span class="legend-dot" style="background:${rasa.color}"></span>
         ${rasa.label}
       </li>`
  ).join("");
}

function highlightRasa(key) {
  document.querySelectorAll(".mandala-seg").forEach((el) => {
    el.classList.toggle("is-active", el.dataset.key === key);
  });
  document.querySelectorAll(".legend-item").forEach((el) => {
    el.classList.toggle("is-active", el.dataset.key === key);
  });

  const index = RASAS.findIndex((r) => r.key === key);
  if (index === -1) return;
  const midAngle = index * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
  const needle = document.getElementById("mandalaNeedle");
  if (needle) needle.setAttribute("transform", `rotate(${midAngle} 150 150)`);
}

/* ---------- Dropzone / file handling ---------- */
function setSelectedFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    showError("Please choose an image file (JPG or PNG).");
    return;
  }
  selectedFile = file;
  preview.src = URL.createObjectURL(file);
  dropzoneEmpty.hidden = true;
  dropzoneFilled.hidden = false;
  predictBtn.disabled = false;
  clearError();
}

function resetFile() {
  selectedFile = null;
  imageInput.value = "";
  dropzoneEmpty.hidden = false;
  dropzoneFilled.hidden = true;
  predictBtn.disabled = true;
}

dropzone.addEventListener("click", (e) => {
  if (e.target === changeImageBtn) return;
  if (!dropzoneFilled.hidden) return;
  imageInput.click();
});

dropzone.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && dropzoneFilled.hidden) {
    e.preventDefault();
    imageInput.click();
  }
});

changeImageBtn.addEventListener("click", () => imageInput.click());

imageInput.addEventListener("change", () => {
  if (imageInput.files[0]) setSelectedFile(imageInput.files[0]);
});

["dragenter", "dragover"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("is-dragover");
  })
);

["dragleave", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("is-dragover");
  })
);

dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (file) setSelectedFile(file);
});

/* ---------- Errors ---------- */
function showError(message) {
  errorMsg.textContent = message;
  errorMsg.hidden = false;
}
function clearError() {
  errorMsg.hidden = true;
  errorMsg.textContent = "";
}

/* ---------- Prediction (shared by upload + webcam) ---------- */
predictBtn.addEventListener("click", () => {
  if (!selectedFile) return;
  runPrediction(selectedFile);
});

async function runPrediction(fileOrBlob) {
  clearError();
  setLoading(true);

  try {
    const formData = new FormData();
    formData.append("file", fileOrBlob, "frame.jpg");

    const response = await fetch(API_URL, { method: "POST", body: formData });
    if (!response.ok) throw new Error("Server returned " + response.status);

    const data = await response.json();
    renderResult(data);
    await addToHistory(data, fileOrBlob);
  } catch (err) {
    console.error(err);
    showError("Couldn't read the rasa. Check that the backend is running and try again.");
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  const inWebcam = !webcamMode.hidden;
  predictBtn.disabled = isLoading || !selectedFile;
  captureBtn.disabled = isLoading || !webcamStream;
  btnSpinnerImg.hidden = !(isLoading && !inWebcam);
  btnSpinnerCam.hidden = !(isLoading && inWebcam);
  const label = isLoading ? "Reading\u2026" : inWebcam ? "Capture & read" : "Read the Bh\u0101va";
  const activeBtn = inWebcam ? captureBtn : predictBtn;
  activeBtn.querySelector(".btn-label").textContent = label;
}

function renderResult(data) {
  const rasa = RASAS.find((r) => r.key === data.emotion);
  const niceName = rasa ? `${rasa.desc} (${rasa.label})` : data.emotion;

  // clear, always-visible readout (fixes hard-to-spot result)
  resultBanner.hidden = false;
  resultName.textContent = `${niceName} \u00b7 ${data.confidence}%`;

  centerLabel.textContent = rasa ? rasa.label : data.emotion;
  centerSub.textContent = rasa ? rasa.desc : "rasa";

  highlightRasa(data.emotion);

  confidenceBlock.hidden = false;
  confidenceValue.textContent = `${data.confidence}%`;
  confidenceFill.style.width = "0%";
  requestAnimationFrame(() => {
    confidenceFill.style.width = `${Math.min(100, Math.max(0, data.confidence))}%`;
  });
}

/* ---------- Mode toggle ---------- */
function setMode(mode) {
  const isImage = mode === "image";
  imageMode.hidden = !isImage;
  webcamMode.hidden = isImage;
  modeImageBtn.classList.toggle("is-active", isImage);
  modeWebcamBtn.classList.toggle("is-active", !isImage);
  modeImageBtn.setAttribute("aria-selected", String(isImage));
  modeWebcamBtn.setAttribute("aria-selected", String(!isImage));
  clearError();
  if (isImage) stopCamera();
}

modeImageBtn.addEventListener("click", () => setMode("image"));
modeWebcamBtn.addEventListener("click", () => setMode("webcam"));

/* ---------- Webcam ---------- */
async function startCamera() {
  try {
    webcamStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    webcamVideo.srcObject = webcamStream;
    webcamStatus.textContent = "Camera live";
    captureBtn.disabled = false;
    captureBtn.hidden = false;
    liveToggle.disabled = false;
    startCameraBtn.querySelector(".btn-label").textContent = "Stop camera";
  } catch (err) {
    console.error(err);
    showError("Couldn't access the webcam. Check browser permissions.");
  }
}

function stopCamera() {
  if (webcamStream) {
    webcamStream.getTracks().forEach((t) => t.stop());
    webcamStream = null;
  }
  webcamVideo.srcObject = null;
  webcamStatus.textContent = "Camera off";
  captureBtn.disabled = true;
  captureBtn.hidden = true;
  liveToggle.checked = false;
  liveToggle.disabled = true;
  startCameraBtn.querySelector(".btn-label").textContent = "Start camera";
  stopLiveDetection();
}

startCameraBtn.addEventListener("click", () => {
  if (webcamStream) stopCamera();
  else startCamera();
});

function captureFrame() {
  return new Promise((resolve) => {
    webcamCanvas.width = webcamVideo.videoWidth || 320;
    webcamCanvas.height = webcamVideo.videoHeight || 240;
    const ctx = webcamCanvas.getContext("2d");
    ctx.drawImage(webcamVideo, 0, 0, webcamCanvas.width, webcamCanvas.height);
    webcamCanvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
  });
}

captureBtn.addEventListener("click", async () => {
  if (!webcamStream) return;
  const blob = await captureFrame();
  if (blob) runPrediction(blob);
});

function startLiveDetection() {
  stopLiveDetection();
  liveIntervalId = setInterval(async () => {
    if (!webcamStream || captureBtn.disabled) return;
    const blob = await captureFrame();
    if (blob) runPrediction(blob);
  }, 2500);
}

function stopLiveDetection() {
  if (liveIntervalId) {
    clearInterval(liveIntervalId);
    liveIntervalId = null;
  }
}

liveToggle.addEventListener("change", () => {
  if (liveToggle.checked) startLiveDetection();
  else stopLiveDetection();
});

window.addEventListener("beforeunload", stopCamera);

/* ---------- History (localStorage) ---------- */
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function saveHistory(items) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
}

function makeThumbnail(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const size = 96;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
}

async function addToHistory(data, file) {
  const thumb = await makeThumbnail(file);
  const rasa = RASAS.find((r) => r.key === data.emotion);
  const entry = {
    emotion: data.emotion,
    label: rasa ? rasa.label : data.emotion,
    confidence: data.confidence,
    thumb,
    time: new Date().toLocaleString()
  };

  const items = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  saveHistory(items);
  renderHistory();
}

function renderHistory() {
  const items = loadHistory();
  historyEmpty.hidden = items.length > 0;

  historyStrip.querySelectorAll(".history-card").forEach((el) => el.remove());

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "history-card";
    card.innerHTML = `
      <img src="${item.thumb}" alt="Past upload predicted as ${item.label}">
      <p class="history-rasa">${item.label}</p>
      <p class="history-meta">${item.confidence}% &middot; ${item.time}</p>
    `;
    historyStrip.appendChild(card);
  });
}

clearHistoryBtn.addEventListener("click", () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});

/* ---------- Init ---------- */
buildMandala();
buildLegend();
renderHistory();