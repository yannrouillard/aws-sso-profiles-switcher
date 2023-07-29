/*******************************************************************************
 * Helper functions
 *******************************************************************************/

const HTML_COLOR_CODE = {
  blue: "#37adff",
  turquoise: "#00c79a",
  green: "#51cd00",
  yellow: "#ffcb00",
  orange: "#ff9f00",
  red: "#ff613d",
  pink: "#ff4bda",
  purple: "#af51f5",
};

function getHtmlColorCode(colorName) {
  return HTML_COLOR_CODE[colorName];
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

async function getActiveTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function createProfileClickHandler(profile) {
  return async () => {
    const cookieStoreId = (await browser.storage.local.get("defaultContainer")).defaultContainer;
    const activeTab = await getActiveTab();
    await browser.tabs.create({ url: profile.url, cookieStoreId, index: activeTab.index + 1 });
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

function createTableEntryFromAwsProfile(awsProfile) {
  const entry = createElement("div", { classes: ["profile-item"] });
  if (awsProfile.favorite) entry.classList.add("profile-favorite");
  const dotStyle = `background-color: ${getHtmlColorCode(awsProfile.color)}`;
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
  const activeTab = await getActiveTab();
  const currentProfiles = await loadAwsProfiles();

  const isOnAwsPortal = activeTab.url.includes(".awsapps.com/");
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
