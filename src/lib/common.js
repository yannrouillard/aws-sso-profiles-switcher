const availableProfileColors = [
  "blue",
  "turquoise",
  "green",
  "yellow",
  "orange",
  "red",
  "pink",
  "purple",
];

const getNextProfileColor = (index) => {
  return availableProfileColors[index % availableProfileColors.length];
};

function updateStoredProfile(storedProfiles, newProfile) {
  const existingProfile = storedProfiles[newProfile.id] || {};
  // We assign a default color if one doesn't exist yet
  const color = getNextProfileColor(Object.keys(storedProfiles).length);
  storedProfiles[newProfile.id] = Object.assign({ color }, existingProfile, newProfile);
  return storedProfiles[newProfile.id];
}

async function saveAwsProfile(awsProfile) {
  const storageContent = await browser.storage.local.get({ awsProfiles: {} });
  const profile = updateStoredProfile(storageContent.awsProfiles, awsProfile);
  await browser.storage.local.set(storageContent);
  return profile;
}

async function saveAwsProfiles(awsProfiles) {
  const currentStorage = await browser.storage.local.get({ awsProfiles: {} });
  for (const profile of Object.values(awsProfiles).sort()) {
    await updateStoredProfile(currentStorage.awsProfiles, profile);
  }
  await browser.storage.local.set(currentStorage);
}

async function legacyLoadAwsProfiles() {
  const storageContent = await browser.storage.local.get({ awsProfilesByDomain: {} });

  const awsProfiles = Object.values(storageContent.awsProfilesByDomain)
    .map((awsAccountProfiles) => Object.values(awsAccountProfiles.awsProfilesByAccount))
    .flat()
    .map((awsProfilesByAccount) => Object.values(awsProfilesByAccount.awsProfilesByName))
    .flat()
    .map((profile, index) =>
      Object.assign(profile, {
        id: `${profile.portalDomain} - ${profile.title}`,
        color: getNextProfileColor(index),
      })
    );

  return awsProfiles;
}

async function loadAwsProfiles() {
  const legacyAwsProfiles = await legacyLoadAwsProfiles();
  if (legacyAwsProfiles.length > 0) {
    saveAwsProfiles(legacyAwsProfiles);
    await browser.storage.local.remove("awsProfilesByDomain");
  }
  const storageContent = await browser.storage.local.get({ awsProfiles: {} });
  const awsProfiles = Object.values(storageContent.awsProfiles).sort((a, b) =>
    a.title.localeCompare(b.title)
  );
  return awsProfiles;
}

// eslint-disable-next-line no-unused-vars
const common = {
  loadAwsProfiles,
  saveAwsProfile,
  saveAwsProfiles,
};

exports = common;
