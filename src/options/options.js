const PERMISSIONS = {
  origins: ["https://*.awsapps.com/start/*", "https://*.amazonaws.com/*/profiles"],
};

async function setupOptionsUI() {
  const hasPermissions = await browser.permissions.contains(PERMISSIONS);
  const storageContent = await browser.storage.local.get({ configuration: {} });
  const configuration = storageContent.configuration;

  const autoPopulateUsedProfiles = document.querySelector("input#auto-populate-used-profiles");
  autoPopulateUsedProfiles.checked = configuration.autoPopulateUsedProfiles && hasPermissions;
  autoPopulateUsedProfiles.addEventListener("change", async () => {
    if (autoPopulateUsedProfiles.checked) {
      const granted = await browser.permissions.request(PERMISSIONS);
      if (granted) {
        configuration.autoPopulateUsedProfiles = true;
        await browser.storage.local.set({ configuration });
        browser.runtime.sendMessage({ command: "reloadBackgroundScript" });
      } else {
        autoPopulateUsedProfiles.checked = false;
      }
    } else {
      await browser.permissions.remove(PERMISSIONS);
    }
  });
}

setupOptionsUI();
