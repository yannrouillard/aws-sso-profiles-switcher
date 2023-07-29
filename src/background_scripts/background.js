const REQUIRED_PERMISSIONS = {
  origins: ["https://*.amazonaws.com/federation/console*"],
};

const decoder = new TextDecoder("utf-8");
const encoder = new TextEncoder();

async function getOrCreateContainerForProfile(profile) {
  const availableContainers = await browser.contextualIdentities.query({ name: profile.title });
  if (availableContainers.length >= 1) {
    return availableContainers[0];
  } else {
    return browser.contextualIdentities.create({
      name: profile.title,
      color: profile.color,
      icon: "briefcase",
    });
  }
}

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

function buildProfileLoginUrl(profile, signInInfo) {
  const destination = signInInfo.destination || "https://console.aws.amazon.com/";
  const queryParameters = new URLSearchParams({
    Action: "login",
    SigninToken: signInInfo.signInToken,
    Issuer: profile.url,
    Destination: destination,
  });
  const loginUrl = `${signInInfo.signInFederationLocation}?${queryParameters.toString()}`;
  return loginUrl;
}

async function saveAwsProfileRequestListener(requestDetails) {
  await saveAwsProfile(extractProfileInfoFromRequest(requestDetails));
}

async function openProfileInContainerRequestListener(requestDetails) {
  const awsProfile = await saveAwsProfile(extractProfileInfoFromRequest(requestDetails));

  if (requestDetails.method != "GET") return {};

  const requestFilterStream = browser.webRequest.filterResponseData(requestDetails.requestId);

  const responseBufferArray = [];
  requestFilterStream.ondata = (event) => {
    responseBufferArray.push(decoder.decode(event.data, { stream: true }));
  };

  requestFilterStream.onstop = async () => {
    const responseData = responseBufferArray.join("");
    try {
      const signInInfo = JSON.parse(responseData);
      const url = buildProfileLoginUrl(awsProfile, signInInfo);
      const container = await getOrCreateContainerForProfile(awsProfile);
      const currentTab = await browser.tabs.get(requestDetails.tabId);
      await Promise.all([
        browser.tabs.create({
          url,
          cookieStoreId: container.cookieStoreId,
          index: currentTab.index,
        }),
        browser.tabs.remove(requestDetails.tabId),
      ]);
    } catch {
      // If anything goes wrong, we passthrough to avoid blocking anything
      requestFilterStream.write(encoder.encode(responseData));
    } finally {
      requestFilterStream.close();
    }
  };
  return {};
}

async function configureListener() {
  // We reset the state before re-configuring
  [saveAwsProfileRequestListener, openProfileInContainerRequestListener].forEach((listener) => {
    if (browser.webRequest.onBeforeRequest.hasListener(listener)) {
      browser.webRequest.onBeforeRequest.removeListener(listener);
    }
  });
  if (!(await browser.permissions.contains(REQUIRED_PERMISSIONS))) {
    return;
  }

  const configuration = (await browser.storage.local.get({ configuration: {} })).configuration;

  if (configuration.openProfileInDedicatedContainer && configuration.autoPopulateUsedProfiles) {
    browser.webRequest.onBeforeRequest.addListener(
      openProfileInContainerRequestListener,
      {
        urls: REQUIRED_PERMISSIONS["origins"],
        types: ["xmlhttprequest"],
      },
      ["blocking"]
    );
  } else if (configuration.autoPopulateUsedProfiles) {
    // The openProfileInContainerRequestListener will also save any aws profile encountered
    // so we only enable the saveAwsProfileRequestListener one if the listener
    // openProfileInContainerRequestListener is not set
    browser.webRequest.onBeforeRequest.addListener(saveAwsProfileRequestListener, {
      urls: REQUIRED_PERMISSIONS["origins"],
      types: ["xmlhttprequest"],
    });
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
