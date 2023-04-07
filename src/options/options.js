const PERMISSIONS = {
  origins: ["https://*.awsapps.com/start/*", "https://*.amazonaws.com/*/profiles"],
};

async function setupOptionsUI() {
  const defaultContainer = (await browser.storage.local.get("defaultContainer")).defaultContainer;
  const defaultContainerOption = document.querySelector("select#default_container");
  const availableIdentities = await browser.contextualIdentities.query({});
  const availableContainerOptions = availableIdentities.map(
    (identity) =>
      new Option(
        identity.name,
        identity.cookieStoreId,
        false,
        identity.cookieStoreId == defaultContainer
      )
  );
  for (const option of availableContainerOptions) {
    defaultContainerOption.add(option);
  }

  defaultContainerOption.addEventListener("change", async (event) => {
    const cookieStoreId = event.target.value == "default" ? undefined : event.target.value;
    await browser.storage.local.set({ defaultContainer: cookieStoreId });
  });

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
