const REQUIRED_PERMISSIONS = {
  origins: ["https://*.amazonaws.com/federation/console*"],
};

function extractProfileInfoFromRequest(requestDetails) {
  const url = new URL(requestDetails.url);
  const profileName = url.searchParams.get("role_name");
  const accountId = url.searchParams.get("account_id");
  const originUrl = new URL(requestDetails.originUrl);
  const portalDomain = originUrl.hostname.split(".")[0];
  // The hash part loolk like this /saml/custom/<ACCOUND_ID> (<ACCOUNT_NAME>)/<BASE64_STRING>
  // so we can extract the account name from it
  const [, accountName] = decodeURIComponent(originUrl.hash.split("/")[3]).match(/\((.*)\)$/);

  const profileInfo = {
    portalDomain,
    accountName,
    accountId,
    name: profileName,
    url: requestDetails.originUrl,
    title: `${accountName} - ${profileName}`,
    id: `${portalDomain} - ${accountName} - ${profileName}`,
  };
  return profileInfo;
}

async function signInfoRequestListener(requestDetails) {
  const awsProfile = extractProfileInfoFromRequest(requestDetails);
  await saveAwsProfile(awsProfile);
  return {};
}

async function configureListener() {
  const configuration = (await browser.storage.local.get({ configuration: {} })).configuration;
  const hasPermissions = await browser.permissions.contains(REQUIRED_PERMISSIONS);
  const alreadyRegistered = browser.webRequest.onBeforeRequest.hasListener(signInfoRequestListener);

  if (configuration.autoPopulateUsedProfiles && hasPermissions) {
    if (!alreadyRegistered) {
      browser.webRequest.onBeforeRequest.addListener(signInfoRequestListener, {
        urls: REQUIRED_PERMISSIONS["origins"],
        types: ["xmlhttprequest"],
      });
    }
  } else {
    if (alreadyRegistered) {
      browser.webRequest.onBeforeRequest.removeListener(signInfoRequestListener);
    }
  }
}

async function handleMessage(request) {
  if (request.command == "reloadBackgroundScript") {
    await configureListener();
  }
}

browser.runtime.onMessage.addListener(handleMessage);

// We run immediately the configureListener to be sure this non-persistent page
// is properly registered to be woken up in case of watched webrequests
(async () => {
  await configureListener();
})();
