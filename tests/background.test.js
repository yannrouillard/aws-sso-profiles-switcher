const path = require("path");

const { buildStorageContentForDomains, createFakePage, mockBrowserStorage } = require("./helper");

/*******************************************************************************
 * Constants
 *******************************************************************************/

const FAKE_DOMAIN = "ssodomain";

const SRC_FOLDER = path.join(__dirname, "..", "src");
const ALL_TEST_PROFILES = Object.values(buildStorageContentForDomains(FAKE_DOMAIN).awsProfiles);
const TEST_PROFILE = ALL_TEST_PROFILES[0];

const EMPTY_HTML = path.join(__dirname, "test_files", "empty.html");
const BACKGROUND_SCRIPTS = [
  `file://${path.join(SRC_FOLDER, "lib/common.js")}`,
  `file://${path.join(SRC_FOLDER, "background_scripts/background.js")}`,
];

/*******************************************************************************
 * Test Helper functions
 *******************************************************************************/

const listenerConfigured = (page) => async () => {
  return page.window.browser.webRequest.onBeforeRequest.getListener() != null;
};

/*******************************************************************************
 * Tests definition
 *******************************************************************************/

test("Auto-populate with an AWS profile used by the user", async () => {
  // Given
  const browserStorage = mockBrowserStorage({ configuration: { autoPopulateUsedProfiles: true } });
  const page = await createFakePage(EMPTY_HTML, { browserStorage });
  await page.injectScripts(BACKGROUND_SCRIPTS, { waitCondition: listenerConfigured(page) });

  // When
  const requestDetails = {
    url: `https://portal.sso.eu-west-1.amazonaws.com/federation/console?account_id=${TEST_PROFILE.accountId}&role_name=${TEST_PROFILE.name}`,
    originUrl: TEST_PROFILE.url,
  };
  const requestListener = await page.window.browser.webRequest.onBeforeRequest.getListener();
  await requestListener(requestDetails);

  // Then
  const storageContent = await page.window.browser.storage.local.get();
  expect(storageContent.awsProfiles).toEqual({ [TEST_PROFILE.id]: TEST_PROFILE });
});
