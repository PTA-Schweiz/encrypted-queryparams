# EncryptedQueryParams

Sample Application to test the final URL size when encrypting query params.

The concept is as follows:

1. Query Params are generated from the form field values
2. the query string is encrypted using AES-GCM 
3. The encrypted query string is then converted to base 64
4. The AES key is wrapped using a RSA public key
5. the resulting key is converted to base64
6. The iv value is converted to base64
7. A link with the following structure is generated: https://host.domain.com/path?data={encryptedData}&key={wrappedKey}&iv={base64Iv}

This implementation uses the standard Browser Cryptography library `SubtleCrypto`. See https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto
