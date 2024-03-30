const REQUIRED_PERMISSIONS = {
  origins: ["https://*.amazonaws.com/federation/console*"],
};

const decoder = new TextDecoder("utf-8");
const encoder = new TextEncoder();

async function getOrCreateContainerForProfile(profile) {
  const availableContainers = await browser.contextualIdentities.query({ name: profile.title });
  if (availableContainers.length >= 1) {
    let container = availableContainers[0];
    // We fix the container color on the way if it has been changed so it matches the profile
    if (profile.color && container.color !== profile.color) {
      container = await browser.contextualIdentities.update(container.cookieStoreId, {
        color: profile.color,
      });
    }
    return container;
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

  let accountName;
  if (originUrl.href.includes("/saml/custom")) {
    // If the url looks like /saml/custom/<ACCOUND_ID> (<ACCOUNT_NAME>)/<BASE64_STRING>
    // it means we are still one legacy AWS access portal design and we can extract the account name
    // Otherwise we will let if undefined, the real account name will be reconciled at save time
    // if the profile has been loaded by the user from the AWS SSO portal
    // As a final fallback, the AwsProfile class will use the account id instead
    [, accountName] = decodeURIComponent(originUrl.hash.split("/")[3]).match(/\((.*)\)$/);
  }

  return new AwsProfile({
    portalDomain,
    accountId,
    accountName,
    profileName,
    url: requestDetails.originUrl,
  });
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
