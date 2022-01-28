import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import * as faker from 'faker';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit{
  title = 'EncryptedQueryParams';
  formGroup: FormGroup;

  onDestroy = new Subject<void>();
  queryString = ''
  rawLength = 0;
  base64StringBeforeEncryption = "";
  byteArrayBeforeEncryption = new Uint8Array();

  byteArrayAfterEncryption = new Uint8Array();
  encryptedBase64 = "";
  aesKeyBase64 = ""
  privateKeyBase64 = "";
  encoder = new TextEncoder();

  publicKey?: CryptoKey;
  aesKey?: CryptoKey;
  wrappedKeyBase64 = '';
  ivBase64 = '';
  url = '';

  constructor(private builder: FormBuilder) {
    faker.setLocale('es');
    this.formGroup = builder.group({
      gender: new FormControl(''),
      firstName: new FormControl(''),
      lastName: new FormControl(''),
      street: new FormControl(''),
      postalCode: new FormControl(''),
      city: new FormControl(''),
      addressLine1: new FormControl(''),
      addressLine2: new FormControl(''),
      birthDate: new FormControl(''),
      nationality: new FormControl(''),
      phone: new FormControl(''),
      mobile: new FormControl(''),
      email: new FormControl(''),
      correspondenceLanguage: new FormControl(''),
    });

    window.crypto.subtle.importKey(
      "spki",
      this.convertPemToBinary(
        "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4R9L578Mfy9QOKLY99pw" +
        "gyy47tFzGWocbJvTLjoUMBfi2fU1H8WKzp5FQtppkLn8/6YnE5icYhzEmT3vN+Q2" +
        "Pq+EkfC44n6Ja/x0SwvT69yxT42CPISthxEbwvgHNvmQEwP7B2zVsB950l/q2GjV" +
        "WB+fGGN2ZO8YnYR13A8FJScZVCwnMybRUyzq/3zB+evuGpy3JnsPT+XgxMo8IIFW" +
        "gwdKYmRPcApjyghSuk6QygkccoBAimw2eM8h6HqWJ4bWCeEbePWUuQK7Q2Wyfhsu" +
        "XBNA4BB5kkBu1BSyIxnWIpYnHpIUV5raS2nAgM6rHQ9iAScMp6KX7LM/Xtl3t2py" +
        "AQIDAQAB"),
        {   //these are the algorithm options
          name: "RSA-OAEP",
          hash: {name: "SHA-256"}, //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
        },
      true,
      ["encrypt", "wrapKey"]).then(
      (key) => {
        this.publicKey = key;
        this.generateWrappedKey();
      }
    );
    window.crypto.subtle.generateKey(
      {
        name: "AES-CBC",
        length: 256,
      },
      true,
      ["encrypt", "decrypt"]).then(
      (key) => {
        this.aesKey = key;
        this.generateWrappedKey();
      }
    );

  }

  ngOnInit(): void {
    this.formGroup.valueChanges.pipe(
      takeUntil(this.onDestroy)
    ).subscribe(value => {
      this.queryString = new URLSearchParams(value).toString();
      this.rawLength = this.queryString.length;

      this.byteArrayBeforeEncryption = this.encoder.encode(this.queryString);
      this.base64StringBeforeEncryption = this.toBase64(this.byteArrayBeforeEncryption);

      if (this.aesKey) {
        this.encryptMessage(this.aesKey).then(() =>{
          this.generateUrl();
        });
      }

    });

  }


  generateValues() {
    let values = {
      gender: faker.name.gender(),
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      street: faker.address.streetAddress(),
      postalCode: faker.address.zipCode(),
      city: faker.address.city(),
      addressLine1: faker.address.secondaryAddress(),
      addressLine2: faker.address.secondaryAddress(),
      birthDate: faker.date.past().toISOString(),
      nationality: faker.address.countryCode(),
      phone: faker.phone.phoneNumber(),
      mobile: faker.phone.phoneNumber(),
      email: faker.internet.email(),
      correspondenceLanguage: faker.locale
    }
    this.formGroup.patchValue(values);

  }

  private toBase64(byteArray: Uint8Array): string {
    let result = '';
    for (let i = 0; i < byteArray.byteLength; i++) {
      result += String.fromCharCode(byteArray[i]);
    }
    return btoa(result);
  }


  async encryptMessage(key: CryptoKey) {
    let iv = window.crypto.getRandomValues(new Uint8Array(16));
    let encrypted: ArrayBuffer = await window.crypto.subtle.encrypt(
      {
        name: "AES-CBC",
        iv
      },
      key,
      this.byteArrayBeforeEncryption
    );
    this.ivBase64 = this.toBase64(iv);
    window.crypto.subtle.exportKey('raw', key).then(
      exp => this.aesKeyBase64 = this.toBase64(new Uint8Array(exp))
    );
    this.encryptedBase64 = this.toBase64(new Uint8Array(encrypted, 0, encrypted.byteLength));
  }

  async generateWrappedKey() {
    if(!(this.aesKey && this.publicKey)) { return; }
    let keyData: ArrayBuffer = await window.crypto.subtle.wrapKey(
      "raw",
      this.aesKey,
      this.publicKey,
      {
        name: "RSA-OAEP"
      }
    )
    this.wrappedKeyBase64 = this.toBase64(new Uint8Array(keyData, 0, keyData.byteLength));
  }

  generateUrl() {
    let qp = new URLSearchParams({
      data: this.encryptedBase64,
      key: this.wrappedKeyBase64,
      iv: this.ivBase64,
      source: 'zuerich-kzp',
      externalId: '49038823'
    }).toString();
    this.url = 'https://vtr.orion.ch/offers/new?' + qp;
  }

  convertPemToBinary(pem: string) {
/*    var lines = pem.split('\n')
    var encoded = ''
    for(var i = 0;i < lines.length;i++){
      if (lines[i].trim().length > 0 &&
        lines[i].indexOf('-BEGIN RSA PRIVATE KEY-') < 0 &&
        lines[i].indexOf('-BEGIN RSA PUBLIC KEY-') < 0 &&
        lines[i].indexOf('-END RSA PRIVATE KEY-') < 0 &&
        lines[i].indexOf('-END RSA PUBLIC KEY-') < 0) {
        encoded += lines[i].trim()
      }
    }*/
    "-----BEGIN RSA PRIVATE KEY-----\n" +
    "MIIEpQIBAAKCAQEA4R9L578Mfy9QOKLY99pwgyy47tFzGWocbJvTLjoUMBfi2fU1\n" +
    "H8WKzp5FQtppkLn8/6YnE5icYhzEmT3vN+Q2Pq+EkfC44n6Ja/x0SwvT69yxT42C\n" +
    "PISthxEbwvgHNvmQEwP7B2zVsB950l/q2GjVWB+fGGN2ZO8YnYR13A8FJScZVCwn\n" +
    "MybRUyzq/3zB+evuGpy3JnsPT+XgxMo8IIFWgwdKYmRPcApjyghSuk6QygkccoBA\n" +
    "imw2eM8h6HqWJ4bWCeEbePWUuQK7Q2WyfhsuXBNA4BB5kkBu1BSyIxnWIpYnHpIU\n" +
    "V5raS2nAgM6rHQ9iAScMp6KX7LM/Xtl3t2pyAQIDAQABAoIBADspZWJO4/LctUFd\n" +
    "EpX4Uw82BpfEdXIdX8DvJo2Ed9+3t0c+WKqz2Gm6UEtkaM+/AQ0SVjyhI5/pHYWE\n" +
    "METI9bR9neJYl832IRk+7DT4s8XNZs+YSbyrxYq0ZU5Urli1Nza4GhV2daXmb7Zo\n" +
    "vKgIzOBu1vmq0eduqlJjCDI/xENhx8bcxDKmvffrAa7WBjNQ3LB+FyyLS7qr0UFC\n" +
    "uZd4qcg5FIsF5Ejo1tLo5VTWUBuShP1OpcviLyeK23yzCnRIhG1m8JWVwGlrXeOJ\n" +
    "IJUpbfIr7/2SMfHQ872/2UPUFconpJWmyRidwWpjaXj2RTKiTq2Ult//tmwQkdlz\n" +
    "2kbAQ80CgYEA+2weRS7noDPpLzhGbFUYvWlCKkLZnQDsvv81/zcD91mTbq8HLP8t\n" +
    "hmaN6Wjh/ILWV7otNIaL5YN90ktubQqiHYHuVYGzRx3bedz1aOAlTRd1GNqrZxiY\n" +
    "tTV89vF1L9VJsCr5YnCfhFONUPmuyCNdTYavDkvd/LeWOTI6vMYh3dMCgYEA5TiX\n" +
    "5I1WRCckjhqaTufM7rT4Calm6Jw9/0lY6ySk4EVecWDGGTLRuIt7HwwiWZjs3ss0\n" +
    "9gI90vn0eJHoGT+SOxTWVsbIcwupPDbQi0f84RSrNFIehUxaCdB7Wx5rRBfMGreO\n" +
    "TxEMdV+VY3e6vFxLfC9jMTqJ33r9CdSZzKqGCFsCgYEA5J5+s/gfxOwPKNHqL439\n" +
    "rhZthNI+4OY7YL3ektCq+ZtpVacwRjlPYzwT5N9rRtqOHz16551EzpGPss7Gfb7C\n" +
    "hURlvTjwFUXQEfLa8N+I653d65jDbT7PdU9K753GKpWuqNOa62lvk7sJ8EzqIrEN\n" +
    "oXZL7hsMo0UpA59qC8e6eeMCgYEAi358WVd19zXG9j/URk6klWRGSkLwYICs7g3p\n" +
    "8fez6tPsXJ0jETSvElq3y7YrtVDuXctWaJwGmb0JfNJ2Z98bE59jrR194R1omT9W\n" +
    "fFyL1UIpykZrUn2bkbtxRotlhePhjyTDkvRyG3/WvtifKIAWY/XGrK/ONdV35iKe\n" +
    "kkH4HV8CgYEA8ybhgjJM2k453D5l7Wr/DvnK0P34GlUfBkKbqbgIzxWzCOWiKofM\n" +
    "nktQrJ4GVHhNVEpcBo4Pik5pfOTP9vvOY9aDbG5XrR1/PiB7SaAtA7GaUZfRazEF\n" +
    "R7P+j+LRSy/Eg9qQtxswiFvJqCUWy8qbmhCAvwAqsVZWtfmKqp3apig=\n" +
    "-----END RSA PRIVATE KEY-----\n";
    return this.base64StringToArrayBuffer(pem)
  }

  base64StringToArrayBuffer(b64str: string) {
    var byteStr = atob(b64str)
    var bytes = new Uint8Array(byteStr.length)
    for (var i = 0; i < byteStr.length; i++) {
      bytes[i] = byteStr.charCodeAt(i)
    }
    return bytes.buffer
  }
}
