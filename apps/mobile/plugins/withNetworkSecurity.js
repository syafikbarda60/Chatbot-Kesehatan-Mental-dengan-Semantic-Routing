// MASVS-NETWORK-1/2 for Android release builds: no cleartext HTTP anywhere, and the backend's
// public key is pinned, so a certificate that is merely "trusted" (a CA installed on the
// phone, a mis-issued cert) is still refused. Debug builds keep cleartext so `expo run`
// and Metro on http://10.0.2.2:8081 still work. Expo Go is unaffected (it is another app).
//
// Options (app.json): domain — backend host; pins — base64 SHA-256 SPKI hashes, the live key
// first and an offline backup key second; caCert — optional CA file for a private staging CA;
// pinExpiration — after this date Android stops enforcing the pins rather than bricking an
// app that was never updated.
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const HEADER = '<?xml version="1.0" encoding="utf-8"?>\n';

module.exports = function withNetworkSecurity(config, { domain, pins, caCert, pinExpiration }) {
  if (!domain || !pins || pins.length < 2) throw new Error('withNetworkSecurity: domain and two pins (live + backup) are required');
  config = withDangerousMod(config, ['android', async (cfg) => {
    const main = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res');
    const debug = path.join(cfg.modRequest.platformProjectRoot, 'app/src/debug/res/xml');
    fs.mkdirSync(path.join(main, 'xml'), { recursive: true });
    fs.mkdirSync(debug, { recursive: true });
    let anchors = '<certificates src="system"/>';
    if (caCert) {
      fs.mkdirSync(path.join(main, 'raw'), { recursive: true });
      fs.copyFileSync(path.join(cfg.modRequest.projectRoot, caCert), path.join(main, 'raw/backend_ca.crt'));
      anchors = '<certificates src="@raw/backend_ca"/>';
    }
    const pinSet = pins.map((p) => `      <pin digest="SHA-256">${p}</pin>`).join('\n');
    fs.writeFileSync(path.join(main, 'xml/network_security_config.xml'), `${HEADER}<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors><certificates src="system"/></trust-anchors>
  </base-config>
  <domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="false">${domain}</domain>
    <trust-anchors>${anchors}</trust-anchors>
    <pin-set${pinExpiration ? ` expiration="${pinExpiration}"` : ''}>
${pinSet}
    </pin-set>
  </domain-config>
</network-security-config>
`);
    // Same resource name under src/debug overrides the release one for debug builds only
    fs.writeFileSync(path.join(debug, 'network_security_config.xml'), `${HEADER}<network-security-config>
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors><certificates src="system"/><certificates src="user"/></trust-anchors>
  </base-config>
</network-security-config>
`);
    return cfg;
  }]);
  return withAndroidManifest(config, (cfg) => {
    cfg.modResults.manifest.application[0].$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return cfg;
  });
};
