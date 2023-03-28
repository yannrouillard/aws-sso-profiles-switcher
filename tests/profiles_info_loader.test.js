const fs = require("fs");
const path = require("path");

const { mockBrowserStorage, buildStorageContentForDomains, createFakePage } = require("./helper");

/*******************************************************************************
 * Constants
 *******************************************************************************/

const SRC_FOLDER = path.join(__dirname, "..", "src");
const PROFILE_INFO_LOADER_SCRIPT = path.join(
  SRC_FOLDER,
  "content_scripts",
  "profiles_info_loader.js"
);
const TEST_FILES_FOLDER = path.join(__dirname, "test_files");

/*******************************************************************************
 * Test Helper functions
 *******************************************************************************/

const createFakeAwsPortalPage = async (htmlFile, { url, browserStorage }) => {
  // by convention, the second element is the domain name
  const domain = htmlFile.split(".")[1];

  return createFakePage(path.join(TEST_FILES_FOLDER, htmlFile), {
    url: `https://${domain}.awsapps.com/start/#`,
    browserStorage,
  });
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

const profilesInfoLoaderCode = fs.readFileSync(PROFILE_INFO_LOADER_SCRIPT, "utf8");

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
  const browserStorage = mockBrowserStorage();
  const awsPortalPage = await createFakeAwsPortalPage(htmlFile, { browserStorage });
  // We have to manually simulate section expansion click logic
  awsPortalPage.window.document
    .querySelectorAll("div.instance-section, div.logo")
    .forEach((elt) => elt.addEventListener("click", simulateExpandSection));
  // When
  await awsPortalPage.eval(profilesInfoLoaderCode);
  // Then
  const browserStorageContent = await browserStorage.get();
  expect(browserStorageContent).toMatchObject(buildStorageContentForDomains("mysso"));
});

test("Merge profiles from two different AWS Portal pages in storage", async () => {
  // Given
  const browserStorage = mockBrowserStorage();
  const awsPortalPages = await Promise.all(
    ["anothersso", "mysso"].map((domain) =>
      createFakeAwsPortalPage(`aws_portal.${domain}.html`, { browserStorage })
    )
  );
  // When
  for (const page of awsPortalPages) {
    await page.eval(profilesInfoLoaderCode);
  }
  // Then
  const browserStorageContent = await browserStorage.get();
  const expectedContent = buildStorageContentForDomains("mysso", "anothersso");
  expect(browserStorageContent).toMatchObject(expectedContent);
});

test("Update profiles fom an existing AWS Portal pages in storage", async () => {
  // Given
  const storageContent = buildStorageContentForDomains("mysso");
  // We set one element to be favorite and expect its state to be preserved
  const awsProfiles = storageContent.awsProfilesByDomain["mysso"].awsProfilesByAccount;
  awsProfiles.Development.awsProfilesByName.AdministratorAccess.favorite = true;
  const expectedContent = structuredClone(storageContent);

  // We add a new account not present in the portal and expect to be removed on update
  awsProfiles.ToBeRemoved = awsProfiles.Production;
  delete awsProfiles.Production;

  const browserStorage = mockBrowserStorage(storageContent);

  const awsPortalPage = await createFakeAwsPortalPage("aws_portal.mysso.html", { browserStorage });

  // When
  await awsPortalPage.eval(profilesInfoLoaderCode);
  // Then
  const browserStorageContent = await browserStorage.get();
  expect(browserStorageContent).toMatchObject(expectedContent);
});
