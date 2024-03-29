const { TextEncoder, TextDecoder } = require("util");

const { JSDOM } = require("jsdom");

const sleep = async (ms) => {
  await new Promise((r) => setTimeout(r, ms));
};

const currentTime = () => new Date().getTime();

const waitForCondition = async (condition, timeout = 1000) => {
  if (!condition) return;
  const startTime = currentTime();
  while (!(await condition()) && currentTime() < startTime + timeout) {
    await sleep(50);
  }
};

const testAccountInfos = {
  Development: {
    accountId: "987654321098",
    profileHashes: {
      AdministratorAccess: "OTg3NjU0MzIxMDk4X2lucy1hMTIzYmM0NWU2NzhkOTAxX3AtMjNhNGI1YzY3ODlkMGUxZg",
    },
  },
  Production: {
    accountId: "123456789012",
    profileHashes: {
      AdministratorAccess: "MTIzNDU2Nzg5MDEyX2lucy1jMjQ2ZGY4OWUwMTJhYjM1X3AtOTg3NmEyYjM5NDBjNWQ2ZQ",
    },
  },
  Root: {
    accountId: "234567890123",
    profileHashes: {
      AdministratorAccess: "MjM0NTY3ODkwMTIzX2lucy1kMTM1YWM1N2UyNDZiODAzX3AtMTAyOWEzYjQ4NTBjNmQ3ZQ",
      ReadOnlyAccess: "MjM0NTY3ODkwMTIzX2lucy1kMTM1YWM1N2UyNDZiODAzX3AtNWExYjJjM2Q0ZTVmNmc3aA",
    },
  },
};

const buildProfileUrl = (portalStyle, domain, accountName, profileName) => {
  const accountId = testAccountInfos[accountName].accountId;
  const profileHash = testAccountInfos[accountName].profileHashes[profileName];
  if (portalStyle == "legacy") {
    return `https://${domain}.awsapps.com/start/#/saml/custom/${accountId}%20%28${accountName}%29/${profileHash}%3D%3D`;
  } else {
    return `https://${domain}.awsapps.com/start/#/console?account_id=${accountId}&role_name=${profileName}`;
  }
};

const buildStorageContentForDomains = (portalStyle, ...domains) => {
  const colors = ["blue", "turquoise", "green", "yellow", "orange", "red", "pink", "purple"];
  const storageContent = { awsProfiles: {} };
  domains.forEach((domain, index) => {
    const profiles = [
      {
        accountName: "Development",
        accountId: testAccountInfos["Development"].accountId,
        color: colors[4 * index],
        name: "AdministratorAccess",
        portalDomain: domain,
        title: "Development - AdministratorAccess",
        url: buildProfileUrl(portalStyle, domain, "Development", "AdministratorAccess"),
        id: `${domain} - Development - AdministratorAccess`,
      },
      {
        accountName: "Root",
        accountId: testAccountInfos["Root"].accountId,
        color: colors[4 * index + 2],
        name: "AdministratorAccess",
        portalDomain: domain,
        title: "Root - AdministratorAccess",
        url: buildProfileUrl(portalStyle, domain, "Root", "AdministratorAccess"),
        id: `${domain} - Root - AdministratorAccess`,
      },
      {
        accountName: "Root",
        accountId: testAccountInfos["Root"].accountId,
        color: colors[4 * index + 3],
        name: "ReadOnlyAccess",
        portalDomain: domain,
        title: "Root - ReadOnlyAccess",
        url: buildProfileUrl(portalStyle, domain, "Root", "ReadOnlyAccess"),
        id: `${domain} - Root - ReadOnlyAccess`,
      },
      {
        accountName: "Production",
        accountId: testAccountInfos["Production"].accountId,
        color: colors[4 * index + 1],
        name: "AdministratorAccess",
        portalDomain: domain,
        title: "Production - AdministratorAccess",
        url: buildProfileUrl(portalStyle, domain, "Production", "AdministratorAccess"),
        id: `${domain} - Production - AdministratorAccess`,
      },
    ];
    profiles.forEach((profile) => {
      storageContent.awsProfiles[profile.id] = profile;
    });
  });

  return storageContent;
};

const createFakeBrowser = (browserStorage, tabUrl) => {
  const encoder = new TextEncoder();

  let nextAvailableTabId = 1;
  let currentTab = { url: tabUrl, id: 0 };
  let allTabs = [currentTab];
  let containers = [];
  let registeredListener = null;
  let filterResponseDataCallbacks = {};

  const returnTabWithIndex = (tab) => {
    return Object.assign({ index: allTabs.indexOf(tab) }, tab);
  };

  return {
    contextualIdentities: {
      query: (queryFilter) => containers.filter((c) => !queryFilter || c.name == queryFilter.name),
      create: (containerSpec) => {
        const newContainer = Object.assign(
          { cookieStoreId: `firefox-container-${containers.length + 1}` },
          containerSpec
        );
        containers.push(newContainer);
        return newContainer;
      },
    },
    permissions: {
      contains: async () => true,
    },
    storage: {
      local: browserStorage || mockBrowserStorage(),
      onChanged: {
        removeListener: () => {},
        addListener: () => {},
      },
    },
    tabs: {
      get: async (tabId) => {
        const foundTabs = allTabs.filter((t) => t.id == tabId);
        return returnTabWithIndex(foundTabs[0]);
      },
      create: async ({ url, cookieStoreId, index }) => {
        index = index || allTabs.length;
        currentTab = { url, cookieStoreId, id: nextAvailableTabId };
        nextAvailableTabId += 1;
        allTabs.splice(index, 0, currentTab);
      },
      query: async () => {
        return [returnTabWithIndex(currentTab)];
      },
      getCurrent: () => {
        return returnTabWithIndex(currentTab);
      },
      remove: async (tabId) => {
        allTabs = allTabs.filter((t) => t.id !== tabId);
      },
    },
    runtime: {
      onMessage: {
        addListener: () => {},
      },
    },
    webRequest: {
      sendResponseDataToFilter: async (responseData) => {
        filterResponseDataCallbacks.ondata({ data: encoder.encode(responseData) });
        await filterResponseDataCallbacks.onstop();
      },
      filterResponseData: () => {
        return {
          set ondata(callback) {
            filterResponseDataCallbacks.ondata = callback;
          },
          set onstop(callback) {
            filterResponseDataCallbacks.onstop = callback;
          },
          close: () => {},
          write: () => {},
        };
      },
      onBeforeRequest: {
        addListener: (listener) => {
          registeredListener = listener;
        },
        getListener: () => {
          return registeredListener;
        },
        hasListener: (listener) => {
          return registeredListener === listener;
        },
        waitForListener: async () => {
          await waitForCondition(() => registeredListener);
          return registeredListener;
        },
        triggerListener: async (requestDetails) => {
          return await registeredListener(requestDetails);
        },
      },
    },
  };
};

const mockBrowserStorage = (storage = {}) => {
  const storageContent = structuredClone(storage);

  return {
    get: async (keys) => {
      let result = {};
      if (keys === undefined || keys === null) {
        result = storageContent;
      } else if (typeof keys === "string") {
        result = Object.prototype.hasOwnProperty.call(storageContent, keys)
          ? { [keys]: storageContent[keys] }
          : {};
      } else if (typeof keys === "object") {
        Object.keys(keys).forEach((key) => {
          result[key] = Object.prototype.hasOwnProperty.call(storageContent, key)
            ? storageContent[key]
            : keys[key];
        });
      }
      return structuredClone(result);
    },
    set: async (value) => {
      Object.assign(storageContent, value);
    },
  };
};

const createFakePage = async (
  htmlFile,
  { url, browserStorage, tabUrl = "https://fakeurl/" } = {}
) => {
  const dom = await JSDOM.fromFile(htmlFile, {
    runScripts: "dangerously",
    resources: "usable",
    includeNodeLocations: true,
    url,
  });

  dom.window.matchMedia = () => {
    return { matches: true };
  };

  dom.injectScripts = async (scripts) => {
    const scriptLoaders = scripts.map(
      (script) =>
        new Promise((resolve) => {
          const scriptElement = dom.window.document.createElement("script");
          scriptElement.src = script;
          scriptElement.onload = resolve;
          dom.window.document.body.appendChild(scriptElement);
        })
    );
    await Promise.all(scriptLoaders);
  };

  // Workaround the issue that jsdom doesn't define these 2 ones
  // see https://github.com/jsdom/jsdom/issues/2524
  dom.window.TextDecoder = TextDecoder;
  dom.window.TextEncoder = TextEncoder;

  dom.window.browser = createFakeBrowser(browserStorage, tabUrl);
  return dom;
};

module.exports = {
  createFakePage,
  createFakeBrowser,
  buildStorageContentForDomains,
  mockBrowserStorage,
  waitForCondition,
};
