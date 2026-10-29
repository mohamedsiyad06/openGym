#!/usr/bin/env python3
# Prints the SHA-256 of the signing certificate in an APK's v2 (or v3) signature block, lowercase
# hex: the same number `keytool -list -v` shows for a keystore's key, without the colons. Used by
# .github/workflows/phone-apk.yml to refuse an APK signed with any key but ci/debug.keystore.
import hashlib, struct, sys

data = open(sys.argv[1], 'rb').read()
eocd = data.rfind(b'PK\x05\x06')
cd_off = struct.unpack('<I', data[eocd + 16:eocd + 20])[0]
if data[cd_off - 16:cd_off] != b'APK Sig Block 42':
    sys.exit('no v2 signature block')
size = struct.unpack('<Q', data[cd_off - 24:cd_off - 16])[0]
blk = data[cd_off - size - 8 + 8:cd_off - 24]

def lp(b, o):
    n = struct.unpack('<I', b[o:o + 4])[0]
    return b[o + 4:o + 4 + n], o + 4 + n

found = {}
i = 0
while i < len(blk):
    ln = struct.unpack('<Q', blk[i:i + 8])[0]
    pid = struct.unpack('<I', blk[i + 8:i + 12])[0]
    if pid in (0x7109871a, 0xf05368c0):  # v2, v3
        val = blk[i + 12:i + 8 + ln]
        signers, _ = lp(val, 0)
        signer, _ = lp(signers, 0)
        signed, _ = lp(signer, 0)
        _, o = lp(signed, 0)          # digests
        certs, _ = lp(signed, o)
        cert, _ = lp(certs, 0)
        found[pid] = hashlib.sha256(cert).hexdigest()
    i += 8 + ln
if not found:
    sys.exit('no v2 or v3 signer')
print(found.get(0x7109871a) or found.get(0xf05368c0))
