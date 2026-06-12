const { withDangerousMod, withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withAndroidWidgetFiles = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformRoot = config.modRequest.platformProjectRoot;

      // Source paths
      const widgetSrcDir = path.join(projectRoot, 'widget/android');
      
      // Destination paths
      const javaDestDir = path.join(platformRoot, 'app/src/main/java/com/ushanshakya/sharedcanvas');
      const xmlDestDir = path.join(platformRoot, 'app/src/main/res/xml');
      const layoutDestDir = path.join(platformRoot, 'app/src/main/res/layout');

      // Helper to copy file
      const copyFile = (src, dest) => {
        if (fs.existsSync(src)) {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(src, dest);
          console.log(`[withAndroidWidget] Copied ${path.basename(src)} -> ${dest}`);
        } else {
          console.warn(`[withAndroidWidget] Source file not found: ${src}`);
        }
      };

      // Copy Kotlin files
      copyFile(path.join(widgetSrcDir, 'WidgetReceiver.kt'), path.join(javaDestDir, 'WidgetReceiver.kt'));
      copyFile(path.join(widgetSrcDir, 'WidgetConfigurationActivity.kt'), path.join(javaDestDir, 'WidgetConfigurationActivity.kt'));

      // Copy XML resource files
      copyFile(path.join(widgetSrcDir, 'res/xml/widget_info.xml'), path.join(xmlDestDir, 'widget_info.xml'));
      copyFile(path.join(widgetSrcDir, 'res/layout/widget_layout.xml'), path.join(layoutDestDir, 'widget_layout.xml'));

      return config;
    },
  ]);
};

const withAndroidWidgetManifest = (config) => {
  return withAndroidManifest(config, async (config) => {
    const mainApplication = config.modResults.manifest.application[0];
    
    // Ensure receivers array exists
    mainApplication.receiver = mainApplication.receiver || [];
    
    // Check if WidgetReceiver is already present to keep it idempotent
    const hasReceiver = mainApplication.receiver.some(
      (r) => r.$['android:name'] === '.WidgetReceiver'
    );
    
    if (!hasReceiver) {
      mainApplication.receiver.push({
        $: {
          'android:name': '.WidgetReceiver',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } },
              { $: { 'android:name': 'com.ushanshakya.sharedcanvas.APPWIDGET_REFRESH' } },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.appwidget.provider',
              'android:resource': '@xml/widget_info',
            },
          },
        ],
      });
      console.log('[withAndroidWidget] Added WidgetReceiver to AndroidManifest.xml');
    }

    // Ensure activities array exists
    mainApplication.activity = mainApplication.activity || [];
    
    // Check if WidgetConfigurationActivity is already present
    const hasConfigActivity = mainApplication.activity.some(
      (a) => a.$['android:name'] === '.WidgetConfigurationActivity'
    );

    if (!hasConfigActivity) {
      mainApplication.activity.push({
        $: {
          'android:name': '.WidgetConfigurationActivity',
          'android:exported': 'true',
          'android:theme': '@style/Theme.AppCompat.Light.Dialog', // Simple dialog theme for setup
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.appwidget.action.APPWIDGET_CONFIGURE' } },
            ],
          },
        ],
      });
      console.log('[withAndroidWidget] Added WidgetConfigurationActivity to AndroidManifest.xml');
    }

    return config;
  });
};

module.exports = function withAndroidWidget(config) {
  config = withAndroidWidgetFiles(config);
  config = withAndroidWidgetManifest(config);
  return config;
};
