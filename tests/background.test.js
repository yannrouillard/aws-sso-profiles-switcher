const { createFakeBrowser, buildStorageContentForDomains } = require("./helper");

const FAKE_DOMAIN = "ssodomain";

const ALL_TEST_PROFILES = Object.values(buildStorageContentForDomains(FAKE_DOMAIN).awsProfiles);
const TEST_PROFILE = ALL_TEST_PROFILES[0];

test("Auto-populate with an AWS profile used by the user", async () => {
  // Given
  const browser = (global.browser = createFakeBrowser());
  browser.storage.local.set({ configuration: { autoPopulateUsedProfiles: true } });
  const requestDetails = {
    url: `https://portal.sso.eu-west-1.amazonaws.com/federation/console?account_id=${TEST_PROFILE.accountId}&role_name=${TEST_PROFILE.name}`,
    originUrl: TEST_PROFILE.url,
  };
  // When
  require("../src/background_scripts/background");
  const requestListener = await browser.webRequest.onBeforeRequest.waitForListener();
  requestListener(requestDetails);
  // Then
  const storageContent = await browser.storage.local.get();
  expect(storageContent.awsProfiles).toEqual({ [TEST_PROFILE.id]: TEST_PROFILE });
});
