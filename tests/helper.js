const { JSDOM } = require("jsdom");

const buildStorageContentForDomains = (...domains) => {
  const storageContent = { awsProfilesByDomain: {} };
  domains.forEach((domain) => {
    storageContent.awsProfilesByDomain[domain] = {
      awsProfilesByAccount: {
        Development: {
          awsProfilesByName: {
            AdministratorAccess: {
              accountName: "Development",
              name: "AdministratorAccess",
              portalDomain: domain,
              title: "Development - AdministratorAccess",
              url: `https://${domain}.awsapps.com/start/#/saml/custom/987654321098%20%28Development%29/OTg3NjU0MzIxMDk4X2lucy1hMTIzYmM0NWU2NzhkOTAxX3AtMjNhNGI1YzY3ODlkMGUxZg%3D%3D`,
            },
          },
        },
        Production: {
          awsProfilesByName: {
            AdministratorAccess: {
              accountName: "Production",
              name: "AdministratorAccess",
              portalDomain: domain,
              title: "Production - AdministratorAccess",
              url: `https://${domain}.awsapps.com/start/#/saml/custom/123456789012%20%28Production%29/MTIzNDU2Nzg5MDEyX2lucy1jMjQ2ZGY4OWUwMTJhYjM1X3AtOTg3NmEyYjM5NDBjNWQ2ZQ%3D%3D`,
            },
          },
        },
        Root: {
          awsProfilesByName: {
            AdministratorAccess: {
              accountName: "Root",
              name: "AdministratorAccess",
              portalDomain: domain,
              title: "Root - AdministratorAccess",
              url: `https://${domain}.awsapps.com/start/#/saml/custom/234567890123%20%28Root%29/MjM0NTY3ODkwMTIzX2lucy1kMTM1YWM1N2UyNDZiODAzX3AtMTAyOWEzYjQ4NTBjNmQ3ZQ%3D%3D`,
            },
            ReadOnlyAccess: {
              accountName: "Root",
              name: "ReadOnlyAccess",
              portalDomain: domain,
              title: "Root - ReadOnlyAccess",
              url: `https://${domain}.awsapps.com/start/#/saml/custom/234567890123%20%28Root%29/MjM0NTY3ODkwMTIzX2lucy1kMTM1YWM1N2UyNDZiODAzX3AtNWExYjJjM2Q0ZTVmNmc3aA%3D%3D`,
            },
          },
        },
      },
    };
  });
  return storageContent;
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

  window.browser = {
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
  };

  return window;
};

module.exports = {
  createFakePage,
  buildStorageContentForDomains,
  mockBrowserStorage,
};
