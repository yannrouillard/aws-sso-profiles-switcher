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

const SRC_FOLDER = path.join(__dirname, "..", "src");
const TEST_FILES_FOLDER = path.join(__dirname, "test_files");
const PROFILES_INFO_LOADER_SCRIPTS = [
  `file://${path.join(SRC_FOLDER, "lib/common.js")}`,
  `file://${path.join(SRC_FOLDER, "content_scripts/profiles_info_loader.js")}`,
];

/*******************************************************************************
 * Test Helper functions
 *******************************************************************************/

const createFakeAwsPortalPage = async (htmlFile, { browserStorage } = {}) => {
  // by convention, the second element is the domain name
  const domain = htmlFile.split(".")[1];

  const page = await createFakePage(path.join(TEST_FILES_FOLDER, htmlFile), {
    url: `https://${domain}.awsapps.com/start/#`,
    browserStorage,
  });

  page.injectScriptsAndWaitForStorageUpdate = async (scripts, expectedProfilesCount) => {
    await page.injectScripts(scripts);
    await page.waitForBrowserStorageUpdate(expectedProfilesCount);
  };

  page.waitForBrowserStorageUpdate = async (expectedProfilesCount) => {
    const browserStorageHasExpectedProfilesCount = async () => {
      const storage = await page.window.browser.storage.local.get({ awsProfiles: {} });
      return (
        storage.awsProfiles && Object.keys(storage.awsProfiles).length === expectedProfilesCount
      );
    };
    await waitForCondition(browserStorageHasExpectedProfilesCount);
  };

  return page;
};

const simulateExpandSection = (event) => {
  const candidates = [event.target.parentElement, event.target.parentElement.parentElement];

  const sectionToExpandParent = candidates.find((e) => e.querySelector("sso-expander-hidden"));
  const sectionToExpand = sectionToExpandParent.querySelector("sso-expander-hidden");

  // We rename sso-expander-hidden element into sso-expander
  // we need to re-create an element and copy everything for that
  const sectionExpanded = sectionToExpand.ownerDocument.createElement("sso-expander");
  Array.from(sectionToExpand.attributes).forEach((attr) =>
    sectionExpanded.setAttribute(attr.name, attr.value)
  );
  Array.from(sectionToExpand.childNodes).forEach((child) =>
    sectionExpanded.appendChild(child.cloneNode(true))
  );
  sectionToExpandParent.replaceChild(sectionExpanded, sectionToExpand);
};

/*******************************************************************************
 * Tests definition
 *******************************************************************************/

const testFiles = [
  {
    htmlFile: "aws_portal.mysso.expanded_sections.html",
    case: "expanded sections",
  },
  {
    htmlFile: "aws_portal.mysso.folded_sections.html",
    case: "folded sections",
  },
];

test.each(testFiles)("Parse correctly AWS Portal page with $case", async ({ htmlFile }) => {
  // Given
  const awsPortalPage = await createFakeAwsPortalPage(htmlFile);
  const expectedStorage = buildStorageContentForDomains("mysso");
  const expectedProfilesCount = Object.keys(expectedStorage.awsProfiles).length;
  // We have to manually simulate section expansion click logic
  awsPortalPage.window.document
    .querySelectorAll("div.instance-section, div.logo")
    .forEach((elt) => elt.addEventListener("click", simulateExpandSection));
  // When
  await awsPortalPage.injectScriptsAndWaitForStorageUpdate(
    PROFILES_INFO_LOADER_SCRIPTS,
    expectedProfilesCount
  );
  // Then
  const browserStorageContent = await awsPortalPage.window.browser.storage.local.get();
  expect(browserStorageContent).toEqual(expectedStorage);
});

test("Merge profiles from two different AWS Portal pages in storage", async () => {
  // Given
  const browserStorage = mockBrowserStorage();
  const awsPortalPages = await Promise.all(
    ["mysso", "anothersso"].map((domain) =>
      createFakeAwsPortalPage(`aws_portal.${domain}.html`, { browserStorage })
    )
  );
  const expectedContent = buildStorageContentForDomains("mysso", "anothersso");
  const expectedProfilesCount = Object.keys(expectedContent.awsProfiles).length;
  // When
  for (const page of awsPortalPages) {
    await page.injectScriptsAndWaitForStorageUpdate(
      PROFILES_INFO_LOADER_SCRIPTS,
      expectedProfilesCount
    );
  }
  // Then
  const browserStorageContent = await browserStorage.get();
  expect(browserStorageContent).toEqual(expectedContent);
});

test("Update profiles fom an existing AWS Portal pages in storage", async () => {
  // Given
  const storageContent = buildStorageContentForDomains("mysso");
  const awsProfiles = storageContent.awsProfiles;
  // We set one element to be favorite and expect its state to be preserved
  const favoriteProfile = Object.values(storageContent.awsProfiles)[1];
  favoriteProfile.favorite = true;
  const expectedContent = structuredClone(storageContent);
  const expectedProfilesCount = Object.keys(expectedContent.awsProfiles).length;

  // We add a new account not present in the portal and expect to be removed on update
  awsProfiles.ToBeRemoved = Object.assign({}, Object.values(awsProfiles)[0], { id: "ToBeRemoved" });

  const browserStorage = mockBrowserStorage(storageContent);
  const awsPortalPage = await createFakeAwsPortalPage("aws_portal.mysso.html", { browserStorage });

  // When
  await awsPortalPage.injectScriptsAndWaitForStorageUpdate(
    PROFILES_INFO_LOADER_SCRIPTS,
    expectedProfilesCount
  );
  // Then
  const browserStorageContent = await awsPortalPage.window.browser.storage.local.get();
  expect(browserStorageContent).toEqual(expectedContent);
});
