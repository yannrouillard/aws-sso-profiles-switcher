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
  const accountId = section.querySelector("span.accountId").textContent.trim().replace("#", "");
  const portalDomain = findAwsPortalDomain();
  const awsProfiles = findAwsProfileLinks(section).map((link) => {
    const name = link.getAttribute("title");
    const url = link.getAttribute("href");
    const title = `${accountName} - ${name}`;
    const id = `${portalDomain} - ${title}`;
    return { portalDomain, accountName, accountId, name, url, title, id };
  });
  return awsProfiles;
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

/*******************************************************************************
 * Main code
 *******************************************************************************/

findAndExpandAwsAccountSectionFolds(document)
  .then(extractAwsProfilesFromAllAccountSections)
  .then(saveAwsProfiles);
