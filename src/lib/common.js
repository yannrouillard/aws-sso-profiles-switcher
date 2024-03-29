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

class AwsProfile {
  constructor({ portalDomain, accountId, accountName, profileName, url, color, favorite }) {
    this.portalDomain = portalDomain;
    this.accountId = accountId;
    this.accountName = accountName;
    this.profileName = profileName;
    this.url = url;
    this.favorite = favorite;
    this.color = color;
  }

  get title() {
    return `${this.accountName || this.accountId} - ${this.profileName}`;
  }

  get id() {
    return `${this.portalDomain} - ${this.accountId} - ${this.profileName}`;
  }

  get legacyId() {
    return `${this.portalDomain} - ${this.accountName} - ${this.profileName}`;
  }

  mergeWithSavedProfile(profile) {
    // the current profile value usually has priority except if the values
    // are undefined in which case we keep the stored value
    // This is useful to keep the color and favorite status of the profile
    Object.entries(profile || {}).forEach(([key, value]) => {
      this[key] = this[key] ?? value;
    });
    return this;
  }

  static fromStorage(profile) {
    return new AwsProfile(profile);
  }
}

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
    // If the profile was saved with the legacy id, we take the opportunity to remove it
    const legacySavedProfile = awsProfiles[profile.legacyId];
    if (legacySavedProfile) {
      delete awsProfiles[profile.legacyId];
    }
    const savedProfile = awsProfiles[profile.id] || legacySavedProfile;
    profile.mergeWithSavedProfile(savedProfile);
    profile.color = profile.color ?? getNextProfileColor(Object.keys(awsProfiles).length);
    profile.favorite = profile.favorite ?? false;
    awsProfiles[profile.id] = profile;
  });

  await browser.storage.local.set({ awsProfiles });
  return awsProfiles;
}

async function removeAwsProfilesForPortalDomain(portalDomain) {
  const { awsProfiles = {} } = await browser.storage.local.get({ awsProfiles: {} });

  const profilesToRemove = Object.values(awsProfiles)
    .map(AwsProfile.fromStorage)
    .filter((profile) => profile.portalDomain === portalDomain);

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
    .map((profile, index) => Object.assign(profile, { color: getNextProfileColor(index) }));

  return awsProfiles;
}

async function loadAwsProfiles() {
  const legacyAwsProfiles = await legacyLoadAwsProfiles();
  if (legacyAwsProfiles.length > 0) {
    saveAwsProfiles(legacyAwsProfiles);
    await browser.storage.local.remove("awsProfilesByDomain");
  }
  const storageContent = await browser.storage.local.get({ awsProfiles: {} });
  return Object.values(storageContent.awsProfiles)
    .map(AwsProfile.fromStorage)
    .sort((a, b) => a.title.localeCompare(b.title));
}

// eslint-disable-next-line no-unused-vars
const common = {
  AwsProfile,
  loadAwsProfiles,
  saveAwsProfile,
  saveAwsProfiles,
  removeAwsProfilesForPortalDomain,
};

exports = common;
