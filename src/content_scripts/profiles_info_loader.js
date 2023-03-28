/*******************************************************************************
 * Helper functions
 *******************************************************************************/

async function waitFor(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function expandSection(section) {
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

function findAwsAccountsParentSection(page) {
  return page.querySelector("portal-application[title='AWS Account']").parentElement;
}

function findAwsAccountSections(accountsParentSection) {
  return Array.from(accountsParentSection.querySelectorAll("div.portal-instance-section"));
}

function findAwsProfileLinks(section) {
  return Array.from(section.querySelectorAll("a.profile-link"));
}

function findAwsPortalDomain() {
  const domain = new URL(window.location.href).host.replace(".awsapps.com", "");
  return domain;
}

function extractAwsProfilesFromAccountSection(section) {
  const accountName = section.querySelector("div.name").textContent.trim();
  const portalDomain = findAwsPortalDomain();
  const awsProfiles = findAwsProfileLinks(section).map((link) => {
    const name = link.getAttribute("title");
    const url = link.getAttribute("href");
    const title = `${accountName} - ${name}`;
    return { portalDomain, accountName, name, url, title };
  });
  return awsProfiles;
}

async function mergeWithExistingAwsProfileSettings(portalDomain, awsProfiles) {
  const storageContent = await browser.storage.local.get({ awsProfilesByDomain: {} });
  const currentAwsDomainProfiles = storageContent.awsProfilesByDomain[portalDomain] || {};
  const currentAwsProfilesByAccount = currentAwsDomainProfiles.awsProfilesByAccount || {};

  return awsProfiles.map((profile) => {
    const currentAccountAwsProfiles = currentAwsProfilesByAccount[profile.accountName] || {};
    const currentAwsAccountProfilesByName = currentAccountAwsProfiles.awsProfilesByName || {};
    const currentAwsProfile = currentAwsAccountProfilesByName[profile.name] || {};
    return Object.assign({}, currentAwsProfile, profile);
  });
}

/*******************************************************************************
 * Main functions
 *******************************************************************************/

async function findAndExpandAwsAccountSectionFolds(page) {
  const accountsParentSection = findAwsAccountsParentSection(page);
  await expandSection(accountsParentSection);
  const accountSections = findAwsAccountSections(accountsParentSection);
  await Promise.all(accountSections.map(expandSection));
  return accountSections;
}

function extractAwsProfilesFromAllAccountSections(awsAccountSections) {
  return awsAccountSections.map(extractAwsProfilesFromAccountSection).flat();
}

async function saveAwsProfiles(awsProfiles) {
  const portalDomain = findAwsPortalDomain();

  const mergedAwsProfiles = await mergeWithExistingAwsProfileSettings(portalDomain, awsProfiles);

  const awsProfilesByAccount = {};
  mergedAwsProfiles.forEach((profile) => {
    const accountProfiles = awsProfilesByAccount[profile.accountName] || { awsProfilesByName: {} };
    accountProfiles.awsProfilesByName[profile.name] = profile;
    awsProfilesByAccount[profile.accountName] = accountProfiles;
  });

  const currentStorage = await browser.storage.local.get({ awsProfilesByDomain: {} });
  Object.assign(currentStorage.awsProfilesByDomain, { [portalDomain]: { awsProfilesByAccount } });
  await browser.storage.local.set(currentStorage);
}

/*******************************************************************************
 * Main code
 *******************************************************************************/

findAndExpandAwsAccountSectionFolds(document)
  .then(extractAwsProfilesFromAllAccountSections)
  .then(saveAwsProfiles);
