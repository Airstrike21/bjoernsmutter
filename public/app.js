const form = document.querySelector("#uploadForm");
const photosInput = document.querySelector("#photos");
const guestNameInput = document.querySelector("#guestName");
const uploadButton = document.querySelector("#uploadButton");
const selection = document.querySelector("#selection");
const progressArea = document.querySelector("#progressArea");
const progressText = document.querySelector("#progressText");
const progressCount = document.querySelector("#progressCount");
const progressBar = document.querySelector("#progressBar");
const message = document.querySelector("#message");

const MAX_FILES = 50;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"
]);

photosInput.addEventListener("change", () => {
  hideMessage();
  const files = [...photosInput.files];
  const invalid = files.filter(file => !ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_SIZE);

  if (files.length > MAX_FILES) {
    showMessage(`Bitte höchstens ${MAX_FILES} Bilder gleichzeitig auswählen.`, "error");
    photosInput.value = "";
  } else if (invalid.length) {
    showMessage("Mindestens eine Datei ist kein unterstütztes Bild oder größer als 20 MB.", "error");
    photosInput.value = "";
  }

  const selected = [...photosInput.files];
  selection.hidden = selected.length === 0;
  selection.textContent = selected.length
    ? `${selected.length} Bild${selected.length === 1 ? "" : "er"} ausgewählt · ${formatBytes(selected.reduce((sum, f) => sum + f.size, 0))}`
    : "";
  updateButton();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const files = [...photosInput.files];
  if (!files.length) return;

  uploadButton.disabled = true;
  progressArea.hidden = false;
  progressBar.value = 0;
  hideMessage();

  let success = 0;
  const failures = [];

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    progressText.textContent = `Lade ${file.name} hoch`;
    progressCount.textContent = `${index + 1} / ${files.length}`;

    const data = new FormData();
    data.append("photo", file, file.name);
    data.append("guestName", guestNameInput.value.trim());

    try {
      const response = await fetch("/api/upload", { method: "POST", body: data });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      success++;
    } catch (error) {
      failures.push(`${file.name}: ${error.message}`);
    }

    progressBar.value = Math.round(((index + 1) / files.length) * 100);
  }

  progressText.textContent = "Upload abgeschlossen";
  progressCount.textContent = `${success} von ${files.length}`;

  if (!failures.length) {
    showMessage(`Vielen Dank! ${success} Bild${success === 1 ? "" : "er"} wurde${success === 1 ? "" : "n"} erfolgreich hochgeladen.`, "success");
    photosInput.value = "";
    selection.hidden = true;
  } else {
    showMessage(`${success} erfolgreich, ${failures.length} fehlgeschlagen. ${failures.join(" · ")}`, "error");
  }

  updateButton();
});

function updateButton() {
  uploadButton.disabled = photosInput.files.length === 0;
}

function showMessage(text, type) {
  message.textContent = text;
  message.className = `message ${type}`;
  message.hidden = false;
}

function hideMessage() {
  message.hidden = true;
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
