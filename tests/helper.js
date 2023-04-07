const { JSDOM } = require("jsdom");

const buildStorageContentForDomains = (...domains) => {
  const storageContent = { awsProfiles: {} };
  domains.forEach((domain) => {
    const profiles = [
      {
        accountName: "Development",
        accountId: "987654321098",
        name: "AdministratorAccess",
        portalDomain: domain,
        title: "Development - AdministratorAccess",
        url: `https://${domain}.awsapps.com/start/#/saml/custom/987654321098%20%28Development%29/OTg3NjU0MzIxMDk4X2lucy1hMTIzYmM0NWU2NzhkOTAxX3AtMjNhNGI1YzY3ODlkMGUxZg%3D%3D`,
        id: `${domain} - Development - AdministratorAccess`,
      },
      {
        accountName: "Production",
        accountId: "123456789012",
        name: "AdministratorAccess",
        portalDomain: domain,
        title: "Production - AdministratorAccess",
        url: `https://${domain}.awsapps.com/start/#/saml/custom/123456789012%20%28Production%29/MTIzNDU2Nzg5MDEyX2lucy1jMjQ2ZGY4OWUwMTJhYjM1X3AtOTg3NmEyYjM5NDBjNWQ2ZQ%3D%3D`,
        id: `${domain} - Production - AdministratorAccess`,
      },
      {
        accountName: "Root",
        accountId: "234567890123",
        name: "AdministratorAccess",
        portalDomain: domain,
        title: "Root - AdministratorAccess",
        url: `https://${domain}.awsapps.com/start/#/saml/custom/234567890123%20%28Root%29/MjM0NTY3ODkwMTIzX2lucy1kMTM1YWM1N2UyNDZiODAzX3AtMTAyOWEzYjQ4NTBjNmQ3ZQ%3D%3D`,
        id: `${domain} - Root - AdministratorAccess`,
      },
      {
        accountName: "Root",
        accountId: "234567890123",
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
  let registeredListener = null;

  return {
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
      query: async () => {
        return [{ url: tabUrl }];
      },
    },
    runtime: {
      onMessage: {
        addListener: () => {},
      },
    },
    webRequest: {
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
          while (!registeredListener) {
            await new Promise((r) => setTimeout(r, 50));
          }
          return registeredListener;
        },
      },
    },
  };
};

const mockBrowserStorage = (storage = {}) => {
  const storageContent = structuredClone(storage);

  return {
    get: async (keys) => {
      if (keys === undefined || keys === null) return storageContent;
      if (typeof keys === "string") {
        return Object.prototype.hasOwnProperty.call(storageContent, keys)
          ? { [keys]: storageContent[keys] }
          : {};
      }
      if (typeof keys === "object") {
        const result = {};
        Object.keys(keys).forEach((key) => {
          result[key] = Object.prototype.hasOwnProperty.call(storageContent, key)
            ? storageContent[key]
            : keys[key];
        });
        return result;
      }
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
  const { window } = await JSDOM.fromFile(htmlFile, {
    runScripts: "dangerously",
    resources: "usable",
    url,
  });

  window.matchMedia = () => {
    return { matches: true };
  };

  window.browser = createFakeBrowser(browserStorage, tabUrl);
  return window;
};

module.exports = {
  createFakePage,
  createFakeBrowser,
  buildStorageContentForDomains,
  mockBrowserStorage,
};
