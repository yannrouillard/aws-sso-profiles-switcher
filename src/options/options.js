async function setupOptionsUI() {
  const defaultContainer = (await browser.storage.local.get("defaultContainer")).defaultContainer;
  console.log("defautl", defaultContainer);
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
    console.log("coucou", event.target);
    const cookieStoreId = event.target.value == "default" ? undefined : event.target.value;
    await browser.storage.local.set({ defaultContainer: cookieStoreId });
  });
}

setupOptionsUI();
