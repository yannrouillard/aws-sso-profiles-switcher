/*******************************************************************************
 * Helper functions
 *******************************************************************************/

async function waitFor(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/*******************************************************************************
 * Common AWS Console functions
 ******************************************************************************/

function findAwsPortalDomain() {
  const domain = new URL(window.location.href).host.replace(".awsapps.com", "");
  return domain;
}

function findPortalStyle(page) {
  return page.querySelector('div[data-testid="account-list"]') ? "new" : "legacy";
}

/*******************************************************************************
 * Legacy AWS Console functions
 ******************************************************************************/

async function expandSectionLegacy(section) {
  let expanded = section.querySelector("sso-expander") !== null;
  let expandAnimationMarker = section.querySelector("sso-line-loader") !== null;
  if (!expanded) {
    const firstClickableDiv = section.querySelector("div");
    firstClickableDiv.click();
  }
  while (!expanded || expandAnimationMarker) {
    await waitFor(100);
    expanded = section.querySelector("sso-expander") !== null;
    expandAnimationMarker = section.querySelector("sso-line-loader") !== null;
  }
  return section;
}

function findAwsAccountsParentSectionLegacy(page) {
  return page.querySelector("portal-application[title='AWS Account']").parentElement;
}

function findAwsAccountSectionsLegacy(accountsParentSection) {
  return Array.from(accountsParentSection.querySelectorAll("div.portal-instance-section"));
}

function findAwsProfileLinksLegacy(section) {
  return Array.from(section.querySelectorAll("a.profile-link"));
}

function extractAwsProfilesFromAccountSectionLegacy(section) {
  const accountName = section.querySelector("div.name").textContent.trim();
  const accountId = section.querySelector("span.accountId").textContent.trim().replace("#", "");
  const portalDomain = findAwsPortalDomain();
  const awsProfiles = findAwsProfileLinksLegacy(section).map((link) => {
    const name = link.getAttribute("title");
    const url = link.getAttribute("href");
    const title = `${accountName} - ${name}`;
    const id = `${portalDomain} - ${title}`;
    return { portalDomain, accountName, accountId, name, url, title, id };
  });
  return awsProfiles;
}

async function* findAndExpandAwsAccountSectionFoldsLegacy(page) {
  const accountsParentSection = findAwsAccountsParentSectionLegacy(page);
  await expandSectionLegacy(accountsParentSection);
  const accountSections = findAwsAccountSectionsLegacy(accountsParentSection);
  // We open section sequentially with a small delay to avoid triggering
  // the 429 too many requests error from AWS SSO Portal
  for (const section of accountSections) {
    yield expandSectionLegacy(section);
    await waitFor(50);
  }
  return accountSections;
}

/*******************************************************************************
 * New AWS Console functions
 ******************************************************************************/

function findAwsAccountSections(page) {
  return Array.from(page.querySelectorAll('button[data-testid="account-list-cell"]')).map(
    (elt) => elt.parentElement
  );
}

async function expandSection(section) {
  const expandButton = section.querySelector("button");
  let expanded = expandButton.getAttribute("aria-expanded") === "true";
  let expandAnimationMarker =
    section.querySelector('span[data-testid="account-list-cell-loading"') !== null;
  if (!expanded) {
    expandButton.click();
  }
  while (!expanded || expandAnimationMarker) {
    await waitFor(50);
    expanded = expandButton.getAttribute("aria-expanded") === "true";
    expandAnimationMarker =
      section.querySelector('span[data-testid="account-list-cell-loading"') !== null;
  }
  return section;
}
function findAwsProfileLinks(section) {
  return Array.from(section.querySelectorAll('a[data-testid="federation-link"]'));
}

function extractAwsProfilesFromAccountSection(section) {
  const accountName = section.querySelector("strong").textContent.trim();
  const portalDomain = findAwsPortalDomain();
  const awsProfiles = findAwsProfileLinks(section).map((link) => {
    const profileUrl = new URL(link.getAttribute("href"), window.location.href);
    // The url parameters are not real query parameters as they are after the #
    // but we can still use URLSearchParams to parse them
    const profileUrlParams = new URLSearchParams(profileUrl.href.split("?")[1]);
    const name = profileUrlParams.get("role_name");
    const accountId = profileUrlParams.get("account_id");
    const url = profileUrl.href;
    const title = `${accountName} - ${name}`;
    const id = `${portalDomain} - ${title}`;
    return { portalDomain, accountName, accountId, name, url, title, id };
  });
  return awsProfiles;
}

async function* findAndExpandAwsAccountSectionFolds(page) {
  const accountSections = findAwsAccountSections(page);
  // We open section sequentially with a small delay to avoid triggering
  // the 429 too many requests error from AWS SSO Portal
  for (const section of accountSections) {
    yield expandSection(section);
    await waitFor(200);
  }
  return accountSections;
}

/*******************************************************************************
 * Main code
 *******************************************************************************/

const portalParsers = {
  legacy: {
    findAndExpandAwsAccountSectionFolds: findAndExpandAwsAccountSectionFoldsLegacy,
    extractAwsProfilesFromAccountSection: extractAwsProfilesFromAccountSectionLegacy,
  },
  new: {
    findAndExpandAwsAccountSectionFolds: findAndExpandAwsAccountSectionFolds,
    extractAwsProfilesFromAccountSection: extractAwsProfilesFromAccountSection,
  },
};

(async () => {
  const profilesRemoved = await removeAwsProfilesForPortalDomain(findAwsPortalDomain());
  const mergeWithPreviousProfileToKeepSettings = (profile) =>
    Object.assign({}, profilesRemoved[profile.id] || {}, profile);

  const portalStyle = findPortalStyle(document);
  const portalParser = portalParsers[portalStyle];

  for await (let section of portalParser.findAndExpandAwsAccountSectionFolds(document)) {
    const profiles = portalParser
      .extractAwsProfilesFromAccountSection(section)
      .map(mergeWithPreviousProfileToKeepSettings);
    await saveAwsProfiles(profiles);
  }
})();
