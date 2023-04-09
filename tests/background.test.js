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
 * Test Data
 *******************************************************************************/

const TEST_FEDERATION_LOCATION = "https://eu-west-1.signin.aws.amazon.com/federation";
const TEST_SIGNIN_TOKEN = "TEST_SIGNIN_TOKEN";

const TEST_PROFILE_SIGNIN_URL =
  `${TEST_FEDERATION_LOCATION}?` +
  new URLSearchParams({
    Action: "login",
    SigninToken: TEST_SIGNIN_TOKEN,
    Issuer: TEST_PROFILE.url,
    Destination: "https://console.aws.amazon.com/",
  }).toString();

const TEST_PROFILE_LOGIN_REQUEST = {
  url: `https://portal.sso.eu-west-1.amazonaws.com/federation/console?account_id=${TEST_PROFILE.accountId}&role_name=${TEST_PROFILE.name}`,
  originUrl: TEST_PROFILE.url,
  method: "GET",
};
const TEST_PROFILE_LOGIN_RESPONSE = JSON.stringify({
  signInToken: TEST_SIGNIN_TOKEN,
  signInFederationLocation: "https://eu-west-1.signin.aws.amazon.com/federation",
});

/*******************************************************************************
 * Tests definition
 *******************************************************************************/

test("Auto-populate with an AWS profile used by the user", async () => {
  // Given
  const browserStorage = mockBrowserStorage({ configuration: { autoPopulateUsedProfiles: true } });
  const page = await createFakePage(EMPTY_HTML, { browserStorage });
  await page.injectScripts(BACKGROUND_SCRIPTS, { waitCondition: listenerConfigured(page) });

  // When
  await page.window.browser.webRequest.onBeforeRequest.triggerListener(TEST_PROFILE_LOGIN_REQUEST);

  // Then
  const storageContent = await page.window.browser.storage.local.get();
  expect(storageContent.awsProfiles).toEqual({ [TEST_PROFILE.id]: TEST_PROFILE });
});

test("Open an AWS profile in a new dedicated container", async () => {
  // Given
  const browserStorage = mockBrowserStorage({
    configuration: { autoPopulateUsedProfiles: true, openProfileInDedicatedContainer: true },
  });
  const page = await createFakePage(EMPTY_HTML, { browserStorage });
  await page.injectScripts(BACKGROUND_SCRIPTS, { waitCondition: listenerConfigured(page) });

  // When
  await page.window.browser.webRequest.onBeforeRequest.triggerListener(TEST_PROFILE_LOGIN_REQUEST);
  await page.window.browser.webRequest.sendResponseDataToFilter(TEST_PROFILE_LOGIN_RESPONSE);

  // Then
  const tab = await page.window.browser.tabs.getCurrent();
  expect(tab.url).toEqual(TEST_PROFILE_SIGNIN_URL);
  expect(tab.cookieStoreId).toEqual("firefox-container-1");
});

test("Open an AWS profile in an already existing dedicated container", async () => {
  // Given
  const browserStorage = mockBrowserStorage({
    configuration: { autoPopulateUsedProfiles: true, openProfileInDedicatedContainer: true },
  });
  const page = await createFakePage(EMPTY_HTML, { browserStorage });
  await page.injectScripts(BACKGROUND_SCRIPTS, { waitCondition: listenerConfigured(page) });

  // When
  for (const name of ["fakeContainer1", TEST_PROFILE.title, "fakeContainer2"]) {
    await page.window.browser.contextualIdentities.create({ name });
  }
  await page.window.browser.webRequest.onBeforeRequest.triggerListener(TEST_PROFILE_LOGIN_REQUEST);
  await page.window.browser.webRequest.sendResponseDataToFilter(TEST_PROFILE_LOGIN_RESPONSE);

  // Then
  const tab = await page.window.browser.tabs.getCurrent();
  expect(tab.url).toEqual(TEST_PROFILE_SIGNIN_URL);
  expect(tab.cookieStoreId).toEqual("firefox-container-2");
});
