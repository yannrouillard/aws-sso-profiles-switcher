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

async function loadProfile(profile) {
  const cookieStoreId = (await browser.storage.local.get("defaultContainer")).defaultContainer;
  const activeTab = await getActiveTab();
  await browser.tabs.create({ url: profile.url, cookieStoreId, index: activeTab.index + 1 });
  await window.close();
}

function sortProfilesFavoritesFirst(a, b) {
  if (a.favorite && !b.favorite) return -1;
  if (!a.favorite && b.favorite) return 1;
  return a.title.localeCompare(b.title);
}

function isSelectedProfile(profile) {
  return profile.id === selectedProfileId;
}

async function getSelectedProfile() {
  const currentProfiles = await loadAwsProfiles();
  return currentProfiles.find(isSelectedProfile);
}

function moveSelectedProfile(direction) {
  if (selectedProfileId === null) return;

  const visibleEntries = Array.from(document.querySelectorAll("div.profile-item"));
  const currentIndex = visibleEntries.findIndex(
    (entry) => entry.getAttribute("data-id") === selectedProfileId
  );
  const newIndex = (currentIndex + direction + visibleEntries.length) % visibleEntries.length;
  const selectedEntry = visibleEntries[newIndex];
  selectedProfileId = selectedEntry.getAttribute("data-id");

  visibleEntries.forEach((entry, index) => {
    entry.classList.toggle("profile-item-selected", index === newIndex);
  });
  selectedEntry.scrollIntoView({ block: "nearest" });
}

function createProfileClickHandler(profile) {
  return async () => {
    await loadProfile(profile);
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
  const entry = createElement("div", {
    classes: ["profile-item"],
    attributes: { "data-id": awsProfile.id },
  });
  if (awsProfile.favorite) entry.classList.add("profile-favorite");
  if (isSelectedProfile(awsProfile)) entry.classList.add("profile-item-selected");
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
  await browser.tabs.executeScript({ file: "/lib/common.js" });
  await browser.tabs.executeScript({ file: "/content_scripts/profiles_info_loader.js" });
}

async function handleSearchKeyEvent(event) {
  if (event.key === "Enter") {
    const selectedProfile = await getSelectedProfile();
    if (selectedProfile) await loadProfile(selectedProfile);
  } else if (event.key === "ArrowUp") {
    moveSelectedProfile(-1);
  } else if (event.key === "ArrowDown") {
    moveSelectedProfile(1);
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
    const visibleProfiles = currentProfiles
      .filter(createSearchTermsMatcher(searchTerms))
      .sort(sortProfilesFavoritesFirst);

    if (visibleProfiles.length === 0) {
      selectedProfileId = null;
    } else if (!visibleProfiles.find(isSelectedProfile)) {
      // selected profile not visible anymore or undefined, we just select the first one
      selectedProfileId = visibleProfiles[0].id;
    }

    const awsProfilesListDiv = document.querySelector("div#profiles-list");
    const visibleProfileEntries = visibleProfiles.map(createTableEntryFromAwsProfile);
    awsProfilesListDiv.replaceChildren(...visibleProfileEntries);
  }

  setPopupSectionVisibility("aws-access-portal", isOnAwsPortal);
  setPopupSectionVisibility("no-profile-info", !hasProfiles && !isOnAwsPortal);
  setPopupSectionVisibility("profiles", hasProfiles);
}

function installEventHandlers() {
  document.querySelector("input#searchbox").addEventListener("input", refreshPopupDisplay);
  document.addEventListener("keydown", handleSearchKeyEvent);
  document.querySelector("div#load-profiles").addEventListener("click", loadProfilesFromPortalPage);
  document.querySelector("#preferences-icon").addEventListener("click", async () => {
    await browser.runtime.openOptionsPage();
    await window.close();
  });
}

/*******************************************************************************
 * Main code
 *******************************************************************************/

let selectedProfileId = null;

setPopupColorTheme(getColorThemePreference());

refreshPopupDisplay().then(() => {
  installEventHandlers();
  document.querySelector("input#searchbox").focus();
});

browser.storage.onChanged.addListener(refreshPopupDisplay);
