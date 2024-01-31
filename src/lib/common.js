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

async function saveAwsProfile(awsProfile) {
  const awsProfiles = await saveAwsProfiles([awsProfile]);
  return awsProfiles[awsProfile.id];
}

async function saveAwsProfiles(newAwsProfiles) {
  const { awsProfiles = {} } = await browser.storage.local.get({ awsProfiles: {} });

  newAwsProfiles.sort().forEach((profile) => {
    const color = getNextProfileColor(Object.keys(awsProfiles).length);
    awsProfiles[profile.id] = Object.assign({ color }, profile);
  });

  await browser.storage.local.set({ awsProfiles });
  return awsProfiles;
}

async function removeAwsProfilesForPortalDomain(portalDomain) {
  const { awsProfiles = {} } = await browser.storage.local.get({ awsProfiles: {} });

  const profilesToRemove = Object.values(awsProfiles).filter(
    (profile) => profile.portalDomain === portalDomain
  );

  const removedProfiles = {};
  profilesToRemove.forEach((profile) => {
    removedProfiles[profile.id] = profile;
    delete awsProfiles[profile.id];
  });

  await browser.storage.local.set({ awsProfiles });
  return removedProfiles;
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
  removeAwsProfilesForPortalDomain,
};

exports = common;
