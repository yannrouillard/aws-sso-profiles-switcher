const path = require("path");
const fs = require("fs");

const { mockBrowserStorage, buildStorageContentForDomains, createFakePage } = require("./helper");

/*******************************************************************************
 * Constants
 *******************************************************************************/

const SRC_FOLDER = path.join(__dirname, "..", "src");
const POPUP_SCRIPT = path.join(SRC_FOLDER, "popup", "popup.js");
const POPUP_HTML_FILE = path.join(SRC_FOLDER, "popup", "popup.html");

/*******************************************************************************
 * Tests definition
 *******************************************************************************/

const popupCode = fs.readFileSync(POPUP_SCRIPT, "utf8");

test("Load and display roles from storage", async () => {
  // Given
  const storageContent = buildStorageContentForDomains("mysso");
  const favoriteProfile = Object.values(storageContent.awsProfiles)[1];
  favoriteProfile.favorite = true;

  const browserStorage = mockBrowserStorage(storageContent);
  const popupPage = await createFakePage(POPUP_HTML_FILE, { browserStorage });
  // When
  await popupPage.eval(popupCode);

  // Then
  const profilesDisplayed = Array.from(
    popupPage.window.document.querySelectorAll("div.profile-text")
  ).map((e) => e.textContent);
  const favoriteProfileDiv = popupPage.window.document.querySelector("div.profile-favorite");

  expect(profilesDisplayed).toEqual([
    "Development - AdministratorAccess",
    "Production - AdministratorAccess",
    "Root - AdministratorAccess",
    "Root - ReadOnlyAccess",
  ]);
  expect(favoriteProfileDiv.textContent).toMatch(favoriteProfile.title);
});

test("Display instructions when no profiles exist", async () => {
  // Given
  const popupPage = await createFakePage(POPUP_HTML_FILE);
  // When
  await popupPage.eval(popupCode);
  // Then
  const noProfileInfoSection = popupPage.window.document.querySelector(
    "div#no-profile-info-section"
  );
  expect(noProfileInfoSection.classList).not.toContain("hide");
});

test("Display loading page button on Portal page", async () => {
  // Given
  const popupPage = await createFakePage(POPUP_HTML_FILE, {
    tabUrl: "https://mysso.awsapps.com/start/#",
  });
  // When
  await popupPage.eval(popupCode);
  // Then
  const accessPortalSection = popupPage.window.document.querySelector(
    "div#aws-access-portal-section"
  );
  expect(accessPortalSection.classList).not.toContain("hide");
});
