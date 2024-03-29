const path = require("path");

const {
  mockBrowserStorage,
  buildStorageContentForDomains,
  createFakePage,
  waitForCondition,
} = require("./helper");

/*******************************************************************************
 * Constants
 *******************************************************************************/

const PORTAL_STYLES = ["legacy", "new"];

const SRC_FOLDER = path.join(__dirname, "..", "src");
const POPUP_HTML_FILE = path.join(SRC_FOLDER, "popup", "popup.html");

/*******************************************************************************
 * Test Helper functions
 *******************************************************************************/

const searchboxFocused = (page) => async () => {
  return (
    page.window.document.querySelector("input#searchbox") == page.window.document.activeElement
  );
};

/*******************************************************************************
 * Tests definition
 *******************************************************************************/

test.each(PORTAL_STYLES)("Load and display roles from storage (%p style)", async (portalStyle) => {
  // Given
  const storageContent = buildStorageContentForDomains(portalStyle, "mysso");
  const favoriteProfile = Object.values(storageContent.awsProfiles)[1];
  favoriteProfile.favorite = true;
  const browserStorage = mockBrowserStorage(storageContent);

  // When
  const popupPage = await createFakePage(POPUP_HTML_FILE, { browserStorage });
  await waitForCondition(searchboxFocused(popupPage));

  // Then
  const profilesDisplayed = Array.from(
    popupPage.window.document.querySelectorAll("div.profile-text")
  ).map((e) => e.textContent);
  const favoriteProfileDiv = popupPage.window.document.querySelector("div.profile-favorite");

  expect(profilesDisplayed).toEqual([
    "Root - AdministratorAccess",
    "Development - AdministratorAccess",
    "Production - AdministratorAccess",
    "Root - ReadOnlyAccess",
  ]);
  expect(favoriteProfileDiv.textContent).toEqual("Root - AdministratorAccess");
});

test("Display instructions when no profiles exist", async () => {
  // When
  const popupPage = await createFakePage(POPUP_HTML_FILE);
  await waitForCondition(searchboxFocused(popupPage));
  // Then
  const noProfileInfoSection = popupPage.window.document.querySelector(
    "div#no-profile-info-section"
  );
  expect(noProfileInfoSection.classList).not.toContain("hide");
});

test("Display loading page button on Portal page", async () => {
  // When
  const popupPage = await createFakePage(POPUP_HTML_FILE, {
    tabUrl: "https://mysso.awsapps.com/start/#",
  });
  await waitForCondition(searchboxFocused(popupPage));
  // Then
  const accessPortalSection = popupPage.window.document.querySelector(
    "div#aws-access-portal-section"
  );
  expect(accessPortalSection.classList).not.toContain("hide");
});
