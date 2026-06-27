

module.exports = {
  packagerConfig: {
    name: 'OnPopup',
    executableName: 'OnPopup',
    appBundleId: 'com.onpopup.app',
    asar: { unpack: "assets/**" },
    icon: './assets/icon', // Resolves to icon.icns on macOS and icon.ico on Windows
  },
  rebuildConfig: {},

  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'onpopup',
        setupIcon: './assets/icon.ico',
        setupExe: 'OnPopupSetup.exe',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        name: 'OnPopup Installation',
        icon: './assets/icon.icns',
        overwrite: true,
      },
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],


  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    }
  ],
};
