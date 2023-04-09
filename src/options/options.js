const PERMISSIONS = {
  origins: ["https://*.awsapps.com/start/*", "https://*.amazonaws.com/*/profiles"],
};

async function isOptionEnabled(option) {
  const storageContent = await browser.storage.local.get({ configuration: {} });
  const configuration = storageContent.configuration;
  return configuration[option];
}

async function setOptionState(option, value) {
  const storageContent = await browser.storage.local.get({ configuration: {} });
  const configuration = storageContent.configuration;
  configuration[option] = value;
  await browser.storage.local.set({ configuration });
  const optionDiv = document.querySelector(`input#${option}`);
  optionDiv.checked = value;
  return value;
}

async function configureOption(
  option,
  { confirmOptionEnabled, preEnableOption, postDisableOption }
) {
  const optionDiv = document.querySelector(`input#${option}`);
  optionDiv.checked = (await isOptionEnabled(option)) && (await confirmOptionEnabled());
  optionDiv.addEventListener("change", async () => {
    if (optionDiv.checked) {
      if (await preEnableOption()) {
        await setOptionState(option, true);
      } else {
        optionDiv.checked = false;
      }
    } else {
      await setOptionState(option, false);
      if (postDisableOption) await postDisableOption();
    }
    browser.runtime.sendMessage({ command: "reloadBackgroundScript" });
  });
}

async function setupOptionsUI() {
  await configureOption("autoPopulateUsedProfiles", {
    confirmOptionEnabled: () => browser.permissions.contains(PERMISSIONS),
    preEnableOption: () => browser.permissions.request(PERMISSIONS),
    postDisableOption: () => setOptionState("openProfileInDedicatedContainer", false),
  });
}

setupOptionsUI();
