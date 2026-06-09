// options.js

document.addEventListener("DOMContentLoaded", init);

async function init() {
  await loadSettings();

  document
    .getElementById("save-settings")
    .addEventListener("click", saveSettings);

  document
    .getElementById("export-backup")
    .addEventListener("click", exportBackup);

  document
    .getElementById("import-backup")
    .addEventListener("click", () => {
      document.getElementById("backup-file").click();
    });

  document
    .getElementById("backup-file")
    .addEventListener("change", importBackup);

  document
    .getElementById("reset-settings")
    .addEventListener("click", resetSettings);
}

async function loadSettings() {
  const settings = await SpaceManager.getSettings();

  document.getElementById("default-new-window").checked =
    settings.defaultOpenInNewWindow ?? true;

  document.getElementById("show-dock").checked =
    settings.showDock ?? false;

  document.getElementById("keyboard-shortcut").value =
    settings.keyboardShortcut ?? "Alt+Shift+S";
}

async function saveSettings() {
  const settings = {
    defaultOpenInNewWindow:
      document.getElementById("default-new-window").checked,

    showDock:
      document.getElementById("show-dock").checked,

    keyboardShortcut:
      document.getElementById("keyboard-shortcut").value.trim() ||
      "Alt+Shift+S"
  };

  await SpaceManager.saveSettings(settings);

  showStatus("Settings saved", "success");
}

async function exportBackup() {
  try {
    const backup = await SpaceManager.exportAll();

    const blob = new Blob([backup], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `fma-space-backup-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);

    showStatus("Backup exported", "success");
  } catch (error) {
    showStatus("Export failed", "error");
  }
}

async function importBackup(event) {
  const file = event.target.files[0];

  if (!file) return;

  try {
    const content = await file.text();

    await SpaceManager.importAll(content);

    showStatus("Backup imported successfully", "success");

    await loadSettings();
  } catch (error) {
    console.error(error);
    showStatus("Invalid backup file", "error");
  }

  event.target.value = "";
}

async function resetSettings() {
  const confirmed = confirm(
    "Reset all FMA Space settings to default values?"
  );

  if (!confirmed) return;

  await SpaceManager.saveSettings({
    defaultOpenInNewWindow: true,
    showDock: false,
    keyboardShortcut: "Alt+Shift+S"
  });

  await loadSettings();

  showStatus("Settings reset", "success");
}

function showStatus(message, type = "success") {
  const status = document.getElementById("status");

  status.textContent = message;
  status.className = `status ${type}`;

  clearTimeout(status._timer);

  status._timer = setTimeout(() => {
    status.textContent = "";
    status.className = "status";
  }, 2500);
}
