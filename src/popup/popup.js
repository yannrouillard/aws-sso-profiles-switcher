/*******************************************************************************
 * Helper functions
 *******************************************************************************/

function getNiceColor(index) {
  const niceColors = [
    "#ea5545",
    "#f46a9b",
    "#ef9b20",
    "#edbf33",
    "#ede15b",
    "#bdcf32",
    "#87bc45",
    "#27aeef",
    "#b33dc6",
    "#964b00",
    "#8b008b",
    "#1e90ff",
    "#ffd700",
    "#228b22",
    "#00ffff",
    "#ff69b4",
    "#ffa07a",
    "#8fbc8f",
    "#483d8b",
    "#00bfff",
  ];
  return niceColors[index % niceColors.length];
}

function getColorThemePreference() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setPopupColorTheme(theme) {
  const popup = document.querySelector("html");
  popup.setAttribute("data-theme", theme);
}

function setPopupSectionVisibility(section, visible) {
  const sectionDiv = document.querySelector(`div#${section}-section`);
  if (visible) {
    sectionDiv.classList.remove("hide");
  } else {
    sectionDiv.classList.add("hide");
  }
}

async function getActiveTabUrl() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const activeTabUrl = tabs[0].url;
  return activeTabUrl;
}

function createProfileClickHandler(profile) {
  return async () => {
    const cookieStoreId = (await browser.storage.local.get("defaultContainer")).defaultContainer;
    await browser.tabs.create({ url: profile.url, cookieStoreId });
    await window.close();
  };
}

function createFavoriteClickHandler(awsProfile) {
  return async (event) => {
    event.stopPropagation();
    awsProfile.favorite = !awsProfile.favorite;
    await saveAwsProfile(awsProfile);
    await refreshPopupDisplay();
  };
}

function createElement(tagName, { classes = [], attributes = {}, text }) {
  const element = document.createElement(tagName);
  element.classList.add(...classes);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
  if (text) element.textContent = text;
  return element;
}

function createTableEntryFromAwsProfile(awsProfile, index) {
  const entry = createElement("div", { classes: ["profile-item"] });
  if (awsProfile.favorite) entry.classList.add("profile-favorite");
  const dotStyle = `background-color: ${getNiceColor(index)}`;
  entry.append(
    createElement("div", { classes: ["profile-dot"], attributes: { style: dotStyle } }),
    createElement("div", { classes: ["profile-text"], text: awsProfile.title }),
    createElement("div", { classes: ["profile-favorite-icon"] })
  );
  entry.addEventListener("click", createProfileClickHandler(awsProfile));
  const favoriteIcon = entry.querySelector(".profile-favorite-icon");
  favoriteIcon.addEventListener("click", createFavoriteClickHandler(awsProfile));

  return entry;
}

async function loadProfilesFromPortalPage() {
  browser.storage.onChanged.addListener(refreshPopupDisplay);
  await browser.tabs.executeScript({ file: "/lib/common.js" });
  await browser.tabs.executeScript({ file: "/content_scripts/profiles_info_loader.js" });
}

function handleSearchKeyEvent(event) {
  if (event.key === "Enter") {
    const awsProfilesDiv = document.querySelector("div#profiles-list");
    if (awsProfilesDiv.firstChild) {
      awsProfilesDiv.firstChild.click();
    }
  }
}

function createSearchTermsMatcher(searchTerms) {
  return (profile) =>
    searchTerms.every((term) => profile.title.toLowerCase().includes(term.toLowerCase()));
}

async function refreshPopupDisplay() {
  const activeTabUrl = await getActiveTabUrl();
  const currentProfiles = await loadAwsProfiles();

  const isOnAwsPortal = activeTabUrl.includes(".awsapps.com/");
  const hasProfiles = currentProfiles.length != 0;

  if (hasProfiles) {
    const searchTerms = document.querySelector("input").value.split(/\s+/);
    const awsProfileEntries = currentProfiles
      .filter(createSearchTermsMatcher(searchTerms))
      .map(createTableEntryFromAwsProfile);

    const awsProfilesDiv = document.querySelector("div#profiles-list");
    awsProfilesDiv.replaceChildren(...awsProfileEntries);
  }

  setPopupSectionVisibility("aws-access-portal", isOnAwsPortal);
  setPopupSectionVisibility("no-profile-info", !hasProfiles && !isOnAwsPortal);
  setPopupSectionVisibility("profiles", hasProfiles);

  browser.storage.onChanged.removeListener(refreshPopupDisplay);
}

function installEventHandlers() {
  document.querySelector("input#searchbox").addEventListener("input", refreshPopupDisplay);
  document.querySelector("input#searchbox").addEventListener("keyup", handleSearchKeyEvent);
  document.querySelector("div#load-profiles").addEventListener("click", loadProfilesFromPortalPage);
  document.querySelector("#preferences-icon").addEventListener("click", async () => {
    await browser.runtime.openOptionsPage();
    await window.close();
  });
}

/*******************************************************************************
 * Main code
 *******************************************************************************/

setPopupColorTheme(getColorThemePreference());

refreshPopupDisplay().then(() => {
  installEventHandlers();
  document.querySelector("input#searchbox").focus();
});
