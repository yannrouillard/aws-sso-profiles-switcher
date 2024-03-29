const path = require("path");

const { buildStorageContentForDomains, createFakePage, mockBrowserStorage } = require("./helper");

/*******************************************************************************
 * Constants
 *******************************************************************************/

const PORTAL_STYLES = ["legacy", "new"];

const FAKE_DOMAIN = "ssodomain";

const SRC_FOLDER = path.join(__dirname, "..", "src");

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

const setupBrowserWithBackgroundScripts = async ({ configuration }) => {
  const browserStorage = mockBrowserStorage({ configuration });
  const page = await createFakePage(EMPTY_HTML, { browserStorage });
  await page.injectScripts(BACKGROUND_SCRIPTS, { waitCondition: listenerConfigured(page) });
  return page.window.browser;
};

/*******************************************************************************
 * Test Data
 *******************************************************************************/

const TEST_FEDERATION_LOCATION = "https://eu-west-1.signin.aws.amazon.com/federation";
const TEST_SIGNIN_TOKEN = "TEST_SIGNIN_TOKEN";

const getTestData = (portalStyle) => {
  const testProfile = Object.values(
    buildStorageContentForDomains(portalStyle, FAKE_DOMAIN).awsProfiles
  )[0];
  if (portalStyle === "new") {
    testProfile.title = `${testProfile.accountId} - ${testProfile.name}`;
    testProfile.id = `${testProfile.portalDomain} - ${testProfile.accountId} - ${testProfile.name}`;
    testProfile.accountName = testProfile.accountId;
  }

  return {
    profile: testProfile,
    signinUrl:
      `${TEST_FEDERATION_LOCATION}?` +
      new URLSearchParams({
        Action: "login",
        SigninToken: TEST_SIGNIN_TOKEN,
        Issuer: testProfile.url,
        Destination: "https://console.aws.amazon.com/",
      }).toString(),

    loginRequest: {
      url: `https://portal.sso.eu-west-1.amazonaws.com/federation/console?account_id=${testProfile.accountId}&role_name=${testProfile.name}`,
      originUrl: testProfile.url,
      method: "GET",
    },
    loginResponse: JSON.stringify({
      signInToken: TEST_SIGNIN_TOKEN,
      signInFederationLocation: "https://eu-west-1.signin.aws.amazon.com/federation",
    }),
  };
};

/*******************************************************************************
 * Tests definition
 *******************************************************************************/

test.each(PORTAL_STYLES)(
  "Auto-populate with an AWS profile used by the user (%p style)",
  async (portalStyle) => {
    // Given
    const testData = getTestData(portalStyle);
    const browser = await setupBrowserWithBackgroundScripts({
      configuration: { autoPopulateUsedProfiles: true },
    });
    // When
    await browser.webRequest.onBeforeRequest.waitForListener();
    await browser.webRequest.onBeforeRequest.triggerListener(testData.loginRequest);
    // Then
    const storageContent = await browser.storage.local.get();
    expect(storageContent.awsProfiles).toEqual({ [testData.profile.id]: testData.profile });
  }
);

test.each(PORTAL_STYLES)(
  "Open an AWS profile in a new dedicated container (%p style)",
  async (portalStyle) => {
    // Given
    const testData = getTestData(portalStyle);
    const browser = await setupBrowserWithBackgroundScripts({
      configuration: { autoPopulateUsedProfiles: true, openProfileInDedicatedContainer: true },
    });
    const activeTabBefore = (await browser.tabs.query({ active: true, currentWindow: true }))[0];
    // When
    await browser.webRequest.onBeforeRequest.triggerListener(testData.loginRequest);
    await browser.webRequest.sendResponseDataToFilter(testData.loginResponse);
    // Then
    const activeTab = (await browser.tabs.query({ active: true, currentWindow: true }))[0];
    expect(activeTab.url).toEqual(testData.signinUrl);
    expect(activeTab.cookieStoreId).toEqual("firefox-container-1");
    // The new tab should be placed at the same position
    expect(activeTab.index).toEqual(activeTabBefore.index);
  }
);

test.each(PORTAL_STYLES)(
  "Open an AWS profile in an already existing dedicated container (%p style)",
  async (portalStyle) => {
    // Given
    const testData = getTestData(portalStyle);
    const browser = await setupBrowserWithBackgroundScripts({
      configuration: { autoPopulateUsedProfiles: true, openProfileInDedicatedContainer: true },
    });
    // When
    for (const name of ["fakeContainer1", testData.profile.title, "fakeContainer3"]) {
      await browser.contextualIdentities.create({ name });
    }
    await browser.webRequest.onBeforeRequest.triggerListener(testData.loginRequest);
    await browser.webRequest.sendResponseDataToFilter(testData.loginResponse);
    // Then
    const tab = await browser.tabs.getCurrent();
    expect(tab.url).toEqual(testData.signinUrl);
    expect(tab.cookieStoreId).toEqual("firefox-container-2");
  }
);
