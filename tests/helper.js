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

const buildStorageContentForDomains = (...domains) => {
  const colors = ["blue", "turquoise", "green", "yellow", "orange", "red", "pink", "purple"];
  const storageContent = { awsProfiles: {} };
  domains.forEach((domain, index) => {
    const profiles = [
      {
        accountName: "Development",
        accountId: "987654321098",
        color: colors[4 * index],
        name: "AdministratorAccess",
        portalDomain: domain,
        title: "Development - AdministratorAccess",
        url: `https://${domain}.awsapps.com/start/#/saml/custom/987654321098%20%28Development%29/OTg3NjU0MzIxMDk4X2lucy1hMTIzYmM0NWU2NzhkOTAxX3AtMjNhNGI1YzY3ODlkMGUxZg%3D%3D`,
        id: `${domain} - Development - AdministratorAccess`,
      },
      {
        accountName: "Production",
        accountId: "123456789012",
        color: colors[4 * index + 1],
        name: "AdministratorAccess",
        portalDomain: domain,
        title: "Production - AdministratorAccess",
        url: `https://${domain}.awsapps.com/start/#/saml/custom/123456789012%20%28Production%29/MTIzNDU2Nzg5MDEyX2lucy1jMjQ2ZGY4OWUwMTJhYjM1X3AtOTg3NmEyYjM5NDBjNWQ2ZQ%3D%3D`,
        id: `${domain} - Production - AdministratorAccess`,
      },
      {
        accountName: "Root",
        accountId: "234567890123",
        color: colors[4 * index + 2],
        name: "AdministratorAccess",
        portalDomain: domain,
        title: "Root - AdministratorAccess",
        url: `https://${domain}.awsapps.com/start/#/saml/custom/234567890123%20%28Root%29/MjM0NTY3ODkwMTIzX2lucy1kMTM1YWM1N2UyNDZiODAzX3AtMTAyOWEzYjQ4NTBjNmQ3ZQ%3D%3D`,
        id: `${domain} - Root - AdministratorAccess`,
      },
      {
        accountName: "Root",
        accountId: "234567890123",
        color: colors[4 * index + 3],
        name: "ReadOnlyAccess",
        portalDomain: domain,
        title: "Root - ReadOnlyAccess",
        url: `https://${domain}.awsapps.com/start/#/saml/custom/234567890123%20%28Root%29/MjM0NTY3ODkwMTIzX2lucy1kMTM1YWM1N2UyNDZiODAzX3AtNWExYjJjM2Q0ZTVmNmc3aA%3D%3D`,
        id: `${domain} - Root - ReadOnlyAccess`,
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

  let currentTab = { url: tabUrl };
  let containers = [];
  let registeredListener = null;
  let filterResponseDataCallbacks = {};

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
      },
    },
    tabs: {
      create: async ({ url, cookieStoreId }) => {
        Object.assign(currentTab, { url, cookieStoreId });
      },
      query: async () => {
        return [currentTab];
      },
      getCurrent: () => {
        return currentTab;
      },
      remove: async () => {},
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

  dom.injectScripts = async (scripts, { waitCondition, waitTimeout } = {}) => {
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
    await waitForCondition(waitCondition, waitTimeout);
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
