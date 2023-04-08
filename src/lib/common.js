async function saveAwsProfile(awsProfile) {
  const storageContent = await browser.storage.local.get({ awsProfiles: {} });
  const existingAwsProfile = storageContent.awsProfiles[awsProfile.id] || {};
  storageContent.awsProfiles[awsProfile.id] = Object.assign({}, existingAwsProfile, awsProfile);
  await browser.storage.local.set(storageContent);
}

async function saveAwsProfiles(awsProfiles) {
  const currentStorage = await browser.storage.local.get({ awsProfiles: {} });

  awsProfiles.forEach((profile) => {
    const existingAwsProfile = currentStorage.awsProfiles[profile.id] || {};
    currentStorage.awsProfiles[profile.id] = Object.assign({}, existingAwsProfile, profile);
  });

  await browser.storage.local.set(currentStorage);
}

async function legacyLoadAwsProfiles() {
  const storageContent = await browser.storage.local.get({ awsProfilesByDomain: {} });

  const awsProfiles = Object.values(storageContent.awsProfilesByDomain)
    .map((awsAccountProfiles) => Object.values(awsAccountProfiles.awsProfilesByAccount))
    .flat()
    .map((awsProfilesByAccount) => Object.values(awsProfilesByAccount.awsProfilesByName))
    .flat()
    .map((profile) => Object.assign(profile, { id: `${profile.portalDomain} - ${profile.title}` }));

  return awsProfiles;
}

async function loadAwsProfiles() {
  const legacyAwsProfiles = await legacyLoadAwsProfiles();
  if (legacyAwsProfiles.length > 0) {
    saveAwsProfiles(legacyAwsProfiles);
    await browser.storage.local.remove("awsProfilesByDomain");
  }
  const storageContent = await browser.storage.local.get({ awsProfiles: {} });
  const awsProfiles = Object.values(storageContent.awsProfiles).sort();
  return awsProfiles;
}

// eslint-disable-next-line no-unused-vars
const common = {
  loadAwsProfiles,
  saveAwsProfile,
  saveAwsProfiles,
};

exports = common;
